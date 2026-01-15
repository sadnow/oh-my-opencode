/**
 * Production-Ready Checklist Verification
 *
 * Verifies that a task has met all production-ready criteria before marking complete.
 * These checks ensure code quality and prevent premature completion.
 */

import type { AutoRouterConfig } from "./types"

// ============================================================================
// Types
// ============================================================================

export interface ProductionReadyChecks {
  /** Require tests to exist and pass */
  requireTests: boolean
  /** Require no LSP errors/warnings */
  requireCleanDiagnostics: boolean
  /** Require build to succeed */
  requireBuildPass: boolean
  /** Require LLM judge approval */
  requireJudgePass: boolean
}

export interface CheckResult {
  /** Name of the check */
  name: string
  /** Whether the check passed */
  passed: boolean
  /** Human-readable status message */
  message: string
  /** Whether this check was skipped (not configured) */
  skipped: boolean
  /** Error details if check failed */
  error?: string
}

export interface ChecklistResult {
  /** All checks passed */
  allPassed: boolean
  /** Individual check results */
  checks: CheckResult[]
  /** Summary message */
  summary: string
  /** Number of checks that passed */
  passedCount: number
  /** Number of checks that failed */
  failedCount: number
  /** Number of checks that were skipped */
  skippedCount: number
}

export interface CheckContext {
  /** Working directory for running commands */
  directory: string
  /** Function to run shell commands */
  runCommand?: (cmd: string) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  /** Function to get LSP diagnostics */
  getDiagnostics?: () => Promise<{ errors: number; warnings: number }>
  /** LLM judge score (if available) */
  judgeScore?: number
  /** Quality threshold for judge */
  qualityThreshold?: number
}

// ============================================================================
// Default Checks Configuration
// ============================================================================

export const DEFAULT_PRODUCTION_CHECKS: ProductionReadyChecks = {
  requireTests: false,
  requireCleanDiagnostics: true,
  requireBuildPass: true,
  requireJudgePass: false,
}

// ============================================================================
// Check Functions
// ============================================================================

/**
 * Check if build passes
 */
