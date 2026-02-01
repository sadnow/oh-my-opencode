import { describe, it, expect, vi, beforeEach } from "bun:test"
import { createOibAutoselectHook, type BudgetOrchestrator } from "./index"
import type { PluginInput } from "@opencode-ai/plugin"

describe("oib-autoselect hook", () => {
  const mockCtx = {
    client: {
      session: {
        messages: vi.fn(),
      },
    },
  } as unknown as PluginInput

  let mockOrchestrator: BudgetOrchestrator

  beforeEach(() => {
    mockOrchestrator = {
      getBestModelForUseCase: vi.fn().mockReturnValue("opencode/gpt-4o"),
      isEnabled: vi.fn().mockReturnValue(true),
    } as unknown as BudgetOrchestrator
  })

  it("should not register if budgetOrchestrator is null", () => {
    const hook = createOibAutoselectHook(mockCtx, null)
    expect(hook).toBeNull()
  })

  it("should register if budgetOrchestrator is provided", () => {
    const hook = createOibAutoselectHook(mockCtx, mockOrchestrator)
    expect(hook).not.toBeNull()
    expect(hook).toHaveProperty(["chat.message"])
    expect(hook).toHaveProperty("event")
  })

  it("should not modify output if model is not oib-autoselect", async () => {
    const hook = createOibAutoselectHook(mockCtx, mockOrchestrator)
    if (!hook) throw new Error("Hook should not be null")

    const output = {
      message: { role: "user", model: "opencode" } as Record<string, unknown>,
      parts: [],
    }

    await hook["chat.message"](
      {
        sessionID: "test-session",
        model: { providerID: "opencode", modelID: "gpt-4o" },
      },
      output
    )

    expect(mockOrchestrator.getBestModelForUseCase).not.toHaveBeenCalled()
    expect(output.message.model).toBe("opencode")
  })

  it("should substitute oh-im-broke/oib-autoselect with best model", async () => {
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

    expect(mockOrchestrator.getBestModelForUseCase).toHaveBeenCalledWith("orchestrator", undefined)
    expect(output.message.model).toBe("opencode")
    expect((output.message as { modelID?: string }).modelID).toBe("gpt-4o")
  })

  it("should use fallback model when getBestModelForUseCase throws", async () => {
    mockOrchestrator.getBestModelForUseCase = vi.fn().mockImplementation(() => {
      throw new Error("Test error")
    })

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

    expect(output.message.model).toBe("opencode")
    expect((output.message as { modelID?: string }).modelID).toBe("gpt-4o-mini")
  })

  it("should use fallback model when getBestModelForUseCase returns invalid format", async () => {
    mockOrchestrator.getBestModelForUseCase = vi.fn().mockReturnValue("invalid-format")

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

    expect(output.message.model).toBe("opencode")
    expect((output.message as { modelID?: string }).modelID).toBe("gpt-4o-mini")
  })

  it("should handle different model selections from orchestrator", async () => {
    mockOrchestrator.getBestModelForUseCase = vi.fn().mockReturnValue("anthropic/claude-3-5-sonnet-20241022")

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

    expect(output.message.model).toBe("anthropic")
    expect((output.message as { modelID?: string }).modelID).toBe("claude-3-5-sonnet-20241022")
  })

  it("should not throw when input.model is undefined", async () => {
    const hook = createOibAutoselectHook(mockCtx, mockOrchestrator)
    if (!hook) throw new Error("Hook should not be null")

    const output = {
      message: { role: "user" } as Record<string, unknown>,
      parts: [],
    }

    await expect(
      hook["chat.message"](
        { sessionID: "test-session" },
        output
      )
    ).resolves.toBeUndefined()

    expect(mockOrchestrator.getBestModelForUseCase).not.toHaveBeenCalled()
  })

  it("event handler should not throw", async () => {
    const hook = createOibAutoselectHook(mockCtx, mockOrchestrator)
    if (!hook) throw new Error("Hook should not be null")

    await expect(
      hook.event({ event: { type: "test-event" } })
    ).resolves.toBeUndefined()
  })
})
