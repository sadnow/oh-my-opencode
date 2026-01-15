/**
 * Auto-Router Constants
 * Detection patterns, selection matrices, budget tiers, and injection templates
 */

import type {
  ProjectType,
  TechniqueCombo,
  BudgetTier,
  BudgetTierConfig,
  DetectionPattern,
  EscalationTrigger,
  DomainSignal,
} from "./types"

// ============================================================================
// Budget Tier Priority (shared constant for comparison functions)
// ============================================================================

/**
 * Priority ordering for budget tiers - higher number = more expensive tier.
 * Used consistently across index.ts, escalation-manager.ts, preset-selector.ts, wizard.ts
 */
export const BUDGET_TIER_PRIORITY: Record<BudgetTier, number> = {
  free: 1,
  cheap: 2,
  moderate: 3,
  expensive: 4,
  maximum: 5,
}

// ============================================================================
// Technique Capability Constants (for techniqueIncludes checks)
// ============================================================================

/**
 * Techniques that include ultrathink capability
 */
export const TECHNIQUES_WITH_ULTRATHINK: readonly TechniqueCombo[] = [
  "ultrathink", "ultrathink+ulw", "ultrathink+ralph", "triple"
] as const

/**
 * Techniques that include ulw (ultrawork) capability
 */
export const TECHNIQUES_WITH_ULW: readonly TechniqueCombo[] = [
  "ulw", "ulw+ralph", "ultrathink+ulw", "triple"
] as const

/**
 * Techniques that include ralph loop capability
 */
export const TECHNIQUES_WITH_RALPH: readonly TechniqueCombo[] = [
  "ralph", "ulw+ralph", "ultrathink+ralph", "triple"
] as const

// ============================================================================
// Project Detection Patterns
// ============================================================================

export const PROJECT_DETECTION_PATTERNS: Record<ProjectType, DetectionPattern> = {
  game: {
    filePatterns: ["**/game*.{ts,js}", "**/engine/**", "**/assets/**", "**/sprites/**", "**/scenes/**"],
    packageSignals: ["phaser", "pixi", "three", "babylonjs", "excalibur", "kontra", "kaboom"],
    configFiles: ["game.config.*", "*.tscn", "*.unity", "phaser.config.*"],
    directoryPatterns: ["assets", "sprites", "scenes", "levels"],
  },
  "web-app": {
    filePatterns: ["**/pages/**", "**/app/**", "**/components/**", "**/views/**"],
    packageSignals: ["react", "vue", "angular", "svelte", "next", "nuxt", "remix", "solid-js"],
    configFiles: ["next.config.*", "vite.config.*", "angular.json", "svelte.config.*"],
    directoryPatterns: ["pages", "components", "views", "layouts"],
  },
  "api-server": {
    filePatterns: ["**/routes/**", "**/controllers/**", "**/api/**", "**/endpoints/**"],
    packageSignals: ["express", "fastify", "hono", "koa", "nestjs", "hapi", "restify"],
    configFiles: ["swagger.*", "openapi.*", "api.config.*"],
    directoryPatterns: ["routes", "controllers", "middleware", "handlers"],
  },
  bot: {
    filePatterns: ["**/bot*.{ts,js}", "**/commands/**", "**/handlers/**", "**/events/**"],
    packageSignals: ["discord.js", "telegraf", "slack-bolt", "twitter-api-v2", "grammy", "eris"],
    configFiles: ["bot.config.*", "discord.config.*"],
    directoryPatterns: ["commands", "events", "handlers"],
  },
  "indexer-crawler": {
    filePatterns: ["**/crawler/**", "**/indexer/**", "**/scraper/**", "**/spider/**"],
    packageSignals: ["puppeteer", "playwright", "cheerio", "crawlee", "apify"],
    configFiles: ["crawler.config.*", "scraper.config.*"],
    directoryPatterns: ["crawler", "scraper", "indexer", "spider"],
  },
  "data-pipeline": {
    filePatterns: ["**/pipeline/**", "**/etl/**", "**/jobs/**", "**/workers/**"],
    packageSignals: ["bull", "bullmq", "agenda", "node-schedule", "bree", "bee-queue"],
    configFiles: ["pipeline.config.*", "jobs.yaml", "workflow.*"],
    directoryPatterns: ["pipeline", "etl", "jobs", "workers", "processors"],
  },
  cli: {
    filePatterns: ["**/cli/**", "**/bin/**", "**/commands/**"],
    packageSignals: ["commander", "yargs", "inquirer", "chalk", "ora", "meow", "clipanion"],
    configFiles: ["cli.config.*"],
    directoryPatterns: ["cli", "bin", "commands"],
  },
  "static-site": {
    filePatterns: ["**/content/**", "**/posts/**", "**/blog/**", "**/articles/**"],
    packageSignals: ["astro", "gatsby", "eleventy", "@11ty/eleventy", "vitepress", "docusaurus"],
    configFiles: ["astro.config.*", "gatsby-config.*", ".eleventy.js", "docusaurus.config.*"],
    directoryPatterns: ["content", "posts", "blog", "docs"],
  },
  library: {
    filePatterns: ["**/src/index.{ts,js}", "**/lib/**"],
    packageSignals: [], // Detected via package.json exports field
    configFiles: ["tsup.config.*", "rollup.config.*", "esbuild.*", "unbuild.config.*"],
    directoryPatterns: ["lib", "src"],
  },
  monorepo: {
    filePatterns: ["**/packages/**", "**/apps/**", "**/libs/**"],
    packageSignals: ["lerna", "nx", "turbo", "@changesets/cli"],
    configFiles: ["pnpm-workspace.yaml", "nx.json", "lerna.json", "turbo.json"],
    directoryPatterns: ["packages", "apps", "libs", "modules"],
  },
  unknown: {
    filePatterns: [],
    packageSignals: [],
    configFiles: [],
    directoryPatterns: [],
  },
}

