import * as fs from "fs";
import * as path from "path";
import { OhMyOpenCodeConfigSchema, type OhMyOpenCodeConfig, type HookName } from "./config";
import {
  log,
  deepMerge,
  getUserConfigDir,
  addConfigLoadError,
  parseJsonc,
  detectConfigFile,
  migrateConfigFile,
} from "./shared";

/**
 * Hooks that are disabled by default.
 * - anthropic-context-window-limit-recovery: Disabled because direct Anthropic API access
 *   is blocked for OpenCode as of Jan 2026. Users can still enable it manually if using
 *   Anthropic via proxy providers (GitHub Copilot, Amazon Bedrock).
 */
const DEFAULT_DISABLED_HOOKS: HookName[] = [
  "anthropic-context-window-limit-recovery",
];

export function loadConfigFromPath(
  configPath: string,
  ctx: unknown
): OhMyOpenCodeConfig | null {
  try {
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, "utf-8");
      const rawConfig = parseJsonc<Record<string, unknown>>(content);

      migrateConfigFile(configPath, rawConfig);

      const result = OhMyOpenCodeConfigSchema.safeParse(rawConfig);

      if (!result.success) {
        const errorMsg = result.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join(", ");
        log(`Config validation error in ${configPath}:`, result.error.issues);
        addConfigLoadError({
          path: configPath,
          error: `Validation error: ${errorMsg}`,
        });
        return null;
      }

      log(`Config loaded from ${configPath}`, { agents: result.data.agents });
      return result.data;
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    log(`Error loading config from ${configPath}:`, err);
    addConfigLoadError({ path: configPath, error: errorMsg });
  }
  return null;
}

export function mergeConfigs(
  base: OhMyOpenCodeConfig,
  override: OhMyOpenCodeConfig
): OhMyOpenCodeConfig {
  return {
    ...base,
    ...override,
    agents: deepMerge(base.agents, override.agents),
    categories: deepMerge(base.categories, override.categories),
    disabled_agents: [
      ...new Set([
        ...(base.disabled_agents ?? []),
        ...(override.disabled_agents ?? []),
      ]),
    ],
    disabled_mcps: [
      ...new Set([
        ...(base.disabled_mcps ?? []),
        ...(override.disabled_mcps ?? []),
      ]),
    ],
    disabled_hooks: [
      ...new Set([
        ...(base.disabled_hooks ?? []),
        ...(override.disabled_hooks ?? []),
      ]),
    ],
    disabled_commands: [
      ...new Set([
        ...(base.disabled_commands ?? []),
        ...(override.disabled_commands ?? []),
      ]),
    ],
    disabled_skills: [
      ...new Set([
        ...(base.disabled_skills ?? []),
        ...(override.disabled_skills ?? []),
      ]),
    ],
    claude_code: deepMerge(base.claude_code, override.claude_code),
  };
}

export function loadPluginConfig(
  directory: string,
  ctx: unknown
): OhMyOpenCodeConfig {
  // User-level config path (OS-specific) - prefer .jsonc over .json
  const userBasePath = path.join(
    getUserConfigDir(),
    "opencode",
    "oh-my-opencode"
  );
  const userDetected = detectConfigFile(userBasePath);
  const userConfigPath =
    userDetected.format !== "none"
      ? userDetected.path
      : userBasePath + ".json";

  // Project-level config path - prefer .jsonc over .json
  const projectBasePath = path.join(directory, ".opencode", "oh-my-opencode");
  const projectDetected = detectConfigFile(projectBasePath);
  const projectConfigPath =
    projectDetected.format !== "none"
      ? projectDetected.path
      : projectBasePath + ".json";

  // Start with default config (includes default disabled hooks)
  const defaultConfig: OhMyOpenCodeConfig = {
    disabled_hooks: DEFAULT_DISABLED_HOOKS,
  };

  // Load user config and merge with defaults
  const userConfig = loadConfigFromPath(userConfigPath, ctx);
  let config: OhMyOpenCodeConfig = userConfig
    ? mergeConfigs(defaultConfig, userConfig)
    : defaultConfig;

  // Override with project config
  const projectConfig = loadConfigFromPath(projectConfigPath, ctx);
  if (projectConfig) {
    config = mergeConfigs(config, projectConfig);
  }

  log("Final merged config", {
    agents: config.agents,
    disabled_agents: config.disabled_agents,
    disabled_mcps: config.disabled_mcps,
    disabled_hooks: config.disabled_hooks,
    claude_code: config.claude_code,
  });
  return config;
}
