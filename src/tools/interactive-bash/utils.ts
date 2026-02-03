import { spawn } from "bun"

let tmuxPath: string | null = null
let initPromise: Promise<string | null> | null = null

const FIND_TMUX_TIMEOUT_MS = 5000  // 5 seconds

async function findTmuxPath(): Promise<string | null> {
  const isWindows = process.platform === "win32"
  const cmd = isWindows ? "where" : "which"

  try {
    const proc = spawn([cmd, "tmux"], {
      stdout: "pipe",
      stderr: "pipe",
    })

    // Race between process exit and timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        proc.kill()
        reject(new Error(`${cmd} tmux timed out after ${FIND_TMUX_TIMEOUT_MS}ms`))
      }, FIND_TMUX_TIMEOUT_MS)
    })

    const exitCode = await Promise.race([proc.exited, timeoutPromise])
    if (exitCode !== 0) {
      return null
    }

    const stdout = await new Response(proc.stdout).text()
    const path = stdout.trim().split("\n")[0]

    if (!path) {
      return null
    }

    const verifyProc = spawn([path, "-V"], {
      stdout: "pipe",
      stderr: "pipe",
    })

    const verifyTimeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        verifyProc.kill()
        reject(new Error(`tmux -V timed out after ${FIND_TMUX_TIMEOUT_MS}ms`))
      }, FIND_TMUX_TIMEOUT_MS)
    })

    const verifyExitCode = await Promise.race([verifyProc.exited, verifyTimeoutPromise])
    if (verifyExitCode !== 0) {
      return null
    }

    return path
  } catch (error) {
    console.warn("[interactive-bash] Failed to find tmux:", error)
    return null
  }
}

export async function getTmuxPath(): Promise<string | null> {
  if (tmuxPath !== null) {
    return tmuxPath
  }

  if (initPromise) {
    return initPromise
  }

  initPromise = (async () => {
    const path = await findTmuxPath()
    tmuxPath = path
    return path
  })()

  return initPromise
}

export function getCachedTmuxPath(): string | null {
  return tmuxPath
}

export function startBackgroundCheck(): void {
  if (!initPromise) {
    initPromise = getTmuxPath()
    initPromise.catch(() => {})
  }
}
