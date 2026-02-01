import { describe, it, expect, vi } from "bun:test"
import { createOibAutoselectHook } from "./index"
import type { PluginInput } from "@opencode-ai/plugin"

describe("oib-autoselect hook", () => {
  const mockCtx = {
    client: {
      session: {
        messages: vi.fn(),
      },
    },
  } as unknown as PluginInput

  it("should not register if budgetOrchestrator is null", () => {
    const hook = createOibAutoselectHook(mockCtx, null)
    expect(hook).toBeNull()
  })

  it("should register if budgetOrchestrator is provided", () => {
    const mockOrchestrator = {}
    const hook = createOibAutoselectHook(mockCtx, mockOrchestrator)
    expect(hook).not.toBeNull()
    expect(hook).toHaveProperty(["chat.message"])
    expect(hook).toHaveProperty("event")
  })

  it("should have stub handlers that don't throw", async () => {
    const mockOrchestrator = {}
    const hook = createOibAutoselectHook(mockCtx, mockOrchestrator)
    
    if (!hook) throw new Error("Hook should not be null")

    // Test chat.message stub
    await expect(
      hook["chat.message"](
        { sessionID: "test-session" },
        { message: { role: "user" }, parts: [] }
      )
    ).resolves.toBeUndefined()

    // Test event stub
    await expect(
      hook.event({ event: { type: "test-event" } })
    ).resolves.toBeUndefined()
  })
})
