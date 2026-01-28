/**
 * Wizard Questions
 * Interactive prompts using @clack/prompts
 */

import * as p from "@clack/prompts"
import color from "picocolors"
import type { LearningMode, OrchestrationPreset } from "../../config/schema"
import { getAllPresets, PRESET_BADGES } from "./presets"

export interface WizardAnswers {
  // Step 1: Subscriptions
  hasOpencodeZen: boolean
  hasChatGPT: boolean
  hasAnthropicOAuth: boolean
  hasCopilot: boolean
  hasGemini: boolean

  // Plan tiers (conditional)
  copilotPlan?: "none" | "free" | "pro" | "enterprise"
  claudePlan?: "pro" | "max-5x" | "max-20x"
  zenBudget?: number

  // Zen models (if available)
  zenModels?: string[]

  // Step 2: Quota Targets
  claudeMaxWeeklyTarget?: number    // 0-100 percentage
  copilotMonthlyTarget?: number     // 0-100 percentage
  zenMonthlyTarget?: number         // Dollar amount

  // Step 3: Preset selection
  preset: OrchestrationPreset

  // Step 4: Learning & Adaptation
  learningMode?: LearningMode
  autoUpgrade?: boolean
  autoDowngrade?: boolean
  // Advanced adaptive config (optional overrides)
  velocityAlpha?: number
  minSamplesForPrediction?: number
  stabilityChecksBeforeUpgrade?: number
  tierUpgradeThreshold?: number
  tierDowngradeThreshold?: number

  // Step 5: Budget config (legacy, kept for backward compat)
  enableBudget: boolean
  monthlyBudget?: number
}

/**
 * Available OpenCode Zen models for selection.
 */
export const ZEN_MODELS = [
  { value: "big-pickle", label: "big-pickle", hint: "Versatile general-purpose model" },
  { value: "gpt-5-nano", label: "gpt-5-nano", hint: "Fast, lightweight GPT" },
  { value: "gemini-3-flash-preview", label: "gemini-3-flash-preview", hint: "Ultra-fast Gemini" },
  { value: "glm-4.6", label: "glm-4.6", hint: "Budget-friendly GLM" },
  { value: "glm-4.7", label: "glm-4.7", hint: "Advanced GLM for complex tasks" },
  { value: "kimi-k2-0905", label: "kimi-k2-0905", hint: "Balanced Kimi model" },
  { value: "kimi-k2-thinking", label: "kimi-k2-thinking", hint: "Extended reasoning Kimi" },
  { value: "qwen3-coder-480b", label: "qwen3-coder-480b", hint: "Massive coding model" },
]

/**
 * Run the subscription questions.
 */
export async function askSubscriptions(): Promise<Partial<WizardAnswers> | null> {
  const answers: Partial<WizardAnswers> = {}

  // OpenCode Zen
  const zen = await p.confirm({
    message: "Do you have access to OpenCode Zen?",
    initialValue: false,
  })
  if (p.isCancel(zen)) return null
  answers.hasOpencodeZen = zen

  // ChatGPT subscription
  const chatgpt = await p.confirm({
    message: "Do you have a ChatGPT Plus/Pro subscription?",
    initialValue: false,
  })
  if (p.isCancel(chatgpt)) return null
  answers.hasChatGPT = chatgpt

  // Anthropic OAuth
  const anthropic = await p.confirm({
    message: "Do you have Anthropic OAuth (Claude Pro/Max)?",
    initialValue: true,
  })
  if (p.isCancel(anthropic)) return null
  answers.hasAnthropicOAuth = anthropic

  // GitHub Copilot
  const copilot = await p.confirm({
    message: "Do you have a GitHub Copilot subscription?",
    initialValue: false,
  })
  if (p.isCancel(copilot)) return null
  answers.hasCopilot = copilot

  // Gemini via Antigrav OAuth
  const gemini = await p.confirm({
    message: "Do you have Antigrav OAuth access for Google Gemini?",
    initialValue: false,
  })
  if (p.isCancel(gemini)) return null
  answers.hasGemini = gemini

  return answers
}

/**
 * Ask plan tier questions based on subscriptions.
 */
