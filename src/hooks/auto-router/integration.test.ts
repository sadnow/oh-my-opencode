/**
 * Integration test for auto-router + auto-slash-command interaction
 * Verifies that /auto is properly handled by auto-router and skipped by auto-slash-command
 *
 * Also includes tests for:
 * - Verbose notification formatting
 * - Sanitizer integration
 * - Magic keyword handling
 */
import { describe, expect, it, mock, beforeEach } from "bun:test"
import { createAutoRouterHook } from "./index"
import { createAutoSlashCommandHook } from "../auto-slash-command"
import { AUTO_ROUTER_TAG_OPEN, parseAutoCommand } from "./constants"
import { AUTO_SLASH_COMMAND_TAG_OPEN } from "../auto-slash-command/constants"
import {
  createAutoRouter,
  BUDGET_TIERS,
  MAGIC_KEYWORDS,
  techniqueIncludes,
  shouldEnableRalphLoop,
} from "../../features/auto-router"
import {
  sanitizeForLogging,
  sanitizeObject,
  isSensitiveKey,
  isSensitiveValue,
  sanitizeErrorMessage,
} from "../../shared/sanitize"
import {
  formatClassificationToast,
  formatClassificationDetailsToast,
  formatEscalationToast,
  formatMagicKeywordToast,
  toSimpleToast,
} from "../../shared/notifications"
import type { TaskClassification, BudgetTier, TechniqueCombo } from "../../features/auto-router/types"

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

// ============================================================================
// SANITIZER INTEGRATION TESTS
// ============================================================================

describe("Sanitizer Integration", () => {
  describe("API Key Detection", () => {
    it("detects OpenAI API keys", () => {
      expect(isSensitiveValue("sk-1234567890abcdefghijklmnop")).toBe(true)
      expect(isSensitiveValue("sk-proj-abcdefghijklmnopqrstu")).toBe(true)
    })

    it("detects Anthropic API keys", () => {
      expect(isSensitiveValue("sk-ant-api03-abcdefghijklmnopqrstu")).toBe(true)
    })

    it("detects Google API keys", () => {
      expect(isSensitiveValue("AIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz12345")).toBe(true)
    })

    it("detects GitHub tokens", () => {
      expect(isSensitiveValue("ghp_abcdefghijklmnopqrstuvwxyz123456789012")).toBe(true)
      expect(isSensitiveValue("gho_abcdefghijklmnopqrstuvwxyz123456789012")).toBe(true)
    })

    it("detects JWT tokens", () => {
      expect(isSensitiveValue("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.")).toBe(true)
    })
  })

  describe("Key Name Detection", () => {
    it("detects sensitive key names", () => {
      expect(isSensitiveKey("api_key")).toBe(true)
      expect(isSensitiveKey("apiKey")).toBe(true)
      expect(isSensitiveKey("secret")).toBe(true)
      expect(isSensitiveKey("token")).toBe(true)
      expect(isSensitiveKey("password")).toBe(true)
      expect(isSensitiveKey("ANTHROPIC_API_KEY")).toBe(true)
    })

    it("allows non-sensitive key names", () => {
      expect(isSensitiveKey("username")).toBe(false)
      expect(isSensitiveKey("email")).toBe(false)
    })
  })

  describe("Object Sanitization", () => {
    it("sanitizes nested objects with sensitive data", () => {
      const input = {
        config: {
          api_key: "sk-1234567890abcdefghijklmnop",
          endpoint: "https://api.example.com",
        },
      }

      const result = sanitizeObject(input) as any
      expect(result.config.api_key).toContain("[REDACTED]")
      expect(result.config.endpoint).toBe("https://api.example.com")
    })
  })

  describe("Error Message Sanitization", () => {
    it("sanitizes API keys in error messages", () => {
      const message = "Failed with key sk-1234567890abcdefghijklmnop"
      const result = sanitizeErrorMessage(message)
      expect(result).toContain("[REDACTED]")
    })
  })
})