// ============================================================================
// Domain Signal Detection Keywords
// ============================================================================

export const DOMAIN_SIGNAL_KEYWORDS: Record<DomainSignal, string[]> = {
  "crypto-trading": [
    "trading bot", "trade execution", "exchange api", "crypto wallet", "blockchain",
    "cryptocurrency", "defi", "swap", "liquidity pool", "yield farm", "staking",
    "mint nft", "nft marketplace", "web3", "smart contract", "solidity",
  ],
  "real-time": [
    "real-time", "realtime", "websocket", "socket", "live", "streaming",
    "push", "notification", "subscribe", "pubsub", "event-driven",
  ],
  "data-aggregation": [
    "aggregate data", "collect data", "gather data", "scrape", "crawl", "indexer",
    "rss feed", "data feed", "batch import", "batch export", "data sync",
    "etl", "data pipeline", "data ingestion",
  ],
  "research-analysis": [
    "data analysis", "research report", "statistical analysis", "statistics",
    "visualization", "chart", "graph", "metrics dashboard", "insight", "analytics",
  ],
  "ui-heavy": [
    "ui", "interface", "design", "component", "animation", "transition",
    "responsive", "mobile", "layout", "style", "theme", "visual",
  ],
  "backend-logic": [
    "api", "endpoint", "route", "controller", "service", "repository",
    "database", "query", "mutation", "resolver", "middleware",
  ],
  infrastructure: [
    "deploy", "ci", "cd", "docker", "kubernetes", "terraform", "aws",
    "gcp", "azure", "cloudflare", "vercel", "netlify", "config",
  ],
  documentation: [
    "document", "readme", "guide", "tutorial", "example", "jsdoc",
    "typedoc", "api-doc", "swagger", "openapi", "spec",
  ],
  testing: [
    "test", "spec", "unit", "integration", "e2e", "coverage", "mock",
    "stub", "fixture", "snapshot", "assertion", "expect",
  ],
  "security-sensitive": [
    "auth", "authentication", "authorization", "permission", "role",
    "password", "secret", "encrypt", "hash", "sanitize", "validate",
    "security", "vulnerability", "audit", "compliance", "pci", "gdpr",
    "csrf", "xss", "injection", "penetration", "threat",
  ],
  "performance-critical": [
    "performance", "optimize", "cache", "memory", "cpu", "latency",
    "throughput", "benchmark", "profile", "fast", "efficient",
  ],
}

// ============================================================================
// Complexity Keywords
// ============================================================================