export async function askPlanTiers(
  answers: Partial<WizardAnswers>
): Promise<Partial<WizardAnswers> | null> {

  // Claude plan tier
  if (answers.hasAnthropicOAuth) {
    const plan = await p.select({
      message: "What Claude subscription do you have?",
      options: [
        { value: "pro" as const, label: "Claude Pro ($20/mo)", hint: "Standard limits" },
        { value: "max-5x" as const, label: "Claude Max 5x ($100/mo)", hint: "5x more usage" },
        { value: "max-20x" as const, label: "Claude Max 20x ($200/mo)", hint: "20x more usage" },
      ],
    })
    if (p.isCancel(plan)) return null
    answers.claudePlan = plan
  }

  // Copilot plan tier (enhanced)
  if (answers.hasCopilot) {
    // Re-ask with more detailed options
    const plan = await p.select({
      message: "What GitHub Copilot plan do you have?",
      options: [
        { value: "free" as const, label: "Free", hint: "2000 completions/mo, limited chat" },
        { value: "pro" as const, label: "Pro ($10/mo)", hint: "Unlimited completions, 1500 premium requests" },
        { value: "enterprise" as const, label: "Enterprise ($39/mo)", hint: "Full features, knowledge bases" },
      ],
    })
    if (p.isCancel(plan)) return null
    answers.copilotPlan = plan
  }

  // Zen budget
  if (answers.hasOpencodeZen) {
    const budget = await p.text({
      message: "What's your monthly OpenCode Zen budget (USD)?",
      placeholder: "50",
      validate: (value) => {
        const num = parseFloat(value)
        if (isNaN(num) || num < 0) return "Please enter a valid number"
        return undefined
      },
    })
    if (p.isCancel(budget)) return null
    answers.zenBudget = parseFloat(budget)
  }

  return answers
}

/**
 * Ask about Zen model selection.
 */
export async function askZenModels(
  answers: Partial<WizardAnswers>
): Promise<Partial<WizardAnswers> | null> {
  if (!answers.hasOpencodeZen) return answers

  const models = await p.multiselect({
    message: "Which OpenCode Zen models do you want to use?",
    options: ZEN_MODELS,
    initialValues: ["big-pickle", "gemini-3-flash-preview"],
    required: false,
  })

  if (p.isCancel(models)) return null
  answers.zenModels = models as string[]

  return answers
}

/**
 * Ask about quota targets (Step 2).
 */
export async function askQuotaTargets(
  answers: Partial<WizardAnswers>
): Promise<Partial<WizardAnswers> | null> {
  // Claude Max weekly target
  if (answers.hasAnthropicOAuth) {
    p.note(
      "Anthropic resets your usage every 7 days. Set a target percentage to avoid hitting rate limits mid-week.",
      "Claude Max Quota"
    )
    const target = await p.text({
      message: "Weekly usage target for Claude Max (0-100%)?",
      placeholder: "70",
      initialValue: "70",
      validate: (value) => {
        const num = parseFloat(value)
        if (isNaN(num) || num < 0 || num > 100) return "Please enter a number between 0 and 100"
        return undefined
      },
    })
    if (p.isCancel(target)) return null
    answers.claudeMaxWeeklyTarget = parseFloat(target)
  }

  // Copilot monthly target
  if (answers.hasCopilot && answers.copilotPlan !== "free") {
    p.note(
      "GitHub resets premium requests monthly. Set a target to pace usage throughout the month.",
      "Copilot Quota"
    )
    const target = await p.text({
      message: "Monthly usage target for Copilot premium requests (0-100%)?",
      placeholder: "80",
      initialValue: "80",
      validate: (value) => {
        const num = parseFloat(value)
        if (isNaN(num) || num < 0 || num > 100) return "Please enter a number between 0 and 100"
        return undefined
      },
    })
    if (p.isCancel(target)) return null
    answers.copilotMonthlyTarget = parseFloat(target)
  }

  // Zen monthly dollar target
  if (answers.hasOpencodeZen && answers.zenBudget && answers.zenBudget > 0) {
    p.note(
      "API providers charge per token. Set a dollar target based on your monthly budget.",
      "OpenCode Zen Budget"
    )
    const target = await p.text({
      message: `Monthly dollar target for Zen (max $${answers.zenBudget})?`,
      placeholder: String(Math.round(answers.zenBudget * 0.8)),
      initialValue: String(Math.round(answers.zenBudget * 0.8)),
      validate: (value) => {
        const num = parseFloat(value)
        if (isNaN(num) || num < 0) return "Please enter a valid positive number"
        if (num > (answers.zenBudget ?? 0)) return `Target cannot exceed budget ($${answers.zenBudget})`
        return undefined
      },
    })
    if (p.isCancel(target)) return null
    answers.zenMonthlyTarget = parseFloat(target)
  }

  return answers
}

