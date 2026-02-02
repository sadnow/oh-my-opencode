import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test"
import {
  fetchZenAvailableModels,
  isZenModelAvailable,
  clearZenModelCache,
  getZenCacheStatus,
  __resetZenModelDetection,
} from "./zen-model-detection"

// Helper to create a mock fetch that satisfies the type
function createMockFetch(handler: () => Promise<Response>): typeof fetch {
  const mockFn = mock(handler) as unknown as typeof fetch
  // Add preconnect property to satisfy the type
  ;(mockFn as any).preconnect = mock(() => {})
  return mockFn
}

describe("zen-model-detection", () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    __resetZenModelDetection()
  })

  afterEach(() => {
    __resetZenModelDetection()
    globalThis.fetch = originalFetch
  })

  describe("fetchZenAvailableModels", () => {
    it("should return empty array when no API key is available", async () => {
      // Ensure no env vars are set
      const originalZenKey = process.env.ZEN_API_KEY
      const originalOpenCodeZenKey = process.env.OPENCODE_ZEN_API_KEY
      delete process.env.ZEN_API_KEY
      delete process.env.OPENCODE_ZEN_API_KEY

      const models = await fetchZenAvailableModels()
      expect(models).toEqual([])

      // Restore
      if (originalZenKey) process.env.ZEN_API_KEY = originalZenKey
      if (originalOpenCodeZenKey) process.env.OPENCODE_ZEN_API_KEY = originalOpenCodeZenKey
    })

    it("should fetch models from API when key is provided", async () => {
      const mockModels = [
        { id: "gpt-5.2", name: "GPT 5.2", enabled: true },
        { id: "claude-opus-4.5", name: "Claude Opus 4.5", enabled: true },
        { id: "disabled-model", name: "Disabled", enabled: false },
      ]

      globalThis.fetch = createMockFetch(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockModels),
        } as Response)
      )

      const models = await fetchZenAvailableModels("test-api-key")

      expect(models).toContain("gpt-5.2")
      expect(models).toContain("claude-opus-4.5")
      expect(models).not.toContain("disabled-model") // Filtered out
    })

    it("should handle object response with models property", async () => {
      const mockResponse = {
        models: [
          { id: "gpt-5.2", enabled: true },
          { id: "claude-opus-4.5", enabled: true },
        ],
      }

      globalThis.fetch = createMockFetch(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        } as Response)
      )

      const models = await fetchZenAvailableModels("test-api-key")

      expect(models).toContain("gpt-5.2")
      expect(models).toContain("claude-opus-4.5")
    })

    it("should use cache on subsequent calls", async () => {
      const mockModels = [{ id: "gpt-5.2", enabled: true }]
      let fetchCount = 0

      globalThis.fetch = createMockFetch(() => {
        fetchCount++
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockModels),
        } as Response)
      })

      // First call - should fetch
      await fetchZenAvailableModels("test-api-key")
      expect(fetchCount).toBe(1)

      // Second call - should use cache
      await fetchZenAvailableModels("test-api-key")
      expect(fetchCount).toBe(1) // Still 1, used cache
    })

    it("should bypass cache when forceRefresh is true", async () => {
      const mockModels = [{ id: "gpt-5.2", enabled: true }]
      let fetchCount = 0

      globalThis.fetch = createMockFetch(() => {
        fetchCount++
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockModels),
        } as Response)
      })

      await fetchZenAvailableModels("test-api-key")
      expect(fetchCount).toBe(1)

      await fetchZenAvailableModels("test-api-key", true) // Force refresh
      expect(fetchCount).toBe(2)
    })

    it("should return cached data on API error", async () => {
      const mockModels = [{ id: "gpt-5.2", enabled: true }]

      // First call succeeds
      globalThis.fetch = createMockFetch(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockModels),
        } as Response)
      )

      await fetchZenAvailableModels("test-api-key")
      clearZenModelCache() // Clear to force re-fetch

      // Re-populate cache
      await fetchZenAvailableModels("test-api-key")

      // Second call fails
      globalThis.fetch = createMockFetch(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
        } as Response)
      )

      const models = await fetchZenAvailableModels("test-api-key", true)
      expect(models).toContain("gpt-5.2") // Returns cached data
    })
  })

  describe("isZenModelAvailable", () => {
    it("should return true for available models", async () => {
      const mockModels = [
        { id: "gpt-5.2", enabled: true },
        { id: "claude-opus-4.5", enabled: true },
      ]

      globalThis.fetch = createMockFetch(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockModels),
        } as Response)
      )

      expect(await isZenModelAvailable("gpt-5.2", "test-key")).toBe(true)
      expect(await isZenModelAvailable("claude-opus-4.5", "test-key")).toBe(true)
    })

    it("should return false for unavailable models", async () => {
      const mockModels = [{ id: "gpt-5.2", enabled: true }]

      globalThis.fetch = createMockFetch(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockModels),
        } as Response)
      )

      expect(await isZenModelAvailable("claude-opus-4.5", "test-key")).toBe(false)
    })

    it("should handle model IDs with provider prefix", async () => {
      const mockModels = [{ id: "gpt-5.2", enabled: true }]

      globalThis.fetch = createMockFetch(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockModels),
        } as Response)
      )

      // Should match even with provider prefix
      expect(await isZenModelAvailable("opencode-zen/gpt-5.2", "test-key")).toBe(true)
    })
  })

  describe("clearZenModelCache", () => {
    it("should clear the cache", async () => {
      const mockModels = [{ id: "gpt-5.2", enabled: true }]

      globalThis.fetch = createMockFetch(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockModels),
        } as Response)
      )

      await fetchZenAvailableModels("test-api-key")
      
      let status = getZenCacheStatus()
      expect(status.cached).toBe(true)

      clearZenModelCache()

      status = getZenCacheStatus()
      expect(status.cached).toBe(false)
    })
  })

  describe("getZenCacheStatus", () => {
    it("should return uncached status when cache is empty", () => {
      const status = getZenCacheStatus()
      expect(status.cached).toBe(false)
      expect(status.ageMs).toBeNull()
      expect(status.modelCount).toBe(0)
    })

    it("should return cached status after fetching", async () => {
      const mockModels = [
        { id: "gpt-5.2", enabled: true },
        { id: "claude-opus-4.5", enabled: true },
      ]

      globalThis.fetch = createMockFetch(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockModels),
        } as Response)
      )

      await fetchZenAvailableModels("test-api-key")

      const status = getZenCacheStatus()
      expect(status.cached).toBe(true)
      expect(status.ageMs).toBeGreaterThanOrEqual(0)
      expect(status.modelCount).toBe(2)
    })
  })
})
