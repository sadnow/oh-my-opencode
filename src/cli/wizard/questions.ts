/**
 * Wizard Questions
 * Interactive prompts using @clack/prompts
 */

import * as p from "@clack/prompts"
import color from "picocolors"
import type { OrchestrationPreset } from "../../config/schema"
import { getAllPresets } from "./presets"

export interface WizardAnswers {
  // Subscriptions
  hasOpencodeZen: boolean
  hasChatGPT: boolean
  hasAnthropicOAuth: boolean
  hasCopilot: boolean
  hasGemini: boolean

  // Plan tiers (conditional)
  copilotPlan?: "none" | "standard" | "enterprise"
  claudePlan?: "pro" | "max"
  zenBudget?: number

  // Zen models (if available)
  zenModels?: string[]

  // Preset selection
  preset: OrchestrationPreset

  // Budget config
  enableBudget: boolean
  monthlyBudget?: number
  autoDowngrade?: boolean
}

/**
 * Available OpenCode Zen models for selection.
 */
export const ZEN_MODELS = [
  { value: "big-pickle", label: "big-pickle", hint: "Versatile general-purpose model" },
  { value: "gpt-5-nano", label: "gpt-5-nano", hint: "Fast, lightweight GPT" },
  { value: "gemini-3-flash", label: "gemini-3-flash", hint: "Ultra-fast Gemini" },
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

  // Gemini
  const gemini = await p.confirm({
    message: "Will you integrate Google Gemini?",
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
  // Copilot plan tier
  if (answers.hasCopilot) {
    const plan = await p.select({
      message: "What GitHub Copilot plan do you have?",
      options: [
        { value: "none" as const, label: "Free/Individual", hint: "Limited usage" },
        { value: "standard" as const, label: "Business ($45/mo)", hint: "Standard features" },
        { value: "enterprise" as const, label: "Enterprise", hint: "Full features" },
      ],
    })
    if (p.isCancel(plan)) return null
    answers.copilotPlan = plan
  }

  // Claude plan tier
  if (answers.hasAnthropicOAuth) {
    const plan = await p.select({
      message: "What Claude subscription do you have?",
      options: [
        { value: "pro" as const, label: "Claude Pro ($20/mo)", hint: "Standard limits" },
        { value: "max" as const, label: "Claude Max ($200/mo)", hint: "5x more usage" },
      ],
    })
    if (p.isCancel(plan)) return null
    answers.claudePlan = plan
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
    initialValues: ["big-pickle", "gemini-3-flash"],
    required: false,
  })

  if (p.isCancel(models)) return null
  answers.zenModels = models as string[]

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

  const options = validPresets.map((preset) => ({
    value: preset.name,
    label: preset.name.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
    hint: preset.description,
  }))

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
 * Ask about budget configuration.
 */
export async function askBudgetConfig(
  answers: Partial<WizardAnswers>
): Promise<Partial<WizardAnswers> | null> {
  const enable = await p.confirm({
    message: "Enable budget-aware auto-orchestration?",
    initialValue: false,
  })
  if (p.isCancel(enable)) return null
  answers.enableBudget = enable

  if (!enable) return answers

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

  const autoDowngrade = await p.confirm({
    message: "Auto-downgrade to cheaper models when over budget?",
    initialValue: true,
  })
  if (p.isCancel(autoDowngrade)) return null
  answers.autoDowngrade = autoDowngrade

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
    lines.push(`  ${color.green("+")} Anthropic (Claude ${answers.claudePlan ?? "Pro"})`)
  }
  if (answers.hasChatGPT) {
    lines.push(`  ${color.green("+")} OpenAI (ChatGPT)`)
  }
  if (answers.hasGemini) {
    lines.push(`  ${color.green("+")} Google (Gemini)`)
  }
  if (answers.hasCopilot) {
    lines.push(`  ${color.green("+")} GitHub Copilot (${answers.copilotPlan ?? "standard"})`)
  }
  if (answers.hasOpencodeZen) {
    lines.push(`  ${color.green("+")} OpenCode Zen ($${answers.zenBudget ?? 0}/mo)`)
  }

  lines.push("")

  // Preset
  lines.push(color.cyan("Orchestration:"))
  lines.push(`  Preset: ${color.yellow(answers.preset)}`)

  // Zen models
  if (answers.zenModels && answers.zenModels.length > 0) {
    lines.push(`  Zen Models: ${answers.zenModels.join(", ")}`)
  }

  // Budget
  if (answers.enableBudget) {
    lines.push("")
    lines.push(color.cyan("Budget:"))
    lines.push(`  Monthly: $${answers.monthlyBudget}`)
    lines.push(`  Auto-downgrade: ${answers.autoDowngrade ? "Yes" : "No"}`)
  }

  return lines.join("\n")
}
