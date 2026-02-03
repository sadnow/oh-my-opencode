import { describe, test, expect } from "bun:test"
import { detectUnderlyingProvider, UNDERLYING_PROVIDER_PATTERNS, isNativeOpenCodeModel } from "./underlying-provider"

describe("detectUnderlyingProvider", () => {
  // OpenAI models via OpenCode
  test("detects openai from opencode/gpt-4o", () => {
    expect(detectUnderlyingProvider("opencode/gpt-4o")).toBe("openai")
  })
  test("detects openai from opencode/gpt-4o-mini", () => {
    expect(detectUnderlyingProvider("opencode/gpt-4o-mini")).toBe("openai")
  })
  test("detects openai from opencode/o1-preview", () => {
    expect(detectUnderlyingProvider("opencode/o1-preview")).toBe("openai")
  })
  test("detects openai from opencode/o1-mini", () => {
    expect(detectUnderlyingProvider("opencode/o1-mini")).toBe("openai")
  })
  test("detects openai from opencode/o3-mini", () => {
    expect(detectUnderlyingProvider("opencode/o3-mini")).toBe("openai")
  })
  test("detects openai from opencode/chatgpt-4o-latest", () => {
    expect(detectUnderlyingProvider("opencode/chatgpt-4o-latest")).toBe("openai")
  })
  test("detects openai case-insensitively", () => {
    expect(detectUnderlyingProvider("opencode/GPT-4o")).toBe("openai")
  })

  // Google models via OpenCode
  test("detects google from opencode/gemini-pro", () => {
    expect(detectUnderlyingProvider("opencode/gemini-pro")).toBe("google")
  })
  test("detects google from opencode/gemini-3-flash", () => {
    expect(detectUnderlyingProvider("opencode/gemini-3-flash")).toBe("google")
  })
  test("detects google from opencode/gemini-2.0-flash", () => {
    expect(detectUnderlyingProvider("opencode/gemini-2.0-flash")).toBe("google")
  })

  // Native OpenCode models (NOT hybrid - always free)
  test("returns null for opencode/big-pickle (native)", () => {
    expect(detectUnderlyingProvider("opencode/big-pickle")).toBeNull()
  })
  test("returns null for opencode/qwen-2.5-coder (native)", () => {
    expect(detectUnderlyingProvider("opencode/qwen-2.5-coder")).toBeNull()
  })
  test("returns null for opencode/deepseek-v3 (native)", () => {
    expect(detectUnderlyingProvider("opencode/deepseek-v3")).toBeNull()
  })
  test("returns null for opencode/glm-4.7 (native)", () => {
    expect(detectUnderlyingProvider("opencode/glm-4.7")).toBeNull()
  })
  test("returns null for opencode/kimi-k2 (native)", () => {
    expect(detectUnderlyingProvider("opencode/kimi-k2")).toBeNull()
  })

  // Non-opencode providers
  test("returns null for anthropic/claude-opus-4-5", () => {
    expect(detectUnderlyingProvider("anthropic/claude-opus-4-5")).toBeNull()
  })
  test("returns null for openai/gpt-4o (direct, not BYOK)", () => {
    expect(detectUnderlyingProvider("openai/gpt-4o")).toBeNull()
  })
  test("returns null for github-copilot/gpt-4o", () => {
    expect(detectUnderlyingProvider("github-copilot/gpt-4o")).toBeNull()
  })

  // Edge cases
  test("returns null for empty string", () => {
    expect(detectUnderlyingProvider("")).toBeNull()
  })
  test("returns null for model without provider prefix", () => {
    expect(detectUnderlyingProvider("gpt-4o")).toBeNull()
  })
})

describe("isNativeOpenCodeModel", () => {
  test("big-pickle is native", () => {
    expect(isNativeOpenCodeModel("opencode/big-pickle")).toBe(true)
  })
  test("qwen is native", () => {
    expect(isNativeOpenCodeModel("opencode/qwen-2.5-coder")).toBe(true)
  })
  test("gpt-4o is NOT native (it's BYOK)", () => {
    expect(isNativeOpenCodeModel("opencode/gpt-4o")).toBe(false)
  })
  test("non-opencode model is not native", () => {
    expect(isNativeOpenCodeModel("anthropic/claude-opus-4-5")).toBe(false)
  })
})