// ============================================================================
// NOTIFICATION FORMATTING INTEGRATION TESTS
// ============================================================================

describe("Notification Formatting Integration", () => {
  const mockClassification: TaskClassification = {
    projectType: "web-app",
    projectMaturity: "established",
    complexityTier: 2,
    estimatedSteps: 5,
    noveltyLevel: "familiar",
    hasTests: true,
    hasBuildGates: true,
    hasTypeChecking: true,
    hasLinting: true,
    needsLlmJudge: false,
    parallelizationPotential: "high",
    contextExhaustionRisk: "low",
    domainSignals: ["backend-logic", "testing"],
    complexityScore: 8.5,
  }

  describe("Classification Toast", () => {
    it("formats classification toast correctly", () => {
      const toast = formatClassificationToast(
        mockClassification,
        "ultrathink+ulw",
        "moderate",
        "google/antigravity-gemini-3-flash",
        0.7
      )

      expect(toast.title).toBe("Auto-Router Active")
      expect(toast.variant).toBe("info")
      expect(toast.lines.length).toBeGreaterThan(0)
    })

    it("includes technique and budget in toast", () => {
      const toast = formatClassificationToast(
        mockClassification,
        "triple",
        "expensive",
        "github-copilot/claude-sonnet-4",
        0.8
      )

      const simple = toSimpleToast(toast)
      expect(simple.message).toContain("Triple")
    })
  })

  describe("Escalation Toast", () => {
    it("formats escalation with reason", () => {
      const toast = formatEscalationToast(
        "cheap",
        "moderate",
        "consecutive failures",
        1,
        3
      )

      expect(toast.title).toContain("Budget Escalated")
      expect(toast.variant).toBe("warning")
    })
  })

  describe("Magic Keyword Toast", () => {
    it("formats magic keyword toast", () => {
      const toast = formatMagicKeywordToast("ultrawork", "ulw", "moderate")

      expect(toast.title).toContain("ultrawork")
    })
  })
})

// ============================================================================
// RALPH LOOP INTEGRATION TESTS
// ============================================================================

describe("Ralph Loop Integration", () => {
  it("shouldEnableRalphLoop correctly determines ralph for complex tasks", () => {
    // Tier 3 should always enable ralph
    expect(shouldEnableRalphLoop(3, "known", [], true)).toBe(true)

    // Novel tier 2 should enable ralph
    expect(shouldEnableRalphLoop(2, "novel", [], true)).toBe(true)

    // Familiar tier 1 should not enable ralph
    expect(shouldEnableRalphLoop(1, "familiar", [], true)).toBe(false)

    // High-risk domains should enable ralph
    expect(shouldEnableRalphLoop(1, "familiar", ["crypto-trading"], true)).toBe(true)
  })

  it("techniqueIncludes correctly identifies ralph techniques", () => {
    expect(techniqueIncludes("ralph", "ralph")).toBe(true)
    expect(techniqueIncludes("ulw+ralph", "ralph")).toBe(true)
    expect(techniqueIncludes("triple", "ralph")).toBe(true)
    expect(techniqueIncludes("direct", "ralph")).toBe(false)
    expect(techniqueIncludes("ulw", "ralph")).toBe(false)
  })
})

// ============================================================================
// BUDGET TIER INTEGRATION TESTS
// ============================================================================

describe("Budget Tier Integration", () => {
  it("all budget tiers have valid configuration", () => {
    const tiers: BudgetTier[] = ["free", "cheap", "moderate", "expensive", "maximum"]

    for (const tier of tiers) {
      const config = BUDGET_TIERS[tier]
      expect(config).toBeDefined()
      expect(config.models).toBeDefined()
      expect(config.models.primary).toBeTruthy()
      expect(config.maxIterations).toBeGreaterThan(0)
    }
  })

  it("budget tier iterations increase with tier", () => {
    expect(BUDGET_TIERS.free.maxIterations).toBeLessThanOrEqual(BUDGET_TIERS.cheap.maxIterations)
    expect(BUDGET_TIERS.cheap.maxIterations).toBeLessThanOrEqual(BUDGET_TIERS.moderate.maxIterations)
    expect(BUDGET_TIERS.moderate.maxIterations).toBeLessThanOrEqual(BUDGET_TIERS.expensive.maxIterations)
  })
})

