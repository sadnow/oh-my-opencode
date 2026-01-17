/**
 * Auto-Router Hook
 * Intelligent task routing based on automatic classification
 */

import type { PluginInput } from "@opencode-ai/plugin"
import { log } from "../../shared/logger"
import {
  formatClassificationToast,
  formatClassificationDetailsToast,
  formatEscalationToast,
  formatMagicKeywordToast,
  formatModelSelectionToast,
  formatParallelAgentToast,
  formatProviderSwitchToast,
  formatRateLimitToast,
  formatModelUsageToast,
  formatProviderStatusToast,
  toSimpleToast,
} from "../../shared/notifications"
import {
  createAutoRouter,
  getRoutingSummary,
  createEscalationManager,
  BUDGET_TIERS,
  MAGIC_KEYWORDS,
  techniqueIncludes,
  shouldEnableRalphLoop,
  getBudgetTierModelConfig,
  getAgentForBudgetTier,
  DEFAULT_PARALLEL_AGENT_CONFIG,
  ORCHESTRATOR_MODEL_RECOMMENDATION,
  SUBAGENT_DELEGATION_TEMPLATE,
  NO_DELEGATION_TEMPLATE,
  parseModelString,
  // v3.8.0: Provider-aware parallel agent selection
  selectAgentsForTask,
  getMaxAgentsForTier,
  AGENTS_PER_PROVIDER,
  // v3.8.0: Model ID validation
  validateModelId,
  // v3.8.1: Technique instructions for escalation
  TECHNIQUE_INSTRUCTIONS,
} from "../../features/auto-router"
import {
  recordSubagentExecution,
  updateSubagentExecution,
  getSubagentExecution,
  formatSubagentAnalytics,
  // v3.8.0: Spending tracking
  recordModelUsage,
  checkSpendingMilestone,
  getSpendingSummary,
  formatSpendingSummary,
  resetSpendingTracker,
} from "../../features/auto-router/analytics"
import type { EscalationManager } from "../../features/auto-router"
import type { BudgetTier, TechniqueCombo } from "../../features/auto-router/types"
import type {
  AutoRouterState,
  AutoRouterHookInput,
  AutoRouterHookOutput,
  AutoRouterHookOptions,
  AutoRouterSessionContext,
  TaskIntent,
  SubagentExecutionInfo,
} from "./types"
import { extractTaskIntent } from "../../features/auto-router/classifier"
import {
  HOOK_NAME,
  AUTO_ROUTER_TAG_OPEN,
  AUTO_ROUTER_TAG_CLOSE,
  AUTO_COMMAND_PATTERN,
  parseAutoCommand,
  showAutoDeprecationWarning,
} from "./constants"
import {
  loadRateLimitState,
  saveRateLimitState,
  recordRateLimitHit,
  recordProviderAuthError,
  recordSuccess,
  isRateLimitError,
  isProviderUnavailableError,
  isProviderAvailable,
  getModelWithFallback,
  extractProvider,
  getRateLimitSummary,
  getCooldownMs,
  BLOCKED_PROVIDERS,
  PROVIDER_FALLBACK_CHAIN,
  COOLDOWN_MS,
  type RateLimitState,
} from "../../features/auto-router/rate-limit-handler"
import { BudgetTierSchema, TechniqueComboSchema, AutoRouterConfigSchema } from "../../config/schema"

export * from "./types"
export * from "./constants"

interface SessionState {
  escalationManager: EscalationManager
  taskDescription: string
  iteration: number
  createdAt: number
  /** Whether ralph-loop is enabled for this session */
  ralphLoopEnabled: boolean
  /** The technique selected for this session */
  technique: TechniqueCombo
  /** v3.6.3: Task intent detected from user prompt */
  taskIntent?: TaskIntent
  /** v3.6.3: Tools explicitly requested by user */
  requiredTools?: string[]
  /** v3.6.4: Session context preserved between /auto commands */
  sessionContext: AutoRouterSessionContext
}

interface ProcessedCommand {
  key: string
  processedAt: number
}

// Cleanup stale entries older than 1 hour
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000
// Commands older than 10 minutes can be cleaned up
const COMMAND_EXPIRY_MS = 10 * 60 * 1000
// Maximum sessions to prevent unbounded memory growth
const MAX_SESSIONS = 100

// Valid budget and technique values for type guards
const VALID_BUDGETS: readonly BudgetTier[] = ["free", "cheap", "moderate", "expensive", "maximum"] as const
const VALID_TECHNIQUES: readonly TechniqueCombo[] = [
  "direct", "ulw", "ultrathink", "ralph",
  "ulw+ralph", "ultrathink+ulw", "ultrathink+ralph", "triple"
] as const

/**
 * v3.8.1: Get the appropriate technique for a budget tier during escalation
 * Higher tiers get more powerful techniques
 */
function getTechniqueForBudgetTier(tier: BudgetTier): TechniqueCombo {
  switch (tier) {
    case "free":
    case "cheap":
      return "direct"
    case "moderate":
      return "ulw"
    case "expensive":
      return "ultrathink+ulw"
    case "maximum":
      return "triple"
  }
}

/**
 * v3.8.1: Generate escalation prompt with technique instructions
 * This ensures technique context isn't lost during escalation respawn
 */
function generateEscalationPrompt(
  taskDescription: string,
  newTier: BudgetTier,
  existingTechnique?: TechniqueCombo
): string {
  // Use the more powerful of: existing technique or tier-appropriate technique
  const tierTechnique = getTechniqueForBudgetTier(newTier)
  const technique = existingTechnique && VALID_TECHNIQUES.indexOf(existingTechnique) > VALID_TECHNIQUES.indexOf(tierTechnique)
    ? existingTechnique
    : tierTechnique

  const budgetConfig = BUDGET_TIERS[newTier]
  const techniqueInstructions = TECHNIQUE_INSTRUCTIONS[technique]
    .replace(/\{\{MAX_ITERATIONS\}\}/g, String(budgetConfig.maxIterations))

  return `## AUTO-ROUTER ESCALATION
You are being escalated to a higher capability tier due to previous failures.

**Budget Tier**: ${newTier.toUpperCase()}
**Model**: ${budgetConfig.models.primary}
**Technique**: ${technique}
**Max Iterations**: ${budgetConfig.maxIterations}

${techniqueInstructions}

---

## YOUR TASK

${taskDescription}`
}

/**
 * Result of launching a subagent with fallback support
 */
interface SubagentLaunchResult {
  taskId: string
  sessionID: string
  usedModel: string
  didFallback: boolean
  fallbackReason?: string
}

/**
 * Launch a subagent with automatic fallback on provider errors
 * Retries with fallback models when auth/rate limit errors occur
 */