export const COMPLEXITY_STEP_INDICATORS = [
  // Sequence words
  "then", "after", "next", "following", "subsequently", "finally",
  "first", "second", "third", "step", "phase", "stage",
  // Multi-part indicators
  "also", "additionally", "as well as", "along with", "together with",
  "multiple", "several", "various", "comprehensive", "complete",
]

export const COMPLEXITY_CONDITIONAL_WORDS = [
  "if", "when", "unless", "depending", "based on", "conditional",
  "either", "or", "optional", "fallback", "alternative",
]

export const COMPLEXITY_INTEGRATION_KEYWORDS = [
  // Abstract integration terms
  "connect", "integrate", "sync", "link", "bridge", "combine",
  "merge", "join", "coordinate", "orchestrate", "compose",
  // Concrete multi-component indicators
  "authentication", "authorization", "database", "api", "endpoint",
  "service", "middleware", "session", "storage", "cache",
  "queue", "worker", "scheduler", "webhook", "callback",
  // v3.5.1: Testing infrastructure (indicates complex setup)
  "playwright", "puppeteer", "cypress", "selenium", "e2e test",
  "visual regression", "screenshot", "pixel diff",
]

export const COMPLEXITY_RESEARCH_KEYWORDS = [
  "research", "investigate", "explore", "analyze", "study",
  "understand", "learn", "figure out", "discover",
]

export const COMPLEXITY_ARCHITECTURE_KEYWORDS = [
  "architecture", "design pattern", "structure", "refactor",
  "reorganize", "modular", "scalable", "extensible",
  "system", "framework", "migration", "redesign", "overhaul",
  "entire", "whole", "full", "end-to-end", "e2e",
  // v3.5.1: Added complex task indicators for porting/recreation
  "harness", "equivalence", "recreation", "faithful", "production-grade",
  "extract all", "build from scratch", "port", "convert", "rewrite",
  "rebuild", "replicate", "clone", "reverse engineer",
]

// ============================================================================
// Task Intent Keywords (v3.6.3)
// ============================================================================

/**
 * Task intent keywords detected from USER PROMPT ONLY (not project artifacts).
 * These force specific behaviors and prevent the model from getting distracted
 * by "Next Step" suggestions in project documentation.
 *
 * Key insight: When user says "play through the game with playwright",
 * the intents are ["test", "play"] and required tools are ["playwright"].
 * These MUST be preserved even if project contains vercel.json or DEPLOY.md.
 */
export const TASK_INTENT_KEYWORDS = {
  /** Testing intents - should enable ralph loop for persistence */
  test: ["test", "play", "play through", "verify", "check", "validate", "e2e", "end-to-end"],

  /** Tool-specific intents - MUST be preserved regardless of project context */
  playwright: ["playwright", "browser automation"],
  cypress: ["cypress"],
  puppeteer: ["puppeteer"],

  /** Deployment intents - only if user explicitly requests */
  deploy: ["deploy", "publish", "release", "ship", "go live"],

  /** Build intents */
  build: ["build", "create", "make", "implement", "add", "write"],

  /** Fix intents */
  fix: ["fix", "debug", "repair", "resolve", "patch", "correct"],

  /** Exploration intents */
  explore: ["explore", "investigate", "understand", "learn", "research", "analyze"],

  /** Refactoring intents */
  refactor: ["refactor", "clean", "optimize", "improve", "restructure"],
} as const

/**
 * Tools that when explicitly mentioned in user prompt MUST be used.
 * These override any suggestions from project artifacts.
 */
export const EXPLICIT_TOOL_KEYWORDS = [
  "playwright", "puppeteer", "cypress", "selenium", "webdriver",
  "jest", "vitest", "mocha", "pytest", "junit",
  "webpack", "vite", "esbuild", "rollup", "parcel",
  "docker", "kubernetes", "terraform",
] as const

/**
 * Keywords in project files that should NOT influence task classification.
 * These are often "suggestions" in docs that distract from user's actual intent.
 */
export const IGNORED_PROJECT_ARTIFACT_SIGNALS = [
  "next step",
  "next steps",
  "todo",
  "future work",
  "recommended",
  "optional",
  "consider",
  "might want to",
  "could also",
] as const

// ============================================================================
// Technique Selection Matrix
// ============================================================================

