#!/usr/bin/env bun
import { Command } from "commander"
import { install } from "./install"
import { run } from "./run"
import { getLocalVersion } from "./get-local-version"
import { doctor } from "./doctor"
import { runWizard } from "./wizard"
import { budget } from "./budget"
import type { InstallArgs } from "./types"
import type { RunOptions } from "./run"
import type { GetLocalVersionOptions } from "./get-local-version/types"
import type { DoctorOptions } from "./doctor"
import type { WizardOptions } from "./wizard"
import type { BudgetCommandOptions } from "./budget/types"
import packageJson from "../../package.json" with { type: "json" }

const VERSION = packageJson.version

const program = new Command()

program
  .name("oh-my-opencode")
  .description("The ultimate OpenCode plugin - multi-model orchestration, LSP tools, and more")
  .version(VERSION, "-v, --version", "Show version number")

program
  .command("install")
  .description("Install and configure oh-my-opencode with interactive setup")
  .option("--no-tui", "Run in non-interactive mode (requires all options)")
  .option("--claude <value>", "Claude subscription: no, yes, max20")
  .option("--openai <value>", "OpenAI/ChatGPT subscription: no, yes (default: no)")
  .option("--gemini <value>", "Gemini integration: no, yes")
  .option("--copilot <value>", "GitHub Copilot subscription: no, yes")
  .option("--opencode-zen <value>", "OpenCode Zen access: no, yes (default: no)")
  .option("--zai-coding-plan <value>", "Z.ai Coding Plan subscription: no, yes (default: no)")
  .option("--skip-auth", "Skip authentication setup hints")
  .addHelpText("after", `
Examples:
  $ bunx oh-my-opencode install
  $ bunx oh-my-opencode install --no-tui --claude=max20 --openai=yes --gemini=yes --copilot=no
  $ bunx oh-my-opencode install --no-tui --claude=no --gemini=no --copilot=yes --opencode-zen=yes

Model Providers (Priority: Native > Copilot > OpenCode Zen > Z.ai):
  Claude        Native anthropic/ models (Opus, Sonnet, Haiku)
  OpenAI        Native openai/ models (GPT-5.2 for Oracle)
  Gemini        Native google/ models (Gemini 3 Pro, Flash)
  Copilot       github-copilot/ models (fallback)
  OpenCode Zen  opencode/ models (opencode/claude-opus-4-5, etc.)
  Z.ai          zai-coding-plan/glm-4.7 (Librarian priority)
`)
  .action(async (options) => {
    const args: InstallArgs = {
      tui: options.tui !== false,
      claude: options.claude,
      openai: options.openai,
      gemini: options.gemini,
      copilot: options.copilot,
      opencodeZen: options.opencodeZen,
      zaiCodingPlan: options.zaiCodingPlan,
      skipAuth: options.skipAuth ?? false,
    }
    const exitCode = await install(args)
    process.exit(exitCode)
  })

program
  .command("run <message>")
  .description("Run opencode with todo/background task completion enforcement")
  .option("-a, --agent <name>", "Agent to use (default: Sisyphus)")
  .option("-d, --directory <path>", "Working directory")
  .option("-t, --timeout <ms>", "Timeout in milliseconds (default: 30 minutes)", parseInt)
  .addHelpText("after", `
Examples:
  $ bunx oh-my-opencode run "Fix the bug in index.ts"
  $ bunx oh-my-opencode run --agent Sisyphus "Implement feature X"
  $ bunx oh-my-opencode run --timeout 3600000 "Large refactoring task"

Unlike 'opencode run', this command waits until:
  - All todos are completed or cancelled
  - All child sessions (background tasks) are idle
`)
  .action(async (message: string, options) => {
    const runOptions: RunOptions = {
      message,
      agent: options.agent,
      directory: options.directory,
      timeout: options.timeout,
    }
    const exitCode = await run(runOptions)
    process.exit(exitCode)
  })

