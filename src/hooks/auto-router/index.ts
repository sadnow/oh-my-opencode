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
} from "../../features/auto-router"
import type { EscalationManager } from "../../features/auto-router"
import type { BudgetTier, TechniqueCombo } from "../../features/auto-router/types"
import type {
  AutoRouterState,
  AutoRouterHookInput,
  AutoRouterHookOutput,
  AutoRouterHookOptions,
  AutoRouterSessionContext,
  TaskIntent,
} from "./types"
import { extractTaskIntent } from "../../features/auto-router/classifier"
import {
  HOOK_NAME,
  AUTO_ROUTER_TAG_OPEN,
  AUTO_ROUTER_TAG_CLOSE,
  AUTO_COMMAND_PATTERN,
  parseAutoCommand,
} from "./constants"
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

export interface AutoRouterHook {
  "chat.message": (
    input: AutoRouterHookInput,
    output: AutoRouterHookOutput
  ) => Promise<void>
  /** Switch model based on auto-router budget tier */
  "chat.params": (
    output: { message: { model?: { providerID: string; modelID: string } } },
    sessionID: string
  ) => Promise<void>
  event: (input: { event: { type: string; properties?: unknown } }) => Promise<void>
  getSessionState: (sessionId: string) => SessionState | undefined
  /** Check if ralph-loop is enabled for a session */
  isRalphLoopEnabled: (sessionId: string) => boolean
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

    // Use the robust parser function (handles multiline, quotes, etc.)
    const taskDescription = parseAutoCommand(text)

    // Validate task description is not empty
    if (!taskDescription) {
      // Only log if it looked like an /auto command
      if (text.trim().toLowerCase().startsWith("/auto")) {
        log(`[${HOOK_NAME}] Empty or invalid task description rejected`)
      }
      return null
    }

    return { taskDescription }
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
      injectedPrompt += `\n\n## MODEL TIER: ${finalBudget.toUpperCase()}
**Recommended Model**: ${budgetConfig.models.primary}
**For subagent tasks**: Use agent="${recommendedAgent}" in sisyphus_task/call_omo_agent
This ensures appropriate model capability for task complexity.
Max iterations at this tier: ${budgetConfig.maxIterations}`

      textPart.text = injectedPrompt

      // v3.5.0: Spawn parallel exploration agents for complex tasks
      const parallelEnabled = config.parallel_agents?.enabled ?? DEFAULT_PARALLEL_AGENT_CONFIG.enabled
      const shouldSpawnParallel = (
        parallelEnabled !== false &&
        options?.backgroundManager &&
        (result.classification.complexityTier === 3 ||
         finalTechnique.includes("ulw") ||
         finalTechnique === "triple")
      )

      let parallelAgentsLaunched = 0
      if (shouldSpawnParallel && options?.backgroundManager) {
        const agentsToSpawn = config.parallel_agents?.agents_for_tier3 ?? [...DEFAULT_PARALLEL_AGENT_CONFIG.agentsForTier3]
        const maxAgents = Math.min(
          config.parallel_agents?.max_concurrent ?? DEFAULT_PARALLEL_AGENT_CONFIG.maxConcurrent,
          agentsToSpawn.length
        )

        for (let i = 0; i < maxAgents; i++) {
          const agentName = agentsToSpawn[i]
          try {
            await options.backgroundManager.launch({
              description: `${agentName}: ${detected.taskDescription.substring(0, 50)}`,
              prompt: `Explore and analyze for this task: ${detected.taskDescription}`,
              agent: agentName,
              parentSessionID: input.sessionID,
              parentMessageID: input.messageID,
            })
            parallelAgentsLaunched++
            log(`[${HOOK_NAME}] Launched parallel agent`, { agent: agentName, sessionID: input.sessionID })
          } catch (agentErr) {
            log(`[${HOOK_NAME}] Failed to launch parallel agent`, {
              agent: agentName,
              error: agentErr instanceof Error ? agentErr.message : String(agentErr),
            })
          }
        }

        if (parallelAgentsLaunched > 0) {
          textPart.text += `\n\n## PARALLEL AGENTS LAUNCHED
${parallelAgentsLaunched} background agent(s) are exploring in parallel.
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
          const agentsToSpawn = config.parallel_agents?.agents_for_tier3 ?? [...DEFAULT_PARALLEL_AGENT_CONFIG.agentsForTier3]
          const launchedAgents = agentsToSpawn.slice(0, parallelAgentsLaunched)
          const parallelToast = formatParallelAgentToast(parallelAgentsLaunched, launchedAgents)
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
          toastMessage += ` | ${parallelAgentsLaunched} agents`
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
   * Chat params handler - switches model based on auto-router budget tier
   * This is the key integration that ACTUALLY changes the model being used
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

    // ACTUALLY switch the model!
    output.message.model = {
      providerID: modelConfig.providerID,
      modelID: modelConfig.modelID,
    }

    log(`[${HOOK_NAME}] Model switched based on budget tier`, {
      sessionID,
      tier: currentTier,
      providerID: modelConfig.providerID,
      modelID: modelConfig.modelID,
    })
  }

  return {
    "chat.message": chatMessage,
    "chat.params": chatParams,
    event,
    getSessionState,
    isRalphLoopEnabled,
  }
}
