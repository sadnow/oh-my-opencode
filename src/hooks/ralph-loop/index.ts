import type { PluginInput } from "@opencode-ai/plugin"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { exec } from "node:child_process"
import { promisify } from "node:util"
import { log } from "../../shared/logger"
import { readState, writeState, clearState, incrementIteration } from "./storage"
import {
  HOOK_NAME,
  DEFAULT_MAX_ITERATIONS,
  DEFAULT_COMPLETION_PROMISE,
} from "./constants"
import type { RalphLoopState, RalphLoopOptions } from "./types"
import { getTranscriptPath as getDefaultTranscriptPath } from "../claude-code-hooks/transcript"
import { verifyCompletionCriteria, judgePassed } from "./completion-judge"
import { findNearestMessageWithFields, MESSAGE_STORAGE } from "../../features/hook-message-injector"

const execAsync = promisify(exec)

function getMessageDir(sessionID: string): string | null {
  if (!existsSync(MESSAGE_STORAGE)) return null
  const directPath = join(MESSAGE_STORAGE, sessionID)
  if (existsSync(directPath)) return directPath
  for (const dir of readdirSync(MESSAGE_STORAGE)) {
    const sessionPath = join(MESSAGE_STORAGE, dir, sessionID)
    if (existsSync(sessionPath)) return sessionPath
  }
  return null
}

export * from "./types"
export * from "./constants"
export { readState, writeState, clearState, incrementIteration } from "./storage"

interface SessionState {
  isRecovering?: boolean
}

interface OpenCodeSessionMessage {
  info?: {
    role?: string
  }
  parts?: Array<{
    type: string
    text?: string
    [key: string]: unknown
  }>
}

const CONTINUATION_PROMPT = `[RALPH LOOP - ITERATION {{ITERATION}}/{{MAX}}]

Your previous attempt did not output the completion promise. Continue working on the task.

IMPORTANT:
- Review your progress so far
- Continue from where you left off
- When FULLY complete, output: <promise>{{PROMISE}}</promise>
- Do not stop until the task is truly done

Original task:
{{PROMPT}}`

const VERIFICATION_FAILED_PROMPT = `[RALPH LOOP - VERIFICATION FAILED]

You claimed completion with <promise>DONE</promise>, but verification checks FAILED:

{{ERRORS}}

You are NOT done. Fix these issues and try again.
When actually complete, output: <promise>{{PROMISE}}</promise>

This is iteration {{ITERATION}}/{{MAX}}.

Original task:
{{PROMPT}}`

const JUDGE_FAILED_PROMPT = `[RALPH LOOP - COMPLETION JUDGE REJECTED]

A verification judge analyzed your completion claim and found it INCOMPLETE.

## Unmet Requirements:
{{UNMET}}

## Contradictions Found:
{{CONTRADICTIONS}}

## Judge's Reasoning:
{{REASONING}}

---

You are NOT done. Address ALL unmet requirements and remove any contradictory language.
Do not claim completion until ALL original requirements are fulfilled.

When ACTUALLY complete, output: <promise>{{PROMISE}}</promise>

This is iteration {{ITERATION}}/{{MAX}}.

Original task:
{{PROMPT}}`

interface VerificationResult {
  passed: boolean
  errors: string[]
}

