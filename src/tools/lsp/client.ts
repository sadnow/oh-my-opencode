import { spawn, type Subprocess } from "bun"
import { readFileSync } from "fs"
import { extname, resolve } from "path"
import { pathToFileURL } from "node:url"
import { getLanguageId } from "./config"
import type { Diagnostic, ResolvedServer } from "./types"

interface ManagedClient {
  client: LSPClient
  lastUsedAt: number
  refCount: number
  initPromise?: Promise<void>
  isInitializing: boolean
}

class LSPServerManager {
  private static instance: LSPServerManager
  private clients = new Map<string, ManagedClient>()
  private cleanupInterval: ReturnType<typeof setInterval> | null = null
  private readonly IDLE_TIMEOUT = 5 * 60 * 1000
  private readonly STARTUP_TIMEOUT = 30 * 1000  // 30 seconds for LSP server startup

  private constructor() {
    this.startCleanupTimer()
    this.registerProcessCleanup()
  }

private registerProcessCleanup(): void {
    // Synchronous cleanup for 'exit' event (cannot await)
    const syncCleanup = () => {
      for (const [, managed] of this.clients) {
        try {
          // Fire-and-forget during sync exit - process is terminating
          void managed.client.stop().catch(() => {})
        } catch {}
      }
      this.clients.clear()
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval)
        this.cleanupInterval = null
      }
    }

    // Async cleanup for signal handlers - properly await all stops
    const asyncCleanup = async () => {
      const stopPromises: Promise<void>[] = []
      for (const [, managed] of this.clients) {
        stopPromises.push(managed.client.stop().catch(() => {}))
      }
      await Promise.allSettled(stopPromises)
      this.clients.clear()
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval)
        this.cleanupInterval = null
      }
    }

    process.on("exit", syncCleanup)

    // Don't call process.exit() here - let other handlers complete their cleanup first
    // The background-agent manager handles the final exit call
    // Use async handlers to properly await LSP subprocess cleanup
    process.on("SIGINT", () => void asyncCleanup().catch(() => {}))
    process.on("SIGTERM", () => void asyncCleanup().catch(() => {}))

    // Ctrl+Break - Windows specific
    if (process.platform === "win32") {
      process.on("SIGBREAK", () => void asyncCleanup().catch(() => {}))
    }
  }

  static getInstance(): LSPServerManager {
    if (!LSPServerManager.instance) {
      LSPServerManager.instance = new LSPServerManager()
    }
    return LSPServerManager.instance
  }

  private getKey(root: string, serverId: string): string {
    return `${root}::${serverId}`
  }

  private startCleanupTimer(): void {
    if (this.cleanupInterval) return
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleClients()
    }, 60000)
  }

  private cleanupIdleClients(): void {
    const now = Date.now()
    for (const [key, managed] of this.clients) {
      if (managed.refCount === 0 && now - managed.lastUsedAt > this.IDLE_TIMEOUT) {
        managed.client.stop()
        this.clients.delete(key)
      }
    }
  }

  async getClient(root: string, server: ResolvedServer): Promise<LSPClient> {
    const key = this.getKey(root, server.id)

    let managed = this.clients.get(key)
    if (managed) {
      if (managed.initPromise) {
        await managed.initPromise
      }
      if (managed.client.isAlive()) {
        managed.refCount++
        managed.lastUsedAt = Date.now()
        return managed.client
      }
      await managed.client.stop()
      this.clients.delete(key)
    }

    const client = new LSPClient(root, server)
    
    // Wrap initialization with timeout to prevent indefinite hangs
    const startupPromise = (async () => {
      await client.start()
      await client.initialize()
    })()
    
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`LSP server startup timed out after ${this.STARTUP_TIMEOUT}ms`))
      }, this.STARTUP_TIMEOUT)
    })
    
    const initPromise = Promise.race([startupPromise, timeoutPromise])

    this.clients.set(key, {
      client,
      lastUsedAt: Date.now(),
      refCount: 1,
      initPromise,
      isInitializing: true,
    })

    try {
      await initPromise
      const m = this.clients.get(key)
      if (m) {
        m.initPromise = undefined
        m.isInitializing = false
      }
      return client
    } catch (err) {
      // Remove failed client from map
      this.clients.delete(key)
      // Attempt cleanup
      try {
        client.stop()
      } catch {}
      // Re-throw so caller knows init failed
      throw err
    }
  }

  warmupClient(root: string, server: ResolvedServer): void {
    const key = this.getKey(root, server.id)
    if (this.clients.has(key)) return

    const client = new LSPClient(root, server)
    
    // Wrap initialization with timeout to prevent indefinite hangs
    const startupPromise = (async () => {
      await client.start()
      await client.initialize()
    })()
    
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`LSP server warmup timed out after ${this.STARTUP_TIMEOUT}ms`))
      }, this.STARTUP_TIMEOUT)
    })
    
    const initPromise = Promise.race([startupPromise, timeoutPromise])

    this.clients.set(key, {
      client,
      lastUsedAt: Date.now(),
      refCount: 0,
      initPromise,
      isInitializing: true,
    })

    initPromise
      .then(() => {
        const m = this.clients.get(key)
        if (m) {
          m.initPromise = undefined
          m.isInitializing = false
        }
      })
      .catch((err) => {
        // Remove failed client from map to prevent reuse
        const m = this.clients.get(key)
        if (m) {
          this.clients.delete(key)
        }
        // Attempt cleanup
        try {
          client.stop()
        } catch {}
        // Log warning but don't crash
        console.warn(`[LSP] Warmup failed for ${server.id}:`, err instanceof Error ? err.message : String(err))
      })
  }

  releaseClient(root: string, serverId: string): void {
    const key = this.getKey(root, serverId)
    const managed = this.clients.get(key)
    if (managed && managed.refCount > 0) {
      managed.refCount--
      managed.lastUsedAt = Date.now()
    }
  }

  isServerInitializing(root: string, serverId: string): boolean {
    const key = this.getKey(root, serverId)
    const managed = this.clients.get(key)
    return managed?.isInitializing ?? false
  }

  async stopAll(): Promise<void> {
    for (const [, managed] of this.clients) {
      await managed.client.stop()
    }
    this.clients.clear()
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
  }

  async cleanupTempDirectoryClients(): Promise<void> {
    const keysToRemove: string[] = []
    for (const [key, managed] of this.clients.entries()) {
      const isTempDir = key.startsWith("/tmp/") || key.startsWith("/var/folders/")
      const isIdle = managed.refCount === 0
      if (isTempDir && isIdle) {
        keysToRemove.push(key)
      }
    }
    for (const key of keysToRemove) {
      const managed = this.clients.get(key)
      if (managed) {
        this.clients.delete(key)
        try {
          await managed.client.stop()
        } catch {}
      }
    }
  }
}

