import { z } from "zod"
import { AnyMcpNameSchema, McpNameSchema } from "../mcp/types"

const PermissionValue = z.enum(["ask", "allow", "deny"])

const BashPermission = z.union([
  PermissionValue,
  z.record(z.string(), PermissionValue),
])

const AgentPermissionSchema = z.object({
  edit: PermissionValue.optional(),
  bash: BashPermission.optional(),
  webfetch: PermissionValue.optional(),
  doom_loop: PermissionValue.optional(),
  external_directory: PermissionValue.optional(),
})

export const BuiltinAgentNameSchema = z.enum([
  "Sisyphus",
  "oracle",
  "librarian",
  "explore",
  "frontend-ui-ux-engineer",
  "document-writer",
  "multimodal-looker",
  "Metis (Plan Consultant)",
  "Momus (Plan Reviewer)",
  "orchestrator-sisyphus",
])

export const BuiltinSkillNameSchema = z.enum([
  "playwright",
  "frontend-ui-ux",
  "git-master",
  "auto",
  "autocode",  // v3.8.0: /autocode command (replaces /auto)
])

export const OverridableAgentNameSchema = z.enum([
  "build",
  "plan",
  "Sisyphus",
  "Sisyphus-Junior",
  "OpenCode-Builder",
  "Prometheus (Planner)",
  "Metis (Plan Consultant)",
  "Momus (Plan Reviewer)",
  "oracle",
  "librarian",
  "explore",
  "frontend-ui-ux-engineer",
  "document-writer",
  "multimodal-looker",
  "orchestrator-sisyphus",
])

export const AgentNameSchema = BuiltinAgentNameSchema

export const HookNameSchema = z.enum([
  "todo-continuation-enforcer",
  "context-window-monitor",
  "session-recovery",
  "session-notification",
  "comment-checker",
  "grep-output-truncator",
  "tool-output-truncator",
  "directory-agents-injector",
  "directory-readme-injector",
  "empty-task-response-detector",
  "think-mode",
  "anthropic-context-window-limit-recovery",
  "rules-injector",
  "background-notification",
  "auto-update-checker",
  "startup-toast",
  "keyword-detector",
  "agent-usage-reminder",
  "non-interactive-env",
  "interactive-bash-session",
  "empty-message-sanitizer",
  "thinking-block-validator",
  "ralph-loop",
  "preemptive-compaction",
  "compaction-context-injector",
  "claude-code-hooks",
  "auto-slash-command",
  "edit-error-recovery",
  "sisyphus-task-retry",
  "prometheus-md-only",
  "start-work",
  "sisyphus-orchestrator",
  "auto-router",
  "meta-development-guard",
])

export const BuiltinCommandNameSchema = z.enum([
  "init-deep",
  "start-work",
])

export const AgentOverrideConfigSchema = z.object({
  /** @deprecated Use `category` instead. Model is inherited from category defaults. */
  model: z.string().optional(),
  variant: z.string().optional(),
  /** Category name to inherit model and other settings from CategoryConfig */
  category: z.string().optional(),
  /** Skill names to inject into agent prompt */
  skills: z.array(z.string()).optional(),
  temperature: z.number().min(0).max(2).optional(),
  top_p: z.number().min(0).max(1).optional(),
  prompt: z.string().optional(),
  prompt_append: z.string().optional(),
  tools: z.record(z.string(), z.boolean()).optional(),
  disable: z.boolean().optional(),
  description: z.string().optional(),
  mode: z.enum(["subagent", "primary", "all"]).optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  permission: AgentPermissionSchema.optional(),
})

