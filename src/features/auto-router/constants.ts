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
// Orchestrator Model Recommendation
// ============================================================================

/**
 * Recommended model for the orchestrator (the main session handling /auto commands).
 * The orchestrator is a lightweight coordinator that classifies tasks and delegates
 * actual work to subagents with appropriate models.
 *
 * Using a cheap/fast model for orchestration ensures:
 * - Fast classification and routing decisions
 * - Low cost for coordination overhead
 * - Budget savings that can be allocated to actual work
 *
 * The orchestrator CAN'T change its own model at runtime (OpenCode API limitation),
 * but it CAN spawn subagents with different models.
 */
export const ORCHESTRATOR_MODEL_RECOMMENDATION = "github-copilot/gpt-4o-mini"

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
      primary: "opencode/glm-4.7-free",       // Free GLM model (always available)
      thinking: "opencode/grok-code",          // Free Grok for reasoning
      judge: "opencode/glm-4.7-free",         // Free judge
    },
    maxIterations: 3,   // Same as cheap tier; escalates to paid if quality issues
    timeoutMs: 120000,  // 2 minutes (free models may be slower)
  },
  cheap: {
    name: "cheap",
    models: {
      // Use OpenAI as primary (more reliable when Copilot credits exhausted)
      primary: "openai/gpt-4o-mini",           // OpenAI API (requires key)
      thinking: "opencode/grok-code",          // Free fallback for thinking
      judge: "opencode/glm-4.7-free",         // Free judge
    },
    maxIterations: 3,   // Quick tasks: fail fast if not solving
    timeoutMs: 30000,   // 30 seconds
  },
  moderate: {
    name: "moderate",
    models: {
      primary: "google/antigravity-gemini-3-flash",      // Free via Antigravity OAuth (AI Studio)
      thinking: "google/antigravity-gemini-3-pro-high",  // Thinking enabled, 1M context
      judge: "opencode/glm-4.7-free",                   // Free judge (avoid copilot)
    },
    maxIterations: 5,   // Standard tasks: moderate exploration
    timeoutMs: 60000,   // 1 minute
  },
  expensive: {
    name: "expensive",
    models: {
      // Use OpenAI gpt-4o when Copilot premium exhausted
      primary: "openai/gpt-4o",                         // OpenAI GPT-4o (high capability)
      thinking: "google/antigravity-gemini-3-pro-high", // Gemini for thinking (free)
      judge: "google/antigravity-gemini-3-flash",       // Free judge via Antigravity
    },
    maxIterations: 10,  // Complex tasks: extensive exploration
    timeoutMs: 180000,  // 3 minutes
  },
  maximum: {
    name: "maximum",
    models: {
      // Use OpenAI o1 for maximum capability when Copilot premium exhausted
      primary: "openai/o1",                             // OpenAI o1 (highest reasoning)
      thinking: "openai/gpt-4o",                        // GPT-4o for extended thinking
      judge: "openai/gpt-4o",                           // GPT-4o as judge
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
- Use sisyphus_task(subagent_type="explore") for codebase searches if needed
- Verify completion with available verification (tests, lsp_diagnostics)
- Report completion when done`,

  ulw: `**Ultrawork Mode**: Parallel agents + TDD verification
- ANNOUNCE: "ULTRAWORK MODE ENABLED!"
- **IMMEDIATELY** fire sisyphus_task agents in PARALLEL:
  \`\`\`
  sisyphus_task(subagent_type="explore", prompt="...", run_in_background=true, skills=[])
  sisyphus_task(subagent_type="librarian", prompt="...", run_in_background=true, skills=[])
  \`\`\`
- Use TDD workflow if tests available: RED -> GREEN -> REFACTOR
- Track ALL steps with TODO items
- Verify against success criteria before completion
- Use sisyphus_task(subagent_type="oracle") if stuck on architecture decisions`,

  ultrathink: `**Ultrathink Mode**: Deep reasoning before action
- Think through the problem thoroughly before any implementation
- Consider edge cases, failure modes, and architectural implications
- Plan the implementation sequence before starting
- Use sisyphus_task(subagent_type="oracle") for complex architecture questions
- Validate reasoning before each major step`,

  ralph: `**Ralph Loop Mode**: Persistent execution until completion
- Work continuously until the task is FULLY complete
- Use sisyphus_task agents to gather context: explore, librarian
- Output <promise>DONE</promise> ONLY when truly finished
- If stuck, use sisyphus_task(subagent_type="oracle") for consultation
- Maximum iterations: {{MAX_ITERATIONS}}`,

  "ulw+ralph": `**Ultrawork + Ralph Loop**: Parallel exploration with persistence
- ANNOUNCE: "ULTRAWORK MODE ENABLED!"
- **IMMEDIATELY** fire parallel sisyphus_task agents:
  \`\`\`
  sisyphus_task(subagent_type="explore", run_in_background=true, skills=[])
  sisyphus_task(subagent_type="librarian", run_in_background=true, skills=[])
  \`\`\`
- Use TDD workflow where possible
- Continue in Ralph loop until complete: <promise>DONE</promise>
- Do not stop at partial completion
- Maximum iterations: {{MAX_ITERATIONS}}`,

  "ultrathink+ulw": `**Ultrathink + Ultrawork**: Deep reasoning + parallel execution
- First, think deeply about the problem and plan
- Use sisyphus_task(subagent_type="oracle") for architecture review if needed
- Then, ANNOUNCE: "ULTRAWORK MODE ENABLED!"
- Fire sisyphus_task agents in PARALLEL (explore, librarian)
- Execute with parallel agents and TDD
- Verify reasoning at each major checkpoint`,

  "ultrathink+ralph": `**Ultrathink + Ralph Loop**: Deep reasoning with persistence
- Think through the problem thoroughly first
- Use sisyphus_task(subagent_type="oracle") for complex decisions
- Execute with persistence until complete
- Output <promise>DONE</promise> only when truly finished
- Revisit reasoning if stuck
- Maximum iterations: {{MAX_ITERATIONS}}`,

  triple: `**Full Orchestration**: Ultrathink + Ultrawork + Ralph Loop
This is the maximum capability configuration. Use ALL techniques:

1. **ULTRATHINK FIRST**:
   - Deep analysis of the problem
   - Use sisyphus_task(subagent_type="oracle") for architecture review
   - Plan the complete implementation
   - Identify all edge cases and failure modes

2. **ULTRAWORK EXECUTION**:
   - ANNOUNCE: "ULTRAWORK MODE ENABLED!"
   - **IMMEDIATELY** fire 5+ sisyphus_task agents in PARALLEL:
     \`\`\`
     sisyphus_task(subagent_type="explore", prompt="Find all X files", run_in_background=true, skills=[])
     sisyphus_task(subagent_type="explore", prompt="Find Y patterns", run_in_background=true, skills=[])
     sisyphus_task(subagent_type="librarian", prompt="Research Z library", run_in_background=true, skills=[])
     \`\`\`
   - Use TDD workflow (RED -> GREEN -> REFACTOR)
   - Track ALL steps with TODO items

3. **RALPH LOOP PERSISTENCE**:
   - Continue until FULLY complete
   - Output <promise>DONE</promise> ONLY when all criteria met
   - If stuck, use sisyphus_task(subagent_type="oracle") for consultation
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

## Subagent Delegation
{{SUBAGENT_DELEGATION_INFO}}

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
// Subagent Delegation Templates
// ============================================================================

/**
 * Template for subagent delegation info when auto-spawn is enabled.
 * Shown when complexity >= tier threshold (default: Tier 2+).
 * v3.8.0: Enhanced to explicitly instruct usage of curated agents via sisyphus_task
 */
export const SUBAGENT_DELEGATION_TEMPLATE = `
For Tier {{COMPLEXITY_TIER}} tasks, work is delegated to a subagent with an appropriate model.
- **Subagent Model**: {{SUBAGENT_MODEL}}
- **Subagent Agent**: {{SUBAGENT_AGENT}}
- **Intended Budget**: {{INTENDED_BUDGET}}

## CRITICAL: Use Curated Agents via sisyphus_task

You have access to specialized agents that provide expertise. **ALWAYS leverage them:**

### 🔍 explore - Codebase Discovery (FREE)
Use when: Finding files, locating implementations, understanding project structure
\`\`\`
sisyphus_task(
  description="Find auth implementation",
  prompt="Find all files related to authentication and authorization",
  subagent_type="explore",
  run_in_background=true,
  skills=[]
)
\`\`\`

### 📚 librarian - Documentation & Library Research (CHEAP)
Use when: Understanding libraries, finding usage examples, looking up API docs
\`\`\`
sisyphus_task(
  description="Research React Query patterns",
  prompt="Find official React Query documentation for useQuery caching strategies",
  subagent_type="librarian",
  run_in_background=true,
  skills=[]
)
\`\`\`

### 🧠 oracle - High-IQ Consulting (EXPENSIVE)
Use when: Complex architecture decisions, debugging hard problems (after 2+ failed attempts), code review
\`\`\`
sisyphus_task(
  description="Review authentication architecture",
  prompt="Review this authentication implementation for security issues and architectural concerns",
  subagent_type="oracle",
  run_in_background=false,
  skills=[]
)
\`\`\`

### 🎨 frontend-ui-ux-engineer - UI/UX Design (MODERATE)
Use when: Building user interfaces, implementing designs, accessibility concerns
\`\`\`
sisyphus_task(
  description="Implement responsive dashboard",
  prompt="Create a responsive dashboard component with modern UI patterns",
  subagent_type="frontend-ui-ux-engineer",
  run_in_background=false,
  skills=[]
)
\`\`\`

**Best Practice**: Fire explore/librarian in PARALLEL at the start to gather context while you plan.
**Rule**: ALWAYS prefer sisyphus_task over direct tool calls for search/research tasks.`

/**
 * Template when subagent delegation is disabled or not triggered.
 * v3.8.0: Enhanced to remind about curated agent availability
 */
export const NO_DELEGATION_TEMPLATE = `
Direct execution mode - no subagent delegation.
Work will be performed in this session with the current model.

## Available Curated Agents (via sisyphus_task)

Even in direct execution, you can leverage specialized agents:
- **explore**: Codebase discovery - use for multi-file searches (run_in_background=true)
- **librarian**: Documentation research - use for library/API questions (run_in_background=true)
- **oracle**: High-IQ consultation - use for complex architecture or debugging (run_in_background=false)

Fire explore/librarian in PARALLEL to gather context efficiently.`

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
// Parallel Agent Configuration (v3.8.0: Provider-Aware Scaling)
// ============================================================================

/**
 * Per-Provider Concurrent Agent Limits
 *
 * We throttle ourselves out of caution and respect for providers offering
 * free or cheap services. Each provider gets a maximum of 2 concurrent agents.
 *
 * With 4 providers (opencode, github-copilot, google, openai), max = 8 agents:
 * - opencode: explore (grok-code) + librarian (glm-4.7-free) = 2 agents
 * - github-copilot: oracle (gpt-5.2) + Sisyphus-Junior (claude-sonnet-4) = 2 agents
 * - google: frontend-ui-ux-engineer (gemini-3-pro) + document-writer (gemini-flash) = 2 agents
 * - openai: (reserved for direct API if configured) = 2 agents
 *
 * This conservative approach:
 * - Respects provider rate limits
 * - Avoids overwhelming free tier services
 * - Ensures fair usage across providers
 * - Scales based on task complexity
 */
export const AGENTS_PER_PROVIDER = 2
export const FREE_AGENTS_PER_PROVIDER = 1
export const PAID_AGENTS_PER_PROVIDER = 1

/**
 * Agent definitions with their provider mappings and cost tiers.
 * Used to intelligently select which agents to spawn based on available providers.
 */
export interface AgentProviderMapping {
  agentName: string
  defaultModel: string
  provider: string
  costTier: "free" | "cheap" | "moderate" | "expensive"
  /** Purpose categories for intelligent selection */
  purpose: ("exploration" | "research" | "architecture" | "ui" | "documentation" | "analysis")[]
  /** Complexity tier threshold - only spawn for tasks >= this tier */
  minTier: 1 | 2 | 3
}

/**
 * Complete mapping of agents to their providers and models.
 * Order matters - earlier agents are preferred when slots are limited.
 */
export const AGENT_PROVIDER_MAPPINGS: AgentProviderMapping[] = [
  // Tier 1+ agents (spawn for any complex task)
  {
    agentName: "explore",
    defaultModel: "opencode/grok-code",
    provider: "opencode",
    costTier: "free",
    purpose: ["exploration"],
    minTier: 1,
  },
  {
    agentName: "librarian",
    defaultModel: "opencode/glm-4.7-free",
    provider: "opencode",
    costTier: "free",
    purpose: ["research", "documentation"],
    minTier: 1,
  },
  // Tier 2+ agents (spawn for moderate/complex tasks)
  {
    agentName: "frontend-ui-ux-engineer",
    defaultModel: "google/gemini-3-pro-preview",
    provider: "google",
    costTier: "moderate",
    purpose: ["ui"],
    minTier: 2,
  },
  {
    agentName: "document-writer",
    defaultModel: "google/gemini-3-flash",
    provider: "google",
    costTier: "cheap",
    purpose: ["documentation"],
    minTier: 2,
  },
  // Tier 3 agents (spawn only for complex tasks)
  {
    agentName: "oracle",
    defaultModel: "github-copilot/claude-sonnet-4",
    provider: "github-copilot",
    costTier: "expensive",
    purpose: ["architecture", "analysis"],
    minTier: 3,
  },
  {
    agentName: "multimodal-looker",
    defaultModel: "google/gemini-3-flash",
    provider: "google",
    costTier: "cheap",
    purpose: ["analysis"],
    minTier: 3,
  },
]

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
  return {
    providerId,
    freeAgents: 0,
    paidAgents: AGENTS_PER_PROVIDER,
    totalAgents: AGENTS_PER_PROVIDER,
  }
}

/**
 * Calculate maximum concurrent agents based on configured providers
 */
export function calculateMaxConcurrentAgents(providerCount: number): number {
  return Math.max(AGENTS_PER_PROVIDER, providerCount * AGENTS_PER_PROVIDER)
}

/**
 * Select agents to spawn based on complexity tier, domain signals, and provider limits.
 * Enforces 2-per-provider limit while maximizing coverage.
 *
 * @param complexityTier Task complexity (1-3)
 * @param domainSignals Detected domain signals (e.g., "ui-heavy", "security-sensitive")
 * @param availableProviders List of available provider IDs
 * @returns Array of agent names to spawn
 */
export function selectAgentsForTask(
  complexityTier: 1 | 2 | 3,
  domainSignals: string[],
  availableProviders: string[] = ["opencode", "google", "github-copilot", "openai"]
): { agentName: string; model: string }[] {
  const providerUsage: Record<string, number> = {}
  const selectedAgents: { agentName: string; model: string }[] = []

  // Initialize provider usage
  for (const provider of availableProviders) {
    providerUsage[provider] = 0
  }

  // Domain-to-purpose mapping for intelligent selection
  const domainPurposeMap: Record<string, string[]> = {
    "ui-heavy": ["ui"],
    "backend-logic": ["architecture", "analysis"],
    "security-sensitive": ["architecture", "analysis"],
    "documentation": ["documentation", "research"],
    "research-analysis": ["research", "analysis"],
    "crypto-trading": ["architecture", "analysis"],
    "performance-critical": ["analysis"],
  }

  // Determine relevant purposes based on domain signals
  const relevantPurposes = new Set<string>(["exploration", "research"]) // Always include these
  for (const signal of domainSignals) {
    const purposes = domainPurposeMap[signal]
    if (purposes) {
      purposes.forEach(p => relevantPurposes.add(p))
    }
  }

  // Sort agents by priority: relevant purposes first, then by minTier
  const sortedAgents = [...AGENT_PROVIDER_MAPPINGS].sort((a, b) => {
    const aRelevant = a.purpose.some(p => relevantPurposes.has(p)) ? 0 : 1
    const bRelevant = b.purpose.some(p => relevantPurposes.has(p)) ? 0 : 1
    if (aRelevant !== bRelevant) return aRelevant - bRelevant
    return a.minTier - b.minTier
  })

  // Select agents respecting provider limits
  for (const agent of sortedAgents) {
    // Skip if agent requires higher tier than current task
    if (agent.minTier > complexityTier) continue

    // Skip if provider not available
    if (!availableProviders.includes(agent.provider)) continue

    // Skip if provider at limit (2 per provider)
    if ((providerUsage[agent.provider] ?? 0) >= AGENTS_PER_PROVIDER) continue

    // Select this agent
    selectedAgents.push({
      agentName: agent.agentName,
      model: agent.defaultModel,
    })
    providerUsage[agent.provider] = (providerUsage[agent.provider] ?? 0) + 1
  }

  return selectedAgents
}

/**
 * Get maximum agents to spawn based on complexity tier.
 * - Tier 1: 2 agents (explore + librarian)
 * - Tier 2: 4 agents (+ frontend + document-writer)
 * - Tier 3: 8 agents (all available across providers)
 */
export function getMaxAgentsForTier(tier: 1 | 2 | 3): number {
  switch (tier) {
    case 1: return 2
    case 2: return 4
    case 3: return 8
  }
}

/**
 * Legacy: Default agents to spawn (for backwards compatibility)
 * @deprecated Use selectAgentsForTask() instead
 */
export const DEFAULT_PARALLEL_AGENTS = ["explore", "librarian"] as const

/**
 * Legacy: Maximum concurrent parallel agents
 * @deprecated Use getMaxAgentsForTier() instead
 */
export const DEFAULT_MAX_PARALLEL_AGENTS = 2

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

// ============================================================================
// Model ID Validation (v3.8.0)
// ============================================================================

/**
 * Known model IDs for validation.
 * This helps catch typos like "qpt-4o-mini" before they reach OpenCode.
 */
export const KNOWN_MODELS = new Set([
  // GitHub Copilot provider (free via Copilot CLI)
  "github-copilot/gpt-4o-mini",
  "github-copilot/gpt-4o",
  "github-copilot/claude-sonnet-4",
  "github-copilot/claude-opus-4-5",
  "github-copilot/gemini-2.0-flash",

  // Google provider (free via Antigravity OAuth)
  "google/antigravity-gemini-3-flash",
  "google/antigravity-gemini-3-pro-high",
  "google/antigravity-gemini-3-pro-low",
  "google/gemini-2.5-flash",
  "google/gemini-2.5-pro",

  // OpenCode free models
  "opencode/glm-4.7-free",
  "opencode/grok-code",

  // Amazon Bedrock
  "amazon-bedrock/claude-sonnet-4",
  "amazon-bedrock/claude-opus-4-5",
  "amazon-bedrock/claude-haiku-3-5",

  // OpenAI direct (requires API key)
  "openai/gpt-4o",
  "openai/gpt-4o-mini",
  "openai/o1",
  "openai/o1-mini",
])

/**
 * Result of model ID validation
 */
export interface ModelValidationResult {
  valid: boolean
  suggestion?: string
  message?: string
}

/**
 * Validate a model ID against known models.
 * Returns suggestions if the model is unknown but similar to a known one.
 *
 * @example
 * validateModelId("qpt-4o-mini") // { valid: false, suggestion: "github-copilot/gpt-4o-mini" }
 * validateModelId("github-copilot/gpt-4o") // { valid: true }
 */
export function validateModelId(model: string): ModelValidationResult {
  // Check exact match
  if (KNOWN_MODELS.has(model)) {
    return { valid: true }
  }

  // Try to find similar model
  const normalizedInput = model.toLowerCase().replace(/[^a-z0-9]/gi, "")
  let bestMatch: string | undefined
  let bestScore = 0

  for (const known of KNOWN_MODELS) {
    const normalizedKnown = known.toLowerCase().replace(/[^a-z0-9]/gi, "")

    // Check for common typos
    const score = calculateSimilarity(normalizedInput, normalizedKnown)
    if (score > bestScore && score > 0.6) {
      bestScore = score
      bestMatch = known
    }

    // Also check just the model part (after the /)
    const modelPart = model.split("/")[1] || model
    const knownModelPart = known.split("/")[1]
    if (knownModelPart && modelPart) {
      const partScore = calculateSimilarity(
        modelPart.toLowerCase().replace(/[^a-z0-9]/gi, ""),
        knownModelPart.toLowerCase().replace(/[^a-z0-9]/gi, "")
      )
      if (partScore > bestScore && partScore > 0.6) {
        bestScore = partScore
        bestMatch = known
      }
    }
  }

  if (bestMatch) {
    return {
      valid: false,
      suggestion: bestMatch,
      message: `Unknown model "${model}". Did you mean "${bestMatch}"?`,
    }
  }

  return {
    valid: false,
    message: `Unknown model "${model}". Check available models in your provider configuration.`,
  }
}

/**
 * Calculate similarity score between two strings (0-1)
 * Uses simple Levenshtein-based similarity
 */
function calculateSimilarity(a: string, b: string): number {
  if (a === b) return 1
  if (a.length === 0 || b.length === 0) return 0

  // Check if one contains the other
  if (a.includes(b) || b.includes(a)) {
    return 0.8
  }

  // Simple character matching
  const aChars = new Set(a.split(""))
  const bChars = new Set(b.split(""))
  const intersection = new Set([...aChars].filter(x => bChars.has(x)))
  const union = new Set([...aChars, ...bChars])

  return intersection.size / union.size
}