// ============================================================================
// MAGIC KEYWORD INTEGRATION TESTS
// ============================================================================

describe("Magic Keyword Integration", () => {
  it("all magic keywords have valid configuration", () => {
    const keywords = Object.keys(MAGIC_KEYWORDS)

    expect(keywords.length).toBeGreaterThan(0)

    for (const keyword of keywords) {
      const config = MAGIC_KEYWORDS[keyword as keyof typeof MAGIC_KEYWORDS]
      expect(config.technique).toBeTruthy()
      expect(config.budget).toBeTruthy()
    }
  })

  it("magic keywords map to valid techniques and budgets", () => {
    const validTechniques: TechniqueCombo[] = [
      "direct", "ulw", "ultrathink", "ralph",
      "ulw+ralph", "ultrathink+ulw", "ultrathink+ralph", "triple"
    ]
    const validBudgets: BudgetTier[] = ["free", "cheap", "moderate", "expensive", "maximum"]

    for (const [keyword, config] of Object.entries(MAGIC_KEYWORDS)) {
      expect(validTechniques).toContain(config.technique)
      expect(validBudgets).toContain(config.budget)
    }
  })
})

// ============================================================================
// END-TO-END INTEGRATION TESTS
// ============================================================================

describe("End-to-End Integration", () => {
  it("complete flow from task to notification", async () => {
    // 1. Classify task
    const result = await createAutoRouter(
      "refactor the authentication system for better security",
      process.cwd(),
      {
        enabled: true,
        defaultBudget: "cheap",
        qualityThreshold: 0.7,
      }
    )

    // 2. Generate notifications
    const classificationToast = formatClassificationToast(
      result.classification,
      result.selectedTechnique,
      result.startingBudget,
      BUDGET_TIERS[result.startingBudget].models.primary,
      0.7
    )

    // 3. Verify all data is valid
    expect(classificationToast.title).toBeTruthy()
    expect(classificationToast.lines.length).toBeGreaterThan(0)

    // 4. Verify sanitization doesn't break data
    const sanitizedSummary = sanitizeForLogging({
      classification: result.classification,
      technique: result.selectedTechnique,
      budget: result.startingBudget,
    })

    expect(sanitizedSummary).toBeDefined()
  })

  it("verbose mode produces detailed output", async () => {
    const result = await createAutoRouter(
      "build a user dashboard with real-time updates",
      process.cwd(),
      { enabled: true, defaultBudget: "moderate" }
    )

    // Verbose details toast
    const verboseToast = formatClassificationDetailsToast(result.classification)

    // Verbose should provide additional info
    expect(verboseToast.lines.length).toBeGreaterThan(0)
    expect(verboseToast.lines.some(l => l.includes("Project"))).toBe(true)
  })
})

// ============================================================================
// TASK INTENT PRESERVATION TESTS (v3.6.3)
// ============================================================================

import { extractTaskIntent, filterDomainSignalsByIntent, containsIgnorableArtifactSignals } from "../../features/auto-router/classifier"
import type { DomainSignal } from "../../features/auto-router/types"

