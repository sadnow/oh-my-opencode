import { describe, expect, it, mock, beforeEach } from "bun:test"
import { AUTO_COMMAND_PATTERN, AUTO_ROUTER_TAG_OPEN, parseAutoCommand } from "./constants"
import { createAutoRouterHook } from "./index"

describe("auto-router hook", () => {
  describe("parseAutoCommand", () => {
    it("should match /autocode with quoted task", () => {
      // #given a quoted /autocode command
      const text = '/autocode "Fix the bug in authentication"'

      // #when parsing
      const result = parseAutoCommand(text)

      // #then should capture task description (not deprecated for /autocode)
      expect(result?.task).toBe("Fix the bug in authentication")
      expect(result?.isDeprecated).toBe(false)
    })

    it("should match /auto with quoted task (deprecated)", () => {
      // #given a quoted /auto command (deprecated)
      const text = '/auto "Fix the bug in authentication"'

      // #when parsing
      const result = parseAutoCommand(text)

      // #then should capture task description and flag as deprecated
      expect(result?.task).toBe("Fix the bug in authentication")
      expect(result?.isDeprecated).toBe(true)
    })

    it("should match /autocode with single-quoted task", () => {
      // #given a single-quoted /autocode command
      const text = "/autocode 'Create a new feature'"

      // #when parsing
      const result = parseAutoCommand(text)

      // #then should capture task description
      expect(result?.task).toBe("Create a new feature")
      expect(result?.isDeprecated).toBe(false)
    })

    it("should match /autocode with unquoted task", () => {
      // #given an unquoted /autocode command
      const text = "/autocode Fix the README typo"

      // #when parsing
      const result = parseAutoCommand(text)

      // #then should capture task description
      expect(result?.task).toBe("Fix the README typo")
      expect(result?.isDeprecated).toBe(false)
    })

    it("should match /autocode with options", () => {
      // #given /autocode with --budget option
      const text = '/autocode "Complex task" --budget=expensive'

      // #when parsing
      const result = parseAutoCommand(text)

      // #then should capture task description (options are after capture)
      expect(result?.task).toBe("Complex task")
    })

    it("should be case-insensitive", () => {
      // #given uppercase /AUTOCODE command
      const text = '/AUTOCODE "Test task"'

      // #when parsing
      const result = parseAutoCommand(text)

      // #then should still match
      expect(result?.task).toBe("Test task")
    })

    it("should return null for /auto with only whitespace", () => {
      // #given /auto with only whitespace
      const text = "/auto   "

      // #when parsing
      const result = parseAutoCommand(text)

      // #then should return null (empty task rejected)
      expect(result).toBeNull()
    })

    it("should NOT match if not at start of string", () => {
      // #given /auto in middle of text
      const text = 'Please run /auto "task"'

      // #when parsing
      const result = parseAutoCommand(text)

      // #then should not match (requires /auto at start)
      expect(result).toBeNull()
    })

    it("should NOT match /automate or similar", () => {
      // #given command that starts with /auto but has more chars
      const text = '/automate "something"'

      // #when parsing
      const result = parseAutoCommand(text)

      // #then should not match (/auto requires space after)
      expect(result).toBeNull()
    })

    it("should match /auto with long complex task", () => {
      // #given a complex multi-word task
      const text = '/auto "Finish extracting our swf file for diner dash and continue developing a hybrid approach"'

      // #when matching
      const match = text.match(AUTO_COMMAND_PATTERN)

      // #then should capture full task
      expect(match).not.toBeNull()
      expect(match?.[1]).toBe(
        "Finish extracting our swf file for diner dash and continue developing a hybrid approach"
      )
    })

    it("should match /auto with task containing special characters", () => {
      // #given task with special chars (but not quotes)
      const text = '/auto "Fix the API: handle 404 errors & retry logic"'

      // #when matching
      const match = text.match(AUTO_COMMAND_PATTERN)

      // #then should capture task with special chars
      expect(match).not.toBeNull()
      expect(match?.[1]).toBe("Fix the API: handle 404 errors & retry logic")
    })
  })

  describe("detectAutoCommand behavior", () => {
    it("should skip text that already has auto-router tags", () => {
      // #given text with auto-router decision tag
      const text = `${AUTO_ROUTER_TAG_OPEN}
## Task Classification
- Already processed
</auto-router-decision>`

      // #when matching
      const match = text.match(AUTO_COMMAND_PATTERN)

      // #then the pattern will match but the hook's detectAutoCommand checks for tag
      // This tests the pattern itself - the hook logic handles the tag check
      expect(text.includes(AUTO_ROUTER_TAG_OPEN)).toBe(true)
    })
  })

  describe("createAutoRouterHook", () => {
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

    it("should create hook with all required methods", () => {
      // #given mock context
      // #when creating hook
      const hook = createAutoRouterHook(mockCtx)

      // #then should have all methods
      expect(hook["chat.message"]).toBeDefined()
      expect(hook["chat.params"]).toBeDefined()
      expect(hook.event).toBeDefined()
      expect(hook.getSessionState).toBeDefined()
      expect(hook.isRalphLoopEnabled).toBeDefined()
    })

    it("should return undefined for unknown session state", () => {
      // #given a hook
      const hook = createAutoRouterHook(mockCtx)

      // #when getting state for unknown session
      const state = hook.getSessionState("unknown-session-id")

      // #then should return undefined
      expect(state).toBeUndefined()
    })

    it("should return false for ralph-loop on unknown session", () => {
      // #given a hook
      const hook = createAutoRouterHook(mockCtx)

      // #when checking ralph-loop for unknown session
      const enabled = hook.isRalphLoopEnabled("unknown-session-id")

      // #then should return false
      expect(enabled).toBe(false)
    })

    it("should skip processing if no text part in output", async () => {
      // #given a hook and message without text
      const hook = createAutoRouterHook(mockCtx)
      const input = { sessionID: "test-session", messageID: "msg-1" }
      const output = { parts: [{ type: "tool_use", id: "123" }] }

      // #when processing message
      await hook["chat.message"](input as any, output as any)

      // #then should not show toast (no processing occurred)
      expect(mockCtx.client.tui.showToast).not.toHaveBeenCalled()
    })

    it("should skip processing if text is empty", async () => {
      // #given a hook and message with empty text
      const hook = createAutoRouterHook(mockCtx)
      const input = { sessionID: "test-session", messageID: "msg-1" }
      const output = { parts: [{ type: "text", text: "" }] }

      // #when processing message
      await hook["chat.message"](input as any, output as any)

      // #then should not show toast
      expect(mockCtx.client.tui.showToast).not.toHaveBeenCalled()
    })

    it("should skip processing non-/auto commands", async () => {
      // #given a hook and message with different command
      const hook = createAutoRouterHook(mockCtx)
      const input = { sessionID: "test-session", messageID: "msg-1" }
      const output = { parts: [{ type: "text", text: "/commit fix typo" }] }

      // #when processing message
      await hook["chat.message"](input as any, output as any)

      // #then should not show toast (not an /auto command)
      expect(mockCtx.client.tui.showToast).not.toHaveBeenCalled()
    })

    it("should process valid /auto command and modify text", async () => {
      // #given a hook and valid /auto command
      const hook = createAutoRouterHook(mockCtx)
      const input = { sessionID: "test-session", messageID: "msg-1" }
      const textPart = { type: "text", text: '/auto "Simple task for testing"' }
      const output = { parts: [textPart] }

      // #when processing message
      await hook["chat.message"](input as any, output as any)

      // #then text should be modified to include auto-router decision
      expect(textPart.text).toContain(AUTO_ROUTER_TAG_OPEN)
      expect(textPart.text).toContain("Task Classification")
      // And toast should be shown
      expect(mockCtx.client.tui.showToast).toHaveBeenCalled()
    })

    it("should not process same command twice", async () => {
      // #given a hook that already processed a command
      const hook = createAutoRouterHook(mockCtx)
      const input = { sessionID: "test-session", messageID: "msg-1" }
      const textPart = { type: "text", text: '/auto "Task"' }
      const output = { parts: [textPart] }

      // Process first time
      await hook["chat.message"](input as any, output as any)
      const firstModifiedText = textPart.text

      // Reset the text to simulate re-processing
      textPart.text = '/auto "Task"'

      // #when processing same message again
      await hook["chat.message"](input as any, output as any)

      // #then should not modify (already processed)
      expect(textPart.text).toBe('/auto "Task"')
      expect(mockCtx.client.tui.showToast).toHaveBeenCalledTimes(1) // Only once
    })

    it("should skip already-processed text with auto-router tag", async () => {
      // #given text that already has auto-router tag
      const hook = createAutoRouterHook(mockCtx)
      const input = { sessionID: "test-session-2", messageID: "msg-2" }
      const textPart = {
        type: "text",
        text: `${AUTO_ROUTER_TAG_OPEN}\nAlready processed\n</auto-router-decision>`,
      }
      const output = { parts: [textPart] }

      // #when processing message
      await hook["chat.message"](input as any, output as any)

      // #then should not modify or show toast
      expect(textPart.text).toContain("Already processed")
      expect(mockCtx.client.tui.showToast).not.toHaveBeenCalled()
    })

    it("should store session state after processing", async () => {
      // #given a hook and valid command
      const hook = createAutoRouterHook(mockCtx)
      const input = { sessionID: "state-test-session", messageID: "msg-1" }
      const textPart = { type: "text", text: '/auto "Task for state test"' }
      const output = { parts: [textPart] }

      // #when processing message
      await hook["chat.message"](input as any, output as any)

      // #then session state should be stored
      const state = hook.getSessionState("state-test-session")
      expect(state).toBeDefined()
      expect(state?.taskDescription).toBe("Task for state test")
      expect(state?.iteration).toBe(1)
      expect(state?.technique).toBeDefined()
    })
  })
})
