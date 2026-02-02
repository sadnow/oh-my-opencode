// src/features/budget-orchestrator/provider-id-mapping.ts

const LEGACY_TO_CANONICAL: Record<string, string> = {
  'claude-max': 'anthropic',
  'copilot': 'github-copilot',
  'opencode_zen': 'opencode',
}

const CANONICAL_TO_LEGACY: Record<string, string> = {
  'anthropic': 'claude-max',
  'github-copilot': 'copilot',
  'opencode': 'opencode_zen',
}

/**
 * Normalizes legacy subscription tracker keys to canonical provider IDs.
 */
export function toCanonicalProviderId(key: string): string {
  return LEGACY_TO_CANONICAL[key] ?? key
}

/**
 * Converts canonical provider IDs back to legacy subscription tracker keys.
 */
export function fromCanonicalProviderId(canonical: string): string {
  return CANONICAL_TO_LEGACY[canonical] ?? canonical
}

/**
 * Checks if a given key is a legacy provider ID.
 */
export function isLegacyProviderId(key: string): boolean {
  return key in LEGACY_TO_CANONICAL
}