describe("current Zen model detection (2026)", () => {
  test("detects openai for opencode/gpt-5.2", () => {
    expect(detectUnderlyingProvider("opencode/gpt-5.2")).toBe("openai")
  })
  test("detects openai for opencode/gpt-5.2-codex", () => {
    expect(detectUnderlyingProvider("opencode/gpt-5.2-codex")).toBe("openai")
  })
  test("detects openai for opencode/gpt-5.1", () => {
    expect(detectUnderlyingProvider("opencode/gpt-5.1")).toBe("openai")
  })
  test("detects openai for opencode/gpt-5.1-codex", () => {
    expect(detectUnderlyingProvider("opencode/gpt-5.1-codex")).toBe("openai")
  })
  test("detects openai for opencode/gpt-5.1-codex-max", () => {
    expect(detectUnderlyingProvider("opencode/gpt-5.1-codex-max")).toBe("openai")
  })
  test("detects openai for opencode/gpt-5.1-codex-mini", () => {
    expect(detectUnderlyingProvider("opencode/gpt-5.1-codex-mini")).toBe("openai")
  })
  test("detects openai for opencode/gpt-5", () => {
    expect(detectUnderlyingProvider("opencode/gpt-5")).toBe("openai")
  })
  test("detects openai for opencode/gpt-5-codex", () => {
    expect(detectUnderlyingProvider("opencode/gpt-5-codex")).toBe("openai")
  })
  test("detects openai for opencode/gpt-5-nano", () => {
    expect(detectUnderlyingProvider("opencode/gpt-5-nano")).toBe("openai")
  })

  test("returns null for opencode/qwen3-coder", () => {
    expect(detectUnderlyingProvider("opencode/qwen3-coder")).toBeNull()
  })
  test("returns null for opencode/glm-4.7", () => {
    expect(detectUnderlyingProvider("opencode/glm-4.7")).toBeNull()
  })
  test("returns null for opencode/glm-4.6", () => {
    expect(detectUnderlyingProvider("opencode/glm-4.6")).toBeNull()
  })
  test("returns null for opencode/glm-4.7-free", () => {
    expect(detectUnderlyingProvider("opencode/glm-4.7-free")).toBeNull()
  })
  test("returns null for opencode/kimi-k2.5", () => {
    expect(detectUnderlyingProvider("opencode/kimi-k2.5")).toBeNull()
  })
  test("returns null for opencode/kimi-k2.5-free", () => {
    expect(detectUnderlyingProvider("opencode/kimi-k2.5-free")).toBeNull()
  })
  test("returns null for opencode/kimi-k2", () => {
    expect(detectUnderlyingProvider("opencode/kimi-k2")).toBeNull()
  })
  test("returns null for opencode/kimi-k2-thinking", () => {
    expect(detectUnderlyingProvider("opencode/kimi-k2-thinking")).toBeNull()
  })
  test("returns null for opencode/minimax-m2.1", () => {
    expect(detectUnderlyingProvider("opencode/minimax-m2.1")).toBeNull()
  })
  test("returns null for opencode/big-pickle", () => {
    expect(detectUnderlyingProvider("opencode/big-pickle")).toBeNull()
  })
  test("returns null for opencode/trinity-large-preview-free", () => {
    expect(detectUnderlyingProvider("opencode/trinity-large-preview-free")).toBeNull()
  })

  test("detects google for opencode/gemini-3-pro", () => {
    expect(detectUnderlyingProvider("opencode/gemini-3-pro")).toBe("google")
  })
  test("detects google for opencode/gemini-3-flash", () => {
    expect(detectUnderlyingProvider("opencode/gemini-3-flash")).toBe("google")
  })

  test("returns null for opencode/claude-3-5-haiku", () => {
    expect(detectUnderlyingProvider("opencode/claude-3-5-haiku")).toBeNull()
  })
})