/**
 * Ask about orchestration preset.
 */
export async function askPreset(
  answers: Partial<WizardAnswers>
): Promise<Partial<WizardAnswers> | null> {
  const presets = getAllPresets()
  const availableProviders: string[] = []

  if (answers.hasAnthropicOAuth) availableProviders.push("anthropic")
  if (answers.hasChatGPT) availableProviders.push("openai")
  if (answers.hasGemini) availableProviders.push("google")
  if (answers.hasCopilot) availableProviders.push("github-copilot")
  if (answers.hasOpencodeZen) availableProviders.push("opencode")

  // Filter presets to those with satisfied requirements
  const validPresets = presets.filter((preset) =>
    preset.requiredProviders.every(
      (p) => availableProviders.includes(p) || p === "opencode"
    )
  )

  const options = validPresets.map((preset) => {
    const badges = PRESET_BADGES[preset.name] || []
    const badgeStr = badges.length > 0 ? ` [${badges.join(", ")}]` : ""
    return {
      value: preset.name,
      label: preset.name.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()) + badgeStr,
      hint: preset.description,
    }
  })

  // Always add custom option
  options.push({
    value: "custom" as OrchestrationPreset,
    label: "Custom",
    hint: "Configure models manually",
  })

  const preset = await p.select({
    message: "Choose an orchestration preset:",
    options,
    initialValue: "balanced" as OrchestrationPreset,
  })

  if (p.isCancel(preset)) return null
  answers.preset = preset as OrchestrationPreset

  return answers
}

/**
 * Ask about learning mode and adaptation settings (Step 4).
 */
