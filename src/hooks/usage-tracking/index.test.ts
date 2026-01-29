import { describe, expect, test, beforeEach, spyOn, jest } from "bun:test"
import { createUsageTrackingHook } from "./index"
import { UsageTracker } from "../../features/usage-tracker"
import type { PluginInput } from "@opencode-ai/plugin"

describe("usage-tracking hook", () => {
  let usageTracker: UsageTracker
  let mockContext: PluginInput

  beforeEach(() => {
    // #given: Fresh UsageTracker with persistence disabled for testing
    usageTracker = new UsageTracker({
      enabled: true,
      persist: false, // Don't write to disk during tests
    })

    // Mock PluginInput context with all required fields
    mockContext = {
      directory: process.cwd(),
      client: {} as any,
      project: {} as any,
      worktree: process.cwd(),
      serverUrl: new URL("http://localhost:3000"),
      $: {} as any,
    }
  })

  test("hook returns null when usageTracker is null", () => {
    // #given: No usage tracker
    const hook = createUsageTrackingHook(mockContext, null)

    // #then: Hook should return null (not register)
    expect(hook).toBeNull()
  })

  test("hook registers chat.message handler and event listener when tracker exists", () => {
    // #given: Usage tracker exists
    const hook = createUsageTrackingHook(mockContext, usageTracker)

    // #then: Hook should return object with chat.message handler
    expect(hook).not.toBeNull()
    expect(hook?.["chat.message"]).toBeDefined()
    expect(typeof hook?.["chat.message"]).toBe("function")
    expect(hook?.event).toBeDefined()
  })

  test("Capture with valid input.model (all providers)", async () => {
    const hook = createUsageTrackingHook(mockContext, usageTracker)
    const recordSpy = spyOn(usageTracker, 'recordUsage')

    const providers = [
      { providerID: "anthropic", modelID: "claude-sonnet-4-5", expectedModel: "claude-sonnet-4-5", expectedProvider: "anthropic" },
      { providerID: "openai", modelID: "gpt-5.2", expectedModel: "gpt-5.2", expectedProvider: "openai" },
      { providerID: "google", modelID: "gemini-3-pro", expectedModel: "gemini-3-pro", expectedProvider: "google" },
      { providerID: "opencode", modelID: "big-pickle", expectedModel: "big-pickle", expectedProvider: "opencode" },
      { providerID: "kimi", modelID: "kimi-k2-thinking", expectedModel: "kimi-k2-thinking", expectedProvider: "moonshot" },
      { providerID: "glm", modelID: "glm-4.7", expectedModel: "glm-4.7", expectedProvider: "zhipu" },
      { providerID: "qwen", modelID: "qwen3-coder-480b", expectedModel: "qwen3-coder-480b", expectedProvider: "alibaba" },
    ]

    for (const { providerID, modelID, expectedModel, expectedProvider } of providers) {
      const sessionID = `session-${providerID}`
      
      // 1. User message (chat.message hook)
      await hook?.["chat.message"](
        { sessionID, model: { providerID, modelID }, messageID: "msg-user" },
        { message: {}, parts: [{ type: "text", text: "Hello" }] }
      )

      // 2. Assistant message (event listener)
      await hook?.event({
        event: {
          type: "message.updated",
          properties: {
            info: {
              sessionID,
              messageID: `msg-assistant-${providerID}`,
              role: "assistant",
              model: { providerID, modelID },
              parts: [{ type: "text", text: "Hi there" }]
            }
          }
        }
      })

      expect(recordSpy).toHaveBeenCalledWith(expect.objectContaining({
        provider: providerID,
        model: expectedModel,
        sessionID: sessionID
      }))
    }
  })

  test("Capture with missing model info (fallback logic)", async () => {
    const hook = createUsageTrackingHook(mockContext, usageTracker)
    const recordSpy = spyOn(usageTracker, 'recordUsage')
    const sessionID = "session-missing-model"

    // chat.message called without model info
    await hook?.["chat.message"](
      { sessionID, messageID: "msg-user" } as any,
      { message: {}, parts: [{ type: "text", text: "Hello" }] }
    )

    // Assistant message arrives
    await hook?.event({
      event: {
        type: "message.updated",
        properties: {
          info: {
            sessionID,
            messageID: "msg-assistant",
            role: "assistant",
            parts: [{ type: "text", text: "Hi" }]
          }
        }
      }
    })

    // Should NOT record usage because pending session wasn't created
    expect(recordSpy).not.toHaveBeenCalled()
  })

  test("Token estimation accuracy (rough check)", async () => {
    const hook = createUsageTrackingHook(mockContext, usageTracker)
    const recordSpy = spyOn(usageTracker, 'recordUsage')
    const sessionID = "session-tokens"

    // User message: "Hello" (5 chars) -> ~2 tokens
    await hook?.["chat.message"](
      { sessionID, model: { providerID: "openai", modelID: "gpt-5.2" }, messageID: "msg-user" },
      { message: {}, parts: [{ type: "text", text: "Hello" }] }
    )

    // Assistant message: "World" (5 chars) -> ~2 tokens
    await hook?.event({
      event: {
        type: "message.updated",
        properties: {
          info: {
            sessionID,
            messageID: "msg-assistant",
            role: "assistant",
            model: { providerID: "openai", modelID: "gpt-5.2" },
            parts: [{ type: "text", text: "World" }]
          }
        }
      }
    })

    expect(recordSpy).toHaveBeenCalledWith(expect.objectContaining({
      inputTokens: 2,
      outputTokens: 2
    }))
  })

  test("Session lifecycle cleanup", async () => {
    const hook = createUsageTrackingHook(mockContext, usageTracker)
    const sessionID = "session-cleanup"

    // Mock Date.now to control time
    const now = Date.now()
    const dateSpy = spyOn(Date, 'now').mockReturnValue(now)

    // 1. Create a pending session
    await hook?.["chat.message"](
      { sessionID, model: { providerID: "openai", modelID: "gpt-5.2" }, messageID: "msg-user" },
      { message: {}, parts: [{ type: "text", text: "Hello" }] }
    )

    // 2. Advance time by 2 hours
    dateSpy.mockReturnValue(now + 7200000)

    // 3. Trigger another chat.message to trigger cleanup
    await hook?.["chat.message"](
      { sessionID: "new-session", model: { providerID: "openai", modelID: "gpt-5.2" }, messageID: "msg-user-2" },
      { message: {}, parts: [{ type: "text", text: "Hello" }] }
    )

    // 4. Try to complete the first session
    const recordSpy = spyOn(usageTracker, 'recordUsage')
    await hook?.event({
      event: {
        type: "message.updated",
        properties: {
          info: {
            sessionID,
            messageID: "msg-assistant",
            role: "assistant",
            model: { providerID: "openai", modelID: "gpt-5.2" },
            parts: [{ type: "text", text: "Hi" }]
          }
        }
      }
    })

    // Should NOT record usage because it was cleaned up
    expect(recordSpy).not.toHaveBeenCalled()
    
    dateSpy.mockRestore()
  })

  test("Error handling in message event handler", async () => {
    const hook = createUsageTrackingHook(mockContext, usageTracker)
    
    // Trigger handler with null event to cause error
    await expect(hook?.event(null as any)).resolves.toBeUndefined()
    
    // Trigger handler with missing fields
    await expect(hook?.event({} as any)).resolves.toBeUndefined()
  })

  test("Duplicate message prevention", async () => {
    const hook = createUsageTrackingHook(mockContext, usageTracker)
    const recordSpy = spyOn(usageTracker, 'recordUsage')
    const sessionID = "session-duplicate"

    await hook?.["chat.message"](
      { sessionID, model: { providerID: "openai", modelID: "gpt-5.2" }, messageID: "msg-user" },
      { message: {}, parts: [{ type: "text", text: "Hello" }] }
    )

    const assistantEvent = {
      event: {
        type: "message.updated",
        properties: {
          info: {
            sessionID,
            messageID: "msg-assistant-1",
            role: "assistant",
            model: { providerID: "openai", modelID: "gpt-5.2" },
            parts: [{ type: "text", text: "Hi" }]
          }
        }
      }
    }

    // First time
    await hook?.event(assistantEvent as any)
    expect(recordSpy).toHaveBeenCalledTimes(1)

    // Second time (same message ID)
    await hook?.event(assistantEvent as any)
    expect(recordSpy).toHaveBeenCalledTimes(1) // Should still be 1
  })
})