export const lspManager = LSPServerManager.getInstance()

export class LSPClient {
  private proc: Subprocess<"pipe", "pipe", "pipe"> | null = null
  private buffer: Uint8Array = new Uint8Array(0)
  private pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>()
  private requestIdCounter = 0
  private openedFiles = new Set<string>()
  private stderrBuffer: string[] = []
  private processExited = false
  private diagnosticsStore = new Map<string, Diagnostic[]>()

  constructor(
    private root: string,
    private server: ResolvedServer
  ) {}

  async start(): Promise<void> {
    try {
      this.proc = spawn(this.server.command, {
        stdin: "pipe",
        stdout: "pipe",
        stderr: "pipe",
        cwd: this.root,
        env: {
          ...process.env,
          ...this.server.env,
        },
      })

      if (!this.proc) {
        throw new Error(`Failed to spawn LSP server: ${this.server.command.join(" ")}`)
      }

      this.startReading()
      this.startStderrReading()

      await new Promise((resolve) => setTimeout(resolve, 100))

      if (this.proc.exitCode !== null) {
        const stderr = this.stderrBuffer.join("\n")
        throw new Error(
          `LSP server exited immediately with code ${this.proc.exitCode}` + (stderr ? `\nstderr: ${stderr}` : "")
        )
      }
    } catch (err) {
      // Log the failure for debugging
      const errorMsg = err instanceof Error ? err.message : String(err)
      console.warn(`[LSP] Failed to start ${this.server.command[0]}:`, errorMsg)
      // Re-throw so caller can handle
      throw err
    }
  }