describe("Task Intent Preservation (v3.6.3)", () => {
  describe("extractTaskIntent", () => {
    it("should detect 'test' intent from play/test keywords", () => {
      const result = extractTaskIntent("play through the entire game with playwright")

      expect(result.primaryIntent).toBe("test")
      expect(result.intents).toContain("test")
      expect(result.requiredTools).toContain("playwright")
    })

    it("should detect playwright as required tool", () => {
      const result = extractTaskIntent("test the game using playwright")

      expect(result.requiredTools).toContain("playwright")
    })

    it("should detect cypress as required tool", () => {
      const result = extractTaskIntent("run e2e tests with cypress")

      expect(result.requiredTools).toContain("cypress")
      expect(result.primaryIntent).toBe("test")
    })

    it("should detect puppeteer as required tool", () => {
      const result = extractTaskIntent("automate the browser with puppeteer")

      expect(result.requiredTools).toContain("puppeteer")
    })

    it("should detect deploy intent only when explicitly requested", () => {
      const result = extractTaskIntent("deploy the application to production")

      expect(result.primaryIntent).toBe("deploy")
      expect(result.intents).toContain("deploy")
    })

    it("should NOT detect deploy intent from 'test'/'play' prompts", () => {
      const result = extractTaskIntent("play through the game and verify it works")

      expect(result.primaryIntent).toBe("test")
      expect(result.intents).not.toContain("deploy")
    })

    it("should detect build intent", () => {
      const result = extractTaskIntent("create a new authentication system")

      expect(result.primaryIntent).toBe("build")
    })

    it("should detect fix intent", () => {
      const result = extractTaskIntent("fix the login bug in the auth module")

      expect(result.primaryIntent).toBe("fix")
    })

    it("should return unknown for ambiguous prompts", () => {
      const result = extractTaskIntent("the application needs attention")

      expect(result.primaryIntent).toBe("unknown")
    })

    it("should handle multiple intents but return primary", () => {
      // "play" triggers "test", "fix" triggers "fix"
      const result = extractTaskIntent("play through the game and fix any bugs")

      // Primary should be the first detected (test from "play")
      expect(result.primaryIntent).toBe("test")
      expect(result.intents.length).toBeGreaterThan(1)
    })
  })

  describe("filterDomainSignalsByIntent", () => {
    it("should remove infrastructure signals for testing tasks", () => {
      const domainSignals: DomainSignal[] = ["testing", "infrastructure", "ui-heavy"]

      const filtered = filterDomainSignalsByIntent(domainSignals, "test", ["playwright"])

      expect(filtered).toContain("testing")
      expect(filtered).not.toContain("infrastructure")
      expect(filtered).toContain("ui-heavy")
    })

    it("should keep all signals for deploy tasks", () => {
      const domainSignals: DomainSignal[] = ["testing", "infrastructure", "ui-heavy"]

      const filtered = filterDomainSignalsByIntent(domainSignals, "deploy", [])

      expect(filtered).toContain("infrastructure")
    })

    it("should filter based on playwright tool even without test intent", () => {
      const domainSignals: DomainSignal[] = ["infrastructure", "testing"]

      const filtered = filterDomainSignalsByIntent(domainSignals, "unknown", ["playwright"])

      expect(filtered).not.toContain("infrastructure")
    })
  })

  describe("containsIgnorableArtifactSignals", () => {
    it("should detect 'next step' in documentation", () => {
      const text = "## Next Steps\n\nDeploy to Vercel and test on mobile"

      expect(containsIgnorableArtifactSignals(text)).toBe(true)
    })

    it("should detect 'todo' suggestions", () => {
      const text = "TODO: Add authentication before deploying"

      expect(containsIgnorableArtifactSignals(text)).toBe(true)
    })

    it("should detect 'recommended' suggestions", () => {
      const text = "It's recommended to deploy to Vercel for best performance"

      expect(containsIgnorableArtifactSignals(text)).toBe(true)
    })

    it("should NOT flag normal task descriptions", () => {
      const text = "Fix the login bug and add unit tests"

      expect(containsIgnorableArtifactSignals(text)).toBe(false)
    })
  })

  describe("shouldEnableRalphLoop with task intent (v3.6.3)", () => {
    it("should enable ralph loop for 'test' intent even at tier 1", () => {
      const result = shouldEnableRalphLoop(
        1,       // Tier 1 (simple)
        "familiar",
        [],
        true,
        "test",  // Task intent: testing
        []
      )

      expect(result).toBe(true)
    })

    it("should enable ralph loop for playwright tool even at tier 1", () => {
      const result = shouldEnableRalphLoop(
        1,       // Tier 1 (simple)
        "known",
        [],
        true,
        "unknown",
        ["playwright"]  // Required tool
      )

      expect(result).toBe(true)
    })

    it("should enable ralph loop for cypress tool", () => {
      const result = shouldEnableRalphLoop(1, "familiar", [], true, "unknown", ["cypress"])

      expect(result).toBe(true)
    })

    it("should enable ralph loop for puppeteer tool", () => {
      const result = shouldEnableRalphLoop(1, "known", [], true, "unknown", ["puppeteer"])

      expect(result).toBe(true)
    })

    it("should NOT enable ralph loop for simple build tasks without intent/tools", () => {
      const result = shouldEnableRalphLoop(1, "known", [], true, "build", [])

      expect(result).toBe(false)
    })

    it("should enable ralph loop for 'play' intent", () => {
      const result = shouldEnableRalphLoop(1, "familiar", [], true, "play", [])

      // "play" should be treated as testing intent
      // Note: The function checks for lowercase and includes "test", "play", etc.
      expect(result).toBe(true)
    })

    it("should enable ralph loop for 'verify' intent", () => {
      const result = shouldEnableRalphLoop(1, "familiar", [], true, "verify", [])

      expect(result).toBe(true)
    })

    it("should enable ralph loop for 'e2e' intent", () => {
      const result = shouldEnableRalphLoop(1, "familiar", [], true, "e2e", [])

      expect(result).toBe(true)
    })
  })
})

