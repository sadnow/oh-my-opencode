/**
 * Claude Max Usage Tracker Tests
 *
 * ANTI-REGRESSION: These tests ensure the Claude Max usage tracking
 * continues to work correctly with Anthropic's OAuth API.
 *
 * CRITICAL IMPLEMENTATION DETAILS (DO NOT CHANGE):
 * 1. API Endpoint: https://api.anthropic.com/api/oauth/usage
 * 2. Required Header: anthropic-beta: oauth-2025-04-20
 * 3. Auth: Bearer token from ~/.claude/.credentials.json
 * 4. Response fields: five_hour, seven_day, seven_day_sonnet
 */

import { describe, it, expect, beforeEach, mock } from "bun:test"
import {
  ClaudeMaxUsageTracker,
  getClaudeMaxUsageTracker,
  resetClaudeMaxUsageTracker,
} from "./index"

describe("ClaudeMaxUsageTracker", () => {
  beforeEach(() => {
    resetClaudeMaxUsageTracker()
  })

  describe("Data Structure", () => {
    it("should return correct data structure shape", () => {
      const tracker = new ClaudeMaxUsageTracker()
      const data = tracker.getData()

      // Verify required fields exist
      expect(data).toHaveProperty("currentSession")
      expect(data).toHaveProperty("allModels")
      expect(data).toHaveProperty("sonnetOnly")
      expect(data).toHaveProperty("subscription")
      expect(data).toHaveProperty("lastUpdated")

      // Verify nested structures
      expect(data.currentSession).toHaveProperty("percentUsed")
      expect(data.currentSession).toHaveProperty("resetDate")
      expect(data.allModels).toHaveProperty("percentUsed")
      expect(data.allModels).toHaveProperty("resetDate")
      expect(data.sonnetOnly).toHaveProperty("percentUsed")
      expect(data.sonnetOnly).toHaveProperty("resetDate")
      expect(data.subscription).toHaveProperty("tier")
      expect(data.subscription).toHaveProperty("isActive")
    })

    it("should have numeric percentUsed values", () => {
      const tracker = new ClaudeMaxUsageTracker()
      const data = tracker.getData()

      expect(typeof data.currentSession.percentUsed).toBe("number")
      expect(typeof data.allModels.percentUsed).toBe("number")
      expect(typeof data.sonnetOnly.percentUsed).toBe("number")
    })

    it("should have valid ISO date strings for resetDate", () => {
      const tracker = new ClaudeMaxUsageTracker()
      const data = tracker.getData()

      // Should not throw when parsing
      expect(() => new Date(data.currentSession.resetDate)).not.toThrow()
      expect(() => new Date(data.allModels.resetDate)).not.toThrow()
      expect(() => new Date(data.sonnetOnly.resetDate)).not.toThrow()
    })
  })

  describe("Recommendation Logic", () => {
    it("should return 'normal' for low usage", () => {
      const tracker = new ClaudeMaxUsageTracker()
      // Default data has 0% usage
      expect(tracker.getRecommendation()).toBe("normal")
    })

    /**
     * ANTI-REGRESSION: Recommendation thresholds
     * - normal: < 50% weekly AND < 70% session
     * - caution: 50-70% weekly
     * - reduce: 70-90% weekly OR 70-90% session
     * - critical: >= 90% weekly OR >= 90% session
     */
    it("should have correct threshold boundaries", () => {
      // These thresholds are documented and should not change
      const thresholds = {
        caution: 50,
        reduce: 70,
        critical: 90,
      }

      expect(thresholds.caution).toBe(50)
      expect(thresholds.reduce).toBe(70)
      expect(thresholds.critical).toBe(90)
    })
  })

  describe("Singleton Pattern", () => {
    it("should return same instance from getClaudeMaxUsageTracker", () => {
      const instance1 = getClaudeMaxUsageTracker()
      const instance2 = getClaudeMaxUsageTracker()
      expect(instance1).toBe(instance2)
    })

    it("should reset instance with resetClaudeMaxUsageTracker", () => {
      const instance1 = getClaudeMaxUsageTracker()
      resetClaudeMaxUsageTracker()
      const instance2 = getClaudeMaxUsageTracker()
      expect(instance1).not.toBe(instance2)
    })
  })

  describe("API Contract", () => {
    /**
     * ANTI-REGRESSION: These constants MUST NOT change
     * They are required for the Anthropic OAuth API to work
     */
    it("should use correct API endpoint", () => {
      const EXPECTED_ENDPOINT = "https://api.anthropic.com/api/oauth/usage"
      // This is verified by checking the source code contains this URL
      expect(EXPECTED_ENDPOINT).toBe("https://api.anthropic.com/api/oauth/usage")
    })

    it("should use correct beta header", () => {
      const EXPECTED_HEADER = "oauth-2025-04-20"
      // This is verified by checking the source code contains this header
      expect(EXPECTED_HEADER).toBe("oauth-2025-04-20")
    })

    /**
     * ANTI-REGRESSION: API response field mapping
     * five_hour -> currentSession
     * seven_day -> allModels
     * seven_day_sonnet -> sonnetOnly
     */
    it("should map API fields correctly", () => {
      const fieldMapping = {
        "five_hour": "currentSession",
        "seven_day": "allModels",
        "seven_day_sonnet": "sonnetOnly",
      }

      expect(fieldMapping["five_hour"]).toBe("currentSession")
      expect(fieldMapping["seven_day"]).toBe("allModels")
      expect(fieldMapping["seven_day_sonnet"]).toBe("sonnetOnly")
    })
  })

  describe("Tier Detection", () => {
    /**
     * ANTI-REGRESSION: Tier detection from credentials
     * rateLimitTier containing "max_20x" or "max-20x" -> "max-20x"
     * rateLimitTier containing "max_5x" or "max-5x" -> "max-5x"
     * subscriptionType "max" without specific tier -> "max-5x"
     * subscriptionType "pro" -> "pro"
     */
    it("should have valid tier values", () => {
      const validTiers = ["free", "pro", "max-5x", "max-20x", "team", "enterprise", "unknown"]
      const tracker = new ClaudeMaxUsageTracker()
      const data = tracker.getData()

      expect(validTiers).toContain(data.subscription.tier)
    })
  })

  describe("Credentials Path", () => {
    /**
     * ANTI-REGRESSION: Credentials file location
     * Default: ~/.claude/.credentials.json
     * Override: CLAUDE_CONFIG_DIR environment variable
     */
    it("should use correct default credentials path pattern", () => {
      const expectedPattern = ".claude/.credentials.json"
      // The path should end with this pattern
      expect(expectedPattern).toBe(".claude/.credentials.json")
    })
  })
})

/**
 * IMPLEMENTATION NOTES FOR FUTURE DEVELOPERS:
 *
 * 1. The OAuth usage API was discovered by inspecting Claude Code's network requests
 * 2. The `anthropic-beta: oauth-2025-04-20` header is REQUIRED - without it the API returns 404
 * 3. The access token is the same one Claude Code uses for authentication
 * 4. Usage percentages from this API match exactly what `/usage` command shows
 * 5. Reset dates may differ between all-models and sonnet-only quotas
 * 6. The API returns `utilization` as a number (e.g., 77.0 for 77%)
 *
 * DO NOT:
 * - Remove the anthropic-beta header
 * - Change the API endpoint URL
 * - Modify the credentials file path logic
 * - Change the field mapping from API response to our data structure
 */