async function runVerificationChecks(directory: string): Promise<VerificationResult> {
  const errors: string[] = []

  // Check 1: TypeScript compilation (if tsconfig exists)
  const hasTsConfig = existsSync(`${directory}/tsconfig.json`)
  if (hasTsConfig) {
    try {
      await execAsync("npx tsc --noEmit", { cwd: directory, timeout: 60000 })
    } catch (err: unknown) {
      const error = err as { stdout?: string; stderr?: string }
      const output = error.stdout || error.stderr || "TypeScript compilation failed"
      const errorCount = (output.match(/error TS/g) || []).length
      errors.push(`TypeScript: ${errorCount} error(s)\n${output.slice(0, 500)}`)
    }
  }

  // Check 2: Build command (try common ones)
  const hasPackageJson = existsSync(`${directory}/package.json`)
  if (hasPackageJson) {
    let buildPassed = false
    const buildCommands = ["npm run build", "bun run build"]

    for (const cmd of buildCommands) {
      try {
        await execAsync(cmd, { cwd: directory, timeout: 120000 })
        buildPassed = true
        break
      } catch {
        // Try next
      }
    }

    if (!buildPassed) {
      // Only error if there's a build script
      try {
        const pkgJson = JSON.parse(readFileSync(`${directory}/package.json`, "utf-8"))
        if (pkgJson.scripts?.build) {
          errors.push("Build: Failed to run build command")
        }
      } catch {
        // Ignore package.json read errors
      }
    }
  }

  // Check 3: Look for obvious runtime errors (index.html/js must exist for web projects)
  const hasIndexHtml = existsSync(`${directory}/index.html`) || existsSync(`${directory}/public/index.html`)
  const hasSrcIndex = existsSync(`${directory}/src/index.ts`) ||
                      existsSync(`${directory}/src/index.js`) ||
                      existsSync(`${directory}/src/main.ts`) ||
                      existsSync(`${directory}/src/main.js`)

  if (!hasIndexHtml && !hasSrcIndex && hasPackageJson) {
    // Web project without entry point
    try {
      const pkgJson = JSON.parse(readFileSync(`${directory}/package.json`, "utf-8"))
      if (pkgJson.scripts?.dev || pkgJson.scripts?.start) {
        // It's meant to be runnable but has no entry
        errors.push("Entry Point: No index.html or src/index.ts found")
      }
    } catch {
      // Ignore
    }
  }

  return {
    passed: errors.length === 0,
    errors,
  }
}

export interface RalphLoopHook {
  event: (input: { event: { type: string; properties?: unknown } }) => Promise<void>
  startLoop: (
    sessionID: string,
    prompt: string,
    options?: { maxIterations?: number; completionPromise?: string }
  ) => boolean
  cancelLoop: (sessionID: string) => boolean
  getState: () => RalphLoopState | null
}

const DEFAULT_API_TIMEOUT = 10000  // v3.8.1: Increased from 3s to 10s for more reliable judge evaluation