program
  .command("get-local-version")
  .description("Show current installed version and check for updates")
  .option("-d, --directory <path>", "Working directory to check config from")
  .option("--json", "Output in JSON format for scripting")
  .addHelpText("after", `
Examples:
  $ bunx oh-my-opencode get-local-version
  $ bunx oh-my-opencode get-local-version --json
  $ bunx oh-my-opencode get-local-version --directory /path/to/project

This command shows:
  - Current installed version
  - Latest available version on npm
  - Whether you're up to date
  - Special modes (local dev, pinned version)
`)
  .action(async (options) => {
    const versionOptions: GetLocalVersionOptions = {
      directory: options.directory,
      json: options.json ?? false,
    }
    const exitCode = await getLocalVersion(versionOptions)
    process.exit(exitCode)
  })

program
  .command("doctor")
  .description("Check oh-my-opencode installation health and diagnose issues")
  .option("--verbose", "Show detailed diagnostic information")
  .option("--json", "Output results in JSON format")
  .option("--category <category>", "Run only specific category")
  .addHelpText("after", `
Examples:
  $ bunx oh-my-opencode doctor
  $ bunx oh-my-opencode doctor --verbose
  $ bunx oh-my-opencode doctor --json
  $ bunx oh-my-opencode doctor --category authentication

Categories:
  installation     Check OpenCode and plugin installation
  configuration    Validate configuration files
  authentication   Check auth provider status
  dependencies     Check external dependencies
  tools            Check LSP and MCP servers
  updates          Check for version updates
`)
  .action(async (options) => {
    const doctorOptions: DoctorOptions = {
      verbose: options.verbose ?? false,
      json: options.json ?? false,
      category: options.category,
    }
    const exitCode = await doctor(doctorOptions)
    process.exit(exitCode)
  })

program
  .command("wizard")
  .description("Interactive orchestration stack wizard")
  .option("-y, --yes", "Skip confirmation prompts")
  .option("--json", "Output configuration as JSON")
  .addHelpText("after", `
Examples:
  $ bunx oh-my-opencode wizard
  $ bunx oh-my-opencode wizard --yes
  $ bunx oh-my-opencode wizard --json

The wizard helps you configure:
  - Provider subscriptions (Claude, GPT, Gemini, Copilot, Zen)
  - Plan tiers and budgets
  - Orchestration presets (balanced, claude-heavy, budget-conscious, etc.)
  - Budget-aware auto-orchestration
`)
  .action(async (options) => {
    const wizardOptions: WizardOptions = {
      yes: options.yes ?? false,
      format: options.json ? "json" : "text",
    }
    const exitCode = await runWizard(wizardOptions)
    process.exit(exitCode)
  })

program
  .command("budget")
  .description("View budget status and manage tier overrides")
  .option("--json", "Output in JSON format")
  .option("--provider <name>", "Filter by provider")
  .option("--force-tier <tier>", "Force tier (premium|standard|budget|economy)")
  .option("--lock-tier", "Lock current tier")
  .option("--unlock-tier", "Unlock tier")
  .option("--reset-learning [provider]", "Reset adaptive learning")
  .option("--duration <minutes>", "Duration for force/lock in minutes", parseInt)
  .addHelpText("after", `
Examples:
  $ bunx oh-my-opencode budget
  $ bunx oh-my-opencode budget --json
  $ bunx oh-my-opencode budget --provider anthropic

Override Commands:
  $ bunx oh-my-opencode budget --force-tier premium
  $ bunx oh-my-opencode budget --force-tier budget --duration 60
  $ bunx oh-my-opencode budget --lock-tier
  $ bunx oh-my-opencode budget --unlock-tier
  $ bunx oh-my-opencode budget --reset-learning
  $ bunx oh-my-opencode budget --reset-learning anthropic

Model Tiers:
  premium   High-capability models (Claude Opus, GPT-4.5)
  standard  Balanced models (Claude Sonnet, GPT-4)
  budget    Cost-effective models (Claude Haiku, GPT-4-mini)
  economy   Lowest cost models (flash variants)
`)
  .action(async (options) => {
    const budgetOptions: BudgetCommandOptions = {
      json: options.json ?? false,
      provider: options.provider,
      forceTier: options.forceTier,
      lockTier: options.lockTier ?? false,
      unlockTier: options.unlockTier ?? false,
      resetLearning: options.resetLearning,
      duration: options.duration,
    }
    const exitCode = await budget(budgetOptions)
    process.exit(exitCode)
  })

program
  .command("version")
  .description("Show version information")
  .action(() => {
    console.log(`oh-my-opencode v${VERSION}`)
  })

program.parse()
