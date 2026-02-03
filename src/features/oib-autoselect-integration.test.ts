import { describe, it, expect, vi, beforeEach } from "bun:test"
import { injectVirtualProvider } from "./virtual-provider"
import { createOibAutoselectHook, type BudgetOrchestrator } from "../hooks/oib-autoselect"
import type { PluginInput } from "@opencode-ai/plugin"
import type { ProviderModelsCache } from "../shared/connected-providers-cache"

describe("OIB-Autoselect Integration", () => {
  let mockCtx: PluginInput
  let mockOrchestrator: BudgetOrchestrator

  beforeEach(() => {
    mockCtx = {
      client: {
        session: {
          messages: vi.fn(),
        },
      },
    } as unknown as PluginInput

    mockOrchestrator = {
      getBestModelForUseCase: vi.fn().mockReturnValue("anthropic/claude-opus-4-5"),
      isEnabled: vi.fn().mockReturnValue(true),
    } as unknown as BudgetOrchestrator
  })

  describe("End-to-End Flow", () => {
    it("should complete full flow: cache injection → model selection → substitution", async () => {
      //#given - Initial cache with real providers
      const initialCache: ProviderModelsCache = {
        models: {
          anthropic: ["claude-3-5-sonnet-20241022", "claude-opus-4-5"],
          openai: ["gpt-4o", "gpt-4o-mini"],
          google: ["gemini-1.5-pro"],
        },
        connected: ["anthropic", "openai", "google"],
        updatedAt: "2026-01-01T00:00:00.000Z",
      }

      //#when - Step 1: Virtual provider injection (simulates cache update)
      const injectedCache = injectVirtualProvider(initialCache)

      //#then - Virtual provider should be in cache
      expect(injectedCache.models["oh-im-broke"]).toEqual(["oib-autoselect"])
      expect(injectedCache.connected).toContain("oh-im-broke")
      expect(injectedCache.connected).toContain("anthropic")
      expect(injectedCache.connected).toContain("openai")
      expect(injectedCache.connected).toContain("google")

      //#when - Step 2: User selects oh-im-broke/oib-autoselect from TUI
      const hook = createOibAutoselectHook(mockCtx, mockOrchestrator)
      if (!hook) throw new Error("Hook should not be null")

      const output = {
        message: { role: "user" } as Record<string, unknown>,
        parts: [],
      }

      await hook["chat.message"](
        {
          sessionID: "test-session",
          model: { providerID: "oh-im-broke", modelID: "oib-autoselect" },
        },
        output
      )

      //#then - Step 3: Model should be substituted with best available
      expect(mockOrchestrator.getBestModelForUseCase).toHaveBeenCalledWith("orchestrator", undefined)
      expect(output.message.model).toEqual({ providerID: "anthropic", modelID: "claude-opus-4-5" })
    })

    it("should handle different budget orchestrator selections", async () => {
      //#given - Cache with virtual provider
      const cache: ProviderModelsCache = {
        models: {
          "github-copilot": ["gpt-4o"],
          opencode: ["gpt-4o-mini"],
        },
        connected: ["github-copilot", "opencode"],
        updatedAt: "2026-01-01T00:00:00.000Z",
      }

      const injectedCache = injectVirtualProvider(cache)

      //#given - Orchestrator selects Copilot model
      mockOrchestrator.getBestModelForUseCase = vi.fn().mockReturnValue("github-copilot/gpt-4o")

      //#when - User selects oib-autoselect
      const hook = createOibAutoselectHook(mockCtx, mockOrchestrator)
      if (!hook) throw new Error("Hook should not be null")

      const output = {
        message: { role: "user" } as Record<string, unknown>,
        parts: [],
      }

      await hook["chat.message"](
        {
          sessionID: "test-session",
          model: { providerID: "oh-im-broke", modelID: "oib-autoselect" },
        },
        output
      )

      //#then - Should substitute with Copilot model
      expect(output.message.model).toEqual({ providerID: "github-copilot", modelID: "gpt-4o" })
    })

    it("should fallback gracefully when orchestrator fails", async () => {
      //#given - Cache with virtual provider
      const cache: ProviderModelsCache = {
        models: {
          anthropic: ["claude-3-5-sonnet-20241022"],
        },
        connected: ["anthropic"],
        updatedAt: "2026-01-01T00:00:00.000Z",
      }

      injectVirtualProvider(cache)

      //#given - Orchestrator throws error
      mockOrchestrator.getBestModelForUseCase = vi.fn().mockImplementation(() => {
        throw new Error("All providers exhausted")
      })

      //#when - User selects oib-autoselect
      const hook = createOibAutoselectHook(mockCtx, mockOrchestrator)
      if (!hook) throw new Error("Hook should not be null")

      const output = {
        message: { role: "user" } as Record<string, unknown>,
        parts: [],
      }

      await hook["chat.message"](
        {
          sessionID: "test-session",
          model: { providerID: "oh-im-broke", modelID: "oib-autoselect" },
        },
        output
      )

      //#then - Should fallback to big-pickle
      expect(output.message.model).toEqual({ providerID: "opencode", modelID: "big-pickle" })
    })

    it("should preserve other providers when injecting virtual provider", async () => {
      //#given - Cache with multiple providers
      const cache: ProviderModelsCache = {
        models: {
          anthropic: ["claude-3-5-sonnet-20241022", "claude-opus-4-5"],
          openai: ["gpt-4o", "gpt-4o-mini", "o1"],
          google: ["gemini-1.5-pro", "gemini-1.5-flash"],
          "github-copilot": ["gpt-4o"],
        },
        connected: ["anthropic", "openai", "google", "github-copilot"],
        updatedAt: "2026-01-01T00:00:00.000Z",
      }

      //#when - Inject virtual provider
      const injectedCache = injectVirtualProvider(cache)

      //#then - All original providers should be preserved
      expect(injectedCache.models["anthropic"]).toEqual(["claude-3-5-sonnet-20241022", "claude-opus-4-5"])
      expect(injectedCache.models["openai"]).toEqual(["gpt-4o", "gpt-4o-mini", "o1"])
      expect(injectedCache.models["google"]).toEqual(["gemini-1.5-pro", "gemini-1.5-flash"])
      expect(injectedCache.models["github-copilot"]).toEqual(["gpt-4o"])

      //#then - Virtual provider should be added
      expect(injectedCache.models["oh-im-broke"]).toEqual(["oib-autoselect"])
      expect(injectedCache.connected).toHaveLength(5)
      expect(injectedCache.connected).toContain("oh-im-broke")
    })

    it("should handle multiple sequential selections", async () => {
      //#given - Cache with virtual provider
      const cache: ProviderModelsCache = {
        models: {
          anthropic: ["claude-opus-4-5"],
          openai: ["gpt-4o"],
        },
        connected: ["anthropic", "openai"],
        updatedAt: "2026-01-01T00:00:00.000Z",
      }

      injectVirtualProvider(cache)

      const hook = createOibAutoselectHook(mockCtx, mockOrchestrator)
      if (!hook) throw new Error("Hook should not be null")

      //#when - First selection: orchestrator returns Claude
      mockOrchestrator.getBestModelForUseCase = vi.fn().mockReturnValue("anthropic/claude-opus-4-5")

      const output1 = {
        message: { role: "user" } as Record<string, unknown>,
        parts: [],
      }

      await hook["chat.message"](
        {
          sessionID: "test-session-1",
          model: { providerID: "oh-im-broke", modelID: "oib-autoselect" },
        },
        output1
      )

      //#then - First selection should use Claude
      expect(output1.message.model).toEqual({ providerID: "anthropic", modelID: "claude-opus-4-5" })

      //#when - Second selection: orchestrator returns OpenAI (budget changed)
      mockOrchestrator.getBestModelForUseCase = vi.fn().mockReturnValue("openai/gpt-4o")

      const output2 = {
        message: { role: "user" } as Record<string, unknown>,
        parts: [],
      }

      await hook["chat.message"](
        {
          sessionID: "test-session-2",
          model: { providerID: "oh-im-broke", modelID: "oib-autoselect" },
        },
        output2
      )

      //#then - Second selection should use OpenAI
      expect(output2.message.model).toEqual({ providerID: "openai", modelID: "gpt-4o" })
    })

    it("should not interfere with non-oib-autoselect model selections", async () => {
      //#given - Cache with virtual provider
      const cache: ProviderModelsCache = {
        models: {
          anthropic: ["claude-opus-4-5"],
          "oh-im-broke": ["oib-autoselect"],
        },
        connected: ["anthropic", "oh-im-broke"],
        updatedAt: "2026-01-01T00:00:00.000Z",
      }

      injectVirtualProvider(cache)

      const hook = createOibAutoselectHook(mockCtx, mockOrchestrator)
      if (!hook) throw new Error("Hook should not be null")

      //#when - User selects regular anthropic model (not oib-autoselect)
      const output = {
        message: { role: "user", model: { providerID: "anthropic", modelID: "claude-opus-4-5" } } as Record<string, unknown>,
        parts: [],
      }

      await hook["chat.message"](
        {
          sessionID: "test-session-not-tracked",
          model: { providerID: "anthropic", modelID: "claude-opus-4-5" },
        },
        output
      )

      //#then - Should NOT call orchestrator or modify model
      expect(mockOrchestrator.getBestModelForUseCase).not.toHaveBeenCalled()
      expect(output.message.model).toEqual({ providerID: "anthropic", modelID: "claude-opus-4-5" })
    })
  })

  describe("Cache Injection Edge Cases", () => {
    it("should handle empty cache", () => {
      //#given - Empty cache
      const emptyCache: ProviderModelsCache = {
        models: {},
        connected: [],
        updatedAt: "2026-01-01T00:00:00.000Z",
      }

      //#when - Inject virtual provider
      const injectedCache = injectVirtualProvider(emptyCache)

      //#then - Should only contain virtual provider
      expect(injectedCache.models["oh-im-broke"]).toEqual(["oib-autoselect"])
      expect(injectedCache.connected).toEqual(["oh-im-broke"])
    })

    it("should update timestamp on injection", () => {
      //#given - Cache with old timestamp
      const oldTimestamp = "2025-01-01T00:00:00.000Z"
      const cache: ProviderModelsCache = {
        models: { anthropic: ["claude-3-5-sonnet-20241022"] },
        connected: ["anthropic"],
        updatedAt: oldTimestamp,
      }

      //#when - Inject virtual provider
      const injectedCache = injectVirtualProvider(cache)

      //#then - Timestamp should be updated
      expect(injectedCache.updatedAt).not.toBe(oldTimestamp)
      expect(new Date(injectedCache.updatedAt).getTime()).toBeGreaterThan(new Date(oldTimestamp).getTime())
    })

    it("should replace existing oh-im-broke provider if present", () => {
      //#given - Cache with existing oh-im-broke provider (old model)
      const cache: ProviderModelsCache = {
        models: {
          "oh-im-broke": ["old-deprecated-model"],
          anthropic: ["claude-3-5-sonnet-20241022"],
        },
        connected: ["oh-im-broke", "anthropic"],
        updatedAt: "2026-01-01T00:00:00.000Z",
      }

      //#when - Inject virtual provider
      const injectedCache = injectVirtualProvider(cache)

      //#then - Should replace with oib-autoselect
      expect(injectedCache.models["oh-im-broke"]).toEqual(["oib-autoselect"])
      expect(injectedCache.connected.filter(p => p === "oh-im-broke")).toHaveLength(1)
    })
  })

  describe("Model Substitution Edge Cases", () => {
    it("should handle orchestrator returning invalid model format", async () => {
      //#given - Orchestrator returns invalid format
      mockOrchestrator.getBestModelForUseCase = vi.fn().mockReturnValue("invalid-no-slash")

      const hook = createOibAutoselectHook(mockCtx, mockOrchestrator)
      if (!hook) throw new Error("Hook should not be null")

      const output = {
        message: { role: "user" } as Record<string, unknown>,
        parts: [],
      }

      //#when - User selects oib-autoselect
      await hook["chat.message"](
        {
          sessionID: "test-session",
          model: { providerID: "oh-im-broke", modelID: "oib-autoselect" },
        },
        output
      )

      //#then - Should fallback to big-pickle
      expect(output.message.model).toEqual({ providerID: "opencode", modelID: "big-pickle" })
    })

    it("should handle orchestrator returning empty string", async () => {
      //#given - Orchestrator returns empty string
      mockOrchestrator.getBestModelForUseCase = vi.fn().mockReturnValue("")

      const hook = createOibAutoselectHook(mockCtx, mockOrchestrator)
      if (!hook) throw new Error("Hook should not be null")

      const output = {
        message: { role: "user" } as Record<string, unknown>,
        parts: [],
      }

      //#when - User selects oib-autoselect
      await hook["chat.message"](
        {
          sessionID: "test-session",
          model: { providerID: "oh-im-broke", modelID: "oib-autoselect" },
        },
        output
      )

      //#then - Should fallback to big-pickle
      expect(output.message.model).toEqual({ providerID: "opencode", modelID: "big-pickle" })
    })

    it("should handle undefined input.model gracefully", async () => {
      //#given - Hook with orchestrator
      const hook = createOibAutoselectHook(mockCtx, mockOrchestrator)
      if (!hook) throw new Error("Hook should not be null")

      const output = {
        message: { role: "user" } as Record<string, unknown>,
        parts: [],
      }

      //#when - Input has no model property
      await hook["chat.message"](
        { sessionID: "test-session" },
        output
      )

      //#then - Should not throw or modify output
      expect(mockOrchestrator.getBestModelForUseCase).not.toHaveBeenCalled()
      expect(output.message.model).toBeUndefined()
    })
  })
})
