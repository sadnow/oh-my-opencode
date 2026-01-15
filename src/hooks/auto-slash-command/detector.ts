import {
  SLASH_COMMAND_PATTERN,
  EXCLUDED_COMMANDS,
} from "./constants"
import type { ParsedSlashCommand } from "./types"
import { log } from "../../shared/logger"

const CODE_BLOCK_PATTERN = /```[\s\S]*?```/g

export function removeCodeBlocks(text: string): string {
  return text.replace(CODE_BLOCK_PATTERN, "")
}

export function parseSlashCommand(text: string): ParsedSlashCommand | null {
  const trimmed = text.trim()

  if (!trimmed.startsWith("/")) {
    return null
  }

  const match = trimmed.match(SLASH_COMMAND_PATTERN)
  if (!match) {
    return null
  }

  const [raw, command, args] = match
  return {
    command: command.toLowerCase(),
    args: args.trim(),
    raw,
  }
}

export function isExcludedCommand(command: string): boolean {
  return EXCLUDED_COMMANDS.has(command.toLowerCase())
}

export function detectSlashCommand(text: string): ParsedSlashCommand | null {
  const textWithoutCodeBlocks = removeCodeBlocks(text)
  const trimmed = textWithoutCodeBlocks.trim()

  if (!trimmed.startsWith("/")) {
    return null
  }

  const parsed = parseSlashCommand(trimmed)

  if (!parsed) {
    return null
  }

  // Debug logging to trace /auto handling
  const isExcluded = isExcludedCommand(parsed.command)
  log("[auto-slash-command] detectSlashCommand", {
    command: parsed.command,
    isExcluded,
    excludedCommands: [...EXCLUDED_COMMANDS],
  })

  if (isExcluded) {
    log("[auto-slash-command] Command excluded, returning null", { command: parsed.command })
    return null
  }

  return parsed
}

export function extractPromptText(
  parts: Array<{ type: string; text?: string }>
): string {
  return parts
    .filter((p) => p.type === "text")
    .map((p) => p.text || "")
    .join(" ")
}