  private startReading(): void {
    if (!this.proc) return

    const reader = this.proc.stdout.getReader()
    const read = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) {
            this.processExited = true
            this.rejectAllPending("LSP server stdout closed")
            break
          }
          const newBuf = new Uint8Array(this.buffer.length + value.length)
          newBuf.set(this.buffer)
          newBuf.set(value, this.buffer.length)
          this.buffer = newBuf
          this.processBuffer()
        }
      } catch (err) {
        this.processExited = true
        this.rejectAllPending(`LSP stdout read error: ${err}`)
      }
    }
    read()
  }

  private startStderrReading(): void {
    if (!this.proc) return

    const reader = this.proc.stderr.getReader()
    const read = async () => {
      const decoder = new TextDecoder()
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const text = decoder.decode(value)
          this.stderrBuffer.push(text)
          if (this.stderrBuffer.length > 100) {
            this.stderrBuffer.shift()
          }
        }
      } catch {
      }
    }
    read()
  }

  private rejectAllPending(reason: string): void {
    for (const [id, handler] of this.pending) {
      handler.reject(new Error(reason))
      this.pending.delete(id)
    }
  }

  private findSequence(haystack: Uint8Array, needle: number[]): number {
    outer: for (let i = 0; i <= haystack.length - needle.length; i++) {
      for (let j = 0; j < needle.length; j++) {
        if (haystack[i + j] !== needle[j]) continue outer
      }
      return i
    }
    return -1
  }

  private processBuffer(): void {
    const decoder = new TextDecoder()
    const CONTENT_LENGTH = [67, 111, 110, 116, 101, 110, 116, 45, 76, 101, 110, 103, 116, 104, 58]
    const CRLF_CRLF = [13, 10, 13, 10]
    const LF_LF = [10, 10]

    while (true) {
      const headerStart = this.findSequence(this.buffer, CONTENT_LENGTH)
      if (headerStart === -1) break
      if (headerStart > 0) this.buffer = this.buffer.slice(headerStart)

      let headerEnd = this.findSequence(this.buffer, CRLF_CRLF)
      let sepLen = 4
      if (headerEnd === -1) {
        headerEnd = this.findSequence(this.buffer, LF_LF)
        sepLen = 2
      }
      if (headerEnd === -1) break

      const header = decoder.decode(this.buffer.slice(0, headerEnd))
      const match = header.match(/Content-Length:\s*(\d+)/i)
      if (!match) break

      const len = parseInt(match[1], 10)
      const start = headerEnd + sepLen
      const end = start + len
      if (this.buffer.length < end) break

      const content = decoder.decode(this.buffer.slice(start, end))
      this.buffer = this.buffer.slice(end)

      try {
        const msg = JSON.parse(content)
        if (msg.id !== undefined && this.pending.has(msg.id)) {
          const handler = this.pending.get(msg.id)!
          this.pending.delete(msg.id)
          if (msg.error) {
            handler.reject(new Error(msg.error.message || JSON.stringify(msg.error)))
          } else {
            handler.resolve(msg.result)
          }
        } else if (msg.method === "textDocument/publishDiagnostics") {
          const uri = msg.params?.uri
          if (uri) {
            this.diagnosticsStore.set(uri, msg.params.diagnostics ?? [])
          }
        }
      } catch (parseError) {
        // Log JSON parse errors instead of silently swallowing them
        const errorMsg = parseError instanceof Error ? parseError.message : String(parseError)
        console.warn(`[LSP] JSON parse error: ${errorMsg}`)
        console.warn(`[LSP] Content: ${content.slice(0, 200)}${content.length > 200 ? '...' : ''}`)
        // Continue processing other messages
      }
    }
  }

  private send(method: string, params?: unknown): Promise<unknown> {
    if (!this.proc) throw new Error("LSP client not started")

    if (this.processExited || this.proc.exitCode !== null) {
      const stderr = this.stderrBuffer.slice(-10).join("\n")
      throw new Error(`LSP server already exited (code: ${this.proc.exitCode})` + (stderr ? `\nstderr: ${stderr}` : ""))
    }

    const id = ++this.requestIdCounter
    const msg = JSON.stringify({ jsonrpc: "2.0", id, method, params })
    const header = `Content-Length: ${Buffer.byteLength(msg)}\r\n\r\n`
    this.proc.stdin.write(header + msg)

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id)
          const stderr = this.stderrBuffer.slice(-5).join("\n")
          reject(new Error(`LSP request timeout (method: ${method})` + (stderr ? `\nrecent stderr: ${stderr}` : "")))
        }
      }, 15000)
    })
  }

  private notify(method: string, params?: unknown): void {
    if (!this.proc) return
    if (this.processExited || this.proc.exitCode !== null) return

    const msg = JSON.stringify({ jsonrpc: "2.0", method, params })
    this.proc.stdin.write(`Content-Length: ${Buffer.byteLength(msg)}\r\n\r\n${msg}`)
  }

  private respond(id: number | string, result: unknown): void {
    if (!this.proc) return
    if (this.processExited || this.proc.exitCode !== null) return

    const msg = JSON.stringify({ jsonrpc: "2.0", id, result })
    this.proc.stdin.write(`Content-Length: ${Buffer.byteLength(msg)}\r\n\r\n${msg}`)
  }

  private handleServerRequest(id: number | string, method: string, params?: unknown): void {
    if (method === "workspace/configuration") {
      const items = (params as { items?: Array<{ section?: string }> })?.items ?? []
      const result = items.map((item) => {
        if (item.section === "json") return { validate: { enable: true } }
        return {}
      })
      this.respond(id, result)
    } else if (method === "client/registerCapability") {
      this.respond(id, null)
    } else if (method === "window/workDoneProgress/create") {
      this.respond(id, null)
    }
  }

  async initialize(): Promise<void> {
    const rootUri = pathToFileURL(this.root).href
    await this.send("initialize", {
      processId: process.pid,
      rootUri,
      rootPath: this.root,
      workspaceFolders: [{ uri: rootUri, name: "workspace" }],
      capabilities: {
        textDocument: {
          hover: { contentFormat: ["markdown", "plaintext"] },
          definition: { linkSupport: true },
          references: {},
          documentSymbol: { hierarchicalDocumentSymbolSupport: true },
          publishDiagnostics: {},
          rename: {
            prepareSupport: true,
            prepareSupportDefaultBehavior: 1,
            honorsChangeAnnotations: true,
          },
          codeAction: {
            codeActionLiteralSupport: {
              codeActionKind: {
                valueSet: [
                  "quickfix",
                  "refactor",
                  "refactor.extract",
                  "refactor.inline",
                  "refactor.rewrite",
                  "source",
                  "source.organizeImports",
                  "source.fixAll",
                ],
              },
            },
            isPreferredSupport: true,
            disabledSupport: true,
            dataSupport: true,
            resolveSupport: {
              properties: ["edit", "command"],
            },
          },
        },
        workspace: {
          symbol: {},
          workspaceFolders: true,
          configuration: true,
          applyEdit: true,
          workspaceEdit: {
            documentChanges: true,
          },
        },
      },
      ...this.server.initialization,
    })
    this.notify("initialized")
    this.notify("workspace/didChangeConfiguration", {
      settings: { json: { validate: { enable: true } } },
    })
    await new Promise((r) => setTimeout(r, 300))
  }

  async openFile(filePath: string): Promise<void> {
    const absPath = resolve(filePath)
    if (this.openedFiles.has(absPath)) return

    const text = readFileSync(absPath, "utf-8")
    const ext = extname(absPath)
    const languageId = getLanguageId(ext)

    this.notify("textDocument/didOpen", {
      textDocument: {
        uri: pathToFileURL(absPath).href,
        languageId,
        version: 1,
        text,
      },
    })
    this.openedFiles.add(absPath)

    await new Promise((r) => setTimeout(r, 1000))
  }

  async definition(filePath: string, line: number, character: number): Promise<unknown> {
    const absPath = resolve(filePath)
    await this.openFile(absPath)
    return this.send("textDocument/definition", {
      textDocument: { uri: pathToFileURL(absPath).href },
      position: { line: line - 1, character },
    })
  }

  async references(filePath: string, line: number, character: number, includeDeclaration = true): Promise<unknown> {
    const absPath = resolve(filePath)
    await this.openFile(absPath)
    return this.send("textDocument/references", {
      textDocument: { uri: pathToFileURL(absPath).href },
      position: { line: line - 1, character },
      context: { includeDeclaration },
    })
  }

  async documentSymbols(filePath: string): Promise<unknown> {
    const absPath = resolve(filePath)
    await this.openFile(absPath)
    return this.send("textDocument/documentSymbol", {
      textDocument: { uri: pathToFileURL(absPath).href },
    })
  }

  async workspaceSymbols(query: string): Promise<unknown> {
    return this.send("workspace/symbol", { query })
  }

  async diagnostics(filePath: string): Promise<{ items: Diagnostic[] }> {
    const absPath = resolve(filePath)
    const uri = pathToFileURL(absPath).href
    await this.openFile(absPath)
    await new Promise((r) => setTimeout(r, 500))

    try {
      const result = await this.send("textDocument/diagnostic", {
        textDocument: { uri },
      })
      if (result && typeof result === "object" && "items" in result) {
        return result as { items: Diagnostic[] }
      }
    } catch {
    }

    return { items: this.diagnosticsStore.get(uri) ?? [] }
  }

  async prepareRename(filePath: string, line: number, character: number): Promise<unknown> {
    const absPath = resolve(filePath)
    await this.openFile(absPath)
    return this.send("textDocument/prepareRename", {
      textDocument: { uri: pathToFileURL(absPath).href },
      position: { line: line - 1, character },
    })
  }

  async rename(filePath: string, line: number, character: number, newName: string): Promise<unknown> {
    const absPath = resolve(filePath)
    await this.openFile(absPath)
    return this.send("textDocument/rename", {
      textDocument: { uri: pathToFileURL(absPath).href },
      position: { line: line - 1, character },
      newName,
    })
  }

  isAlive(): boolean {
    return this.proc !== null && !this.processExited && this.proc.exitCode === null
  }

  async stop(): Promise<void> {
    try {
      this.notify("shutdown", {})
      this.notify("exit")
    } catch {
    }
    const proc = this.proc
    if (proc) {
      this.proc = null
      let exitedBeforeTimeout = false
      try {
        proc.kill()
        // Wait for exit with timeout to prevent indefinite hang
        let timeoutId: ReturnType<typeof setTimeout> | undefined
        const timeoutPromise = new Promise<void>((resolve) => {
          timeoutId = setTimeout(resolve, 5000)
        })
        await Promise.race([
          proc.exited.then(() => { exitedBeforeTimeout = true }).finally(() => timeoutId && clearTimeout(timeoutId)),
          timeoutPromise,
        ])
if (!exitedBeforeTimeout) {
          console.warn("[LSPClient] Process did not exit within timeout, escalating to SIGKILL")
          try {
            proc.kill("SIGKILL")
            // Wait briefly for SIGKILL to take effect
            await Promise.race([
              proc.exited,
              new Promise<void>((resolve) => setTimeout(resolve, 1000)),
            ])
          } catch {}
        }
      } catch {}
    }
    this.processExited = true
    this.diagnosticsStore.clear()
  }
}