export const AgentOverridesSchema = z.object({
  build: AgentOverrideConfigSchema.optional(),
  plan: AgentOverrideConfigSchema.optional(),
  Sisyphus: AgentOverrideConfigSchema.optional(),
  "Sisyphus-Junior": AgentOverrideConfigSchema.optional(),
  "OpenCode-Builder": AgentOverrideConfigSchema.optional(),
  "Prometheus (Planner)": AgentOverrideConfigSchema.optional(),
  "Metis (Plan Consultant)": AgentOverrideConfigSchema.optional(),
  "Momus (Plan Reviewer)": AgentOverrideConfigSchema.optional(),
  oracle: AgentOverrideConfigSchema.optional(),
  librarian: AgentOverrideConfigSchema.optional(),
  explore: AgentOverrideConfigSchema.optional(),
  "frontend-ui-ux-engineer": AgentOverrideConfigSchema.optional(),
  "document-writer": AgentOverrideConfigSchema.optional(),
  "multimodal-looker": AgentOverrideConfigSchema.optional(),
  "orchestrator-sisyphus": AgentOverrideConfigSchema.optional(),
})

export const ClaudeCodeConfigSchema = z.object({
  mcp: z.boolean().optional(),
  commands: z.boolean().optional(),
  skills: z.boolean().optional(),
  agents: z.boolean().optional(),
  hooks: z.boolean().optional(),
  plugins: z.boolean().optional(),
  plugins_override: z.record(z.string(), z.boolean()).optional(),
})

export const SisyphusAgentConfigSchema = z.object({
  disabled: z.boolean().optional(),
  default_builder_enabled: z.boolean().optional(),
  planner_enabled: z.boolean().optional(),
  replace_plan: z.boolean().optional(),
})

export const CategoryConfigSchema = z.object({
  model: z.string(),
  variant: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  top_p: z.number().min(0).max(1).optional(),
  maxTokens: z.number().optional(),
  thinking: z.object({
    type: z.enum(["enabled", "disabled"]),
    budgetTokens: z.number().optional(),
  }).optional(),
  reasoningEffort: z.enum(["low", "medium", "high"]).optional(),
  textVerbosity: z.enum(["low", "medium", "high"]).optional(),
  tools: z.record(z.string(), z.boolean()).optional(),
  prompt_append: z.string().optional(),
})

export const BuiltinCategoryNameSchema = z.enum([
  "visual-engineering",
  "ultrabrain",
  "artistry",
  "quick",
  "most-capable",
  "writing",
  "general",
])

export const CategoriesConfigSchema = z.record(z.string(), CategoryConfigSchema)

export const CommentCheckerConfigSchema = z.object({
  /** Custom prompt to replace the default warning message. Use {{comments}} placeholder for detected comments XML. */
  custom_prompt: z.string().optional(),
})

export const DynamicContextPruningConfigSchema = z.object({
  /** Enable dynamic context pruning (default: false) */
  enabled: z.boolean().default(false),
  /** Notification level: off, minimal, or detailed (default: detailed) */
  notification: z.enum(["off", "minimal", "detailed"]).default("detailed"),
  /** Turn protection - prevent pruning recent tool outputs */
  turn_protection: z.object({
    enabled: z.boolean().default(true),
    turns: z.number().min(1).max(10).default(3),
  }).optional(),
  /** Tools that should never be pruned */
  protected_tools: z.array(z.string()).default([
    "task", "todowrite", "todoread",
    "lsp_rename",
    "session_read", "session_write", "session_search",
  ]),
  /** Pruning strategies configuration */
  strategies: z.object({
    /** Remove duplicate tool calls (same tool + same args) */
    deduplication: z.object({
      enabled: z.boolean().default(true),
    }).optional(),
    /** Prune write inputs when file subsequently read */
    supersede_writes: z.object({
      enabled: z.boolean().default(true),
      /** Aggressive mode: prune any write if ANY subsequent read */
      aggressive: z.boolean().default(false),
    }).optional(),
    /** Prune errored tool inputs after N turns */
    purge_errors: z.object({
      enabled: z.boolean().default(true),
      turns: z.number().min(1).max(20).default(5),
    }).optional(),
  }).optional(),
})