// ============================================================================
// SESSION CONTEXT PRESERVATION TESTS (v3.6.3)
// ============================================================================

describe("Session Context Preservation (v3.6.3)", () => {
  const mockCtx = {
    directory: "/test/project",
    client: {
      tui: {
        showToast: mock(() => Promise.resolve()),
      },
    },
  } as any

  it("should store task intent in session state", async () => {
    // #given auto-router hook
    const autoRouter = createAutoRouterHook(mockCtx)

    // #when processing a playwright task
    const input = { sessionID: "intent-test", messageID: "msg-1" }
    const textPart = { type: "text", text: '/auto "play through the game with playwright"' }
    const output = { parts: [textPart] }
    await autoRouter["chat.message"](input as any, output as any)

    // #then session state should contain task intent
    const state = autoRouter.getSessionState("intent-test")
    expect(state?.taskIntent).toBe("test")
    expect(state?.requiredTools).toContain("playwright")
    expect(state?.ralphLoopEnabled).toBe(true)
  })

  it("should enable ralph loop for playwright tasks", async () => {
    // #given auto-router hook
    const autoRouter = createAutoRouterHook(mockCtx)

    // #when processing a playwright task
    const input = { sessionID: "ralph-playwright-test", messageID: "msg-1" }
    const textPart = { type: "text", text: '/auto "test with playwright"' }
    const output = { parts: [textPart] }
    await autoRouter["chat.message"](input as any, output as any)

    // #then ralph loop should be enabled
    expect(autoRouter.isRalphLoopEnabled("ralph-playwright-test")).toBe(true)
  })

  it("should inject required tools warning in prompt", async () => {
    // #given auto-router hook
    const autoRouter = createAutoRouterHook(mockCtx)

    // #when processing a playwright task
    const input = { sessionID: "inject-test", messageID: "msg-1" }
    const textPart = { type: "text", text: '/auto "run e2e tests with playwright"' }
    const output = { parts: [textPart] }
    await autoRouter["chat.message"](input as any, output as any)

    // #then prompt should contain required tools warning
    expect(textPart.text).toContain("REQUIRED TOOLS")
    expect(textPart.text).toContain("playwright")
    expect(textPart.text).toContain("DO NOT IGNORE")
  })

  it("should inject testing intent warning in prompt", async () => {
    // #given auto-router hook
    const autoRouter = createAutoRouterHook(mockCtx)

    // #when processing a test task
    const input = { sessionID: "intent-inject-test", messageID: "msg-1" }
    const textPart = { type: "text", text: '/auto "play through the game and verify it works"' }
    const output = { parts: [textPart] }
    await autoRouter["chat.message"](input as any, output as any)

    // #then prompt should contain testing intent warning
    expect(textPart.text).toContain("TASK INTENT: TESTING")
    expect(textPart.text).toContain("Do NOT deploy")
    expect(textPart.text).toContain("Ignore deployment suggestions")
  })
})

