import { describe, it, expect } from "bun:test"
import {
  MODEL_TIERS,
  DEFAULT_TIER,
  TIER_ORDER,
  getModelTier,
  getModelsInTier,
  getNextLowerTier,
  getNextHigherTier,
  getBestModelInTier,
  findDowngradedModel,
  findUpgradedModel,
  isMoreExpensive,
  getModelsAtOrBelowTier,
  parseModelRef,
  formatModelRef,
} from "./tiers"

describe("MODEL_TIERS", () => {
  it("defines four tiers with model lists and costs", () => {
    expect(Object.keys(MODEL_TIERS)).toEqual(["premium", "standard", "budget", "economy"])

    for (const tier of Object.keys(MODEL_TIERS)) {
      const config = MODEL_TIERS[tier as keyof typeof MODEL_TIERS]
      expect(Array.isArray(config.models)).toBe(true)
      expect(typeof config.avgCostPer1M).toBe("number")
    }
  })
})

describe("DEFAULT_TIER", () => {
  it("defaults to standard", () => {
    expect(DEFAULT_TIER).toBe("standard")
  })
})

describe("TIER_ORDER", () => {
  it("orders tiers from premium to economy", () => {
    expect(TIER_ORDER).toEqual(["premium", "standard", "budget", "economy"])
  })
})

describe("getModelTier", () => {
  it("returns premium for known premium model", () => {
    expect(getModelTier("anthropic/claude-opus-4-5")).toBe("premium")
  })

  it("returns economy for known economy model", () => {
    expect(getModelTier("openai/gpt-4.1-nano")).toBe("economy")
  })

  it("returns default for unknown model", () => {
    expect(getModelTier("unknown/imaginary-model")).toBe("standard")
  })

  it("returns null for unknown model in strict mode", () => {
    expect(getModelTier("unknown/imaginary-model", true)).toBeNull()
  })

  it("matches by model ID without provider", () => {
    expect(getModelTier({ providerID: "unknown", modelID: "gpt-4.1-nano" })).toBe("economy")
  })

  it("matches case-insensitively", () => {
    expect(getModelTier("OPENAI/GPT-4.1-NANO")).toBe("economy")
  })
})

describe("getModelsInTier", () => {
  it("returns premium tier models", () => {
    expect(getModelsInTier("premium")).toEqual(MODEL_TIERS.premium.models)
  })

  it("returns standard tier models", () => {
    expect(getModelsInTier("standard")).toEqual(MODEL_TIERS.standard.models)
  })

  it("returns budget tier models", () => {
    expect(getModelsInTier("budget")).toEqual(MODEL_TIERS.budget.models)
  })

  it("returns economy tier models", () => {
    expect(getModelsInTier("economy")).toEqual(MODEL_TIERS.economy.models)
  })
})

describe("getNextLowerTier", () => {
  it("steps down through tiers", () => {
    expect(getNextLowerTier("premium")).toBe("standard")
    expect(getNextLowerTier("standard")).toBe("budget")
    expect(getNextLowerTier("budget")).toBe("economy")
    expect(getNextLowerTier("economy")).toBeNull()
  })
})

describe("getNextHigherTier", () => {
  it("steps up through tiers", () => {
    expect(getNextHigherTier("economy")).toBe("budget")
    expect(getNextHigherTier("budget")).toBe("standard")
    expect(getNextHigherTier("standard")).toBe("premium")
    expect(getNextHigherTier("premium")).toBeNull()
  })
})

describe("getBestModelInTier", () => {
  it("returns first model matching available providers", () => {
    expect(getBestModelInTier("premium", ["anthropic"])).toEqual({
      providerID: "anthropic",
      modelID: "claude-opus-4-5",
    })
  })

  it("treats opencode models as always available", () => {
    expect(getBestModelInTier("premium", [])).toEqual({
      providerID: "opencode",
      modelID: "gpt-5.2-codex",
    })
  })

  it("returns null when no providers match and no opencode models", () => {
    const originalModels = MODEL_TIERS.premium.models
    MODEL_TIERS.premium.models = ["anthropic/claude-opus-4-5"]

    try {
      expect(getBestModelInTier("premium", ["openai"])).toBeNull()
    } finally {
      MODEL_TIERS.premium.models = originalModels
    }
  })

  it("handles empty availableProviders arrays", () => {
    expect(getBestModelInTier("standard", [])).toEqual({
      providerID: "opencode",
      modelID: "gpt-5.1-codex-max",
    })
  })
})

