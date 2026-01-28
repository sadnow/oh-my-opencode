import { describe, expect, test, beforeEach } from "bun:test"
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

  test("hook registers chat.message handler when tracker exists", () => {
    // #given: Usage tracker exists
    const hook = createUsageTrackingHook(mockContext, usageTracker)

    // #then: Hook should return object with chat.message handler
    expect(hook).not.toBeNull()
    expect(hook?.["chat.message"]).toBeDefined()
    expect(typeof hook?.["chat.message"]).toBe("function")
  })

  test("hook tracks user message tokens", async () => {
    // #given: Hook with user message
    const hook = createUsageTrackingHook(mockContext, usageTracker)
    const input = {
      sessionID: "test-session-123",
      agent: "sisyphus",
    }
    const output = {
      message: {
        info: { role: "user" as const, agent: "sisyphus" },
      },
      parts: [
        { type: "text", text: "Hello, how are you today?" },
      ],
    }

    // #when: Hook processes user message
    await hook?.["chat.message"](input, output)

    // #then: Should NOT record usage yet (waits for assistant response)
    const summaries = usageTracker.getAllSummaries()
    expect(Object.keys(summaries).length).toBe(0)
  })

  test("hook records assistant response with estimated tokens", async () => {
    // #given: Hook with user message followed by assistant response
    const hook = createUsageTrackingHook(mockContext, usageTracker)
    const sessionID = "test-session-456"

    // User message
    await hook?.["chat.message"](
      { sessionID, agent: "sisyphus" },
      {
        message: {
          info: { role: "user" as const, agent: "sisyphus" },
        },
        parts: [{ type: "text", text: "Write a hello world function" }],
      }
    )

    // Assistant response
    await hook?.["chat.message"](
      { sessionID, agent: "sisyphus", model: { providerID: "anthropic", modelID: "claude-opus-4-5" } },
      {
        message: {
          info: {
            role: "assistant" as const,
            agent: "sisyphus",
            model: "anthropic/claude-opus-4-5",
          },
        },
        parts: [
          { type: "text", text: "Here's a hello world function:\n\nfunction helloWorld() {\n  console.log('Hello, World!');\n}\n\nThis function prints 'Hello, World!' to the console." },
        ],
      }
    )

    // #then: Usage should be recorded
    const summaries = usageTracker.getAllSummaries()
    expect(Object.keys(summaries).length).toBeGreaterThan(0)

    const anthropicSummary = summaries["anthropic"]
    expect(anthropicSummary).toBeDefined()
    expect(anthropicSummary.totalInputTokens).toBeGreaterThan(0)
    expect(anthropicSummary.totalOutputTokens).toBeGreaterThan(0)
    expect(anthropicSummary.totalCost).toBeGreaterThan(0)
  })

  test("hook handles multiple sessions independently", async () => {
    // #given: Hook tracking two different sessions
    const hook = createUsageTrackingHook(mockContext, usageTracker)

    // Session 1
    await hook?.["chat.message"](
      { sessionID: "session-1", agent: "sisyphus" },
      {
        message: { info: { role: "user" as const, agent: "sisyphus" } },
        parts: [{ type: "text", text: "First question" }],
      }
    )
    await hook?.["chat.message"](
      { sessionID: "session-1", agent: "sisyphus" },
      {
        message: {
          info: {
            role: "assistant" as const,
            agent: "sisyphus",
            model: "openai/gpt-5.2",
          },
        },
        parts: [{ type: "text", text: "First answer with some content" }],
      }
    )

    // Session 2
    await hook?.["chat.message"](
      { sessionID: "session-2", agent: "oracle" },
      {
        message: { info: { role: "user" as const, agent: "oracle" } },
        parts: [{ type: "text", text: "Second question" }],
      }
    )
    await hook?.["chat.message"](
      { sessionID: "session-2", agent: "oracle" },
      {
        message: {
          info: {
            role: "assistant" as const,
            agent: "oracle",
            model: "openai/gpt-5.2",
          },
        },
        parts: [{ type: "text", text: "Second answer with different content" }],
      }
    )

    // #then: Both sessions should contribute to OpenAI usage
    const summaries = usageTracker.getAllSummaries()
    const openaiSummary = summaries["openai"]
    expect(openaiSummary).toBeDefined()
    expect(openaiSummary.totalCost).toBeGreaterThan(0)
  })

  test("hook estimates tokens from tool_use and tool_result parts", async () => {
    // #given: Assistant response with tool usage
    const hook = createUsageTrackingHook(mockContext, usageTracker)
    const sessionID = "test-session-tool"

    // User message
    await hook?.["chat.message"](
      { sessionID, agent: "sisyphus" },
      {
        message: { info: { role: "user" as const } },
        parts: [{ type: "text", text: "List files" }],
      }
    )

    // Assistant response with tool use
    await hook?.["chat.message"](
      { sessionID, agent: "sisyphus" },
      {
        message: {
          info: {
            role: "assistant" as const,
            model: "google/gemini-3-pro",
          },
        },
        parts: [
          { type: "text", text: "Let me list the files for you." },
          {
            type: "tool_use",
            name: "bash",
            input: { command: "ls -la" },
          },
          {
            type: "tool_result",
            output: "total 48\ndrwxr-xr-x 12 user user 4096 file1.txt\nfile2.txt",
          },
          { type: "text", text: "Here are the files in the directory." },
        ],
      }
    )

    // #then: Should estimate tokens from all parts including tool use/result
    const summaries = usageTracker.getAllSummaries()
    const googleSummary = summaries["google"]
    expect(googleSummary).toBeDefined()
    expect(googleSummary.totalOutputTokens).toBeGreaterThan(0)
  })

  test("hook handles missing message info gracefully", async () => {
    // #given: Message without proper info structure
    const hook = createUsageTrackingHook(mockContext, usageTracker)

    const input = { sessionID: "test-malformed", agent: "test" }
    const output = {
      message: { someOtherField: "value" }, // Missing 'info'
      parts: [{ type: "text", text: "test" }],
    }

    // #when: Hook processes malformed message
    // #then: Should not crash
    await expect(hook?.["chat.message"](input, output as any)).resolves.toBeUndefined()

    // No usage recorded
    const summaries = usageTracker.getAllSummaries()
    expect(Object.keys(summaries).length).toBe(0)
  })

  test("hook extracts correct provider from model string", async () => {
    // #given: Messages from different providers
    const hook = createUsageTrackingHook(mockContext, usageTracker)

    const testCases = [
      { model: "anthropic/claude-sonnet-4-5", expectedProvider: "anthropic" },
      { model: "openai/gpt-5.2", expectedProvider: "openai" },
      { model: "google/gemini-3-pro", expectedProvider: "google" },
      { model: "opencode/kimi-k2-thinking", expectedProvider: "moonshot" },
      { model: "opencode/glm-4.7", expectedProvider: "zhipu" },
    ]

    for (const { model, expectedProvider } of testCases) {
      const sessionID = `test-${expectedProvider}`

      // User message
      await hook?.["chat.message"](
        { sessionID },
        {
          message: { info: { role: "user" as const } },
          parts: [{ type: "text", text: "test" }],
        }
      )

      // Assistant response
      await hook?.["chat.message"](
        { sessionID },
        {
          message: {
            info: { role: "assistant" as const, model },
          },
          parts: [{ type: "text", text: "Response" }],
        }
      )
    }

    // #then: Each provider should have separate summary
    const summaries = usageTracker.getAllSummaries()
    expect(summaries["anthropic"]).toBeDefined()
    expect(summaries["openai"]).toBeDefined()
    expect(summaries["google"]).toBeDefined()
    expect(summaries["moonshot"]).toBeDefined()
    expect(summaries["zhipu"]).toBeDefined()
  })
})
