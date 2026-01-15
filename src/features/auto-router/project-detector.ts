/**
 * Project Type Detector
 * Analyzes directory structure and dependencies to determine project type
 */

import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import type { ProjectType, ProjectContext, DetectionResult } from "./types"
import { PROJECT_DETECTION_PATTERNS } from "./constants"
import { log } from "../../shared/logger"

/**
 * Priority ordering for project types when scores are close.
 * Higher priority = checked first and wins ties.
 * Rule: Container types (monorepo) > specialized (library, game, bot) > general (web-app, api-server)
 */
const PROJECT_TYPE_PRIORITY: Record<ProjectType, number> = {
  monorepo: 100,      // Highest priority - container for other types
  game: 90,           // Specialized, rarely confused
  bot: 85,            // Specialized, rarely confused
  "indexer-crawler": 80,
  "data-pipeline": 75,
  cli: 70,
  library: 60,        // Often contains web-app/api patterns
  "static-site": 50,
  "api-server": 40,
  "web-app": 30,      // Most general - default for many patterns
  unknown: 0,
}

/**
 * Mutual exclusion rules - if a project matches these patterns strongly,
 * other types should be suppressed.
 */
const MUTUAL_EXCLUSIONS: Partial<Record<ProjectType, ProjectType[]>> = {
  monorepo: ["web-app", "api-server", "library", "static-site"], // Monorepo contains these
  library: ["web-app"], // Libraries often have demo apps
}

/**
 * Detect project type from directory context
 * Uses priority ordering and mutual exclusion rules to resolve collisions
 */
export async function detectProjectType(
  directory: string
): Promise<DetectionResult> {
  const context = await buildProjectContext(directory)
  let results: Array<{ type: ProjectType; score: number; matches: string[] }> = []

  for (const [type, patterns] of Object.entries(PROJECT_DETECTION_PATTERNS)) {
    if (type === "unknown") continue

    const { score, matches } = scoreProjectType(
      type as ProjectType,
      patterns,
      context
    )

    if (score > 0) {
      results.push({ type: type as ProjectType, score, matches })
    }
  }

  if (results.length === 0) {
    return {
      projectType: "unknown",
      confidence: 0,
      matchedPatterns: [],
    }
  }

  // Apply mutual exclusion rules:
  // If a high-priority type scores well, suppress types it would contain
  const exclusionThreshold = 3 // Minimum score to trigger exclusion
  for (const result of results) {
    if (result.score >= exclusionThreshold) {
      const exclusions = MUTUAL_EXCLUSIONS[result.type]
      if (exclusions) {
        results = results.filter(
          r => r.type === result.type || !exclusions.includes(r.type)
        )
      }
    }
  }

  // Sort by: (1) score descending, (2) priority descending for ties
  results.sort((a, b) => {
    const scoreDiff = b.score - a.score
    if (Math.abs(scoreDiff) > 1) {
      // Clear winner by score (more than 1 point difference)
      return scoreDiff
    }
    // Close scores - use priority ordering
    return PROJECT_TYPE_PRIORITY[b.type] - PROJECT_TYPE_PRIORITY[a.type]
  })

  const best = results[0]
  const totalScore = results.reduce((sum, r) => sum + r.score, 0)
  const confidence = best.score / Math.max(totalScore, 1)

  // Log warning for low confidence detection
  if (confidence < 0.5) {
    log("[ProjectDetector] Low confidence detection", {
      detected: best.type,
      confidence: confidence.toFixed(2),
      candidates: results.slice(0, 3).map(r => ({ type: r.type, score: r.score })),
    })
  }

  return {
    projectType: best.type,
    confidence,
    matchedPatterns: best.matches,
  }
}

/**
 * Build project context from directory
 */