export const ExperimentalConfigSchema = z.object({
  aggressive_truncation: z.boolean().optional(),
  auto_resume: z.boolean().optional(),
  /** Enable preemptive compaction at threshold (default: true since v2.9.0) */
  preemptive_compaction: z.boolean().optional(),
  /** Threshold percentage to trigger preemptive compaction (default: 0.80) */
  preemptive_compaction_threshold: z.number().min(0.5).max(0.95).optional(),
  /** Truncate all tool outputs, not just whitelisted tools (default: false). Tool output truncator is enabled by default - disable via disabled_hooks. */
  truncate_all_tool_outputs: z.boolean().optional(),
  /** Dynamic context pruning configuration */
  dynamic_context_pruning: DynamicContextPruningConfigSchema.optional(),
  /** Enable DCP (Dynamic Context Pruning) for compaction - runs first when token limit exceeded (default: false) */
  dcp_for_compaction: z.boolean().optional(),
})

export const SkillSourceSchema = z.union([
  z.string(),
  z.object({
    path: z.string(),
    recursive: z.boolean().optional(),
    glob: z.string().optional(),
  }),
])

export const SkillDefinitionSchema = z.object({
  description: z.string().optional(),
  template: z.string().optional(),
  from: z.string().optional(),
  model: z.string().optional(),
  agent: z.string().optional(),
  subtask: z.boolean().optional(),
  "argument-hint": z.string().optional(),
  license: z.string().optional(),
  compatibility: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  "allowed-tools": z.array(z.string()).optional(),
  disable: z.boolean().optional(),
})

export const SkillEntrySchema = z.union([
  z.boolean(),
  SkillDefinitionSchema,
])

export const SkillsConfigSchema = z.union([
  z.array(z.string()),
  z.record(z.string(), SkillEntrySchema).and(z.object({
    sources: z.array(SkillSourceSchema).optional(),
    enable: z.array(z.string()).optional(),
    disable: z.array(z.string()).optional(),
  }).partial()),
])

export const CompletionJudgeConfigSchema = z.object({
  /** Enable completion criteria judge (default: true - uses fallback models if primary fails) */
  enabled: z.boolean().default(true),
  /** Minimum confidence required to pass (default: 0.8) */
  min_confidence: z.number().min(0).max(1).default(0.8),
  /** Primary model to use for judge (default: github-copilot/gpt-4o-mini - free via Copilot) */
  model: z.string().default("github-copilot/gpt-4o-mini"),
  /** Fallback models to try if primary fails (in order) */
  fallback_models: z.array(z.string()).default([
    "google/antigravity-gemini-3-flash",  // Free via Antigravity OAuth (AI Studio)
    "openai/gpt-4o-mini",
    "opencode/glm-4.7-free",
  ]),
  /** Timeout in milliseconds (default: 30000) */
  timeout_ms: z.number().min(1000).max(120000).default(30000),
})

export const RalphLoopConfigSchema = z.object({
  /** Enable ralph loop functionality (default: false - opt-in feature) */
  enabled: z.boolean().default(false),
  /** Default max iterations if not specified in command (default: 100) */
  default_max_iterations: z.number().min(1).max(1000).default(100),
  /** Custom state file directory relative to project root (default: .opencode/) */
  state_dir: z.string().optional(),
  /** Completion criteria judge configuration */
  completion_judge: CompletionJudgeConfigSchema.optional(),
})

export const BackgroundTaskConfigSchema = z.object({
  defaultConcurrency: z.number().min(1).optional(),
  providerConcurrency: z.record(z.string(), z.number().min(1)).optional(),
  modelConcurrency: z.record(z.string(), z.number().min(1)).optional(),
})

export const NotificationConfigSchema = z.object({
  /** Force enable session-notification even if external notification plugins are detected (default: false) */
  force_enable: z.boolean().optional(),
})

export const GitMasterConfigSchema = z.object({
  /** Add "Ultraworked with Sisyphus" footer to commit messages (default: true) */
  commit_footer: z.boolean().default(true),
  /** Add "Co-authored-by: Sisyphus" trailer to commit messages (default: true) */
  include_co_authored_by: z.boolean().default(true),
})

