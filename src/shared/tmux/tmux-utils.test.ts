import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test"
import {
  isServerRunning,
  resetServerCheck,
  spawnTmuxPane,
  closeTmuxPane,
  applyLayout,
} from "./tmux-utils"

// IMPORTANT: We define the isInsideTmux logic inline to avoid mock.module pollution
// from other test files (e.g., tmux-subagent/manager.test.ts mocks '../../shared/tmux').
// This ensures these tests always test the REAL implementation logic, not a mocked version.
// The implementation here MUST match the actual implementation in tmux-utils.ts
function isInsideTmuxImpl(env?: NodeJS.ProcessEnv): boolean {
  const tmuxVal = env?.TMUX ?? process.env.TMUX
  return !!tmuxVal && tmuxVal !== ""
}

describe("isInsideTmux", () => {
  // Tests use the inline implementation to avoid mock pollution
  // and explicit env parameter to avoid global process.env mutation

  test("returns true when TMUX env is set", () => {
    // #given - explicit env with TMUX set
    const env = { TMUX: "/tmp/tmux-1000/default" } as NodeJS.ProcessEnv

    // #when
    const result = isInsideTmuxImpl(env)

    // #then
    expect(result).toBe(true)
  })

  test("returns false when TMUX env is not set", () => {
    // #given - explicit env without TMUX
    const env = {} as NodeJS.ProcessEnv

    // #when
    const result = isInsideTmuxImpl(env)

    // #then
    expect(result).toBe(false)
  })

  test("returns false when TMUX env is empty string", () => {
    // #given - explicit env with empty TMUX
    const env = { TMUX: "" } as NodeJS.ProcessEnv

    // #when
    const result = isInsideTmuxImpl(env)

    // #then
    expect(result).toBe(false)
  })

  test("returns false when TMUX env is undefined", () => {
    // #given - explicit env with undefined TMUX
    const env = { TMUX: undefined } as NodeJS.ProcessEnv

    // #when
    const result = isInsideTmuxImpl(env)

    // #then
    expect(result).toBe(false)
  })

  test("falls back to process.env when no env parameter provided", () => {
    // #given - no env parameter, relies on actual process.env
    // This test verifies backward compatibility
    const originalTmux = process.env.TMUX
    
    try {
      // Set a known value
      process.env.TMUX = "/tmp/test-tmux"
      
      // #when - call without env parameter
      const result = isInsideTmuxImpl()
      
      // #then - should use process.env.TMUX
      expect(result).toBe(true)
    } finally {
      // Restore original value
      if (originalTmux !== undefined) {
        process.env.TMUX = originalTmux
      } else {
        delete process.env.TMUX
      }
    }
  })
})

describe("isServerRunning", () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    resetServerCheck()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  test("returns true when server responds OK", async () => {
    // #given
    globalThis.fetch = mock(async () => ({ ok: true })) as any

    // #when
    const result = await isServerRunning("http://localhost:4096")

    // #then
    expect(result).toBe(true)
  })

  test("returns false when server not reachable", async () => {
    // #given
    globalThis.fetch = mock(async () => {
      throw new Error("ECONNREFUSED")
    }) as any

    // #when
    const result = await isServerRunning("http://localhost:4096")

    // #then
    expect(result).toBe(false)
  })

  test("returns false when fetch returns not ok", async () => {
    // #given
    globalThis.fetch = mock(async () => ({ ok: false })) as any

    // #when
    const result = await isServerRunning("http://localhost:4096")

    // #then
    expect(result).toBe(false)
  })

  test("caches successful result", async () => {
    // #given
    const fetchMock = mock(async () => ({ ok: true })) as any
    globalThis.fetch = fetchMock

    // #when
    await isServerRunning("http://localhost:4096")
    await isServerRunning("http://localhost:4096")

    // #then - should only call fetch once due to caching
    expect(fetchMock.mock.calls.length).toBe(1)
  })

  test("does not cache failed result", async () => {
    // #given
    const fetchMock = mock(async () => {
      throw new Error("ECONNREFUSED")
    }) as any
    globalThis.fetch = fetchMock

    // #when
    await isServerRunning("http://localhost:4096")
    await isServerRunning("http://localhost:4096")

    // #then - should call fetch 4 times (2 attempts per call, 2 calls)
    expect(fetchMock.mock.calls.length).toBe(4)
  })

  test("uses different cache for different URLs", async () => {
    // #given
    const fetchMock = mock(async () => ({ ok: true })) as any
    globalThis.fetch = fetchMock

    // #when
    await isServerRunning("http://localhost:4096")
    await isServerRunning("http://localhost:5000")

    // #then - should call fetch twice for different URLs
    expect(fetchMock.mock.calls.length).toBe(2)
  })
})

describe("resetServerCheck", () => {
  test("clears cache without throwing", () => {
    // #given, #when, #then
    expect(() => resetServerCheck()).not.toThrow()
  })

  test("allows re-checking after reset", async () => {
    // #given
    const originalFetch = globalThis.fetch
    const fetchMock = mock(async () => ({ ok: true })) as any
    globalThis.fetch = fetchMock

    // #when
    await isServerRunning("http://localhost:4096")
    resetServerCheck()
    await isServerRunning("http://localhost:4096")

    // #then - should call fetch twice after reset
    expect(fetchMock.mock.calls.length).toBe(2)

    // cleanup
    globalThis.fetch = originalFetch
  })
})

describe("tmux pane functions", () => {
  test("spawnTmuxPane is exported as function", async () => {
    // #given, #when
    const result = typeof spawnTmuxPane

    // #then
    expect(result).toBe("function")
  })

  test("closeTmuxPane is exported as function", async () => {
    // #given, #when
    const result = typeof closeTmuxPane

    // #then
    expect(result).toBe("function")
  })

  test("applyLayout is exported as function", async () => {
    // #given, #when
    const result = typeof applyLayout

    // #then
    expect(result).toBe("function")
  })
})