type SelectionKey = `tier${1 | 2 | 3}-${"known" | "familiar" | "novel"}-${"tests" | "notests"}`

export const TECHNIQUE_SELECTION_MATRIX: Record<SelectionKey, TechniqueCombo> = {
  // Tier 1: Simple tasks - minimize resources, complete quickly
  // Simple tasks should NOT use parallel agents (ulw) or persistence (ralph)
  // unless absolutely necessary (novel + no tests = some exploration needed)
  "tier1-known-tests": "direct",
  "tier1-known-notests": "direct",
  "tier1-familiar-tests": "direct",
  "tier1-familiar-notests": "direct",  // Changed: was "ulw" - simple familiar task doesn't need parallel agents
  "tier1-novel-tests": "direct",       // Changed: was "ulw" - tests provide verification, no need for parallel
  "tier1-novel-notests": "ulw",        // Changed: was "ulw+ralph" - novel but still simple, just needs exploration

  // Tier 2: Moderate tasks
  "tier2-known-tests": "ulw",
  "tier2-known-notests": "ulw+ralph",
  "tier2-familiar-tests": "ulw",
  "tier2-familiar-notests": "ultrathink+ulw",
  "tier2-novel-tests": "ultrathink+ulw",
  "tier2-novel-notests": "triple",

  // Tier 3: Complex tasks
  "tier3-known-tests": "ultrathink+ulw",
  "tier3-known-notests": "triple",
  "tier3-familiar-tests": "ultrathink+ulw",
  "tier3-familiar-notests": "triple",
  "tier3-novel-tests": "triple",
  "tier3-novel-notests": "triple",
}

// Domain-specific overrides
export const DOMAIN_TECHNIQUE_OVERRIDES: Partial<Record<DomainSignal, TechniqueCombo>> = {
  "crypto-trading": "triple", // Always max caution
  "security-sensitive": "ultrathink+ulw", // Deep reasoning for security
  "performance-critical": "ultrathink+ulw", // Analysis before optimization
}

// ============================================================================
// Budget Tier Configurations
// ============================================================================

/**
 * Budget tier configurations control model selection, iteration limits, and timeouts.
 *
 * Iteration counts rationale:
 * - cheap (3): Quick tasks, fail fast. Most simple tasks complete in 1-2 iterations.
 * - moderate (5): Standard tasks needing some exploration/retry.
 * - expensive (10): Complex tasks requiring multiple approaches.
 * - maximum (25): Hardest tasks, extensive exploration allowed.
 *
 * Timeout rationale:
 * - cheap (30s): Fast models, simple tasks - 10s per iteration average.
 * - moderate (60s): More complex processing, 12s per iteration.
 * - expensive (180s/3min): Deep thinking allowed, 18s per iteration.
 * - maximum (600s/10min): Full orchestration, 24s per iteration.
 *
 * Escalation happens when:
 * - 2+ consecutive failures (cheap→moderate, moderate→expensive)
 * - Quality score < 0.6-0.7 threshold
 * - Stuck pattern detected (repeated identical outputs)
 * - Timeout exceeded
 */
export const BUDGET_TIERS: Record<BudgetTier, BudgetTierConfig> = {
  free: {
    name: "free",
    models: {
      primary: "opencode/glm-4.7-free",       // Free GLM model
      thinking: "opencode/grok-code",          // Free Grok for reasoning
      judge: "opencode/glm-4.7-free",         // Free judge
    },
    maxIterations: 3,   // Same as cheap tier; escalates to paid if quality issues
    timeoutMs: 120000,  // 2 minutes (free models may be slower)
  },
  cheap: {
    name: "cheap",
    models: {
      primary: "github-copilot/gpt-4o-mini",   // Free via Copilot CLI
      thinking: "github-copilot/gpt-4o-mini",
      judge: "github-copilot/gpt-4o-mini",
    },
    maxIterations: 3,   // Quick tasks: fail fast if not solving
    timeoutMs: 30000,   // 30 seconds
  },
  moderate: {
    name: "moderate",
    models: {
      primary: "google/antigravity-gemini-3-flash",      // Free via Antigravity OAuth (AI Studio)
      thinking: "google/antigravity-gemini-3-pro-high",  // Thinking enabled, 1M context
      judge: "github-copilot/gpt-4o-mini",              // Keep judge cheap
    },
    maxIterations: 5,   // Standard tasks: moderate exploration
    timeoutMs: 60000,   // 1 minute
  },
  expensive: {
    name: "expensive",
    models: {
      primary: "github-copilot/claude-sonnet-4",        // Claude Sonnet 4 via Copilot CLI
      thinking: "github-copilot/claude-sonnet-4",
      judge: "google/antigravity-gemini-3-flash",       // Free judge via Antigravity
    },
    maxIterations: 10,  // Complex tasks: extensive exploration
    timeoutMs: 180000,  // 3 minutes
  },
  maximum: {
    name: "maximum",
    models: {
      primary: "github-copilot/claude-opus-4-5",       // Claude Opus 4.5 via Copilot CLI
      thinking: "github-copilot/claude-opus-4-5",
      judge: "github-copilot/claude-sonnet-4",         // Sonnet as judge for maximum tier
    },
    maxIterations: 25,  // Hardest tasks: exhaustive exploration
    timeoutMs: 600000,  // 10 minutes
  },
}