export async function askLearningMode(
  answers: Partial<WizardAnswers>
): Promise<Partial<WizardAnswers> | null> {
  p.note(
    "Learning mode controls how quickly the system adapts to your spending patterns.",
    "Adaptive Learning"
  )

  const mode = await p.select({
    message: "Choose a learning mode:",
    options: [
      {
        value: "balanced" as const,
        label: "Balanced (Recommended)",
        hint: "Default settings - moderate learning speed, balanced stability",
      },
      {
        value: "conservative" as const,
        label: "Conservative (Stable)",
        hint: "Slow learning, high stability - good for predictable workloads",
      },
      {
        value: "aggressive" as const,
        label: "Aggressive (Adaptive)",
        hint: "Fast learning, quick adjustments - good for variable workloads",
      },
    ],
    initialValue: "balanced" as const,
  })
  if (p.isCancel(mode)) return null
  answers.learningMode = mode

  // Auto-upgrade/downgrade toggles
  const autoUpgrade = await p.confirm({
    message: "Enable auto-upgrade? (Switch to higher-quality models when budget headroom allows)",
    initialValue: true,
  })
  if (p.isCancel(autoUpgrade)) return null
  answers.autoUpgrade = autoUpgrade

  const autoDowngrade = await p.confirm({
    message: "Enable auto-downgrade? (Switch to cheaper models when approaching budget limits)",
    initialValue: true,
  })
  if (p.isCancel(autoDowngrade)) return null
  answers.autoDowngrade = autoDowngrade

  // Advanced options (optional)
  const showAdvanced = await p.confirm({
    message: "Configure advanced learning parameters?",
    initialValue: false,
  })
  if (p.isCancel(showAdvanced)) return null

  if (showAdvanced) {
    // Velocity alpha
    const velocityAlpha = await p.text({
      message: "Learning speed (velocity alpha, 0.1-0.5, lower = more stable):",
      placeholder: mode === "conservative" ? "0.1" : mode === "aggressive" ? "0.4" : "0.2",
      validate: (value) => {
        const num = parseFloat(value)
        if (isNaN(num) || num < 0.05 || num > 0.5) return "Please enter a number between 0.05 and 0.5"
        return undefined
      },
    })
    if (p.isCancel(velocityAlpha)) return null
    answers.velocityAlpha = parseFloat(velocityAlpha)

    // Min samples for prediction
    const minSamples = await p.text({
      message: "Minimum data points before trusting predictions (5-30):",
      placeholder: mode === "conservative" ? "20" : mode === "aggressive" ? "5" : "10",
      validate: (value) => {
        const num = parseInt(value)
        if (isNaN(num) || num < 3 || num > 50) return "Please enter a number between 3 and 50"
        return undefined
      },
    })
    if (p.isCancel(minSamples)) return null
    answers.minSamplesForPrediction = parseInt(minSamples)

    // Stability checks before upgrade
    const stabilityChecks = await p.text({
      message: "Stability checks required before upgrade (1-10):",
      placeholder: mode === "conservative" ? "5" : mode === "aggressive" ? "1" : "3",
      validate: (value) => {
        const num = parseInt(value)
        if (isNaN(num) || num < 1 || num > 10) return "Please enter a number between 1 and 10"
        return undefined
      },
    })
    if (p.isCancel(stabilityChecks)) return null
    answers.stabilityChecksBeforeUpgrade = parseInt(stabilityChecks)

    // Tier upgrade threshold
    const upgradeThreshold = await p.text({
      message: "Upgrade headroom multiplier (1.0-3.0, e.g., 1.5 = 50% more than needed):",
      placeholder: mode === "conservative" ? "2.0" : mode === "aggressive" ? "1.2" : "1.5",
      validate: (value) => {
        const num = parseFloat(value)
        if (isNaN(num) || num < 1.0 || num > 3.0) return "Please enter a number between 1.0 and 3.0"
        return undefined
      },
    })
    if (p.isCancel(upgradeThreshold)) return null
    answers.tierUpgradeThreshold = parseFloat(upgradeThreshold)

    // Tier downgrade threshold
    const downgradeThreshold = await p.text({
      message: "Downgrade trigger (0.2-1.0, e.g., 0.5 = 50% of needed):",
      placeholder: mode === "conservative" ? "0.3" : mode === "aggressive" ? "0.7" : "0.5",
      validate: (value) => {
        const num = parseFloat(value)
        if (isNaN(num) || num < 0.2 || num > 1.0) return "Please enter a number between 0.2 and 1.0"
        return undefined
      },
    })
    if (p.isCancel(downgradeThreshold)) return null
    answers.tierDowngradeThreshold = parseFloat(downgradeThreshold)
  }

  return answers
}

/**
 * Ask about budget configuration (Step 5 - simplified).
 */
export async function askBudgetConfig(
  answers: Partial<WizardAnswers>
): Promise<Partial<WizardAnswers> | null> {
  const enable = await p.confirm({
    message: "Enable budget-aware auto-orchestration?",
    initialValue: true,
  })
  if (p.isCancel(enable)) return null
  answers.enableBudget = enable

  if (!enable) return answers

  // Only ask for monthly budget if not already set via provider-specific targets
  if (!answers.zenMonthlyTarget && !answers.claudeMaxWeeklyTarget && !answers.copilotMonthlyTarget) {
    const budget = await p.text({
      message: "What's your total monthly budget across all providers (USD)?",
      placeholder: "100",
      validate: (value) => {
        const num = parseFloat(value)
        if (isNaN(num) || num <= 0) return "Please enter a valid positive number"
        return undefined
      },
    })
    if (p.isCancel(budget)) return null
    answers.monthlyBudget = parseFloat(budget)
  }

  return answers
}

/**
 * Show a summary of the configuration.
 */