async function launchSubagentWithFallback(
  backgroundManager: NonNullable<AutoRouterHookOptions["backgroundManager"]>,
  input: {
    description: string
    prompt: string
    agent: string
    parentSessionID: string
    parentMessageID: string
    model: { providerID: string; modelID: string }
  },
  intendedModel: string,
  rateLimitState: RateLimitState,
  maxRetries: number = 3
): Promise<{ result: SubagentLaunchResult; newRateLimitState: RateLimitState }> {
  let currentModel = intendedModel
  let currentModelConfig = input.model
  let retries = 0
  let newState = rateLimitState

  while (retries < maxRetries) {
    try {
      const launchResult = await backgroundManager.launch({
        ...input,
        model: currentModelConfig,
      })

      return {
        result: {
          taskId: launchResult.id,
          sessionID: launchResult.sessionID || "",
          usedModel: currentModel,
          didFallback: retries > 0,
          fallbackReason: retries > 0 ? "Provider unavailable" : undefined,
        },
        newRateLimitState: newState,
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      const { isUnavailable, isAuthError } = isProviderUnavailableError(err)

      if (isUnavailable) {
        const provider = extractProvider(currentModel)

        // Record the error with appropriate cooldown
        if (isAuthError) {
          newState = recordProviderAuthError(newState, provider, errorMessage)
        } else {
          newState = recordRateLimitHit(newState, provider)
        }

        // Save state immediately
        saveRateLimitState(newState)

        // Log the provider error prominently
        console.log(`\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!`)
        console.log(`[AUTO-ROUTER] PROVIDER ${isAuthError ? "AUTH" : "RATE LIMIT"} ERROR`)
        console.log(`!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!`)
        console.log(`Provider: ${provider}`)
        console.log(`Model: ${currentModel}`)
        console.log(`Error: ${errorMessage.substring(0, 200)}`)
        console.log(`Cooldown: ${Math.ceil((isAuthError ? COOLDOWN_MS.auth_error : COOLDOWN_MS.default) / 60000)} minutes`)

        // Get fallback model
        const { model: fallbackModel, provider: fallbackProvider, didFallback } = getModelWithFallback(
          newState,
          currentModel
        )

        if (!didFallback || fallbackModel === currentModel) {
          console.log(`Action: NO FALLBACK AVAILABLE - all providers exhausted`)
          console.log(`!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n`)
          throw new Error(`No available fallback providers. Last error: ${errorMessage}`)
        }

        console.log(`Action: Falling back to ${fallbackProvider}`)
        console.log(`Fallback: ${currentModel} → ${fallbackModel}`)
        console.log(`!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n`)

        // Parse the fallback model and retry
        currentModel = fallbackModel
        currentModelConfig = parseModelString(fallbackModel)
        retries++
      } else {
        // Non-provider error, don't retry
        throw err
      }
    }
  }

  throw new Error(`Failed after ${maxRetries} retries across providers`)
}

/**
 * Display current provider availability status
 */
function logProviderStatus(rateLimitState: RateLimitState): void {
  console.log(`\n[AUTO-ROUTER] Provider Status:`)
  console.log(`----------------------------------------`)
  for (const provider of PROVIDER_FALLBACK_CHAIN) {
    const available = isProviderAvailable(rateLimitState, provider)
    const blocked = BLOCKED_PROVIDERS.has(provider)
    const pState = rateLimitState.providers[provider]

    let status = "✓ available"
    let detail = ""

    if (blocked) {
      status = "✗ BLOCKED"
    } else if (!available && pState) {
      const now = Date.now()
      const cooldownLeft = Math.max(0, pState.cooldownUntil - now)
      const cooldownMinutes = Math.ceil(cooldownLeft / 60000)
      status = "✗ unavailable"
      detail = ` (cooldown ${cooldownMinutes}m remaining)`
    }

    console.log(`  ${provider}: ${status}${detail}`)
  }
  console.log(`  anthropic: ✗ BLOCKED (direct API disabled)`)
  console.log(`----------------------------------------\n`)
}

export interface AutoRouterHook {
  /** Main hook - intercepts /auto commands, classifies tasks, injects technique prompts */
  "chat.message": (
    input: AutoRouterHookInput,
    output: AutoRouterHookOutput
  ) => Promise<void>
  /**
   * ⚠️ NOT WIRED UP - OpenCode API doesn't support model switching via chat.params.
   * Preserved as architectural placeholder.
   */
  "chat.params": (
    output: { message: { model?: { providerID: string; modelID: string } } },
    sessionID: string
  ) => Promise<void>
  /**
   * ⚠️ NOT WIRED UP - OpenCode API doesn't expose chat.error hook.
   * Preserved as architectural placeholder.
   */
  "chat.error": (
    input: { error: unknown; sessionID: string; model?: { providerID: string; modelID: string } }
  ) => Promise<void>
  /** Event handler - handles escalations on session.idle, session.error */
  event: (input: { event: { type: string; properties?: unknown } }) => Promise<void>
  getSessionState: (sessionId: string) => SessionState | undefined
  /** Check if ralph-loop is enabled for a session */
  isRalphLoopEnabled: (sessionId: string) => boolean
  /** Get current rate limit state summary */
  getRateLimitSummary: () => string
  /** Get subagent analytics summary (v3.7.0) */
  getSubagentAnalytics: () => string
}

/**
 * Create the auto-router hook
 */
export function createAutoRouterHook(
  ctx: PluginInput,
  options?: AutoRouterHookOptions
): AutoRouterHook {
  const sessions = new Map<string, SessionState>()
  const processedCommands = new Map<string, number>() // key -> timestamp

  // v3.7.0: Track subagent executions for model verification
  const subagentExecutions = new Map<string, SubagentExecutionInfo>()

  // v3.6.6: Rate limit state (loaded from disk, persisted on changes)
  let rateLimitState: RateLimitState = loadRateLimitState()
  log(`[${HOOK_NAME}] Rate limit state loaded`, {
    providers: Object.keys(rateLimitState.providers).length,
    summary: getRateLimitSummary(rateLimitState),
  })

  /**
   * v3.6.4: Helper to get or create session state with proper initialization.
   * This ensures sessionContext is preserved between /auto commands in the same session.
   */
  function getOrCreateSession(sessionID: string): SessionState | null {
    return sessions.get(sessionID) ?? null
  }

  // Validate config if provided
  // If validation fails, use empty partial config (defaults will be applied via ?? operators)
  const rawConfig = options?.config ?? {}
  const configValidation = AutoRouterConfigSchema.safeParse(rawConfig)
  if (!configValidation.success) {
    log(`[${HOOK_NAME}] Config validation failed, using defaults`, {
      error: configValidation.error.message,
    })
  }
  // Type the config as partial to allow property access with defaults via ??
  type ValidatedConfig = typeof configValidation.data
  const config: Partial<ValidatedConfig> = configValidation.success ? configValidation.data : {}

  /**
   * Cleanup stale processed commands to prevent memory leak
   * Uses timestamp-based expiry instead of arbitrary deletion
   */
  function cleanupProcessedCommands(): void {
    const now = Date.now()
    for (const [key, processedAt] of processedCommands) {
      if (now - processedAt > COMMAND_EXPIRY_MS) {
        processedCommands.delete(key)
      }
    }
  }

  /**
   * Cleanup stale sessions and enforce max session limit
   * Removes sessions older than CLEANUP_INTERVAL_MS and caps at MAX_SESSIONS
   */
  function cleanupStaleSessions(): void {
    const now = Date.now()

    // First pass: remove stale sessions
    for (const [sessionId, state] of sessions) {
      if (now - state.createdAt > CLEANUP_INTERVAL_MS) {
        sessions.delete(sessionId)
      }
    }

    // Second pass: enforce max sessions cap by removing oldest
    if (sessions.size > MAX_SESSIONS) {
      // Sort by createdAt ascending (oldest first)
      const sorted = [...sessions.entries()].sort(
        (a, b) => a[1].createdAt - b[1].createdAt
      )
      // Remove oldest sessions until we're at the cap
      const toRemove = sorted.slice(0, sessions.size - MAX_SESSIONS)
      for (const [sessionId] of toRemove) {
        sessions.delete(sessionId)
        log(`[${HOOK_NAME}] Session evicted due to max cap`, { sessionId })
      }
    }
  }

  /**
   * Detect if message contains /auto command
   *
   * Supports:
   * - /auto "quoted task"
   * - /auto 'single quoted'
   * - /auto unquoted task description
   * - /auto multiline
   *   task description
   *   with multiple lines
   * - /auto task --budget=moderate (options after task)
   */
  function detectAutoCommand(text: string): { taskDescription: string } | null {
    // Skip if already processed
    if (text.includes(AUTO_ROUTER_TAG_OPEN)) {
      return null
    }

    // Use the robust parser function (handles multiline, quotes, /autocode and /auto)
    const parseResult = parseAutoCommand(text)

    // Validate task description is not empty
    if (!parseResult) {
      // Only log if it looked like an /auto or /autocode command
      const trimmedLower = text.trim().toLowerCase()
      if (trimmedLower.startsWith("/auto") || trimmedLower.startsWith("/autocode")) {
        log(`[${HOOK_NAME}] Empty or invalid task description rejected`)
      }
      return null
    }

    // v3.8.0: Show deprecation warning if using /auto instead of /autocode
    if (parseResult.isDeprecated) {
      showAutoDeprecationWarning()
    }

    return { taskDescription: parseResult.task }
  }

  /**
   * Type guard for BudgetTier
   */
  function isValidBudget(value: string): value is BudgetTier {
    return VALID_BUDGETS.includes(value as BudgetTier)
  }

  /**
   * Type guard for TechniqueCombo
   */
  function isValidTechnique(value: string): value is TechniqueCombo {
    return VALID_TECHNIQUES.includes(value as TechniqueCombo)
  }

  /**
   * Parse command-line options from /auto command
   * Uses type guards for safe parsing without unsafe casts
   *
   * Supports:
   * - --budget=<tier> : Override budget tier
   * - --force-technique=<technique> : Override technique selection
   * - Magic keywords at start: "ultrawork:", "deepthink:", "fullsend:", "quickfix:", "careful:"
   */
  function parseOptions(text: string): {
    budget?: BudgetTier
    technique?: TechniqueCombo
    warnings: string[]
    magicKeyword?: string
  } {
    const result: { budget?: BudgetTier; technique?: TechniqueCombo; warnings: string[]; magicKeyword?: string } = {
      warnings: []
    }

    // Check for magic keywords (format: "keyword: task" or "keyword task")
    // Magic keywords take precedence over explicit flags
    const lowerText = text.toLowerCase()
    for (const [keyword, config] of Object.entries(MAGIC_KEYWORDS)) {
      // Check for "keyword:" or "keyword " at the beginning of the task (after /auto)
      const patterns = [
        new RegExp(`/auto\\s+${keyword}:`, 'i'),
        new RegExp(`/auto\\s+"${keyword}:`, 'i'),
        new RegExp(`/auto\\s+'${keyword}:`, 'i'),
      ]

      if (patterns.some(p => p.test(text))) {
        result.technique = config.technique
        result.budget = config.budget
        result.magicKeyword = keyword
        log(`[${HOOK_NAME}] Magic keyword detected`, { keyword, technique: config.technique, budget: config.budget })
        break
      }
    }

    // Explicit flags can override magic keywords
    const budgetMatch = text.match(/--budget=(\w+)/i)
    if (budgetMatch) {
      const budget = budgetMatch[1].toLowerCase()
      if (isValidBudget(budget)) {
        result.budget = budget
      } else {
        result.warnings.push(`Invalid budget '${budget}', using default. Valid: ${VALID_BUDGETS.join(', ')}`)
      }
    }

    const techniqueMatch = text.match(/--force-technique=(\S+)/i)
    if (techniqueMatch) {
      const technique = techniqueMatch[1].toLowerCase()
      if (isValidTechnique(technique)) {
        result.technique = technique
      } else {
        result.warnings.push(`Invalid technique '${technique}', using auto-select. Valid: ${VALID_TECHNIQUES.join(', ')}`)
      }
    }

    return result
  }

  /**
   * Chat message handler - intercepts /auto commands
   * Input comes from plugin API, output.parts contains the message content
   */
  const chatMessage = async (
    input: AutoRouterHookInput,
    output: AutoRouterHookOutput
  ): Promise<void> => {
    // Parts are in output, not input (per OpenCode plugin API)
    const textPart = output.parts?.find((p) => p.type === "text" && p.text)
    if (!textPart?.text) {
      return
    }

    // Debug: Log all incoming messages that start with /auto
    if (textPart.text.trim().toLowerCase().startsWith("/auto")) {
      log(`[${HOOK_NAME}] Received potential /auto message`, {
        sessionID: input.sessionID,
        text: textPart.text.substring(0, 100),
      })
    }

    const detected = detectAutoCommand(textPart.text)
    if (!detected) {
      // Debug: Log why detection failed
      if (textPart.text.trim().toLowerCase().startsWith("/auto")) {
        log(`[${HOOK_NAME}] /auto detection failed - pattern didn't match`, {
          text: textPart.text.substring(0, 100),
          pattern: AUTO_COMMAND_PATTERN.source,
        })
      }
      return
    }

    // Check if already processed (using timestamp-based Map)
    const commandKey = `${input.sessionID}:${input.messageID}:auto`
    if (processedCommands.has(commandKey)) {
      return
    }
    processedCommands.set(commandKey, Date.now())

    log(`[${HOOK_NAME}] Detected /auto command`, {
      sessionID: input.sessionID,
      taskDescription: detected.taskDescription.substring(0, 100),
    })

    try {
      // Parse optional overrides (with validation warnings)
      const cmdOptions = parseOptions(textPart.text)

      // Log any parsing warnings
      if (cmdOptions.warnings.length > 0) {
        log(`[${HOOK_NAME}] Option parsing warnings`, {
          sessionID: input.sessionID,
          warnings: cmdOptions.warnings,
        })
      }

      // Run auto-router classification
      // NOTE: Config keys use snake_case (from schema) but createAutoRouter expects camelCase
      // The conversion is done inline below. If schema changes, update mappings here.
      const directory = options?.directory ?? ctx.directory

      // v3.6.4: Get existing session context to preserve between /auto commands
      const existingSessionForContext = getOrCreateSession(input.sessionID)
      const sessionContextForClassification = existingSessionForContext?.sessionContext

      const result = await createAutoRouter(
        detected.taskDescription,
        directory,
        {
          enabled: config.enabled ?? true,
          defaultBudget: cmdOptions.budget ?? config.default_budget ?? "cheap",
          autoEscalate: config.auto_escalate ?? true,
          maxEscalations: config.max_escalations ?? 3,
          enableJudge: config.enable_judge ?? true,
          qualityThreshold: config.quality_threshold ?? 0.7,
        },
        sessionContextForClassification
      )

      // Apply technique override if specified
      const finalTechnique = cmdOptions.technique ?? config.technique_override ?? result.selectedTechnique

      // v3.6.3: Extract task intent from USER PROMPT ONLY (not project artifacts)
      // This is the critical fix for the "playwright task switching to vercel" bug
      const taskIntentResult = extractTaskIntent(detected.taskDescription)
      log(`[${HOOK_NAME}] Task intent extracted`, {
        sessionID: input.sessionID,
        primaryIntent: taskIntentResult.primaryIntent,
        intents: taskIntentResult.intents,
        requiredTools: taskIntentResult.requiredTools,
        confidence: taskIntentResult.confidence,
      })

      // Determine if ralph-loop should be enabled (intelligent determination)
      // v3.3.0: Use shouldEnableRalphLoop for complexity-aware decision
      // v3.6.3: Now also considers task intent and required tools
      // Ralph loop is enabled if:
      // 1. Technique explicitly includes ralph, OR
      // 2. Classification indicates it's needed (complexity tier 3, novel tier 2, high-risk domain), OR
      // 3. Task intent is "test", "play", "verify" (interactive tasks need persistence), OR
      // 4. Required tools include playwright/cypress/puppeteer (browser automation needs persistence)
      const techniqueRequiresRalph = techniqueIncludes(finalTechnique, "ralph")
      const classificationNeedsRalph = shouldEnableRalphLoop(
        result.classification.complexityTier,
        result.classification.noveltyLevel,
        result.classification.domainSignals,
        config.full_autonomy ?? true,
        taskIntentResult.primaryIntent, // v3.6.3: Pass task intent
        taskIntentResult.requiredTools   // v3.6.3: Pass required tools
      )
      const ralphLoopEnabled = techniqueRequiresRalph || classificationNeedsRalph

      // v3.6.3: Log why ralph loop is enabled/disabled for debugging
      if (ralphLoopEnabled) {
        log(`[${HOOK_NAME}] Ralph loop ENABLED`, {
          sessionID: input.sessionID,
          techniqueRequiresRalph,
          classificationNeedsRalph,
          taskIntent: taskIntentResult.primaryIntent,
          requiredTools: taskIntentResult.requiredTools,
          complexityTier: result.classification.complexityTier,
        })
      }

      // v3.6.4: Get existing session to preserve context, or start fresh
      const existingSession = getOrCreateSession(input.sessionID)
      const previousContext = existingSession?.sessionContext ?? {
        preservedIntents: [],
        requiredTools: [],
      }

      // v3.6.4: Build updated session context with preserved + new intents/tools
      const updatedSessionContext: AutoRouterSessionContext = {
        previousTask: detected.taskDescription,
        previousDomain: result.classification.domainSignals[0],
        preservedIntents: taskIntentResult.intents,
        requiredTools: [
          ...new Set([
            ...previousContext.requiredTools,
            ...taskIntentResult.requiredTools,
          ]),
        ],
        lastCommandAt: new Date().toISOString(),
      }

      // Store session state for escalation tracking
      sessions.set(input.sessionID, {
        escalationManager: result.escalationManager,
        taskDescription: detected.taskDescription,
        iteration: existingSession ? existingSession.iteration + 1 : 1,
        createdAt: existingSession?.createdAt ?? Date.now(),
        ralphLoopEnabled,
        technique: finalTechnique,
        taskIntent: taskIntentResult.primaryIntent,
        requiredTools: taskIntentResult.requiredTools,
        sessionContext: updatedSessionContext,
      })

      // Generate summary for logging
      const summary = getRoutingSummary(result)
      log(`[${HOOK_NAME}] Classification complete`, {
        sessionID: input.sessionID,
        projectType: result.classification.projectType,
        complexity: result.classification.complexityTier,
        technique: finalTechnique,
        budget: result.startingBudget,
        ralphLoopEnabled,
      })

      // Inject the classification result into the prompt
      // Add ralph-loop instructions if enabled
      let injectedPrompt = result.injectedPrompt
      if (ralphLoopEnabled) {
        injectedPrompt += `\n\n## RALPH LOOP ENABLED
You are operating in persistent mode. Continue working until the task is fully complete.
When you have FULLY completed the task and verified everything works:
- Output: <promise>DONE</promise>
Do NOT output this promise until you have verified the task is 100% complete.`

        // v3.6.3: Add task intent and required tools to prevent focus drift
        if (taskIntentResult.requiredTools.length > 0) {
          injectedPrompt += `

## REQUIRED TOOLS (DO NOT IGNORE)
The user explicitly requested these tools: **${taskIntentResult.requiredTools.join(", ")}**
You MUST use these tools to complete the task. Do NOT switch to alternative approaches.
Do NOT follow "Next Step" suggestions from project documentation that differ from this.`
        }

        if (taskIntentResult.primaryIntent === "test") {
          injectedPrompt += `

## TASK INTENT: TESTING
The user wants to TEST/PLAY/VERIFY this project.
Focus on running tests and verification. Do NOT deploy unless explicitly asked.
Ignore deployment suggestions in project files unless the user asked for deployment.`
        }
      }

      // v3.6.4: Inject preserved context from previous /auto commands
      const prevTask = existingSessionForContext?.sessionContext?.previousTask
      if (prevTask) {
        const prevCtx = existingSessionForContext.sessionContext
        const truncatedTask = prevTask.substring(0, 100) + (prevTask.length > 100 ? "..." : "")
        injectedPrompt += `

## PRESERVED CONTEXT (from previous /auto command)
- **Previous Task**: ${truncatedTask}
- **Previous Domain**: ${prevCtx.previousDomain ?? "none"}
- **Preserved Intents**: ${prevCtx.preservedIntents.join(", ") || "none"}
- **Required Tools**: ${prevCtx.requiredTools.join(", ") || "none"}

Continue with the same context unless explicitly overridden by the current task.`
      }

      // Determine the final budget (magic keyword or explicit override takes precedence)
      const finalBudget = cmdOptions.budget ?? result.startingBudget

      // v3.5.0: Inject agent recommendation for model tier switching
      const recommendedAgent = getAgentForBudgetTier(finalBudget)
      const budgetConfig = BUDGET_TIERS[finalBudget]

      // v3.6.7: Verbose console output - ALWAYS show routing decision
      // NOTE: OpenCode plugin API does not support runtime model switching via chat.params
      // This output shows what model WOULD be used if the user configures agents properly
      console.log(`\n========================================`)
      console.log(`[AUTO-ROUTER] TASK ROUTING`)
      console.log(`========================================`)
      console.log(`Session: ${input.sessionID.substring(0, 8)}...`)
      console.log(`Task: ${detected.taskDescription.substring(0, 60)}${detected.taskDescription.length > 60 ? '...' : ''}`)
      console.log(`----------------------------------------`)
      console.log(`CLASSIFICATION:`)
      console.log(`  Project Type: ${result.classification.projectType}`)
      console.log(`  Complexity: Tier ${result.classification.complexityTier}`)
      console.log(`  Novelty: ${result.classification.noveltyLevel}`)
      console.log(`  Domains: ${result.classification.domainSignals.join(', ') || 'none'}`)
      console.log(`----------------------------------------`)
      console.log(`ROUTING DECISION:`)
      console.log(`  Technique: ${finalTechnique}`)
      console.log(`  Budget Tier: ${finalBudget.toUpperCase()}`)
      console.log(`  Recommended Model: ${budgetConfig.models.primary}`)
      console.log(`  Ralph Loop: ${ralphLoopEnabled ? 'ENABLED' : 'disabled'}`)
      console.log(`  Max Iterations: ${budgetConfig.maxIterations}`)
      if (cmdOptions.magicKeyword) {
        console.log(`  Magic Keyword: ${cmdOptions.magicKeyword}`)
      }
      console.log(`----------------------------------------`)
      console.log(`AGENT CONFIGURATION:`)
      console.log(`  For subagent tasks use: agent="${recommendedAgent}"`)
      console.log(`  Configure in opencode.json: agents.${recommendedAgent}.model`)
      console.log(`========================================\n`)

      injectedPrompt += `\n\n## MODEL TIER: ${finalBudget.toUpperCase()}
**Recommended Model**: ${budgetConfig.models.primary}
**For subagent tasks**: Use agent="${recommendedAgent}" in sisyphus_task/call_omo_agent
This ensures appropriate model capability for task complexity.
Max iterations at this tier: ${budgetConfig.maxIterations}`

      // v3.7.0: Auto-spawn subagent for Tier 2-3 tasks
      const autoSpawnConfig = config.auto_spawn_subagents ?? { enabled: true, tier_threshold: 2, verify_models: true, spawn_for_ralph: true }
      const autoSpawnEnabled = autoSpawnConfig.enabled !== false
      const tierThreshold = autoSpawnConfig.tier_threshold ?? 2
      const spawnForRalph = ("spawn_for_ralph" in autoSpawnConfig) ? autoSpawnConfig.spawn_for_ralph !== false : true
      const techniqueTriggersSpawn = spawnForRalph && (
        finalTechnique.includes("ralph") || finalTechnique === "triple"
      )

      const shouldAutoSpawn = (
        autoSpawnEnabled &&
        options?.backgroundManager &&
        (result.classification.complexityTier >= tierThreshold || techniqueTriggersSpawn)
      )

      let subagentSpawned = false
      let subagentTaskId: string | undefined
      let subagentInfo: SubagentExecutionInfo | undefined

      if (shouldAutoSpawn && options?.backgroundManager) {
        let intendedModel = budgetConfig.models.primary
        const subagentAgent = recommendedAgent

        // Generate a unique execution ID for analytics tracking
        const executionId = `exec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

        // Show provider status before spawning
        logProviderStatus(rateLimitState)

        try {
          // v3.8.0: Validate model ID before launching subagent
          const modelValidation = validateModelId(intendedModel)
          if (!modelValidation.valid) {
            log(`[AUTO-ROUTER] Model validation warning: ${modelValidation.message}`)
            if (modelValidation.suggestion) {
              log(`[AUTO-ROUTER] Using suggested model: ${modelValidation.suggestion}`)
              intendedModel = modelValidation.suggestion
            }
          }

          // Launch subagent with explicit model using retry-fallback logic
          const modelConfig = parseModelString(intendedModel)
          const { result: launchResult, newRateLimitState } = await launchSubagentWithFallback(
            options.backgroundManager,
            {
              description: `[AUTO-ROUTER] ${detected.taskDescription.substring(0, 50)}`,
              prompt: detected.taskDescription,
              agent: subagentAgent,
              parentSessionID: input.sessionID,
              parentMessageID: input.messageID ?? "",
              model: modelConfig,
            },
            intendedModel,
            rateLimitState,
            3 // maxRetries
          )

          // Update rate limit state if fallback occurred
          rateLimitState = newRateLimitState

          subagentTaskId = launchResult.taskId
          subagentSpawned = true

          // Track if fallback occurred for logging
          const usedModel = launchResult.usedModel
          const didFallback = launchResult.didFallback

          // Create subagent execution info for tracking
          subagentInfo = {
            executionId,
            intendedModel: usedModel, // Track actual model used
            sessionId: launchResult.sessionID,
            agentName: subagentAgent,
            startTime: Date.now(),
            isEscalation: false,
            budgetTier: finalBudget,
            complexityTier: result.classification.complexityTier,
            parentSessionId: input.sessionID,
            taskDescription: detected.taskDescription,
          }

          // Store locally for completion tracking
          subagentExecutions.set(subagentTaskId, subagentInfo)

          // Record in analytics
          recordSubagentExecution({
            executionId,
            taskId: subagentTaskId,
            sessionId: subagentInfo.sessionId,
            agentName: subagentAgent,
            intendedModel: usedModel,
            isEscalation: false,
            parentSessionId: input.sessionID,
            complexityTier: result.classification.complexityTier,
            budgetTier: finalBudget,
          })

          // v3.8.0: Track spending for model usage
          recordModelUsage(usedModel)

          // Console output for subagent delegation
          console.log(`\n========================================`)
          console.log(`[AUTO-ROUTER] SUBAGENT DELEGATION`)
          console.log(`========================================`)
          console.log(`Task Complexity: Tier ${result.classification.complexityTier}`)
          console.log(`Technique: ${finalTechnique}`)
          console.log(`Budget: ${finalBudget.toUpperCase()}`)
          console.log(`----------------------------------------`)
          console.log(`Spawning Agent: ${subagentAgent}`)
          if (didFallback) {
            console.log(`Original Model: ${intendedModel}`)
            console.log(`Actual Model: ${usedModel} (FALLBACK)`)
          } else {
            console.log(`Model: ${usedModel}`)
          }
          console.log(`Task ID: ${subagentTaskId}`)
          console.log(`========================================`)
          console.log(`NOTE: Work delegated to subagent.`)
          console.log(`Use background_output to check progress.`)
          console.log(`========================================\n`)

          log(`[${HOOK_NAME}] Subagent spawned for Tier ${result.classification.complexityTier} task`, {
            sessionID: input.sessionID,
            taskId: subagentTaskId,
            agent: subagentAgent,
            intendedModel,
            actualModel: usedModel,
            didFallback,
            budget: finalBudget,
          })

          // v3.8.1: Show toast notification for subagent deployment
          await ctx.client.tui
            .showToast({
              body: {
                title: "Subagent Deployed",
                message: `${subagentAgent} launched with ${usedModel}${didFallback ? " (fallback)" : ""}`,
                variant: "info",
                duration: 4000,
              },
            })
            .catch(err => log(`[${HOOK_NAME}] Subagent toast failed`, { error: err?.message || String(err) }))

          // Update injected prompt to indicate delegation
          const delegationInfo = SUBAGENT_DELEGATION_TEMPLATE
            .replace("{{COMPLEXITY_TIER}}", String(result.classification.complexityTier))
            .replace("{{SUBAGENT_MODEL}}", usedModel)
            .replace("{{SUBAGENT_AGENT}}", subagentAgent)
            .replace("{{INTENDED_BUDGET}}", finalBudget.toUpperCase())

          let delegationNote = `\n\n## SUBAGENT DELEGATED
A subagent has been spawned to handle this task.
- **Task ID**: \`${subagentTaskId}\`
- **Agent**: ${subagentAgent}
- **Model**: ${usedModel}`

          if (didFallback) {
            delegationNote += `
- **Note**: Original model (${intendedModel}) unavailable, using fallback`
          }

          delegationNote += `
- **Budget Tier**: ${finalBudget.toUpperCase()}

Monitor progress with: \`background_output(task_id="${subagentTaskId}")\`

${delegationInfo}`

          injectedPrompt += delegationNote

        } catch (spawnErr) {
          const errorMessage = spawnErr instanceof Error ? spawnErr.message : String(spawnErr)

          // Check if this is a provider error that exhausted all fallbacks
          const { isUnavailable, isAuthError } = isProviderUnavailableError(spawnErr)

          console.log(`\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!`)
          console.log(`[AUTO-ROUTER] SUBAGENT SPAWN FAILED`)
          console.log(`!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!`)
          console.log(`Error: ${errorMessage.substring(0, 200)}`)
          if (isUnavailable) {
            console.log(`Reason: ${isAuthError ? "Authentication error" : "Rate limit"} - all providers exhausted`)
          }
          console.log(`Falling back to direct execution`)
          console.log(`!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n`)

          log(`[${HOOK_NAME}] Failed to spawn subagent`, {
            sessionID: input.sessionID,
            error: errorMessage,
            isUnavailable,
            isAuthError,
          })

          // Show provider status after failure
          logProviderStatus(rateLimitState)

          // Fall back to direct execution
          injectedPrompt += `\n\n## SUBAGENT SPAWN FAILED
Falling back to direct execution in current session.
Error: ${errorMessage}
${isUnavailable ? `\n**Note**: ${isAuthError ? "Authentication" : "Rate limit"} error - configure provider API keys or wait for cooldown.` : ""}
${NO_DELEGATION_TEMPLATE}`
        }
      } else if (!shouldAutoSpawn) {
        // Not auto-spawning - direct execution
        injectedPrompt += `\n${NO_DELEGATION_TEMPLATE}`
      }

      textPart.text = injectedPrompt

      // v3.5.0: Spawn parallel exploration agents for complex tasks
      // v3.8.0: Provider-aware scaling - up to 8 agents across 4 providers
      const parallelEnabled = config.parallel_agents?.enabled ?? DEFAULT_PARALLEL_AGENT_CONFIG.enabled
      const shouldSpawnParallel = (
        parallelEnabled !== false &&
        options?.backgroundManager &&
        (result.classification.complexityTier >= 2 ||   // Tier 2+ benefits from exploration
         finalTechnique.includes("ulw") ||
         finalTechnique.includes("ralph") ||
         finalTechnique === "triple")
      )

      let parallelAgentsLaunched = 0
      const launchedAgentNames: string[] = []
      const launchedAgentModels: string[] = []

      if (shouldSpawnParallel && options?.backgroundManager) {
        // v3.8.0: Use provider-aware agent selection
        const complexityTier = result.classification.complexityTier as 1 | 2 | 3
        const domainSignals = result.classification.domainSignals || []
        const availableProviders = ["opencode", "google", "github-copilot", "openai"]

        // Select agents based on complexity, domain, and provider limits (2 per provider)
        const selectedAgents = selectAgentsForTask(complexityTier, domainSignals, availableProviders)
        const maxAgentsForTier = getMaxAgentsForTier(complexityTier)
        const agentsToSpawn = selectedAgents.slice(0, maxAgentsForTier)

        // Track provider usage to enforce 2-per-provider limit at launch time
        const providerUsage: Record<string, number> = {}

        // v3.8.0: Console output for parallel agent launch
        console.log(`\n========================================`)
        console.log(`[AUTO-ROUTER] PARALLEL AGENT DEPLOYMENT`)
        console.log(`========================================`)
        console.log(`Complexity: Tier ${complexityTier}`)
        console.log(`Technique: ${finalTechnique}`)
        console.log(`Domain Signals: ${domainSignals.join(", ") || "none"}`)
        console.log(`Max Agents for Tier: ${maxAgentsForTier}`)
        console.log(`Selected Agents: ${agentsToSpawn.length}`)
        console.log(`Provider Limit: ${AGENTS_PER_PROVIDER} per provider`)
        console.log(`----------------------------------------`)

        for (const { agentName, model } of agentsToSpawn) {
          const provider = model.split("/")[0]

          // Double-check provider limit (selectAgentsForTask should handle this, but defensive)
          if ((providerUsage[provider] ?? 0) >= AGENTS_PER_PROVIDER) {
            console.log(`  ⚠ ${agentName.toUpperCase()} skipped: provider ${provider} at limit`)
            continue
          }

          try {
            // v3.8.0: Validate model ID before launching parallel agent
            let validatedModel = model
            const validation = validateModelId(model)
            if (!validation.valid && validation.suggestion) {
              log(`[AUTO-ROUTER] Parallel agent model correction: ${model} → ${validation.suggestion}`)
              validatedModel = validation.suggestion
            }

            const modelConfig = parseModelString(validatedModel)
            const launchResult = await options.backgroundManager.launch({
              description: `${agentName}: ${detected.taskDescription.substring(0, 50)}`,
              prompt: `Explore and analyze for this task: ${detected.taskDescription}`,
              agent: agentName,
              parentSessionID: input.sessionID,
              parentMessageID: input.messageID,
              model: modelConfig,
            })

            parallelAgentsLaunched++
            launchedAgentNames.push(agentName)
            launchedAgentModels.push(model)
            providerUsage[provider] = (providerUsage[provider] ?? 0) + 1

            // v3.8.0: Track spending for parallel agent launches
            recordModelUsage(model)

            console.log(`  ✓ ${agentName.toUpperCase()} (${model}) → ID: ${launchResult.id}`)
            log(`[${HOOK_NAME}] Launched parallel agent`, {
              agent: agentName,
              model,
              provider,
              sessionID: input.sessionID,
              taskId: launchResult.id,
            })
          } catch (agentErr) {
            const errorMsg = agentErr instanceof Error ? agentErr.message : String(agentErr)
            console.log(`  ✗ ${agentName.toUpperCase()} FAILED: ${errorMsg.substring(0, 50)}`)
            log(`[${HOOK_NAME}] Failed to launch parallel agent`, {
              agent: agentName,
              model,
              error: errorMsg,
            })
          }
        }

        console.log(`----------------------------------------`)
        if (parallelAgentsLaunched > 0) {
          // Show provider distribution
          const providerSummary = Object.entries(providerUsage)
            .filter(([, count]) => count > 0)
            .map(([provider, count]) => `${provider}:${count}`)
            .join(", ")
          console.log(`SUCCESS: ${parallelAgentsLaunched}/${maxAgentsForTier} agent(s) deployed`)
          console.log(`Agents: ${launchedAgentNames.join(", ")}`)
          console.log(`Provider Distribution: ${providerSummary}`)
          console.log(`Use background_output to check progress.`)
        } else {
          console.log(`WARNING: No agents deployed successfully`)
        }
        console.log(`========================================\n`)

        if (parallelAgentsLaunched > 0) {
          textPart.text += `\n\n## PARALLEL AGENTS LAUNCHED (${parallelAgentsLaunched}/${maxAgentsForTier})
Background agents exploring in parallel:
${launchedAgentNames.map((name, i) => `- **${name}** (${launchedAgentModels[i]})`).join("\n")}

Use \`background_output\` tool to check their progress before proceeding.`
        }
      }

      // Show toast notification (include magic keyword info and warnings if any)
      const isVerbose = config.verbose === true
      const modelConfig = BUDGET_TIERS[finalBudget]

      if (isVerbose) {
        // Verbose mode: Show detailed classification toast
        const classificationToast = formatClassificationToast(
          result.classification,
          finalTechnique,
          finalBudget,
          modelConfig.models.primary,
          config.quality_threshold ?? 0.7
        )
        const simple = toSimpleToast(classificationToast)
        await ctx.client.tui
          .showToast({
            body: {
              title: simple.title,
              message: simple.message,
              variant: classificationToast.variant,
              duration: classificationToast.duration,
            },
          })
          .catch(err => log(`[${HOOK_NAME}] Toast failed`, { error: err?.message || String(err) }))

        // Show additional details toast
        const detailsToast = formatClassificationDetailsToast(result.classification)
        const detailsSimple = toSimpleToast(detailsToast)
        await ctx.client.tui
          .showToast({
            body: {
              title: detailsSimple.title,
              message: detailsSimple.message,
              variant: detailsToast.variant,
              duration: detailsToast.duration,
            },
          })
          .catch(err => log(`[${HOOK_NAME}] Details toast failed`, { error: err?.message || String(err) }))

        // Show magic keyword toast if applicable
        if (cmdOptions.magicKeyword) {
          const magicToast = formatMagicKeywordToast(cmdOptions.magicKeyword, finalTechnique, finalBudget)
          const magicSimple = toSimpleToast(magicToast)
          await ctx.client.tui
            .showToast({
              body: {
                title: magicSimple.title,
                message: magicSimple.message,
                variant: magicToast.variant,
                duration: magicToast.duration,
              },
            })
            .catch(err => log(`[${HOOK_NAME}] Magic keyword toast failed`, { error: err?.message || String(err) }))
        }

        // Show parallel agents toast if applicable
        if (parallelAgentsLaunched > 0) {
          // v3.8.0: Use actual launched agent names instead of re-computing
          const parallelToast = formatParallelAgentToast(parallelAgentsLaunched, launchedAgentNames)
          const parallelSimple = toSimpleToast(parallelToast)
          await ctx.client.tui
            .showToast({
              body: {
                title: parallelSimple.title,
                message: parallelSimple.message,
                variant: parallelToast.variant,
                duration: parallelToast.duration,
              },
            })
            .catch(err => log(`[${HOOK_NAME}] Parallel agents toast failed`, { error: err?.message || String(err) }))
        }
      } else {
        // Standard mode: Single concise toast
        let toastMessage = `Technique: ${finalTechnique} | Budget: ${finalBudget}`
        if (ralphLoopEnabled) {
          toastMessage += ` | Ralph Loop`
        }
        if (parallelAgentsLaunched > 0) {
          // v3.8.0: Show agent names in standard mode too
          toastMessage += ` | Agents: ${launchedAgentNames.join(", ")}`
        }
        if (cmdOptions.magicKeyword) {
          toastMessage = `[${cmdOptions.magicKeyword}] ${toastMessage}`
        }
        if (cmdOptions.warnings.length > 0) {
          toastMessage += `\n${cmdOptions.warnings[0]}`
        }

        await ctx.client.tui
          .showToast({
            body: {
              title: "Auto-Router Active",
              message: toastMessage,
              variant: cmdOptions.warnings.length > 0 ? "warning" : "info",
              duration: 5000,
            },
          })
          .catch(err => log(`[${HOOK_NAME}] Toast failed`, { error: err?.message || String(err) }))
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      const errorType = err instanceof Error ? err.constructor.name : typeof err
      const errorStack = err instanceof Error ? err.stack?.split('\n').slice(0, 3).join('\n') : undefined

      log(`[${HOOK_NAME}] Classification failed`, {
        sessionID: input.sessionID,
        errorType,
        errorMessage,
        errorStack,
      })

      // Inject error message with better context for debugging
      textPart.text = `${AUTO_ROUTER_TAG_OPEN}
[AUTO-ROUTER ERROR]
Failed to classify task.

**Error Type**: ${errorType}
**Error**: ${errorMessage}
${errorStack ? `**Stack** (truncated):\n\`\`\`\n${errorStack}\n\`\`\`` : ''}

Falling back to direct execution mode.

## YOUR TASK
${detected.taskDescription}
${AUTO_ROUTER_TAG_CLOSE}`
    } finally {
      // Always cleanup stale data, even on failure
      cleanupProcessedCommands()
      cleanupStaleSessions()
    }
  }

  /**
   * Type-safe property extraction from event properties
   */
  function getEventProps(properties: unknown): Record<string, unknown> | undefined {
    if (properties && typeof properties === "object" && !Array.isArray(properties)) {
      return properties as Record<string, unknown>
    }
    return undefined
  }

  /**
   * Safely extract string property from props
   */
  function getStringProp(props: Record<string, unknown> | undefined, key: string): string | undefined {
    const value = props?.[key]
    return typeof value === "string" ? value : undefined
  }

  /**
   * Event handler - tracks session lifecycle for escalation
   */
  const event = async ({
    event,
  }: {
    event: { type: string; properties?: unknown }
  }): Promise<void> => {
    const props = getEventProps(event.properties)

    if (event.type === "session.idle") {
      const sessionID = getStringProp(props, "sessionID")
      if (!sessionID) return

      const sessionState = sessions.get(sessionID)
      if (!sessionState) return

      // Track iteration
      sessionState.iteration++

      log(`[${HOOK_NAME}] Session idle`, {
        sessionID,
        iteration: sessionState.iteration,
      })

      // Check for escalation
      if (config.auto_escalate !== false) {
        const decision = await sessionState.escalationManager.shouldEscalate()

        if (decision.shouldEscalate && decision.toTier) {
          sessionState.escalationManager.escalate(decision.toTier)

          const newBudgetConfig = BUDGET_TIERS[decision.toTier]
          const escalationCount = sessionState.escalationManager.getEscalationCount()
          const maxEscalations = config.max_escalations ?? 3

          log(`[${HOOK_NAME}] Escalating budget`, {
            sessionID,
            fromTier: decision.fromTier,
            toTier: decision.toTier,
            reason: decision.reason,
            escalationCount,
          })

          // v3.6.7: Console output for escalations (always shown)
          console.log(`\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!`)
          console.log(`[AUTO-ROUTER] BUDGET ESCALATION`)
          console.log(`!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!`)
          console.log(`Session: ${sessionID.substring(0, 8)}...`)
          console.log(`Escalation: ${escalationCount}/${maxEscalations}`)
          console.log(`From: ${decision.fromTier?.toUpperCase() ?? 'unknown'}`)
          console.log(`To: ${decision.toTier.toUpperCase()}`)
          console.log(`Reason: ${decision.reason ?? 'consecutive failures'}`)
          console.log(`New Model: ${newBudgetConfig.models.primary}`)
          console.log(`New Max Iterations: ${newBudgetConfig.maxIterations}`)
          console.log(`!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!`)
          console.log(`NOTE: Model recommendation updated in prompt.`)
          console.log(`For subagent tasks, use: agent="${getAgentForBudgetTier(decision.toTier)}"`)
          console.log(`!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n`)

          // Verbose mode: Show detailed escalation toast
          const isVerbose = config.verbose === true
          if (isVerbose && decision.fromTier) {
            const escalationToast = formatEscalationToast(
              decision.fromTier,
              decision.toTier,
              decision.reason ?? "consecutive failures",
              escalationCount,
              maxEscalations,
              newBudgetConfig.models.primary,
              undefined, // quality score not available here
              config.quality_threshold ?? 0.7
            )
            const simple = toSimpleToast(escalationToast)
            await ctx.client.tui
              .showToast({
                body: {
                  title: simple.title,
                  message: simple.message,
                  variant: escalationToast.variant,
                  duration: escalationToast.duration,
                },
              })
              .catch(err => log(`[${HOOK_NAME}] Escalation toast failed`, { error: err?.message || String(err) }))

            // Also show model selection toast in verbose mode
            const modelToast = formatModelSelectionToast(newBudgetConfig.models.primary, decision.toTier)
            const modelSimple = toSimpleToast(modelToast)
            await ctx.client.tui
              .showToast({
                body: {
                  title: modelSimple.title,
                  message: modelSimple.message,
                  variant: modelToast.variant,
                  duration: modelToast.duration,
                },
              })
              .catch(err => log(`[${HOOK_NAME}] Model toast failed`, { error: err?.message || String(err) }))
          } else {
            // Standard mode: Simple escalation toast
            await ctx.client.tui
              .showToast({
                body: {
                  title: `Budget Escalated (${escalationCount}/${maxEscalations})`,
                  message: `${decision.fromTier} → ${decision.toTier}: ${decision.reason}`,
                  variant: "warning",
                  duration: 5000,
                },
              })
              .catch(err => log(`[${HOOK_NAME}] Toast failed`, { error: err?.message || String(err) }))

            // v3.8.1: Also show model notification in standard mode (not just verbose)
            await ctx.client.tui
              .showToast({
                body: {
                  title: "Model Upgraded",
                  message: `Now using: ${newBudgetConfig.models.primary}`,
                  variant: "info",
                  duration: 3000,
                },
              })
              .catch(err => log(`[${HOOK_NAME}] Model toast failed`, { error: err?.message || String(err) }))
          }
        }
      }
    }

    if (event.type === "session.deleted") {
      // Safely extract nested info.id property
      const infoObj = props?.info
      const sessionId = (infoObj && typeof infoObj === "object" && "id" in infoObj)
        ? getStringProp(infoObj as Record<string, unknown>, "id")
        : undefined
      if (sessionId) {
        sessions.delete(sessionId)
        log(`[${HOOK_NAME}] Session cleaned up`, { sessionID: sessionId })

        // v3.8.0: Show spending summary on session end
        const summary = getSpendingSummary()
        if (summary.requestCount > 0) {
          console.log(formatSpendingSummary())
        }
        resetSpendingTracker()
      }
    }

    if (event.type === "session.error") {
      const sessionID = getStringProp(props, "sessionID")
      if (!sessionID) return

      const sessionState = sessions.get(sessionID)
      if (!sessionState) return

      // Record failure for escalation tracking
      sessionState.escalationManager.recordAttempt({
        success: false,
        duration: 0,
        errorMessage: String(props?.error ?? "Unknown error"),
      })

      log(`[${HOOK_NAME}] Session error recorded`, {
        sessionID,
        escalationCount: sessionState.escalationManager.getEscalationCount(),
        history: sessionState.escalationManager.getHistory().length,
      })
    }

    // v3.7.0: Handle subagent completion for analytics tracking
    if (event.type === "background.task.completed") {
      const taskId = getStringProp(props, "taskId") || getStringProp(props, "id")
      if (!taskId) return

      const subagentInfo = subagentExecutions.get(taskId)
      if (!subagentInfo) return // Not a tracked subagent

      const endTime = Date.now()
      const durationMs = endTime - subagentInfo.startTime
      const durationSec = Math.round(durationMs / 1000)

      // Get actual model from the event if available
      // Props might contain model info from the completed task
      const actualModel = getStringProp(props, "model") || subagentInfo.intendedModel
      const modelMatch = actualModel === subagentInfo.intendedModel

      // Update analytics
      updateSubagentExecution(taskId, {
        endTime,
        durationMs,
        actualModel,
        modelMatch,
        success: true,
      })

      // v3.8.0: Check spending milestone after subagent completion
      const milestone = checkSpendingMilestone()
      if (milestone) {
        const summary = getSpendingSummary()
        console.log(`\n💰 SPENDING MILESTONE: $${milestone.amount}`)
        console.log(`   Main contributor: ${milestone.mainContributor}`)
        console.log(`   Total requests: ${summary.requestCount}`)
      }

      // Console output for completion
      console.log(`\n========================================`)
      console.log(`[AUTO-ROUTER] SUBAGENT COMPLETED`)
      console.log(`========================================`)
      console.log(`Task ID: ${taskId}`)
      console.log(`Duration: ${durationSec}s`)
      console.log(`Intended Model: ${subagentInfo.intendedModel}`)
      console.log(`Actual Model: ${actualModel}`)
      console.log(`Model Match: ${modelMatch ? "YES ✓" : "NO ✗"}`)
      if (!modelMatch) {
        console.log(`WARNING: Model mismatch detected!`)
      }
      console.log(`========================================\n`)

      log(`[${HOOK_NAME}] Subagent completed`, {
        taskId,
        durationSec,
        intendedModel: subagentInfo.intendedModel,
        actualModel,
        modelMatch,
      })

      // Clean up local tracking
      subagentExecutions.delete(taskId)
    }

    // v3.7.0: Handle subagent error for analytics tracking and escalation respawn
    if (event.type === "background.task.error") {
      const taskId = getStringProp(props, "taskId") || getStringProp(props, "id")
      if (!taskId) return

      const subagentInfo = subagentExecutions.get(taskId)
      if (!subagentInfo) return // Not a tracked subagent

      const endTime = Date.now()
      const durationMs = endTime - subagentInfo.startTime
      const errorMessage = getStringProp(props, "error") || "Unknown error"

      // Update analytics
      updateSubagentExecution(taskId, {
        endTime,
        durationMs,
        success: false,
        errorMessage,
      })

      // Console output for error
      console.log(`\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!`)
      console.log(`[AUTO-ROUTER] SUBAGENT FAILED`)
      console.log(`!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!`)
      console.log(`Task ID: ${taskId}`)
      console.log(`Intended Model: ${subagentInfo.intendedModel}`)
      console.log(`Budget Tier: ${subagentInfo.budgetTier.toUpperCase()}`)
      console.log(`Error: ${errorMessage}`)
      console.log(`!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!`)

      log(`[${HOOK_NAME}] Subagent failed`, {
        taskId,
        error: errorMessage,
        budget: subagentInfo.budgetTier,
      })

      // Clean up local tracking
      subagentExecutions.delete(taskId)

      // v3.7.0: Attempt escalation respawn if auto_escalate is enabled
      const sessionState = sessions.get(subagentInfo.parentSessionId)
      if (sessionState && config.auto_escalate !== false && options?.backgroundManager) {
        const decision = await sessionState.escalationManager.shouldEscalate()

        if (decision.shouldEscalate && decision.toTier) {
          const fromTier = subagentInfo.budgetTier
          sessionState.escalationManager.escalate(decision.toTier)

          const newBudgetConfig = BUDGET_TIERS[decision.toTier]
          const newModel = newBudgetConfig.models.primary
          const newAgent = getAgentForBudgetTier(decision.toTier)
          const escalationCount = sessionState.escalationManager.getEscalationCount()
          const maxEscalations = config.max_escalations ?? 3

          // Generate new execution ID
          const newExecutionId = `exec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

          // v3.8.1: Get escalated technique for the new tier
          const escalatedTechnique = getTechniqueForBudgetTier(decision.toTier)

          console.log(`\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!`)
          console.log(`[AUTO-ROUTER] ESCALATION RESPAWN`)
          console.log(`!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!`)
          console.log(`Previous Tier: ${fromTier.toUpperCase()}`)
          console.log(`New Tier: ${decision.toTier.toUpperCase()}`)
          console.log(`Technique: ${escalatedTechnique}`)
          console.log(`Escalation: ${escalationCount}/${maxEscalations}`)
          console.log(`New Model: ${newModel}`)
          console.log(`Spawning new subagent...`)
          console.log(`!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!`)

          try {
            // v3.8.1: Generate enhanced prompt with technique instructions
            const enhancedPrompt = generateEscalationPrompt(
              subagentInfo.taskDescription,
              decision.toTier,
              sessionState.technique
            )

            // Spawn new subagent with higher-tier model and technique instructions
            const escalatedModelConfig = parseModelString(newModel)
            const launchResult = await options.backgroundManager.launch({
              description: `[AUTO-ROUTER ESCALATE] ${subagentInfo.taskDescription.substring(0, 40)}`,
              prompt: enhancedPrompt,
              agent: newAgent,
              parentSessionID: subagentInfo.parentSessionId,
              model: escalatedModelConfig,
            })

            const newTaskId = launchResult.id

            // Create new subagent execution info
            const newSubagentInfo: SubagentExecutionInfo = {
              executionId: newExecutionId,
              intendedModel: newModel,
              sessionId: launchResult.sessionID || "",
              agentName: newAgent,
              startTime: Date.now(),
              isEscalation: true,
              escalatedFrom: fromTier,
              budgetTier: decision.toTier,
              complexityTier: subagentInfo.complexityTier,
              parentSessionId: subagentInfo.parentSessionId,
              taskDescription: subagentInfo.taskDescription,
            }

            // Store locally for tracking
            subagentExecutions.set(newTaskId, newSubagentInfo)

            // Record in analytics
            recordSubagentExecution({
              executionId: newExecutionId,
              taskId: newTaskId,
              sessionId: newSubagentInfo.sessionId,
              agentName: newAgent,
              intendedModel: newModel,
              isEscalation: true,
              escalatedFrom: fromTier,
              parentSessionId: subagentInfo.parentSessionId,
              complexityTier: subagentInfo.complexityTier,
              budgetTier: decision.toTier,
            })

            // v3.8.0: Track spending for escalation respawn
            recordModelUsage(newModel)

            console.log(`[AUTO-ROUTER] Escalation respawn successful`)
            console.log(`New Task ID: ${newTaskId}`)
            console.log(`!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n`)

            log(`[${HOOK_NAME}] Escalation respawn successful`, {
              fromTier,
              toTier: decision.toTier,
              oldTaskId: taskId,
              newTaskId,
              newModel,
            })

          } catch (respawnErr) {
            const respawnError = respawnErr instanceof Error ? respawnErr.message : String(respawnErr)
            console.log(`[AUTO-ROUTER] Escalation respawn failed: ${respawnError}`)
            console.log(`!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n`)

            log(`[${HOOK_NAME}] Escalation respawn failed`, {
              fromTier,
              toTier: decision.toTier,
              error: respawnError,
            })
          }
        }
      }
    }
  }

  /**
   * Get session state for external access
   */
  const getSessionState = (sessionId: string): SessionState | undefined => {
    return sessions.get(sessionId)
  }

  /**
   * Check if ralph-loop is enabled for a session
   */
  const isRalphLoopEnabled = (sessionId: string): boolean => {
    const state = sessions.get(sessionId)
    return state?.ralphLoopEnabled ?? false
  }

  /**
   * Chat params handler - INTENDED to switch model based on auto-router budget tier
   *
   * ⚠️ IMPORTANT: This hook is NOT CURRENTLY WIRED UP to the main plugin.
   * OpenCode's plugin API (chat.params) can only modify temperature/topP/topK/options,
   * NOT the model. The `output.message.model` field is read-only.
   *
   * This code is preserved as architectural placeholder for when/if OpenCode adds
   * runtime model switching support. Currently, model selection happens via:
   * 1. Agent variants configured in opencode.json
   * 2. Recommendations injected into the prompt text
   *
   * v3.6.6: Rate limit checking (would work if hook were active)
   * v3.6.7: Verbose logging (would work if hook were active)
   *
   * @see https://github.com/opencode-ai/opencode - Plugin API documentation
   */
  const chatParams = async (
    output: { message: { model?: { providerID: string; modelID: string } } },
    sessionID: string
  ): Promise<void> => {
    const sessionState = sessions.get(sessionID)
    if (!sessionState) {
      // No auto-router session for this chat - don't modify model
      return
    }

    // Get the current budget tier from the escalation manager
    const currentTier = sessionState.escalationManager.getCurrentTierName()

    // Get the model config for this tier
    const modelConfig = getBudgetTierModelConfig(currentTier)

    // v3.6.6: Check rate limits and apply fallback if needed
    const originalProvider = modelConfig.providerID
    const originalModel = modelConfig.modelID
    const originalFullModel = `${originalProvider}/${originalModel}`

    // Check if original provider is blocked
    const isOriginalBlocked = BLOCKED_PROVIDERS.has(originalProvider)

    const { model: finalModel, provider: finalProvider, didFallback } = getModelWithFallback(
      rateLimitState,
      originalFullModel
    )

    // Parse fallback result
    const [fallbackProviderID, ...modelParts] = finalModel.split("/")
    const fallbackModelID = modelParts.join("/")

    // ACTUALLY switch the model!
    output.message.model = {
      providerID: fallbackProviderID,
      modelID: fallbackModelID,
    }

    // v3.6.7: Verbose logging - ALWAYS show which model is being used
    console.log(`\n========================================`)
    console.log(`[AUTO-ROUTER] MODEL SELECTION`)
    console.log(`========================================`)
    console.log(`Session: ${sessionID.substring(0, 8)}...`)
    console.log(`Budget Tier: ${currentTier.toUpperCase()}`)
    console.log(`----------------------------------------`)
    console.log(`Original Request:`)
    console.log(`  Provider: ${originalProvider}`)
    console.log(`  Model: ${originalModel}`)
    if (isOriginalBlocked) {
      console.log(`  Status: BLOCKED (direct Anthropic API disabled)`)
    }
    console.log(`----------------------------------------`)
    console.log(`Final Selection:`)
    console.log(`  Provider: ${fallbackProviderID}`)
    console.log(`  Model: ${fallbackModelID}`)
    console.log(`  Fallback: ${didFallback ? "YES" : "NO"}`)
    if (didFallback) {
      console.log(`  Reason: ${isOriginalBlocked ? "Provider blocked" : "Rate limited"}`)
    }
    console.log(`========================================\n`)

    // Also log to debug log
    if (didFallback) {
      log(`[${HOOK_NAME}] MODEL SWITCH: ${originalFullModel} → ${finalModel}`, {
        sessionID,
        tier: currentTier,
        original: { provider: originalProvider, model: originalModel },
        final: { provider: fallbackProviderID, model: fallbackModelID },
        reason: isOriginalBlocked ? "blocked" : "rate_limited",
      })
    } else {
      log(`[${HOOK_NAME}] MODEL SELECTED: ${finalModel}`, {
        sessionID,
        tier: currentTier,
        provider: fallbackProviderID,
        model: fallbackModelID,
      })
    }
  }

  /**
   * Chat error handler - detects rate limits and triggers circuit breaker
   *
   * ⚠️ IMPORTANT: This hook is NOT CURRENTLY WIRED UP to the main plugin.
   * OpenCode's plugin API does not expose a chat.error hook for plugins to intercept.
   *
   * This code is preserved as architectural placeholder. If OpenCode adds error
   * handling hooks, this would:
   * 1. Detect rate limit errors (429 status)
   * 2. Open circuit breakers for affected providers
   * 3. Persist state to ~/.opencode/rate-limit-state.json
   *
   * v3.6.6: Rate limit detection and circuit breaker pattern
   * v3.6.7: Verbose console logging
   */
  const chatError = async (
    input: { error: unknown; sessionID: string; model?: { providerID: string; modelID: string } }
  ): Promise<void> => {
    const { error, sessionID, model } = input

    // Check if this is a rate limit error
    if (isRateLimitError(error)) {
      const provider = model ? model.providerID : "unknown"
      const modelName = model ? model.modelID : "unknown"
      const cooldownMs = getCooldownMs(provider)
      const cooldownMinutes = Math.ceil(cooldownMs / 60000)

      // v3.6.7: Verbose console output for rate limits
      console.log(`\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!`)
      console.log(`[AUTO-ROUTER] RATE LIMIT DETECTED`)
      console.log(`!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!`)
      console.log(`Provider: ${provider}`)
      console.log(`Model: ${modelName}`)
      console.log(`Cooldown: ${cooldownMinutes} minute(s)`)
      console.log(`Circuit Breaker: OPENING`)
      console.log(`!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!`)

      // Record the rate limit hit (this persists to disk)
      rateLimitState = recordRateLimitHit(rateLimitState, provider)

      // Show updated provider status
      console.log(`\n[AUTO-ROUTER] PROVIDER STATUS AFTER RATE LIMIT:`)
      console.log(`----------------------------------------`)
      for (const p of PROVIDER_FALLBACK_CHAIN) {
        const available = isProviderAvailable(rateLimitState, p)
        const blocked = BLOCKED_PROVIDERS.has(p)
        let status = "AVAILABLE"
        if (blocked) status = "BLOCKED"
        else if (!available) status = "RATE LIMITED"
        console.log(`  ${p}: ${status}`)
      }
      console.log(`  anthropic: BLOCKED (always)`)
      console.log(`----------------------------------------\n`)

      // Log to debug log
      log(`[${HOOK_NAME}] RATE LIMIT: ${provider}/${modelName} - circuit OPEN for ${cooldownMinutes}m`, {
        sessionID,
        provider,
        model: `${provider}/${modelName}`,
        cooldownMs,
        summary: getRateLimitSummary(rateLimitState),
      })
    }
  }

  /**
   * Record successful request (for circuit breaker half-open recovery)
   */
  const recordSuccessfulRequest = (provider: string): void => {
    rateLimitState = recordSuccess(rateLimitState, provider)
  }

  return {
    "chat.message": chatMessage,
    "chat.params": chatParams,
    "chat.error": chatError,
    event,
    getSessionState,
    isRalphLoopEnabled,
    getRateLimitSummary: () => getRateLimitSummary(rateLimitState),
    getSubagentAnalytics: () => formatSubagentAnalytics(),
  }
}