// ============================================================================
// Budget Tier Model Configs (for chat.params hook model switching)
// ============================================================================

export interface ModelConfig {
  providerID: string
  modelID: string
}

/**
 * Parse a model string like "openai/gpt-5.2" into provider and model ID
 */
export function parseModelString(modelString: string): ModelConfig {
  const [providerID, modelID] = modelString.split("/")
  return { providerID, modelID }
}

/**
 * Get the primary model config for a budget tier (for use in chat.params)
 */
export function getBudgetTierModelConfig(tier: BudgetTier): ModelConfig {
  const tierConfig = BUDGET_TIERS[tier]
  return parseModelString(tierConfig.models.primary)
}

// ============================================================================
// Escalation Rules
// ============================================================================

export const ESCALATION_RULES: EscalationTrigger[] = [
  // Free tier escalation (free → cheap)
  {
    condition: "consecutive-failures >= 2",
    fromTier: "free",
    toTier: "cheap",
    signals: ["consecutive-failures"],
  },
  {
    condition: "quality-score < 0.5",
    fromTier: "free",
    toTier: "cheap",
    signals: ["quality-below-threshold"],
  },
  {
    condition: "stuck-pattern",
    fromTier: "free",
    toTier: "cheap",
    signals: ["stuck-pattern"],
  },
  // Cheap tier escalation (cheap → moderate)
  {
    condition: "consecutive-failures >= 2",
    fromTier: "cheap",
    toTier: "moderate",
    signals: ["consecutive-failures"],
  },
  {
    condition: "quality-score < 0.6",
    fromTier: "cheap",
    toTier: "moderate",
    signals: ["quality-below-threshold"],
  },
  {
    condition: "consecutive-failures >= 2",
    fromTier: "moderate",
    toTier: "expensive",
    signals: ["consecutive-failures"],
  },
  {
    condition: "stuck-pattern AND quality-score < 0.7",
    fromTier: "moderate",
    toTier: "expensive",
    signals: ["stuck-pattern", "quality-below-threshold"],
  },
  {
    condition: "consecutive-failures >= 3 OR timeout-exceeded",
    fromTier: "expensive",
    toTier: "maximum",
    signals: ["consecutive-failures", "timeout-exceeded"],
  },
]

// ============================================================================
// Technique Instructions
// ============================================================================