// ============================================================================
// PARSE AUTO COMMAND TESTS (v3.6.3)
// ============================================================================

describe("parseAutoCommand", () => {
  describe("quoted strings", () => {
    it("should parse double-quoted task with /autocode", () => {
      const result = parseAutoCommand('/autocode "fix the bug"')
      expect(result?.task).toBe("fix the bug")
      expect(result?.isDeprecated).toBe(false)
    })

    it("should parse double-quoted task with /auto (deprecated)", () => {
      const result = parseAutoCommand('/auto "fix the bug"')
      expect(result?.task).toBe("fix the bug")
      expect(result?.isDeprecated).toBe(true)
    })

    it("should parse single-quoted task", () => {
      const result = parseAutoCommand("/autocode 'fix the bug'")
      expect(result?.task).toBe("fix the bug")
    })

    it("should handle quotes with special characters inside", () => {
      const result = parseAutoCommand('/autocode "fix the \\"nested\\" quotes"')
      // Note: This captures up to the first unescaped quote
      expect(result).toBeTruthy()
    })

    it("should handle empty quotes", () => {
      const result = parseAutoCommand('/autocode ""')
      expect(result).toBe(null) // Empty task should return null
    })
  })

  describe("unquoted strings", () => {
    it("should parse unquoted task", () => {
      const result = parseAutoCommand("/autocode fix the login bug")
      expect(result?.task).toBe("fix the login bug")
    })

    it("should trim whitespace", () => {
      const result = parseAutoCommand("/autocode   fix the bug   ")
      expect(result?.task).toBe("fix the bug")
    })

    it("should handle single word", () => {
      const result = parseAutoCommand("/autocode deploy")
      expect(result?.task).toBe("deploy")
    })
  })

  describe("multiline support", () => {
    it("should capture multiline task description", () => {
      const result = parseAutoCommand(`/autocode implement the feature:
- Step 1: Create component
- Step 2: Add tests
- Step 3: Deploy`)

      expect(result?.task).toContain("implement the feature")
      expect(result?.task).toContain("Step 1")
      expect(result?.task).toContain("Step 2")
      expect(result?.task).toContain("Step 3")
    })

    it("should handle newlines in middle of text", () => {
      const result = parseAutoCommand("/autocode first line\nsecond line\nthird line")
      expect(result?.task).toContain("first line")
      expect(result?.task).toContain("second line")
      expect(result?.task).toContain("third line")
    })
  })

  describe("with options", () => {
    it("should stop at --budget option", () => {
      const result = parseAutoCommand("/autocode fix the bug --budget=expensive")
      expect(result?.task).toBe("fix the bug")
    })

    it("should stop at --force-technique option", () => {
      const result = parseAutoCommand("/autocode fix the bug --force-technique=triple")
      expect(result?.task).toBe("fix the bug")
    })

    it("should handle quoted task with options", () => {
      const result = parseAutoCommand('/autocode "fix the bug" --budget=moderate')
      expect(result?.task).toBe("fix the bug")
    })

    it("should handle multiline with options", () => {
      const result = parseAutoCommand(`/autocode implement this:
- feature A
- feature B --budget=expensive`)
      // Should NOT include --budget as part of task
      expect(result?.task).not.toContain("--budget")
    })
  })

  describe("edge cases", () => {
    it("should return null for non /autocode commands", () => {
      expect(parseAutoCommand("/commit message")).toBe(null)
      expect(parseAutoCommand("just some text")).toBe(null)
      expect(parseAutoCommand("/automate something")).toBe(null)
    })

    it("should return null for /autocode without task", () => {
      expect(parseAutoCommand("/autocode")).toBe(null)
      expect(parseAutoCommand("/autocode ")).toBe(null)
      expect(parseAutoCommand("/autocode   ")).toBe(null)
    })

    it("should be case insensitive for /autocode", () => {
      expect(parseAutoCommand("/AUTOCODE fix bug")?.task).toBe("fix bug")
      expect(parseAutoCommand("/Autocode fix bug")?.task).toBe("fix bug")
      expect(parseAutoCommand("/aUtOcOdE fix bug")?.task).toBe("fix bug")
    })

    it("should handle task with hyphens (not options)", () => {
      const result = parseAutoCommand("/autocode fix the e2e-tests")
      expect(result?.task).toBe("fix the e2e-tests")
    })

    it("should handle URLs in task", () => {
      const result = parseAutoCommand("/autocode check https://example.com/api")
      expect(result?.task).toBe("check https://example.com/api")
    })
  })
})