async function checkBuild(ctx: CheckContext): Promise<CheckResult> {
  if (!ctx.runCommand) {
    return {
      name: "Build",
      passed: true,
      message: "Build check skipped (no command runner)",
      skipped: true,
    }
  }

  try {
    // Try common build commands
    const buildCommands = [
      "npm run build",
      "bun run build",
      "yarn build",
      "pnpm build",
    ]

    for (const cmd of buildCommands) {
      try {
        const result = await ctx.runCommand(cmd)
        if (result.exitCode === 0) {
          return {
            name: "Build",
            passed: true,
            message: `Build succeeded (${cmd})`,
            skipped: false,
          }
        }
      } catch {
        // Try next command
      }
    }

    // All commands failed
    return {
      name: "Build",
      passed: false,
      message: "Build failed",
      skipped: false,
      error: "No build command succeeded",
    }
  } catch (err) {
    return {
      name: "Build",
      passed: false,
      message: "Build check error",
      skipped: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * Check if LSP diagnostics are clean
 */
async function checkDiagnostics(ctx: CheckContext): Promise<CheckResult> {
  if (!ctx.getDiagnostics) {
    // Fallback: try running tsc --noEmit
    if (ctx.runCommand) {
      try {
        const result = await ctx.runCommand("npx tsc --noEmit 2>&1")
        if (result.exitCode === 0) {
          return {
            name: "Diagnostics",
            passed: true,
            message: "No TypeScript errors",
            skipped: false,
          }
        } else {
          // Count errors from output
          const errorCount = (result.stdout.match(/error TS/g) || []).length
          return {
            name: "Diagnostics",
            passed: false,
            message: `${errorCount} TypeScript error(s) found`,
            skipped: false,
            error: result.stdout.slice(0, 500),
          }
        }
      } catch {
        // TypeScript not available
      }
    }

    return {
      name: "Diagnostics",
      passed: true,
      message: "Diagnostics check skipped (no provider)",
      skipped: true,
    }
  }

  try {
    const diagnostics = await ctx.getDiagnostics()
    if (diagnostics.errors === 0) {
      return {
        name: "Diagnostics",
        passed: true,
        message: `Clean (${diagnostics.warnings} warnings)`,
        skipped: false,
      }
    } else {
      return {
        name: "Diagnostics",
        passed: false,
        message: `${diagnostics.errors} error(s), ${diagnostics.warnings} warning(s)`,
        skipped: false,
      }
    }
  } catch (err) {
    return {
      name: "Diagnostics",
      passed: false,
      message: "Diagnostics check error",
      skipped: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * Check if tests pass
 */
async function checkTests(ctx: CheckContext): Promise<CheckResult> {
  if (!ctx.runCommand) {
    return {
      name: "Tests",
      passed: true,
      message: "Tests check skipped (no command runner)",
      skipped: true,
    }
  }

  try {
    // Try common test commands
    const testCommands = [
      "npm test",
      "bun test",
      "yarn test",
      "pnpm test",
      "npx vitest run",
      "npx jest",
    ]

    for (const cmd of testCommands) {
      try {
        const result = await ctx.runCommand(cmd)
        if (result.exitCode === 0) {
          return {
            name: "Tests",
            passed: true,
            message: `Tests passed (${cmd})`,
            skipped: false,
          }
        }
      } catch {
        // Try next command
      }
    }

    // All commands failed or no test script found
    return {
      name: "Tests",
      passed: false,
      message: "Tests failed or not found",
      skipped: false,
      error: "No test command succeeded",
    }
  } catch (err) {
    return {
      name: "Tests",
      passed: false,
      message: "Tests check error",
      skipped: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * Check if LLM judge passes
 */
function checkJudge(ctx: CheckContext): CheckResult {
  if (ctx.judgeScore === undefined) {
    return {
      name: "Judge",
      passed: true,
      message: "Judge check skipped (no score provided)",
      skipped: true,
    }
  }

  const threshold = ctx.qualityThreshold ?? 0.7
  const passed = ctx.judgeScore >= threshold

  return {
    name: "Judge",
    passed,
    message: passed
      ? `Quality score ${(ctx.judgeScore * 100).toFixed(0)}% >= ${(threshold * 100).toFixed(0)}%`
      : `Quality score ${(ctx.judgeScore * 100).toFixed(0)}% < ${(threshold * 100).toFixed(0)}%`,
    skipped: false,
  }
}

// ============================================================================
// Main Verification Function
// ============================================================================

/**
 * Run production-ready checklist verification
 */
export async function verifyProductionReady(
  config: ProductionReadyChecks,
  ctx: CheckContext
): Promise<ChecklistResult> {
  const checks: CheckResult[] = []

  // Run build check if required
  if (config.requireBuildPass) {
    checks.push(await checkBuild(ctx))
  } else {
    checks.push({
      name: "Build",
      passed: true,
      message: "Build check not required",
      skipped: true,
    })
  }

  // Run diagnostics check if required
  if (config.requireCleanDiagnostics) {
    checks.push(await checkDiagnostics(ctx))
  } else {
    checks.push({
      name: "Diagnostics",
      passed: true,
      message: "Diagnostics check not required",
      skipped: true,
    })
  }

  // Run tests check if required
  if (config.requireTests) {
    checks.push(await checkTests(ctx))
  } else {
    checks.push({
      name: "Tests",
      passed: true,
      message: "Tests check not required",
      skipped: true,
    })
  }

  // Run judge check if required
  if (config.requireJudgePass) {
    checks.push(checkJudge(ctx))
  } else {
    checks.push({
      name: "Judge",
      passed: true,
      message: "Judge check not required",
      skipped: true,
    })
  }

  // Calculate summary
  const passedCount = checks.filter(c => c.passed && !c.skipped).length
  const failedCount = checks.filter(c => !c.passed && !c.skipped).length
  const skippedCount = checks.filter(c => c.skipped).length
  const allPassed = failedCount === 0

  // Generate summary message
  let summary: string
  if (allPassed) {
    summary = `✅ All checks passed (${passedCount} passed, ${skippedCount} skipped)`
  } else {
    const failedNames = checks.filter(c => !c.passed && !c.skipped).map(c => c.name)
    summary = `❌ ${failedCount} check(s) failed: ${failedNames.join(", ")}`
  }

  return {
    allPassed,
    checks,
    summary,
    passedCount,
    failedCount,
    skippedCount,
  }
}

/**
 * Generate a formatted report of checklist results
 */
export function formatChecklistReport(result: ChecklistResult): string {
  const lines: string[] = []

  lines.push("PRODUCTION-READY CHECKLIST")
  lines.push("═".repeat(40))
  lines.push("")

  for (const check of result.checks) {
    const icon = check.skipped ? "⏭️" : check.passed ? "✅" : "❌"
    lines.push(`${icon} ${check.name}: ${check.message}`)
    if (check.error) {
      lines.push(`   Error: ${check.error.slice(0, 100)}${check.error.length > 100 ? "..." : ""}`)
    }
  }

  lines.push("")
  lines.push("─".repeat(40))
  lines.push(result.summary)
  lines.push("")

  return lines.join("\n")
}

/**
 * Quick check if production-ready (simple boolean)
 */
export async function isProductionReady(
  config: ProductionReadyChecks,
  ctx: CheckContext
): Promise<boolean> {
  const result = await verifyProductionReady(config, ctx)
  return result.allPassed
}

/**
 * Get production-ready checks from auto-router config
 */
export function getChecksFromConfig(config: AutoRouterConfig): ProductionReadyChecks {
  return config.productionReadyChecks ?? DEFAULT_PRODUCTION_CHECKS
}

// ============================================================================
// Exports
// ============================================================================

export {
  checkBuild,
  checkDiagnostics,
  checkTests,
  checkJudge,
}