export const TECHNIQUE_INSTRUCTIONS: Record<TechniqueCombo, string> = {
  direct: `**Direct Execution**: No special orchestration needed.
- Execute the task directly using available tools
- Verify completion with available verification (tests, lsp_diagnostics)
- Report completion when done`,

  ulw: `**Ultrawork Mode**: Parallel agents + TDD verification
- ANNOUNCE: "ULTRAWORK MODE ENABLED!"
- Fire explore/librarian agents IN PARALLEL for context gathering
- Use TDD workflow if tests available: RED -> GREEN -> REFACTOR
- Track ALL steps with TODO items
- Verify against success criteria before completion`,

  ultrathink: `**Ultrathink Mode**: Deep reasoning before action
- Think through the problem thoroughly before any implementation
- Consider edge cases, failure modes, and architectural implications
- Plan the implementation sequence before starting
- Validate reasoning before each major step`,

  ralph: `**Ralph Loop Mode**: Persistent execution until completion
- Work continuously until the task is FULLY complete
- Output <promise>DONE</promise> ONLY when truly finished
- If stuck, try different approaches before giving up
- Maximum iterations: {{MAX_ITERATIONS}}`,

  "ulw+ralph": `**Ultrawork + Ralph Loop**: Parallel exploration with persistence
- ANNOUNCE: "ULTRAWORK MODE ENABLED!"
- Fire parallel exploration agents
- Use TDD workflow where possible
- Continue in Ralph loop until complete: <promise>DONE</promise>
- Do not stop at partial completion
- Maximum iterations: {{MAX_ITERATIONS}}`,

  "ultrathink+ulw": `**Ultrathink + Ultrawork**: Deep reasoning + parallel execution
- First, think deeply about the problem and plan
- Then, ANNOUNCE: "ULTRAWORK MODE ENABLED!"
- Execute with parallel agents and TDD
- Verify reasoning at each major checkpoint`,

  "ultrathink+ralph": `**Ultrathink + Ralph Loop**: Deep reasoning with persistence
- Think through the problem thoroughly first
- Execute with persistence until complete
- Output <promise>DONE</promise> only when truly finished
- Revisit reasoning if stuck
- Maximum iterations: {{MAX_ITERATIONS}}`,

  triple: `**Full Orchestration**: Ultrathink + Ultrawork + Ralph Loop
This is the maximum capability configuration. Use ALL techniques:

1. **ULTRATHINK FIRST**:
   - Deep analysis of the problem
   - Plan the complete implementation
   - Identify all edge cases and failure modes

2. **ULTRAWORK EXECUTION**:
   - ANNOUNCE: "ULTRAWORK MODE ENABLED!"
   - Fire 5+ parallel exploration agents
   - Use TDD workflow (RED -> GREEN -> REFACTOR)
   - Track ALL steps with TODO items

3. **RALPH LOOP PERSISTENCE**:
   - Continue until FULLY complete
   - Output <promise>DONE</promise> ONLY when all criteria met
   - Try different approaches if stuck
   - Maximum iterations: {{MAX_ITERATIONS}}

**VERIFICATION GUARANTEE**: Nothing is "done" without proof. Run tests, verify with LLM judge if applicable.`,
}

// ============================================================================
// Injection Template
// ============================================================================

export const AUTO_ROUTER_INJECTION_TEMPLATE = `<auto-router-decision>
## Task Classification
- **Project Type**: {{PROJECT_TYPE}}
- **Complexity Tier**: {{COMPLEXITY_TIER}} ({{COMPLEXITY_DESCRIPTION}})
- **Novelty Level**: {{NOVELTY_LEVEL}}
- **Domain Signals**: {{DOMAIN_SIGNALS}}

## Verification Capabilities
- Tests Available: {{HAS_TESTS}}
- Build Gates: {{HAS_BUILD_GATES}}
- Type Checking: {{HAS_TYPE_CHECKING}}
- LLM Judge Required: {{NEEDS_LLM_JUDGE}}

## Selected Technique
**{{TECHNIQUE_COMBO}}**

{{TECHNIQUE_INSTRUCTIONS}}

## Budget Configuration
- **Starting Tier**: {{STARTING_TIER}}
- **Model**: {{MODEL}}
- **Max Iterations**: {{MAX_ITERATIONS}}
- **Escalation Policy**: Adaptive (start cheap, escalate on failures)

## Applicable Quality Rubrics
{{APPLICABLE_RUBRICS}}

## Execution Directives
{{EXECUTION_DIRECTIVES}}

</auto-router-decision>

---

**IMPORTANT**: Follow the technique instructions precisely. The auto-router has analyzed this task and determined the optimal approach.

---

## YOUR TASK

{{TASK_DESCRIPTION}}
`

// ============================================================================
// Complexity Tier Descriptions
// ============================================================================

export const COMPLEXITY_DESCRIPTIONS: Record<1 | 2 | 3, string> = {
  1: "Simple - direct execution, few steps",
  2: "Moderate - planning needed, multiple components",
  3: "Complex - full orchestration required, many interdependencies",
}

// ============================================================================
// Default Config
// ============================================================================

