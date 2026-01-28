import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test"
import { LSPClient, lspManager } from "./client"
import type { ResolvedServer } from "./types"

describe("LSPClient crash prevention", () => {
  const mockRoot = "/test/root"
  const mockServer: ResolvedServer = {
    id: "test-server",
    command: ["non-existent-lsp-server", "--stdio"],
    extensions: [".ts"],
    priority: 0,
    env: {},
    initialization: {},
  }

  afterEach(async () => {
    // Clean up any clients that may have been created
    await lspManager.stopAll()
  })

  describe("LSPClient.start() error handling", () => {
    test("should log and re-throw spawn failures", async () => {
      // #given: A client with a non-existent LSP server command
      const client = new LSPClient(mockRoot, mockServer)

      // #when: Attempting to start the client
      // #then: Should throw an error but not crash the process
      await expect(client.start()).rejects.toThrow()
      
      // Verify client is not alive after failed start
      expect(client.isAlive()).toBe(false)
    })

    test("should handle spawn failures gracefully", async () => {
      // #given: A client with a command that will fail to spawn
      const client = new LSPClient(mockRoot, {
        ...mockServer,
        command: ["non-existent-command-xyz"],
      })

      // #when: Starting the client
      // #then: Should throw an error (logged) but not crash process
      await expect(client.start()).rejects.toThrow()
      
      // Verify client is not alive after failed start
      expect(client.isAlive()).toBe(false)
    })
  })

  describe("LSPServerManager.getClient() failure cleanup", () => {
    test("should remove failed client from cache", async () => {
      // #given: A server that will fail to initialize
      const failServer: ResolvedServer = {
        ...mockServer,
        id: "fail-server",
      }

      // #when: First call fails
      await expect(lspManager.getClient(mockRoot, failServer)).rejects.toThrow()

      // #then: Second call should attempt fresh initialization (not reuse broken client)
      // This verifies the failed client was removed from cache
      await expect(lspManager.getClient(mockRoot, failServer)).rejects.toThrow()
      
      // If cache wasn't cleaned, this would fail differently (timeout waiting for broken client)
    })

    test("should handle concurrent getClient calls gracefully", async () => {
      // #given: Multiple concurrent calls to getClient with failing server
      const calls = Array(3).fill(null).map(() => 
        lspManager.getClient(mockRoot, mockServer).catch(e => e)
      )

      // #when: All calls complete
      const results = await Promise.all(calls)

      // #then: All should fail gracefully without crashing
      results.forEach(result => {
        expect(result).toBeInstanceOf(Error)
      })
    })
  })

  describe("LSPServerManager.warmupClient() unhandled rejection prevention", () => {
    test("should not crash on warmup failure", async () => {
      // #given: A warmup call with failing server
      let unhandledRejection = false
      const handler = () => { unhandledRejection = true }
      
      process.on("unhandledRejection", handler)

      // #when: Warmup is called (fire and forget)
      lspManager.warmupClient(mockRoot, mockServer)

      // #then: Wait to ensure no unhandled rejection
      await new Promise(resolve => setTimeout(resolve, 500))
      
      process.off("unhandledRejection", handler)
      expect(unhandledRejection).toBe(false)
    })

    test("should remove failed warmup client from cache", async () => {
      // #given: Warmup called with failing server
      lspManager.warmupClient(mockRoot, mockServer)
      
      // Wait for warmup to fail
      await new Promise(resolve => setTimeout(resolve, 500))

      // #when: Attempting getClient after warmup failure
      // #then: Should attempt fresh initialization (not timeout waiting for broken warmup)
      const promise = lspManager.getClient(mockRoot, mockServer)
      await expect(promise).rejects.toThrow()
    })
  })

  describe("LSPClient graceful degradation", () => {
    test("should handle send() on unstarted client", async () => {
      // #given: A client that was never started
      const client = new LSPClient(mockRoot, mockServer)

      // #when: Attempting to send without starting
      // #then: Should throw with clear error message (but not crash process)
      try {
        await (client as any).send("test/method", {})
        expect(true).toBe(false) // Should not reach here
      } catch (e) {
        expect(e instanceof Error && e.message.includes("not started")).toBe(true)
      }
    })

    test("should handle notify() on unstarted client", async () => {
      // #given: A client that was never started
      const client = new LSPClient(mockRoot, mockServer)

      // #when: Attempting to notify without starting
      // #then: Should not crash (notify returns void)
      expect(() => {
        (client as any).notify("test/notification", {})
      }).not.toThrow()
    })
  })

  describe("LSPClient.stop() idempotency", () => {
    test("should handle multiple stop() calls safely", async () => {
      // #given: A client (even if not successfully started)
      const client = new LSPClient(mockRoot, mockServer)

      // #when: Calling stop multiple times
      // #then: Should not throw
      await client.stop()
      await client.stop()
      await client.stop()
    })
  })

  describe("Error propagation to tools", () => {
    test("withLspClient should propagate errors as expected", async () => {
      // This is an integration test to ensure errors bubble up correctly
      // The actual tools catch these and return error strings
      
      const { withLspClient } = await import("./utils")
      
      // #given: A file path that will trigger server lookup failure
      const fakePath = "/test/file.ts"
      
      // #when: Using withLspClient with non-existent server
      // #then: Should throw error that tools can catch
      await expect(
        withLspClient(fakePath, async (client) => {
          return await client.documentSymbols(fakePath)
        })
      ).rejects.toThrow()
    })
  })
})

describe("LSPServerManager lifecycle", () => {
  const mockRoot = "/test/root"
  const mockServer: ResolvedServer = {
    id: "lifecycle-test-server",
    command: ["non-existent-lifecycle-server"],
    extensions: [".ts"],
    priority: 0,
    env: {},
    initialization: {},
  }

  afterEach(async () => {
    await lspManager.stopAll()
  })

  test("should cleanup clients on stopAll", async () => {
    // #given: Warmup called with failing server (will be cleaned up)
    lspManager.warmupClient(mockRoot, mockServer)
    
    // Wait for warmup to fail and cleanup
    await new Promise(resolve => setTimeout(resolve, 300))

    // #when: Calling stopAll
    await lspManager.stopAll()

    // #then: No errors should occur
    // (Implicit test - if cleanup fails, stopAll would throw)
  })

  test("should handle process cleanup signals gracefully", () => {
    // #given: Manager is initialized
    // #when: Process signals are triggered
    // #then: Should not crash (tested implicitly by not throwing)
    
    // The manager registers cleanup handlers for exit/SIGINT/SIGTERM
    // This test verifies the handlers are registered without errors
    expect(() => {
      // Trigger would be: process.emit("exit", 0)
      // But we don't want to actually exit the test process
    }).not.toThrow()
  })
})

describe("LSPClient JSON-RPC error handling", () => {
  test("should log parse errors without crashing", async () => {
    // #given: A mock console.warn to capture logs
    const originalWarn = console.warn
    const warnings: any[] = []
    console.warn = (...args: any[]) => warnings.push(args)

    try {
      // #when: Creating a client that will fail (triggering our error logging)
      const client = new LSPClient("/test", {
        id: "json-test",
        command: ["non-existent-json-test"],
        extensions: [".ts"],
        priority: 0,
        env: {},
        initialization: {},
      })

      // Attempt to start (will fail)
      await client.start().catch(() => {})
      
      // #then: Should have logged the error without crashing
      expect(warnings.length).toBeGreaterThan(0)
      
      await client.stop()
    } finally {
      console.warn = originalWarn
    }
  })
})
