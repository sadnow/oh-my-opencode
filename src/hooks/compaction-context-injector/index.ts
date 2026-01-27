import { injectHookMessage } from "../../features/hook-message-injector"
import { log } from "../../shared/logger"
import { createSystemDirective, SystemDirectiveTypes } from "../../shared/system-directive"

export interface SummarizeContext {
  sessionID: string
  providerID: string
  modelID: string
  usageRatio: number
  directory: string
}

/**
 * The compaction context prompt that instructs the summarizer
 * to preserve critical information during context compaction.
 */
export const COMPACTION_CONTEXT_PROMPT = `${createSystemDirective(SystemDirectiveTypes.COMPACTION_CONTEXT)}

When summarizing this session, you MUST include the following sections in your summary:

## 1. User Requests (As-Is)
- List all original user requests exactly as they were stated
- Preserve the user's exact wording and intent

## 2. Final Goal
- What the user ultimately wanted to achieve
- The end result or deliverable expected

## 3. Work Completed
- What has been done so far
- Files created/modified
- Features implemented
- Problems solved

## 4. Remaining Tasks
- What still needs to be done
- Pending items from the original request
- Follow-up tasks identified during the work

## 5. MUST NOT Do (Critical Constraints)
- Things that were explicitly forbidden
- Approaches that failed and should not be retried
- User's explicit restrictions or preferences
- Anti-patterns identified during the session

This context is critical for maintaining continuity after compaction.
`

/**
 * Creates a hook handler for the experimental.session.compacting event.
 * This modifies the compaction output to include our context requirements.
 */
export function createCompactionContextInjectorHook() {
  return async (
    input: { sessionID: string },
    output: { context: string[]; prompt?: string }
  ): Promise<void> => {
    log("[compaction-context-injector] hook fired", { sessionID: input.sessionID })

    // Push our context requirements into the context array
    // OpenCode will include these when generating the summary
    output.context.push(COMPACTION_CONTEXT_PROMPT)

    log("[compaction-context-injector] context added to compaction", {
      sessionID: input.sessionID,
      contextCount: output.context.length,
    })
  }
}

/**
 * @deprecated Use createCompactionContextInjectorHook() instead.
 * This legacy function uses message injection instead of the proper hook API.
 */
export function createCompactionContextInjector() {
  return async (ctx: SummarizeContext): Promise<void> => {
    log("[compaction-context-injector] injecting context (legacy)", { sessionID: ctx.sessionID })

    const success = injectHookMessage(ctx.sessionID, COMPACTION_CONTEXT_PROMPT, {
      agent: "general",
      model: { providerID: ctx.providerID, modelID: ctx.modelID },
      path: { cwd: ctx.directory },
    })

    if (success) {
      log("[compaction-context-injector] context injected", { sessionID: ctx.sessionID })
    } else {
      log("[compaction-context-injector] injection failed", { sessionID: ctx.sessionID })
    }
  }
}