export const BudgetTierSchema = z.enum(["cheap", "moderate", "expensive", "maximum"])

export const TechniqueComboSchema = z.enum([
  "direct",
  "ulw",
  "ultrathink",
  "ralph",
  "ulw+ralph",
  "ultrathink+ulw",
  "ultrathink+ralph",
  "triple",
])

export const ProjectTypeSchema = z.enum([
  "game",
  "web-app",
  "cli",
  "api-server",
  "bot",
  "indexer-crawler",
  "data-pipeline",
  "static-site",
  "library",
  "monorepo",
  "unknown",
])

/** Parallel agent configuration schema */
export const ParallelAgentConfigSchema = z.object({
  /** Enable parallel agent spawning (default: true) */
  enabled: z.boolean().default(true),
  /** Maximum concurrent parallel agents (default: 2, max: 3) */
  max_concurrent: z.number().min(1).max(3).default(2),
  /** Agents to spawn for Tier 3 tasks (default: ["explore", "librarian"]) */
  agents_for_tier3: z.array(z.string()).default(["explore", "librarian"]),
})

export const MetaDevelopmentConfigSchema = z.object({
  /** Enable meta-development mode - allows modifying plugin source code (default: false) */
  enabled: z.boolean().default(false),
  /** Allow self-modification of critical plugin paths without confirmation (default: false) */
  allow_self_modification: z.boolean().default(false),
  /** Enable audit logging for all config and code changes (default: true) */
  audit_logging: z.boolean().default(true),
  /** Protected paths that require extra confirmation when editing */
  protected_paths: z.array(z.string()).default([
    "src/hooks/auto-router/",
    "src/hooks/ralph-loop/",
    "src/features/auto-router/",
    "src/index.ts",
    "package.json",
  ]),
})

/** Subagent auto-spawn configuration schema (v3.7.0) */
export const SubagentSpawnConfigSchema = z.object({
  /** Enable automatic subagent spawning for complex tasks (default: true) */
  enabled: z.boolean().default(true),
  /** Minimum complexity tier to trigger subagent spawn (default: 2) */
  tier_threshold: z.number().min(1).max(3).default(2),
  /** Verify subagent used the intended model (default: true) */
  verify_models: z.boolean().default(true),
  /** Also spawn subagent for ralph/triple techniques regardless of tier (default: true) */
  spawn_for_ralph: z.boolean().default(true),
})

export const AutoRouterConfigSchema = z.object({
  /** Enable auto-router functionality (default: true) */
  enabled: z.boolean().default(true),
  /** Default budget tier to start with (default: "cheap") */
  default_budget: BudgetTierSchema.default("cheap"),
  /** Enable automatic budget escalation on failures (default: true) */
  auto_escalate: z.boolean().default(true),
  /** Maximum number of escalations allowed (default: 3) */
  max_escalations: z.number().min(0).max(10).default(3),
  /** Enable LLM-as-judge quality evaluation (default: true) */
  enable_judge: z.boolean().default(true),
  /** Quality threshold for passing (0.0-1.0, default: 0.7) */
  quality_threshold: z.number().min(0).max(1).default(0.7),
  /** Override automatic project type detection */
  project_type_override: ProjectTypeSchema.optional(),
  /** Override automatic technique selection */
  technique_override: TechniqueComboSchema.optional(),
  /** Override automatic budget selection */
  budget_override: BudgetTierSchema.optional(),
  /** Enable full autonomy mode - run without interruption (default: true) */
  full_autonomy: z.boolean().default(true),
  /** Enable wizard mode for interactive configuration (default: false) */
  wizard_mode: z.boolean().default(false),
  /** Show detailed classification, routing, and model selection information (default: false) */
  verbose: z.boolean().default(false),
  /** Parallel agent spawning configuration (v3.5.0) */
  parallel_agents: ParallelAgentConfigSchema.optional(),
  /** Subagent auto-spawn configuration for complex tasks (v3.7.0) */
  auto_spawn_subagents: SubagentSpawnConfigSchema.optional(),
})