export function createRalphLoopHook(
  ctx: PluginInput,
  options?: RalphLoopOptions
): RalphLoopHook {
  const sessions = new Map<string, SessionState>()
  const config = options?.config
  const stateDir = config?.state_dir
  const getTranscriptPath = options?.getTranscriptPath ?? getDefaultTranscriptPath
  const apiTimeout = options?.apiTimeout ?? DEFAULT_API_TIMEOUT
  const checkSessionExists = options?.checkSessionExists
  const llmInvoker = options?.llmInvoker
  const completionJudgeConfig = options?.completionJudgeConfig

  /**
   * Get the last assistant message from a session for judge evaluation
   */
  async function getLastAssistantMessage(sessionID: string): Promise<string> {
    try {
      const response = await Promise.race([
        ctx.client.session.messages({
          path: { id: sessionID },
          query: { directory: ctx.directory },
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("API timeout")), apiTimeout)
        ),
      ])

      const messages = (response as { data?: unknown[] }).data ?? []
      if (!Array.isArray(messages)) return ""

      const assistantMessages = (messages as OpenCodeSessionMessage[]).filter(
        (msg) => msg.info?.role === "assistant"
      )
      const lastAssistant = assistantMessages[assistantMessages.length - 1]
      if (!lastAssistant?.parts) return ""

      // Extract all text content from the last assistant message
      return lastAssistant.parts
        .filter((p) => p.type === "text")
        .map((p) => p.text ?? "")
        .join("\n")
    } catch (err) {
      log(`[${HOOK_NAME}] Failed to get last assistant message`, { sessionID, error: String(err) })
      return ""
    }
  }

  function getSessionState(sessionID: string): SessionState {
    let state = sessions.get(sessionID)
    if (!state) {
      state = {}
      sessions.set(sessionID, state)
    }
    return state
  }

  function detectCompletionPromise(
    transcriptPath: string | undefined,
    promise: string
  ): boolean {
    if (!transcriptPath) return false

    try {
      if (!existsSync(transcriptPath)) return false

      const content = readFileSync(transcriptPath, "utf-8")
      const pattern = new RegExp(`<promise>\\s*${escapeRegex(promise)}\\s*</promise>`, "is")
      return pattern.test(content)
    } catch {
      return false
    }
  }

  function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  }

  async function detectCompletionInSessionMessages(
    sessionID: string,
    promise: string
  ): Promise<boolean> {
    try {
      const response = await Promise.race([
        ctx.client.session.messages({
          path: { id: sessionID },
          query: { directory: ctx.directory },
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("API timeout")), apiTimeout)
        ),
      ])

      const messages = (response as { data?: unknown[] }).data ?? []
      if (!Array.isArray(messages)) return false

      const assistantMessages = (messages as OpenCodeSessionMessage[]).filter(
        (msg) => msg.info?.role === "assistant"
      )
      const lastAssistant = assistantMessages[assistantMessages.length - 1]
      if (!lastAssistant?.parts) return false

      const pattern = new RegExp(`<promise>\\s*${escapeRegex(promise)}\\s*</promise>`, "is")
      const responseText = lastAssistant.parts
        .filter((p) => p.type === "text")
        .map((p) => p.text ?? "")
        .join("\n")

      return pattern.test(responseText)
    } catch (err) {
      log(`[${HOOK_NAME}] Session messages check failed`, { sessionID, error: String(err) })
      return false
    }
  }

  const startLoop = (
    sessionID: string,
    prompt: string,
    loopOptions?: { maxIterations?: number; completionPromise?: string }
  ): boolean => {
    const state: RalphLoopState = {
      active: true,
      iteration: 1,
      max_iterations:
        loopOptions?.maxIterations ?? config?.default_max_iterations ?? DEFAULT_MAX_ITERATIONS,
      completion_promise: loopOptions?.completionPromise ?? DEFAULT_COMPLETION_PROMISE,
      started_at: new Date().toISOString(),
      prompt,
      session_id: sessionID,
    }

    const success = writeState(ctx.directory, state, stateDir)
    if (success) {
      log(`[${HOOK_NAME}] Loop started`, {
        sessionID,
        maxIterations: state.max_iterations,
        completionPromise: state.completion_promise,
      })
    }
    return success
  }

  const cancelLoop = (sessionID: string): boolean => {
    const state = readState(ctx.directory, stateDir)
    if (!state || state.session_id !== sessionID) {
      return false
    }

    const success = clearState(ctx.directory, stateDir)
    if (success) {
      log(`[${HOOK_NAME}] Loop cancelled`, { sessionID, iteration: state.iteration })
    }
    return success
  }

  const getState = (): RalphLoopState | null => {
    return readState(ctx.directory, stateDir)
  }

  const event = async ({
    event,
  }: {
    event: { type: string; properties?: unknown }
  }): Promise<void> => {
    const props = event.properties as Record<string, unknown> | undefined

    if (event.type === "session.idle") {
      const sessionID = props?.sessionID as string | undefined
      if (!sessionID) return

      const sessionState = getSessionState(sessionID)
      if (sessionState.isRecovering) {
        log(`[${HOOK_NAME}] Skipped: in recovery`, { sessionID })
        console.log(`[RALPH-LOOP] Idle event skipped - session in recovery (${sessionID.substring(0, 8)}...)`)
        return
      }

      const state = readState(ctx.directory, stateDir)
      if (!state || !state.active) {
        return
      }

      // v3.8.0: Verbose console logging for debugging premature termination
      console.log(`\n========================================`)
      console.log(`[RALPH-LOOP] IDLE EVENT RECEIVED`)
      console.log(`========================================`)
      console.log(`Session: ${sessionID.substring(0, 8)}...`)
      console.log(`Iteration: ${state.iteration}/${state.max_iterations}`)
      console.log(`Promise: ${state.completion_promise}`)
      console.log(`Started: ${state.started_at}`)
      console.log(`----------------------------------------`)

      if (state.session_id && state.session_id !== sessionID) {
        if (checkSessionExists) {
          try {
            const originalSessionExists = await checkSessionExists(state.session_id)
            if (!originalSessionExists) {
              clearState(ctx.directory, stateDir)
              log(`[${HOOK_NAME}] Cleared orphaned state from deleted session`, {
                orphanedSessionId: state.session_id,
                currentSessionId: sessionID,
              })
              return
            }
          } catch (err) {
            log(`[${HOOK_NAME}] Failed to check session existence`, {
              sessionId: state.session_id,
              error: String(err),
            })
          }
        }
        return
      }

      const transcriptPath = getTranscriptPath(sessionID)
      const completionDetectedViaTranscript = detectCompletionPromise(transcriptPath, state.completion_promise)

      const completionDetectedViaApi = completionDetectedViaTranscript
        ? false
        : await detectCompletionInSessionMessages(sessionID, state.completion_promise)

      // v3.8.0: Log completion detection results
      console.log(`[RALPH-LOOP] Completion Detection:`)
      console.log(`  Via transcript: ${completionDetectedViaTranscript ? "YES" : "no"}`)
      console.log(`  Via API: ${completionDetectedViaApi ? "YES" : "no"}`)

      if (completionDetectedViaTranscript || completionDetectedViaApi) {
        console.log(`[RALPH-LOOP] COMPLETION PROMISE DETECTED! Running verification...`)
        log(`[${HOOK_NAME}] Completion promise detected, running verification...`, {
          sessionID,
          iteration: state.iteration,
          promise: state.completion_promise,
          detectedVia: completionDetectedViaTranscript ? "transcript_file" : "session_messages_api",
        })

        // MANDATORY VERIFICATION: Don't trust "DONE" - verify it actually works!
        const verification = await runVerificationChecks(ctx.directory)

        if (!verification.passed) {
          log(`[${HOOK_NAME}] Verification FAILED - rejecting completion claim`, {
            sessionID,
            iteration: state.iteration,
            errors: verification.errors,
          })

          // Check if we've hit max iterations
          if (state.iteration >= state.max_iterations) {
            log(`[${HOOK_NAME}] Max iterations reached with verification failures`, {
              sessionID,
              errors: verification.errors,
            })
            clearState(ctx.directory, stateDir)

            await ctx.client.tui
              .showToast({
                body: {
                  title: "Ralph Loop Stopped (Verification Failed)",
                  message: `Max iterations reached. Errors: ${verification.errors.join("; ").slice(0, 100)}`,
                  variant: "error",
                  duration: 10000,
                },
              })
              .catch(err => log("[ralph-loop] Toast failed", { error: err?.message || String(err) }))

            return
          }

          // Increment iteration and continue with verification failure prompt
          const newState = incrementIteration(ctx.directory, stateDir)
          if (!newState) {
            log(`[${HOOK_NAME}] Failed to increment iteration after verification failure`, { sessionID })
            return
          }

          const errorList = verification.errors.map(e => `- ${e}`).join("\n")
          const verificationFailedPrompt = VERIFICATION_FAILED_PROMPT
            .replace("{{ERRORS}}", errorList)
            .replace("{{ITERATION}}", String(newState.iteration))
            .replace("{{MAX}}", String(newState.max_iterations))
            .replace("{{PROMISE}}", newState.completion_promise)
            .replace("{{PROMPT}}", newState.prompt)

          await ctx.client.tui
            .showToast({
              body: {
                title: "Ralph Loop - Verification Failed!",
                message: `Claimed done but checks failed. Iteration ${newState.iteration}/${newState.max_iterations}`,
                variant: "error",
                duration: 5000,
              },
            })
            .catch(err => log("[ralph-loop] Toast failed", { error: err?.message || String(err) }))

          try {
            await ctx.client.session.prompt({
              path: { id: sessionID },
              body: {
                parts: [{ type: "text", text: verificationFailedPrompt }],
              },
              query: { directory: ctx.directory },
            })
          } catch (err) {
            log(`[${HOOK_NAME}] Failed to inject verification failure prompt`, {
              sessionID,
              error: String(err),
            })
          }

          return
        }

        // Verification PASSED - now run completion criteria judge
        log(`[${HOOK_NAME}] Verification PASSED - running completion judge...`, {
          sessionID,
          iteration: state.iteration,
          promise: state.completion_promise,
        })

        // Run completion criteria judge if LLM invoker is available
        if (llmInvoker) {
          const lastMessage = await getLastAssistantMessage(sessionID)

          if (lastMessage) {
            const judgeResult = await verifyCompletionCriteria(
              state.prompt,
              lastMessage,
              llmInvoker,
              completionJudgeConfig
            )

            const minConfidence = completionJudgeConfig?.min_confidence ?? 0.8
            if (!judgePassed(judgeResult, minConfidence)) {
              // Judge REJECTED completion - continue loop
              log(`[${HOOK_NAME}] Completion judge REJECTED - continuing loop`, {
                sessionID,
                iteration: state.iteration,
                isComplete: judgeResult.isComplete,
                confidence: judgeResult.confidence,
                unmetCriteria: judgeResult.unmetCriteria,
                contradictions: judgeResult.contradictions,
              })

              // Check max iterations
              if (state.iteration >= state.max_iterations) {
                log(`[${HOOK_NAME}] Max iterations reached with judge rejection`, {
                  sessionID,
                  judgeResult,
                })
                clearState(ctx.directory, stateDir)

                await ctx.client.tui
                  .showToast({
                    body: {
                      title: "Ralph Loop Stopped (Judge Rejected)",
                      message: `Max iterations. Unmet: ${judgeResult.unmetCriteria.slice(0, 2).join(", ")}`,
                      variant: "error",
                      duration: 10000,
                    },
                  })
                  .catch(err => log("[ralph-loop] Toast failed", { error: err?.message || String(err) }))

                return
              }

              // Increment iteration and continue with judge feedback
              const newState = incrementIteration(ctx.directory, stateDir)
              if (!newState) {
                log(`[${HOOK_NAME}] Failed to increment iteration after judge rejection`, { sessionID })
                return
              }

              const unmetList = judgeResult.unmetCriteria.length > 0
                ? judgeResult.unmetCriteria.map(c => `- ${c}`).join("\n")
                : "- (none explicitly identified)"
              const contradictionList = judgeResult.contradictions.length > 0
                ? judgeResult.contradictions.map(c => `- "${c}"`).join("\n")
                : "- (none found)"

              const judgeFailedPrompt = JUDGE_FAILED_PROMPT
                .replace("{{UNMET}}", unmetList)
                .replace("{{CONTRADICTIONS}}", contradictionList)
                .replace("{{REASONING}}", judgeResult.reasoning)
                .replace("{{ITERATION}}", String(newState.iteration))
                .replace("{{MAX}}", String(newState.max_iterations))
                .replace("{{PROMISE}}", newState.completion_promise)
                .replace("{{PROMPT}}", newState.prompt)

              await ctx.client.tui
                .showToast({
                  body: {
                    title: "Ralph Loop - Judge Rejected!",
                    message: `Requirements not met. Iteration ${newState.iteration}/${newState.max_iterations}`,
                    variant: "warning",
                    duration: 5000,
                  },
                })
                .catch(err => log("[ralph-loop] Toast failed", { error: err?.message || String(err) }))

              try {
                await ctx.client.session.prompt({
                  path: { id: sessionID },
                  body: {
                    parts: [{ type: "text", text: judgeFailedPrompt }],
                  },
                  query: { directory: ctx.directory },
                })
              } catch (err) {
                log(`[${HOOK_NAME}] Failed to inject judge failure prompt`, {
                  sessionID,
                  error: String(err),
                })
              }

              return
            }

            // Judge APPROVED - now we can truly complete!
            log(`[${HOOK_NAME}] Completion judge APPROVED`, {
              sessionID,
              confidence: judgeResult.confidence,
              reasoning: judgeResult.reasoning,
            })
          }
        }

        // All checks passed - task truly complete!
        console.log(`\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!`)
        console.log(`[RALPH-LOOP] TASK COMPLETE!`)
        console.log(`!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!`)
        console.log(`Termination Reason: All checks passed`)
        console.log(`Iterations used: ${state.iteration}/${state.max_iterations}`)
        console.log(`Duration: ${Date.now() - new Date(state.started_at).getTime()}ms`)
        console.log(`!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!`)
        log(`[${HOOK_NAME}] Task truly complete!`, {
          sessionID,
          iteration: state.iteration,
          promise: state.completion_promise,
        })
        clearState(ctx.directory, stateDir)

        await ctx.client.tui
          .showToast({
            body: {
              title: "Ralph Loop Complete! ✅",
              message: `Task verified and completed after ${state.iteration} iteration(s)`,
              variant: "success",
              duration: 5000,
            },
          })
          .catch(err => log("[ralph-loop] Toast failed", { error: err?.message || String(err) }))

        return
      }

      if (state.iteration >= state.max_iterations) {
        console.log(`\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!`)
        console.log(`[RALPH-LOOP] LOOP STOPPED - MAX ITERATIONS`)
        console.log(`!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!`)
        console.log(`Termination Reason: Max iterations reached without completion promise`)
        console.log(`Iterations: ${state.iteration}/${state.max_iterations}`)
        console.log(`Duration: ${Date.now() - new Date(state.started_at).getTime()}ms`)
        console.log(`!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!`)
        log(`[${HOOK_NAME}] Max iterations reached`, {
          sessionID,
          iteration: state.iteration,
          max: state.max_iterations,
        })
        clearState(ctx.directory, stateDir)

        await ctx.client.tui
          .showToast({
            body: {
              title: "Ralph Loop Stopped",
              message: `Max iterations (${state.max_iterations}) reached without completion`,
              variant: "warning",
              duration: 5000,
            },
          })
          .catch(err => log("[ralph-loop] Toast failed", { error: err?.message || String(err) }))

        return
      }

      const newState = incrementIteration(ctx.directory, stateDir)
      if (!newState) {
        console.log(`[RALPH-LOOP] ERROR: Failed to increment iteration state`)
        log(`[${HOOK_NAME}] Failed to increment iteration`, { sessionID })
        return
      }

      console.log(`[RALPH-LOOP] CONTINUING - No completion promise detected`)
      console.log(`  Next iteration: ${newState.iteration}/${newState.max_iterations}`)
      console.log(`  Injecting continuation prompt...`)
      console.log(`========================================\n`)
      log(`[${HOOK_NAME}] Continuing loop`, {
        sessionID,
        iteration: newState.iteration,
        max: newState.max_iterations,
      })

      const continuationPrompt = CONTINUATION_PROMPT.replace("{{ITERATION}}", String(newState.iteration))
        .replace("{{MAX}}", String(newState.max_iterations))
        .replace("{{PROMISE}}", newState.completion_promise)
        .replace("{{PROMPT}}", newState.prompt)

      await ctx.client.tui
        .showToast({
          body: {
            title: "Ralph Loop",
            message: `Iteration ${newState.iteration}/${newState.max_iterations}`,
            variant: "info",
            duration: 2000,
          },
        })
        .catch(err => log("[ralph-loop] Toast failed", { error: err?.message || String(err) }))

      try {
        let agent: string | undefined
        let model: { providerID: string; modelID: string } | undefined

        try {
          const messagesResp = await ctx.client.session.messages({ path: { id: sessionID } })
          const messages = (messagesResp.data ?? []) as Array<{
            info?: { agent?: string; model?: { providerID: string; modelID: string } }
          }>
          for (let i = messages.length - 1; i >= 0; i--) {
            const info = messages[i].info
            if (info?.agent || info?.model) {
              agent = info.agent
              model = info.model
              break
            }
          }
        } catch {
          const messageDir = getMessageDir(sessionID)
          const currentMessage = messageDir ? findNearestMessageWithFields(messageDir) : null
          agent = currentMessage?.agent
          model = currentMessage?.model?.providerID && currentMessage?.model?.modelID
            ? { providerID: currentMessage.model.providerID, modelID: currentMessage.model.modelID }
            : undefined
        }

        await ctx.client.session.prompt({
          path: { id: sessionID },
          body: {
            ...(agent !== undefined ? { agent } : {}),
            ...(model !== undefined ? { model } : {}),
            parts: [{ type: "text", text: continuationPrompt }],
          },
          query: { directory: ctx.directory },
        })
      } catch (err) {
        log(`[${HOOK_NAME}] Failed to inject continuation`, {
          sessionID,
          error: String(err),
        })
      }
    }

    if (event.type === "session.deleted") {
      const sessionInfo = props?.info as { id?: string } | undefined
      if (sessionInfo?.id) {
        const state = readState(ctx.directory, stateDir)
        if (state?.session_id === sessionInfo.id) {
          clearState(ctx.directory, stateDir)
          log(`[${HOOK_NAME}] Session deleted, loop cleared`, { sessionID: sessionInfo.id })
        }
        sessions.delete(sessionInfo.id)
      }
    }

    if (event.type === "session.error") {
      const sessionID = props?.sessionID as string | undefined
      const error = props?.error as { name?: string } | undefined

      if (error?.name === "MessageAbortedError") {
        if (sessionID) {
          const state = readState(ctx.directory, stateDir)
          if (state?.session_id === sessionID) {
            clearState(ctx.directory, stateDir)
            log(`[${HOOK_NAME}] User aborted, loop cleared`, { sessionID })
          }
          sessions.delete(sessionID)
        }
        return
      }

      if (sessionID) {
        const sessionState = getSessionState(sessionID)
        sessionState.isRecovering = true
        setTimeout(() => {
          sessionState.isRecovering = false
        }, 5000)
      }
    }
  }

  return {
    event,
    startLoop,
    cancelLoop,
    getState,
  }
}