export async function buildProjectContext(
  directory: string
): Promise<ProjectContext> {
  const packageJsonPath = join(directory, "package.json")
  const hasPackageJson = existsSync(packageJsonPath)

  let packageJson: ProjectContext["packageJson"] | undefined

  if (hasPackageJson) {
    try {
      const content = readFileSync(packageJsonPath, "utf-8")
      packageJson = JSON.parse(content)
    } catch (err) {
      // Log parse errors for debugging but continue without package.json data
      log("[ProjectDetector] Failed to parse package.json", {
        path: packageJsonPath,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  // Quick file pattern detection (sampling common directories)
  const filePatterns = detectFilePatterns(directory)
  const configFiles = detectConfigFiles(directory)

  return {
    directory,
    hasPackageJson,
    packageJson,
    filePatterns,
    configFiles,
  }
}

/**
 * Score a project type based on pattern matches
 */
function scoreProjectType(
  type: ProjectType,
  patterns: (typeof PROJECT_DETECTION_PATTERNS)[ProjectType],
  context: ProjectContext
): { score: number; matches: string[] } {
  let score = 0
  const matches: string[] = []

  // Check package signals (strongest signal)
  if (context.packageJson) {
    // Use null-coalescing to handle undefined dependencies safely
    const allDeps = {
      ...(context.packageJson.dependencies ?? {}),
      ...(context.packageJson.devDependencies ?? {}),
    }

    for (const signal of patterns.packageSignals) {
      if (allDeps[signal]) {
        score += 3
        matches.push(`package:${signal}`)
      }
    }

    // Special case for library detection: check exports field
    if (type === "library" && context.packageJson.exports) {
      score += 2
      matches.push("package:exports")
    }
  }

  // Check config files
  for (const configPattern of patterns.configFiles) {
    const baseName = configPattern.replace("*", "")
    if (context.configFiles.some((f) => f.includes(baseName))) {
      score += 2
      matches.push(`config:${configPattern}`)
    }
  }

  // Check directory patterns
  if (patterns.directoryPatterns) {
    for (const dirPattern of patterns.directoryPatterns) {
      if (context.filePatterns.includes(dirPattern)) {
        score += 1
        matches.push(`dir:${dirPattern}`)
      }
    }
  }

  return { score, matches }
}

/**
 * Quick detection of common directories
 */
function detectFilePatterns(directory: string): string[] {
  const patterns: string[] = []
  const commonDirs = [
    "src",
    "lib",
    "dist",
    "pages",
    "app",
    "components",
    "views",
    "routes",
    "api",
    "controllers",
    "commands",
    "handlers",
    "events",
    "assets",
    "sprites",
    "scenes",
    "content",
    "posts",
    "blog",
    "packages",
    "apps",
    "libs",
    "crawler",
    "scraper",
    "indexer",
    "pipeline",
    "etl",
    "jobs",
    "workers",
    "cli",
    "bin",
  ]

  for (const dir of commonDirs) {
    if (existsSync(join(directory, dir))) {
      patterns.push(dir)
    }
  }

  return patterns
}

/**
 * Quick detection of config files
 */
function detectConfigFiles(directory: string): string[] {
  const configs: string[] = []
  const commonConfigs = [
    "next.config.js",
    "next.config.mjs",
    "next.config.ts",
    "vite.config.js",
    "vite.config.ts",
    "astro.config.mjs",
    "angular.json",
    "svelte.config.js",
    "gatsby-config.js",
    "phaser.config.js",
    "game.config.js",
    "rollup.config.js",
    "tsup.config.ts",
    "turbo.json",
    "nx.json",
    "lerna.json",
    "pnpm-workspace.yaml",
    "swagger.json",
    "swagger.yaml",
    "openapi.json",
    "openapi.yaml",
    ".eleventy.js",
    "docusaurus.config.js",
  ]

  for (const config of commonConfigs) {
    if (existsSync(join(directory, config))) {
      configs.push(config)
    }
  }

  return configs
}

/**
 * Detect verification capabilities
 */
export function detectVerificationCapabilities(context: ProjectContext): {
  hasTests: boolean
  hasBuildGates: boolean
  hasTypeChecking: boolean
  hasLinting: boolean
} {
  const hasTests =
    existsSync(join(context.directory, "tests")) ||
    existsSync(join(context.directory, "__tests__")) ||
    existsSync(join(context.directory, "test")) ||
    existsSync(join(context.directory, "spec")) ||
    Boolean(context.packageJson?.scripts?.test)

  const hasBuildGates = Boolean(context.packageJson?.scripts?.build)

  const hasTypeChecking =
    existsSync(join(context.directory, "tsconfig.json")) ||
    existsSync(join(context.directory, "jsconfig.json"))

  const hasLinting =
    existsSync(join(context.directory, ".eslintrc")) ||
    existsSync(join(context.directory, ".eslintrc.js")) ||
    existsSync(join(context.directory, ".eslintrc.json")) ||
    existsSync(join(context.directory, "eslint.config.js")) ||
    existsSync(join(context.directory, "eslint.config.mjs")) ||
    existsSync(join(context.directory, "biome.json"))

  return { hasTests, hasBuildGates, hasTypeChecking, hasLinting }
}

/**
 * Detect project maturity from git history and file count
 */
export function detectProjectMaturity(
  context: ProjectContext
): "greenfield" | "established" | "legacy" {
  // Simple heuristic based on directory presence
  const hasGit = existsSync(join(context.directory, ".git"))
  const hasSrc = existsSync(join(context.directory, "src"))
  const hasTests =
    existsSync(join(context.directory, "tests")) ||
    existsSync(join(context.directory, "__tests__"))
  const hasReadme =
    existsSync(join(context.directory, "README.md")) ||
    existsSync(join(context.directory, "readme.md"))

  const signals = [hasGit, hasSrc, hasTests, hasReadme].filter(Boolean).length

  if (signals <= 1) return "greenfield"
  if (signals <= 3) return "established"
  return "legacy"
}
