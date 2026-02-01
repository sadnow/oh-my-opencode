import { describe, expect, it } from "bun:test";
import { normalizeModelID } from "./model-normalizer";

describe("normalizeModelID", () => {
  it("should normalize decimal version numbers to dashes", () => {
    expect(normalizeModelID("claude-sonnet-4.5")).toBe("claude-sonnet-4-5");
    expect(normalizeModelID("gpt-5.2")).toBe("gpt-5-2");
    expect(normalizeModelID("glm-4.6")).toBe("glm-4-6");
    expect(normalizeModelID("gpt-5.2-codex")).toBe("gpt-5-2-codex");
  });

  it("should not change already normalized IDs", () => {
    expect(normalizeModelID("claude-opus-4-5")).toBe("claude-opus-4-5");
    expect(normalizeModelID("gemini-3-flash-preview")).toBe("gemini-3-flash-preview");
    expect(normalizeModelID("gpt-4-turbo")).toBe("gpt-4-turbo");
  });

  it("should not touch date formats like 0905", () => {
    expect(normalizeModelID("kimi-k2-0905")).toBe("kimi-k2-0905");
    expect(normalizeModelID("claude-3-5-sonnet-20240620")).toBe("claude-3-5-sonnet-20240620");
  });

  it("should handle IDs without decimals", () => {
    expect(normalizeModelID("qwen3-coder-480b")).toBe("qwen3-coder-480b");
    expect(normalizeModelID("o3-mini")).toBe("o3-mini");
  });

  it("should handle null, undefined, and empty strings", () => {
    expect(normalizeModelID("")).toBe("");
    expect(normalizeModelID(undefined)).toBe(undefined);
    expect(normalizeModelID(null)).toBe(null);
  });

  it("should handle multiple decimal points if they exist (though rare)", () => {
    expect(normalizeModelID("model-1.2.3")).toBe("model-1-2-3");
  });
});
