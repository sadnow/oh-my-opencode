/**
 * Integration test for auto-router + auto-slash-command interaction
 * Verifies that /auto is properly handled by auto-router and skipped by auto-slash-command
 */
import { describe, expect, it, mock, beforeEach } from "bun:test"
import { createAutoRouterHook } from "./index"
import { createAutoSlashCommandHook } from "../auto-slash-command"
import { AUTO_ROUTER_TAG_OPEN } from "./constants"
import { AUTO_SLASH_COMMAND_TAG_OPEN } from "../auto-slash-command/constants"

describe("auto-router + auto-slash-command integration", () => {
  const mockCtx = {
    directory: "/test/project",
    client: {
      tui: {
        showToast: mock(() => Promise.resolve()),
      },
    },
  } as any

  beforeEach(() => {
    mockCtx.client.tui.showToast.mockClear()
  })

  it("should handle /auto via auto-router, not auto-slash-command", async () => {
    // #given both hooks
    const autoRouter = createAutoRouterHook(mockCtx)
    const autoSlashCommand = createAutoSlashCommandHook()

    // #given a /auto command
    const input = { sessionID: "integration-test", messageID: "msg-1" }
    const textPart = { type: "text", text: '/auto "Test the integration"' }
    const output = { parts: [textPart] }

    // #when processing through both hooks (order matters!)
    // Auto-router MUST run first
    await autoRouter["chat.message"](input as any, output as any)
    await autoSlashCommand["chat.message"](input as any, output as any)

    // #then auto-router should have modified the text
    expect(textPart.text).toContain(AUTO_ROUTER_TAG_OPEN)
    expect(textPart.text).toContain("Task Classification")

    // #and auto-slash-command should NOT have touched it
    expect(textPart.text).not.toContain(AUTO_SLASH_COMMAND_TAG_OPEN)
    expect(textPart.text).not.toContain("AUTO-SLASH-COMMAND ERROR")
  })

  it("should let auto-slash-command handle other commands", async () => {
    // #given both hooks
    const autoRouter = createAutoRouterHook(mockCtx)
    const autoSlashCommand = createAutoSlashCommandHook()

    // #given a different command (not /auto)
    const input = { sessionID: "other-cmd-test", messageID: "msg-1" }
    const textPart = { type: "text", text: "/commit fix the bug" }
    const output = { parts: [textPart] }

    // #when processing through both hooks
    await autoRouter["chat.message"](input as any, output as any)
    await autoSlashCommand["chat.message"](input as any, output as any)

    // #then auto-router should NOT have modified it
    expect(textPart.text).not.toContain(AUTO_ROUTER_TAG_OPEN)

    // #and auto-slash-command SHOULD have processed it
    // (it will show error since /commit isn't a real skill, but the tag should be there)
    expect(textPart.text).toContain(AUTO_SLASH_COMMAND_TAG_OPEN)
  })

  it("should properly exclude /auto in auto-slash-command detector", async () => {
    // #given only auto-slash-command hook (simulating if auto-router was disabled)
    const autoSlashCommand = createAutoSlashCommandHook()

    // #given a /auto command
    const input = { sessionID: "exclusion-test", messageID: "msg-1" }
    const textPart = { type: "text", text: '/auto "Should be excluded"' }
    const output = { parts: [textPart] }

    // #when processing only through auto-slash-command
    await autoSlashCommand["chat.message"](input as any, output as any)

    // #then auto-slash-command should have skipped it (excluded command)
    // Text should remain unchanged
    expect(textPart.text).toBe('/auto "Should be excluded"')
    expect(textPart.text).not.toContain(AUTO_SLASH_COMMAND_TAG_OPEN)
    expect(textPart.text).not.toContain("Command not found")
  })

  it("should handle multiple sequential /auto commands in different sessions", async () => {
    // #given auto-router hook
    const autoRouter = createAutoRouterHook(mockCtx)

    // #when processing /auto in session 1
    const input1 = { sessionID: "session-1", messageID: "msg-1" }
    const textPart1 = { type: "text", text: '/auto "Task for session 1"' }
    const output1 = { parts: [textPart1] }
    await autoRouter["chat.message"](input1 as any, output1 as any)

    // #and processing /auto in session 2
    const input2 = { sessionID: "session-2", messageID: "msg-1" }
    const textPart2 = { type: "text", text: '/auto "Task for session 2"' }
    const output2 = { parts: [textPart2] }
    await autoRouter["chat.message"](input2 as any, output2 as any)

    // #then both should be processed independently
    expect(textPart1.text).toContain(AUTO_ROUTER_TAG_OPEN)
    expect(textPart2.text).toContain(AUTO_ROUTER_TAG_OPEN)

    // #and session states should be stored separately
    const state1 = autoRouter.getSessionState("session-1")
    const state2 = autoRouter.getSessionState("session-2")
    expect(state1?.taskDescription).toBe("Task for session 1")
    expect(state2?.taskDescription).toBe("Task for session 2")
  })

  it("should include model tier recommendation in injected prompt", async () => {
    // #given auto-router hook
    const autoRouter = createAutoRouterHook(mockCtx)

    // #when processing a /auto command
    const input = { sessionID: "model-tier-test", messageID: "msg-1" }
    const textPart = { type: "text", text: '/auto "Check model tier injection"' }
    const output = { parts: [textPart] }
    await autoRouter["chat.message"](input as any, output as any)

    // #then should include model tier section
    expect(textPart.text).toContain("MODEL TIER")
    expect(textPart.text).toMatch(/auto-(free|cheap|moderate|expensive|maximum)/)
    expect(textPart.text).toContain("sisyphus_task")
  })

  it("should show toast notification with technique and budget", async () => {
    // #given auto-router hook with fresh mock
    mockCtx.client.tui.showToast.mockClear()
    const autoRouter = createAutoRouterHook(mockCtx)

    // #when processing a /auto command
    const input = { sessionID: "toast-test", messageID: "msg-1" }
    const textPart = { type: "text", text: '/auto "Test toast notification"' }
    const output = { parts: [textPart] }
    await autoRouter["chat.message"](input as any, output as any)

    // #then toast should be shown with technique and budget
    expect(mockCtx.client.tui.showToast).toHaveBeenCalledTimes(1)
    const toastCall = mockCtx.client.tui.showToast.mock.calls[0][0]
    expect(toastCall.body.title).toBe("Auto-Router Active")
    expect(toastCall.body.message).toMatch(/Technique:/)
    expect(toastCall.body.message).toMatch(/Budget:/)
  })
})