// ============================================================================
// SESSION CONTEXT PRESERVATION TESTS (v3.6.4)
// ============================================================================

describe("session context preservation (v3.6.4)", () => {
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

  it("should preserve required tools across sequential /auto commands", async () => {
    // #given auto-router hook
    const autoRouter = createAutoRouterHook(mockCtx)
    const sessionID = "preserve-tools-test"

    // #when processing first command with playwright
    const input1 = { sessionID, messageID: "msg-1" }
    const textPart1 = { type: "text", text: '/auto "test with playwright"' }
    const output1 = { parts: [textPart1] }
    await autoRouter["chat.message"](input1 as any, output1 as any)

    // #then session should have playwright in required tools
    const state1 = autoRouter.getSessionState(sessionID)
    expect(state1?.sessionContext.requiredTools).toContain("playwright")

    // #when processing second command (same session, no new tools)
    const input2 = { sessionID, messageID: "msg-2" }
    const textPart2 = { type: "text", text: '/auto "fix the failing test"' }
    const output2 = { parts: [textPart2] }
    await autoRouter["chat.message"](input2 as any, output2 as any)

    // #then session should STILL have playwright in required tools
    const state2 = autoRouter.getSessionState(sessionID)
    expect(state2?.sessionContext.requiredTools).toContain("playwright")
  })

  it("should accumulate tools across commands", async () => {
    // #given auto-router hook
    const autoRouter = createAutoRouterHook(mockCtx)
    const sessionID = "accumulate-tools-test"

    // #when processing first command with playwright
    const input1 = { sessionID, messageID: "msg-1" }
    const textPart1 = { type: "text", text: '/auto "test with playwright"' }
    const output1 = { parts: [textPart1] }
    await autoRouter["chat.message"](input1 as any, output1 as any)

    // #when processing second command with cypress
    const input2 = { sessionID, messageID: "msg-2" }
    const textPart2 = { type: "text", text: '/auto "also run cypress tests"' }
    const output2 = { parts: [textPart2] }
    await autoRouter["chat.message"](input2 as any, output2 as any)

    // #then session should have BOTH tools
    const state = autoRouter.getSessionState(sessionID)
    expect(state?.sessionContext.requiredTools).toContain("playwright")
    expect(state?.sessionContext.requiredTools).toContain("cypress")
  })

  it("should inject preserved context in prompt for second command", async () => {
    // #given auto-router hook
    const autoRouter = createAutoRouterHook(mockCtx)
    const sessionID = "inject-context-test"

    // #when processing first command
    const input1 = { sessionID, messageID: "msg-1" }
    const textPart1 = { type: "text", text: '/auto "make a horror game"' }
    const output1 = { parts: [textPart1] }
    await autoRouter["chat.message"](input1 as any, output1 as any)

    // #when processing second command
    const input2 = { sessionID, messageID: "msg-2" }
    const textPart2 = { type: "text", text: '/auto "play through it"' }
    const output2 = { parts: [textPart2] }
    await autoRouter["chat.message"](input2 as any, output2 as any)

    // #then prompt should contain preserved context section
    expect(textPart2.text).toContain("PRESERVED CONTEXT")
    expect(textPart2.text).toContain("Previous Task")
    expect(textPart2.text).toContain("horror game")
  })

  it("should NOT preserve context across different sessions", async () => {
    // #given auto-router hook
    const autoRouter = createAutoRouterHook(mockCtx)

    // #when processing command in session A
    const inputA = { sessionID: "session-a", messageID: "msg-1" }
    const textPartA = { type: "text", text: '/auto "test with playwright"' }
    const outputA = { parts: [textPartA] }
    await autoRouter["chat.message"](inputA as any, outputA as any)

    // #when processing command in session B (different session)
    const inputB = { sessionID: "session-b", messageID: "msg-1" }
    const textPartB = { type: "text", text: '/auto "play the game"' }
    const outputB = { parts: [textPartB] }
    await autoRouter["chat.message"](inputB as any, outputB as any)

    // #then session B should NOT have playwright from session A
    const stateB = autoRouter.getSessionState("session-b")
    expect(stateB?.sessionContext.requiredTools).not.toContain("playwright")
    // And should not have preserved context injected
    expect(textPartB.text).not.toContain("Previous Task")
  })

  it("should increment iteration count across commands", async () => {
    // #given auto-router hook
    const autoRouter = createAutoRouterHook(mockCtx)
    const sessionID = "iteration-test"

    // #when processing first command
    const input1 = { sessionID, messageID: "msg-1" }
    const textPart1 = { type: "text", text: '/auto "first task"' }
    const output1 = { parts: [textPart1] }
    await autoRouter["chat.message"](input1 as any, output1 as any)

    const state1 = autoRouter.getSessionState(sessionID)
    expect(state1?.iteration).toBe(1)

    // #when processing second command
    const input2 = { sessionID, messageID: "msg-2" }
    const textPart2 = { type: "text", text: '/auto "second task"' }
    const output2 = { parts: [textPart2] }
    await autoRouter["chat.message"](input2 as any, output2 as any)

    // #then iteration should increment
    const state2 = autoRouter.getSessionState(sessionID)
    expect(state2?.iteration).toBe(2)
  })

  it("should preserve createdAt timestamp across commands", async () => {
    // #given auto-router hook
    const autoRouter = createAutoRouterHook(mockCtx)
    const sessionID = "createdAt-test"

    // #when processing first command
    const input1 = { sessionID, messageID: "msg-1" }
    const textPart1 = { type: "text", text: '/auto "first task"' }
    const output1 = { parts: [textPart1] }
    await autoRouter["chat.message"](input1 as any, output1 as any)

    const state1 = autoRouter.getSessionState(sessionID)
    const createdAt1 = state1?.createdAt

    // Add small delay
    await new Promise(resolve => setTimeout(resolve, 10))

    // #when processing second command
    const input2 = { sessionID, messageID: "msg-2" }
    const textPart2 = { type: "text", text: '/auto "second task"' }
    const output2 = { parts: [textPart2] }
    await autoRouter["chat.message"](input2 as any, output2 as any)

    // #then createdAt should be preserved (not updated)
    const state2 = autoRouter.getSessionState(sessionID)
    expect(state2?.createdAt).toBe(createdAt1)
  })
})