describe("findDowngradedModel", () => {
  it("returns a model from the target tier when available", () => {
    expect(findDowngradedModel({ providerID: "openai", modelID: "gpt-5.2" }, "standard", ["openai"]))
      .toEqual({ providerID: "openai", modelID: "gpt-5.2" })
  })

  it("cascades down when the target tier is empty", () => {
    const originalModels = MODEL_TIERS.standard.models
    MODEL_TIERS.standard.models = []

    try {
      expect(findDowngradedModel({ providerID: "openai", modelID: "gpt-5.2" }, "standard", ["anthropic"]))
        .toEqual({ providerID: "anthropic", modelID: "claude-haiku-4-5" })
    } finally {
      MODEL_TIERS.standard.models = originalModels
    }
  })

  it("falls back to opencode/big-pickle when no models are available", () => {
    const originalModels = {
      premium: MODEL_TIERS.premium.models,
      standard: MODEL_TIERS.standard.models,
      budget: MODEL_TIERS.budget.models,
      economy: MODEL_TIERS.economy.models,
    }

    MODEL_TIERS.premium.models = []
    MODEL_TIERS.standard.models = []
    MODEL_TIERS.budget.models = []
    MODEL_TIERS.economy.models = []

    try {
      expect(findDowngradedModel({ providerID: "openai", modelID: "gpt-5.2" }, "standard", ["openai"]))
        .toEqual({ providerID: "opencode", modelID: "big-pickle" })
    } finally {
      MODEL_TIERS.premium.models = originalModels.premium
      MODEL_TIERS.standard.models = originalModels.standard
      MODEL_TIERS.budget.models = originalModels.budget
      MODEL_TIERS.economy.models = originalModels.economy
    }
  })
})

describe("findUpgradedModel", () => {
  it("upgrades economy models to a standard model when available", () => {
    expect(findUpgradedModel({ providerID: "openai", modelID: "gpt-4.1-nano" }, "standard", ["openai"]))
      .toEqual({ providerID: "openai", modelID: "gpt-5.2" })
  })

  it("returns null when already at or above the target tier", () => {
    expect(findUpgradedModel({ providerID: "openai", modelID: "gpt-5.2" }, "standard", ["openai"]))
      .toBeNull()
  })

  it("tries higher tiers when the target tier has no models", () => {
    const originalModels = MODEL_TIERS.standard.models
    MODEL_TIERS.standard.models = []

    try {
      expect(findUpgradedModel({ providerID: "openai", modelID: "gpt-4.1-nano" }, "standard", ["openai"]))
        .toEqual({ providerID: "openai", modelID: "o1-pro" })
    } finally {
      MODEL_TIERS.standard.models = originalModels
    }
  })
})

describe("isMoreExpensive", () => {
  it("returns true when the first model is more expensive", () => {
    expect(isMoreExpensive(
      { providerID: "anthropic", modelID: "claude-opus-4-5" },
      { providerID: "openai", modelID: "gpt-4.1-nano" }
    )).toBe(true)
  })

  it("returns false when the first model is cheaper", () => {
    expect(isMoreExpensive(
      { providerID: "openai", modelID: "gpt-4.1-nano" },
      { providerID: "anthropic", modelID: "claude-opus-4-5" }
    )).toBe(false)
  })

  it("returns false when both models are in the same tier", () => {
    expect(isMoreExpensive(
      { providerID: "openai", modelID: "gpt-5.2" },
      { providerID: "openai", modelID: "gpt-5.1" }
    )).toBe(false)
  })
})

describe("getModelsAtOrBelowTier", () => {
  it("returns all models when min tier is premium", () => {
    const allModels = [
      ...MODEL_TIERS.premium.models,
      ...MODEL_TIERS.standard.models,
      ...MODEL_TIERS.budget.models,
      ...MODEL_TIERS.economy.models,
    ]
    expect(getModelsAtOrBelowTier("premium")).toEqual(allModels)
  })

  it("returns only economy models when min tier is economy", () => {
    expect(getModelsAtOrBelowTier("economy")).toEqual(MODEL_TIERS.economy.models)
  })

  it("returns budget and economy models when min tier is budget", () => {
    expect(getModelsAtOrBelowTier("budget")).toEqual([
      ...MODEL_TIERS.budget.models,
      ...MODEL_TIERS.economy.models,
    ])
  })
})

describe("parseModelRef", () => {
  it("parses provider/model strings", () => {
    expect(parseModelRef("openai/gpt-5.2")).toEqual({
      providerID: "openai",
      modelID: "gpt-5-2",
    })
  })

  it("assumes opencode for model-only strings", () => {
    expect(parseModelRef("gpt-5.2")).toEqual({
      providerID: "opencode",
      modelID: "gpt-5-2",
    })
  })
})

describe("formatModelRef", () => {
  it("formats a ModelRef into a string", () => {
    expect(formatModelRef({ providerID: "openai", modelID: "gpt-5.2" })).toBe("openai/gpt-5.2")
  })
})

describe("anti-regression: broken Zen models", () => {
  it("does not include known broken models in any tier", () => {
    const allModels = Object.values(MODEL_TIERS).flatMap((tier) => tier.models)

    expect(allModels).not.toContain("opencode/gemini-3-pro")
    expect(allModels).not.toContain("opencode/gemini-3-flash")
    expect(allModels).not.toContain("opencode/minimax-m2.1-free")
  })
})
