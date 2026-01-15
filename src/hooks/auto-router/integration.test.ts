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
import { AUTO_ROUTER_TAG_OPEN } from "./constants"
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