export const DEFAULT_AUTO_ROUTER_CONFIG = {
  enabled: true,
  defaultBudget: "free" as BudgetTier,   // Start with free models, escalate if needed
  autoEscalate: true,
  maxEscalations: 3,
  enableJudge: true,
  qualityThreshold: 0.7,
  wizardMode: false,                      // Enable wizard prompts before execution
  fullAutonomy: true,                     // Run without interruption until complete
  productionReadyChecks: {
    requireTests: false,                  // Optional: tests must exist
    requireCleanDiagnostics: true,        // Required: no LSP errors
    requireBuildPass: true,               // Required: build must succeed
    requireJudgePass: false,              // Optional: LLM judge approval
  },
}

// ============================================================================
// Magic Keywords (User Shortcuts)
// ============================================================================

/**
 * Magic keywords allow power users to force specific technique/budget combinations.
 * Usage: Include the keyword anywhere in the task description.
 * Example: "ultrawork: fix the login bug" → forces ulw technique, moderate budget
 */
export const MAGIC_KEYWORDS: Record<string, { technique: TechniqueCombo; budget: BudgetTier }> = {
  "ultrawork": { technique: "ulw", budget: "moderate" },
  "deepthink": { technique: "ultrathink", budget: "expensive" },
  "fullsend": { technique: "triple", budget: "maximum" },
  "quickfix": { technique: "direct", budget: "cheap" },
  "careful": { technique: "ultrathink+ulw", budget: "expensive" },
}

// ============================================================================
// Development Presets
// ============================================================================

/**
 * Development presets provide pre-configured settings for common development patterns.
 * These optimize for specific use cases like rapid prototyping vs production code.
 */
export interface DevelopmentPreset {
  name: string
  description: string
  defaultTechnique: TechniqueCombo
  startingBudget: BudgetTier
  maxBudget: BudgetTier
  qualityThreshold: number
}

export const DEVELOPMENT_PRESETS: Record<string, DevelopmentPreset> = {
  "game-prototype": {
    name: "Game Prototype",
    description: "Rapid game development iteration, lower quality bar",
    defaultTechnique: "ulw+ralph",
    startingBudget: "moderate",
    maxBudget: "expensive",
    qualityThreshold: 0.6,
  },
  "production-app": {
    name: "Production Application",
    description: "Production-quality code with full verification",
    defaultTechnique: "triple",
    startingBudget: "moderate",
    maxBudget: "maximum",
    qualityThreshold: 0.8,
  },
  "quick-fix": {
    name: "Quick Fix",
    description: "Fast bug fixes and small changes",
    defaultTechnique: "direct",
    startingBudget: "cheap",
    maxBudget: "moderate",
    qualityThreshold: 0.7,
  },
  "security-audit": {
    name: "Security Audit",
    description: "Security-sensitive changes requiring careful review",
    defaultTechnique: "ultrathink+ulw",
    startingBudget: "expensive",
    maxBudget: "maximum",
    qualityThreshold: 0.85,
  },
  "exploration": {
    name: "Exploration",
    description: "Research and exploratory development",
    defaultTechnique: "ultrathink",
    startingBudget: "moderate",
    maxBudget: "expensive",
    qualityThreshold: 0.65,
  },
}

// ============================================================================
// Budget Tier Agents (for model switching via agent system)
// ============================================================================

/**
 * Maps budget tiers to pre-configured agent names.
 * Users configure these agents in their opencode.json with different models.
 *
 * NOTE: Direct Anthropic API access is blocked for OpenCode as of Jan 2026.
 * Use GitHub Copilot, Google Antigravity, or OpenAI instead.
 * Claude models can still be accessed via github-copilot provider.
 *
 * Example opencode.json:
 * {
 *   "agents": {
 *     "auto-free": { "model": "google/gemini-2.5-flash" },
 *     "auto-cheap": { "model": "github-copilot/gpt-4o-mini" },
 *     "auto-moderate": { "model": "google/gemini-2.5-flash" },
 *     "auto-expensive": {
 *       "model": "github-copilot/claude-sonnet-4",
 *       "thinking": { "type": "enabled", "budgetTokens": 10000 }
 *     },
 *     "auto-maximum": { "model": "openai/gpt-5.2" }
 *   }
 * }
 */
