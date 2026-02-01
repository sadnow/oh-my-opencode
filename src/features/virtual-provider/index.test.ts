import { describe, it, expect } from "bun:test";
import { injectVirtualProvider } from "./cache-injector";
import { ProviderModelsCache } from "../../shared/connected-providers-cache";

describe("injectVirtualProvider", () => {
  it("should add oh-im-broke provider and oib-autoselect model", () => {
    const mockCache: ProviderModelsCache = {
      models: {
        anthropic: ["claude-3-5-sonnet-20241022"],
        openai: ["gpt-4o"],
      },
      connected: ["anthropic", "openai"],
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    const result = injectVirtualProvider(mockCache);

    expect(result.models["oh-im-broke"]).toEqual(["oib-autoselect"]);
    expect(result.connected).toContain("oh-im-broke");
    expect(result.connected).toContain("anthropic");
    expect(result.connected).toContain("openai");
    expect(result.models["anthropic"]).toEqual(["claude-3-5-sonnet-20241022"]);
    expect(result.models["openai"]).toEqual(["gpt-4o"]);
  });

  it("should preserve existing providers and models", () => {
    const mockCache: ProviderModelsCache = {
      models: {
        google: ["gemini-1.5-pro"],
      },
      connected: ["google"],
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    const result = injectVirtualProvider(mockCache);

    expect(result.models["google"]).toEqual(["gemini-1.5-pro"]);
    expect(result.connected).toContain("google");
    expect(result.models["oh-im-broke"]).toEqual(["oib-autoselect"]);
    expect(result.connected).toContain("oh-im-broke");
  });

  it("should not duplicate oh-im-broke in connected array if already present", () => {
    const mockCache: ProviderModelsCache = {
      models: {
        "oh-im-broke": ["old-model"],
      },
      connected: ["oh-im-broke"],
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    const result = injectVirtualProvider(mockCache);

    const count = result.connected.filter(p => p === "oh-im-broke").length;
    expect(count).toBe(1);
    expect(result.models["oh-im-broke"]).toEqual(["oib-autoselect"]);
  });

  it("should update updatedAt timestamp", () => {
    const oldTimestamp = "2026-01-01T00:00:00.000Z";
    const mockCache: ProviderModelsCache = {
      models: {},
      connected: [],
      updatedAt: oldTimestamp,
    };

    const result = injectVirtualProvider(mockCache);

    expect(result.updatedAt).not.toBe(oldTimestamp);
    expect(new Date(result.updatedAt).getTime()).toBeGreaterThan(new Date(oldTimestamp).getTime());
  });
});
