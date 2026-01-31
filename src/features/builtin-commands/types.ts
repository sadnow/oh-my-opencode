import type { CommandDefinition } from "../claude-code-command-loader"

export type BuiltinCommandName = "init-deep" | "ralph-loop" | "cancel-ralph" | "ulw-loop" | "refactor" | "start-work" | "oib-webui" | "oib-webui-stop" | "oib-status" | "oib-tier" | "oib-max" | "oib-eco"

export interface BuiltinCommandConfig {
  disabled_commands?: BuiltinCommandName[]
}

export type BuiltinCommands = Record<string, CommandDefinition>