export function showSummary(answers: WizardAnswers): string {
  const lines: string[] = []

  lines.push(color.bold(color.white("Configuration Summary")))
  lines.push("")

  // Providers
  lines.push(color.cyan("Providers:"))
  if (answers.hasAnthropicOAuth) {
    const claudeTier = answers.claudePlan === "max-20x" ? "Max 20x" :
                       answers.claudePlan === "max-5x" ? "Max 5x" : "Pro"
    lines.push(`  ${color.green("+")} Anthropic (Claude ${claudeTier})`)
  }
  if (answers.hasChatGPT) {
    lines.push(`  ${color.green("+")} OpenAI (ChatGPT)`)
  }
  if (answers.hasGemini) {
    lines.push(`  ${color.green("+")} Google Gemini (Antigrav OAuth)`)
  }
  if (answers.hasCopilot) {
    const copilotTier = answers.copilotPlan === "enterprise" ? "Enterprise" :
                        answers.copilotPlan === "pro" ? "Pro" : "Free"
    lines.push(`  ${color.green("+")} GitHub Copilot (${copilotTier})`)
  }
  if (answers.hasOpencodeZen) {
    lines.push(`  ${color.green("+")} OpenCode Zen ($${answers.zenBudget ?? 0}/mo)`)
  }

  lines.push("")

  // Quota Targets
  if (answers.claudeMaxWeeklyTarget || answers.copilotMonthlyTarget || answers.zenMonthlyTarget) {
    lines.push(color.cyan("Quota Targets:"))
    if (answers.claudeMaxWeeklyTarget) {
      lines.push(`  Claude Max Weekly: ${answers.claudeMaxWeeklyTarget}%`)
    }
    if (answers.copilotMonthlyTarget) {
      lines.push(`  Copilot Monthly: ${answers.copilotMonthlyTarget}%`)
    }
    if (answers.zenMonthlyTarget) {
      lines.push(`  Zen Monthly: $${answers.zenMonthlyTarget}`)
    }
    lines.push("")
  }

  // Preset
  lines.push(color.cyan("Orchestration:"))
  const badges = PRESET_BADGES[answers.preset] || []
  const badgeStr = badges.length > 0 ? ` [${badges.join(", ")}]` : ""
  lines.push(`  Preset: ${color.yellow(answers.preset)}${badgeStr}`)

  // Zen models
  if (answers.zenModels && answers.zenModels.length > 0) {
    lines.push(`  Zen Models: ${answers.zenModels.join(", ")}`)
  }

  lines.push("")

  // Learning & Adaptation
  lines.push(color.cyan("Adaptation:"))
  lines.push(`  Learning Mode: ${color.yellow(answers.learningMode ?? "balanced")}`)
  lines.push(`  Auto-upgrade: ${answers.autoUpgrade !== false ? color.green("Yes") : color.red("No")}`)
  lines.push(`  Auto-downgrade: ${answers.autoDowngrade !== false ? color.green("Yes") : color.red("No")}`)

  // Advanced params if customized
  if (answers.velocityAlpha || answers.minSamplesForPrediction || answers.stabilityChecksBeforeUpgrade) {
    lines.push(color.dim("  Advanced:"))
    if (answers.velocityAlpha) lines.push(color.dim(`    Velocity Alpha: ${answers.velocityAlpha}`))
    if (answers.minSamplesForPrediction) lines.push(color.dim(`    Min Samples: ${answers.minSamplesForPrediction}`))
    if (answers.stabilityChecksBeforeUpgrade) lines.push(color.dim(`    Stability Checks: ${answers.stabilityChecksBeforeUpgrade}`))
    if (answers.tierUpgradeThreshold) lines.push(color.dim(`    Upgrade Threshold: ${answers.tierUpgradeThreshold}`))
    if (answers.tierDowngradeThreshold) lines.push(color.dim(`    Downgrade Threshold: ${answers.tierDowngradeThreshold}`))
  }

  // Budget
  if (answers.enableBudget) {
    lines.push("")
    lines.push(color.cyan("Budget Orchestration:"))
    lines.push(`  Enabled: ${color.green("Yes")}`)
    if (answers.monthlyBudget) {
      lines.push(`  Monthly Budget: $${answers.monthlyBudget}`)
    }
  }

  return lines.join("\n")
}