export const OhMyOpenCodeConfigSchema = z.object({
  $schema: z.string().optional(),
  disabled_mcps: z.array(AnyMcpNameSchema).optional(),
  disabled_agents: z.array(BuiltinAgentNameSchema).optional(),
  disabled_skills: z.array(BuiltinSkillNameSchema).optional(),
  disabled_hooks: z.array(HookNameSchema).optional(),
  disabled_commands: z.array(BuiltinCommandNameSchema).optional(),
  agents: AgentOverridesSchema.optional(),
  categories: CategoriesConfigSchema.optional(),
  claude_code: ClaudeCodeConfigSchema.optional(),
  sisyphus_agent: SisyphusAgentConfigSchema.optional(),
  comment_checker: CommentCheckerConfigSchema.optional(),
  experimental: ExperimentalConfigSchema.optional(),
  auto_update: z.boolean().optional(),
  skills: SkillsConfigSchema.optional(),
  ralph_loop: RalphLoopConfigSchema.optional(),
  background_task: BackgroundTaskConfigSchema.optional(),
  notification: NotificationConfigSchema.optional(),
  git_master: GitMasterConfigSchema.optional(),
  auto_router: AutoRouterConfigSchema.optional(),
  /** Meta-development guardrails for self-modification (default: disabled) */
  meta_development: MetaDevelopmentConfigSchema.optional(),
})

export type OhMyOpenCodeConfig = z.infer<typeof OhMyOpenCodeConfigSchema>
export type AgentOverrideConfig = z.infer<typeof AgentOverrideConfigSchema>
export type AgentOverrides = z.infer<typeof AgentOverridesSchema>
export type BackgroundTaskConfig = z.infer<typeof BackgroundTaskConfigSchema>
export type AgentName = z.infer<typeof AgentNameSchema>
export type HookName = z.infer<typeof HookNameSchema>
export type BuiltinCommandName = z.infer<typeof BuiltinCommandNameSchema>
export type BuiltinSkillName = z.infer<typeof BuiltinSkillNameSchema>
export type SisyphusAgentConfig = z.infer<typeof SisyphusAgentConfigSchema>
export type CommentCheckerConfig = z.infer<typeof CommentCheckerConfigSchema>
export type ExperimentalConfig = z.infer<typeof ExperimentalConfigSchema>
export type DynamicContextPruningConfig = z.infer<typeof DynamicContextPruningConfigSchema>
export type SkillsConfig = z.infer<typeof SkillsConfigSchema>
export type SkillDefinition = z.infer<typeof SkillDefinitionSchema>
export type RalphLoopConfig = z.infer<typeof RalphLoopConfigSchema>
export type CompletionJudgeConfig = z.infer<typeof CompletionJudgeConfigSchema>
export type NotificationConfig = z.infer<typeof NotificationConfigSchema>
export type CategoryConfig = z.infer<typeof CategoryConfigSchema>
export type CategoriesConfig = z.infer<typeof CategoriesConfigSchema>
export type BuiltinCategoryName = z.infer<typeof BuiltinCategoryNameSchema>
export type GitMasterConfig = z.infer<typeof GitMasterConfigSchema>
export type AutoRouterConfig = z.infer<typeof AutoRouterConfigSchema>
export type SubagentSpawnConfig = z.infer<typeof SubagentSpawnConfigSchema>
export type MetaDevelopmentConfig = z.infer<typeof MetaDevelopmentConfigSchema>
export type BudgetTier = z.infer<typeof BudgetTierSchema>
export type TechniqueCombo = z.infer<typeof TechniqueComboSchema>
export type ProjectType = z.infer<typeof ProjectTypeSchema>

// v3.8.0: Alias for rename oh-my-opencode → oh_my_autocode
export const OhMyAutoCodeConfigSchema = OhMyOpenCodeConfigSchema
export type OhMyAutoCodeConfig = OhMyOpenCodeConfig

export { AnyMcpNameSchema, type AnyMcpName, McpNameSchema, type McpName } from "../mcp/types"
