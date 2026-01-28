import { describe, expect, test } from "bun:test"
import {
  estimateTokens,
  estimateTokensFromParts,
  estimateCost,
  extractModelName,
  extractProvider,
} from "./token-estimator"

describe("token-estimator", () => {
  describe("estimateTokens", () => {
    test("estimates tokens for natural language text", () => {
      // #given: A simple English sentence (typically ~4 chars/token)
      const text = "Hello, how are you today?"
      
      // #when: Estimating tokens
      const tokens = estimateTokens(text)
      
      // #then: Should be around 6-7 tokens (26 chars / 4 ≈ 6.5)
      expect(tokens).toBeGreaterThanOrEqual(5)
      expect(tokens).toBeLessThanOrEqual(8)
    })

    test("estimates tokens for code with brackets and symbols", () => {
      // #given: Code with high bracket density (typically ~3.5 chars/token)
      const code = `function add(a, b) { return a + b; }`
      
      // #when: Estimating tokens
      const tokens = estimateTokens(code)
      
      // #then: Should detect as code and use ~3.5 chars/token
      // 38 chars / 3.5 ≈ 10.9 tokens
      expect(tokens).toBeGreaterThanOrEqual(9)
      expect(tokens).toBeLessThanOrEqual(12)
    })

    test("estimates tokens for JSON structure", () => {
      // #given: JSON with many brackets (should use code ratio)
      const json = `{"name": "test", "value": 123, "active": true}`
      
      // #when: Estimating tokens
      const tokens = estimateTokens(json)
      
      // #then: Should detect high symbol density
      expect(tokens).toBeGreaterThan(0)
      expect(tokens).toBeLessThan(20) // Reasonable upper bound
    })

    test("handles empty string", () => {
      // #given: Empty string
      const text = ""
      
      // #when: Estimating tokens
      const tokens = estimateTokens(text)
      
      // #then: Should return 0
      expect(tokens).toBe(0)
    })

    test("handles whitespace normalization", () => {
      // #given: Text with excessive whitespace
      const text = "Hello    world\t\t\twith\n\nmany\nspaces"
      
      // #when: Estimating tokens
      const tokens = estimateTokens(text)
      
      // #then: Should normalize spaces but preserve newlines
      expect(tokens).toBeGreaterThan(0)
      expect(tokens).toBeLessThan(20)
    })
  })

  describe("estimateTokensFromParts", () => {
    test("estimates tokens from text parts", () => {
      // #given: Message parts with text content
      const parts = [
        { type: "text", text: "Hello, how are you?" },
        { type: "text", text: "I am doing well." },
      ]
      
      // #when: Estimating tokens from parts
      const tokens = estimateTokensFromParts(parts)
      
      // #then: Should sum tokens from all text parts
      expect(tokens).toBeGreaterThan(0)
      expect(tokens).toBeLessThan(20)
    })

    test("estimates tokens from tool_use parts", () => {
      // #given: Tool use with input
      const parts = [
        {
          type: "tool_use",
          name: "bash",
          input: { command: "echo 'hello world'" },
        },
      ]
      
      // #when: Estimating tokens
      const tokens = estimateTokensFromParts(parts)
      
      // #then: Should estimate from stringified input
      expect(tokens).toBeGreaterThan(0)
    })

    test("estimates tokens from tool_result parts", () => {
      // #given: Tool result with output
      const parts = [
        {
          type: "tool_result",
          output: "Command executed successfully\nOutput: hello world",
        },
      ]
      
      // #when: Estimating tokens
      const tokens = estimateTokensFromParts(parts)
      
      // #then: Should estimate from output string
      expect(tokens).toBeGreaterThan(0)
    })

    test("handles mixed part types", () => {
      // #given: Mix of text, tool_use, and tool_result
      const parts = [
        { type: "text", text: "Let me run a command:" },
        { type: "tool_use", name: "bash", input: { command: "ls" } },
        { type: "tool_result", output: "file1.txt\nfile2.txt" },
        { type: "text", text: "Here are the files." },
      ]
      
      // #when: Estimating tokens
      const tokens = estimateTokensFromParts(parts)
      
      // #then: Should sum all parts
      expect(tokens).toBeGreaterThan(0)
      expect(tokens).toBeLessThan(100)
    })

    test("handles empty parts array", () => {
      // #given: Empty parts array
      const parts: unknown[] = []
      
      // #when: Estimating tokens
      const tokens = estimateTokensFromParts(parts)
      
      // #then: Should return 0
      expect(tokens).toBe(0)
    })

    test("handles parts with missing fields gracefully", () => {
      // #given: Parts with undefined/null values
      const parts = [
        { type: "text", text: undefined },
        { type: "tool_use", input: null },
        { type: "unknown" },
      ]
      
      // #when: Estimating tokens
      const tokens = estimateTokensFromParts(parts)
      
      // #then: Should not crash, returns 0 for missing data
      expect(tokens).toBe(0)
    })
  })

  describe("estimateCost", () => {
    test("calculates cost for claude-opus-4-5", () => {
      // #given: Token counts and pricing
      const model = "claude-opus-4-5"
      const inputTokens = 1000
      const outputTokens = 500
      const pricing = { inputPer1M: 15.0, outputPer1M: 75.0 }
      
      // #when: Calculating cost
      const cost = estimateCost(model, inputTokens, outputTokens, pricing)
      
      // #then: Cost = (1000 * 15.0 / 1M) + (500 * 75.0 / 1M)
      // = 0.015 + 0.0375 = 0.0525
      expect(cost).toBeCloseTo(0.0525, 4)
    })

    test("calculates cost for gpt-5.2", () => {
      // #given: GPT pricing
      const model = "gpt-5.2"
      const inputTokens = 2000
      const outputTokens = 1000
      const pricing = { inputPer1M: 10.0, outputPer1M: 30.0 }
      
      // #when: Calculating cost
      const cost = estimateCost(model, inputTokens, outputTokens, pricing)
      
      // #then: Cost = (2000 * 10 / 1M) + (1000 * 30 / 1M)
      // = 0.02 + 0.03 = 0.05
      expect(cost).toBeCloseTo(0.05, 4)
    })

    test("handles zero tokens", () => {
      // #given: Zero tokens
      const model = "test-model"
      const pricing = { inputPer1M: 1.0, outputPer1M: 2.0 }
      
      // #when: Calculating cost
      const cost = estimateCost(model, 0, 0, pricing)
      
      // #then: Should return 0
      expect(cost).toBe(0)
    })

    test("handles large token counts", () => {
      // #given: Very large message (1 million tokens)
      const model = "test-model"
      const inputTokens = 1_000_000
      const outputTokens = 1_000_000
      const pricing = { inputPer1M: 5.0, outputPer1M: 15.0 }
      
      // #when: Calculating cost
      const cost = estimateCost(model, inputTokens, outputTokens, pricing)
      
      // #then: Cost = 5 + 15 = $20
      expect(cost).toBe(20)
    })
  })

  describe("extractModelName", () => {
    test("extracts model from provider/model format", () => {
      // #given: Standard format with provider
      const modelStr = "anthropic/claude-opus-4-5"
      
      // #when: Extracting model name
      const model = extractModelName(modelStr)
      
      // #then: Should return model without provider
      expect(model).toBe("claude-opus-4-5")
    })

    test("extracts model from complex format", () => {
      // #given: Format with variants
      const modelStr = "github-copilot/gpt-5.2-codex"
      
      // #when: Extracting model
      const model = extractModelName(modelStr)
      
      // #then: Should extract full model name
      expect(model).toBe("gpt-5.2-codex")
    })

    test("handles model name without provider", () => {
      // #given: Just model name
      const modelStr = "claude-sonnet-4-5"
      
      // #when: Extracting
      const model = extractModelName(modelStr)
      
      // #then: Should return as-is
      expect(model).toBe("claude-sonnet-4-5")
    })

    test("handles unknown format", () => {
      // #given: Unknown model string
      const modelStr = "unknown"
      
      // #when: Extracting
      const model = extractModelName(modelStr)
      
      // #then: Should return as-is
      expect(model).toBe("unknown")
    })
  })

  describe("extractProvider", () => {
    test("extracts provider from anthropic models", () => {
      // #given: Anthropic model
      const modelStr = "anthropic/claude-opus-4-5"
      
      // #when: Extracting provider
      const provider = extractProvider(modelStr)
      
      // #then: Should return anthropic
      expect(provider).toBe("anthropic")
    })

    test("extracts provider from openai models", () => {
      // #given: OpenAI model via github-copilot
      const modelStr = "github-copilot/gpt-5.2"
      
      // #when: Extracting provider
      const provider = extractProvider(modelStr)
      
      // #then: Should detect OpenAI
      expect(provider).toBe("openai")
    })

    test("extracts provider from google models", () => {
      // #given: Google Gemini model
      const modelStr = "google/gemini-3-pro"
      
      // #when: Extracting provider
      const provider = extractProvider(modelStr)
      
      // #then: Should return google
      expect(provider).toBe("google")
    })

    test("handles opencode models", () => {
      // #given: OpenCode model
      const modelStr = "opencode/big-pickle"
      
      // #when: Extracting provider
      const provider = extractProvider(modelStr)
      
      // #then: Should return opencode
      expect(provider).toBe("opencode")
    })

    test("detects kimi/moonshot models", () => {
      // #given: Kimi model (Moonshot AI is the provider)
      const modelStr = "opencode/kimi-k2-thinking"
      
      // #when: Extracting provider
      const provider = extractProvider(modelStr)
      
      // #then: Should return moonshot (Kimi's provider)
      expect(provider).toBe("moonshot")
    })

    test("defaults to unknown for unrecognized models", () => {
      // #given: Unknown model format
      const modelStr = "mystery-model"
      
      // #when: Extracting provider
      const provider = extractProvider(modelStr)
      
      // #then: Should return unknown
      expect(provider).toBe("unknown")
    })
  })
})