export const BUDGET_TIER_AGENTS: Record<BudgetTier, string> = {
  free: "auto-free",
  cheap: "auto-cheap",
  moderate: "auto-moderate",
  expensive: "auto-expensive",
  maximum: "auto-maximum",
}

/**
 * Get the recommended agent name for a budget tier
 */
export function getAgentForBudgetTier(tier: BudgetTier): string {
  return BUDGET_TIER_AGENTS[tier]
}

// ============================================================================
// Parallel Agent Configuration
// ============================================================================

/**
 * Default agents to spawn for parallel exploration
 */
export const DEFAULT_PARALLEL_AGENTS = ["explore", "librarian"] as const

/**
 * Per-Provider Concurrent Agent Limits
 *
 * We throttle ourselves out of caution and respect for providers offering
 * free or cheap services. Each provider gets a maximum of 2 concurrent agents:
 * - 1 free model agent (if the provider offers free models)
 * - 1 paid model agent
 *
 * This means with 3 providers configured, the auto-router can deploy up to
 * 6 concurrent agents (2 per provider). If a provider only offers paid models,
 * both slots can be used for paid agents.
 *
 * Example with 3 providers (github-copilot, google, opencode):
 * - github-copilot: 1 free (gpt-4o-mini) + 1 paid (claude-sonnet-4) = 2 agents
 * - google: 1 free (gemini-flash) + 1 paid (gemini-pro) = 2 agents
 * - opencode: 1 free (glm-4.7-free) + 1 paid (grok-code) = 2 agents
 * - Total: 6 concurrent agents maximum
 *
 * This conservative approach:
 * - Respects provider rate limits
 * - Avoids overwhelming free tier services
 * - Ensures fair usage across providers
 * - Allows budget escalation within each provider
 */
export const AGENTS_PER_PROVIDER = 2
export const FREE_AGENTS_PER_PROVIDER = 1
export const PAID_AGENTS_PER_PROVIDER = 1

/**
 * Maximum concurrent parallel agents (conservative for rate limits)
 * @deprecated Use calculateMaxConcurrentAgents() with provider count instead
 */
export const DEFAULT_MAX_PARALLEL_AGENTS = 2

/**
 * Calculate maximum concurrent agents based on configured providers
 * @param providerCount Number of enabled providers (e.g., github-copilot, google, opencode)
 * @returns Maximum concurrent agents allowed
 */
export function calculateMaxConcurrentAgents(providerCount: number): number {
  return Math.max(AGENTS_PER_PROVIDER, providerCount * AGENTS_PER_PROVIDER)
}

/**
 * Provider agent allocation configuration
 */
export interface ProviderAgentAllocation {
  providerId: string
  freeAgents: number
  paidAgents: number
  totalAgents: number
}

/**
 * Get agent allocation for a provider based on its model offerings
 * @param providerId The provider ID (e.g., "github-copilot", "google")
 * @param hasFreeModels Whether the provider offers free models
 * @returns Agent allocation for this provider
 */
export function getProviderAgentAllocation(
  providerId: string,
  hasFreeModels: boolean
): ProviderAgentAllocation {
  if (hasFreeModels) {
    return {
      providerId,
      freeAgents: FREE_AGENTS_PER_PROVIDER,
      paidAgents: PAID_AGENTS_PER_PROVIDER,
      totalAgents: AGENTS_PER_PROVIDER,
    }
  }
  // Provider only has paid models - both slots can be paid
  return {
    providerId,
    freeAgents: 0,
    paidAgents: AGENTS_PER_PROVIDER,
    totalAgents: AGENTS_PER_PROVIDER,
  }
}

/**
 * Parallel agent configuration
 */
export interface ParallelAgentConfig {
  enabled: boolean
  maxConcurrent: number
  agentsForTier3: readonly string[]
  /** Per-provider allocation (optional, uses defaults if not specified) */
  providerAllocations?: ProviderAgentAllocation[]
}

export const DEFAULT_PARALLEL_AGENT_CONFIG: ParallelAgentConfig = {
  enabled: true,
  maxConcurrent: DEFAULT_MAX_PARALLEL_AGENTS,
  agentsForTier3: DEFAULT_PARALLEL_AGENTS,
}
