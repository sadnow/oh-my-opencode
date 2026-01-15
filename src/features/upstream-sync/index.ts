/**
 * Upstream Sync Checker
 *
 * Checks if the fork is behind the upstream repository and notifies on startup.
 * This helps maintainers stay aware of new releases from the original project.
 */

import { log } from "../../shared/logger"

// ============================================================================
// Configuration
// ============================================================================

/** Upstream repository info */
export const UPSTREAM_CONFIG = {
  owner: "code-yeongyu",
  repo: "oh-my-opencode",
  branch: "dev",
  apiBase: "https://api.github.com",
} as const

/** Current fork version - update when syncing with upstream */
export const FORK_BASE_VERSION = {
  /** The upstream tag this fork is based on */
  basedOnTag: "v3.0.0-beta.8",
  /** The upstream commit hash this fork diverged from */
  basedOnCommit: "837176d9478a923ded1a131cb50fc040fa31020e",
  /** Last sync date */
  lastSyncDate: "2026-01-15",
} as const

/** Fork-specific version */
export const FORK_VERSION = "v3.6.0-fork"

// ============================================================================
// Types
// ============================================================================

export interface UpstreamRelease {
  tag_name: string
  name: string
  published_at: string
  html_url: string
  prerelease: boolean
}

export interface UpstreamCommit {
  sha: string
  commit: {
    message: string
    author: {
      date: string
    }
  }
}

export interface SyncStatus {
  isChecked: boolean
  isBehind: boolean
  latestUpstreamTag: string | null
  latestUpstreamCommit: string | null
  commitsBehind: number
  newReleases: UpstreamRelease[]
  lastChecked: Date | null
  error: string | null
}

// ============================================================================
// State
// ============================================================================

let cachedStatus: SyncStatus = {
  isChecked: false,
  isBehind: false,
  latestUpstreamTag: null,
  latestUpstreamCommit: null,
  commitsBehind: 0,
  newReleases: [],
  lastChecked: null,
  error: null,
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Fetch latest releases from upstream
 */
async function fetchUpstreamReleases(): Promise<UpstreamRelease[]> {
  const url = `${UPSTREAM_CONFIG.apiBase}/repos/${UPSTREAM_CONFIG.owner}/${UPSTREAM_CONFIG.repo}/releases`

  const response = await fetch(url, {
    headers: {
      "Accept": "application/vnd.github.v3+json",
      "User-Agent": "oh-my-opencode-fork",
    },
  })

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`)
  }

  return response.json() as Promise<UpstreamRelease[]>
}

/**
 * Fetch latest commits from upstream dev branch
 */
async function fetchUpstreamCommits(since?: string): Promise<UpstreamCommit[]> {
  let url = `${UPSTREAM_CONFIG.apiBase}/repos/${UPSTREAM_CONFIG.owner}/${UPSTREAM_CONFIG.repo}/commits?sha=${UPSTREAM_CONFIG.branch}`

  if (since) {
    url += `&since=${since}`
  }

  const response = await fetch(url, {
    headers: {
      "Accept": "application/vnd.github.v3+json",
      "User-Agent": "oh-my-opencode-fork",
    },
  })

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`)
  }

  return response.json() as Promise<UpstreamCommit[]>
}

/**
 * Compare two version tags (e.g., "v3.0.0-beta.7" vs "v3.0.0-beta.8")
 * Returns positive if a > b, negative if a < b, 0 if equal
 */
export function compareVersionTags(a: string, b: string): number {
  const parseVersion = (v: string) => {
    const match = v.match(/v?(\d+)\.(\d+)\.(\d+)(?:-beta\.(\d+))?/)
    if (!match) return { major: 0, minor: 0, patch: 0, beta: Infinity }
    return {
      major: parseInt(match[1], 10),
      minor: parseInt(match[2], 10),
      patch: parseInt(match[3], 10),
      beta: match[4] ? parseInt(match[4], 10) : Infinity, // No beta = release version
    }
  }

  const va = parseVersion(a)
  const vb = parseVersion(b)

  if (va.major !== vb.major) return va.major - vb.major
  if (va.minor !== vb.minor) return va.minor - vb.minor
  if (va.patch !== vb.patch) return va.patch - vb.patch
  return va.beta - vb.beta
}

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Check if fork is behind upstream
 */
export async function checkUpstreamSync(): Promise<SyncStatus> {
  try {
    log("[UpstreamSync] Checking for upstream updates...")

    // Fetch releases
    const releases = await fetchUpstreamReleases()

    // Find releases newer than our base
    const newReleases = releases.filter(release =>
      compareVersionTags(release.tag_name, FORK_BASE_VERSION.basedOnTag) > 0
    )

    // Get latest tag
    const latestRelease = releases[0] // GitHub returns newest first
    const latestUpstreamTag = latestRelease?.tag_name ?? null

    // Fetch commits since our base
    const commits = await fetchUpstreamCommits(FORK_BASE_VERSION.lastSyncDate)
    const commitsBehind = commits.filter(c =>
      c.sha !== FORK_BASE_VERSION.basedOnCommit
    ).length

    const isBehind = newReleases.length > 0 || commitsBehind > 10

    cachedStatus = {
      isChecked: true,
      isBehind,
      latestUpstreamTag,
      latestUpstreamCommit: commits[0]?.sha ?? null,
      commitsBehind,
      newReleases,
      lastChecked: new Date(),
      error: null,
    }

    log("[UpstreamSync] Check complete", {
      isBehind,
      latestTag: latestUpstreamTag,
      newReleases: newReleases.length,
      commitsBehind,
    })

    return cachedStatus

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    log("[UpstreamSync] Error checking upstream", { error: errorMsg })

    cachedStatus = {
      ...cachedStatus,
      isChecked: true,
      error: errorMsg,
      lastChecked: new Date(),
    }

    return cachedStatus
  }
}

/**
 * Get cached sync status
 */
export function getSyncStatus(): SyncStatus {
  return cachedStatus
}

/**
 * Format sync status for display
 */
export function formatSyncNotification(status: SyncStatus): string | null {
  if (!status.isChecked) return null
  if (status.error) return null
  if (!status.isBehind) return null

  const lines: string[] = []

  lines.push("╔════════════════════════════════════════════════════════════════╗")
  lines.push("║  UPSTREAM UPDATE AVAILABLE                                     ║")
  lines.push("╠════════════════════════════════════════════════════════════════╣")

  if (status.newReleases.length > 0) {
    const latest = status.newReleases[0]
    lines.push(`║  Latest upstream release: ${latest.tag_name.padEnd(37)}║`)
    lines.push(`║  Your fork is based on:   ${FORK_BASE_VERSION.basedOnTag.padEnd(37)}║`)
  }

  if (status.commitsBehind > 0) {
    lines.push(`║  Commits behind upstream: ${String(status.commitsBehind).padEnd(37)}║`)
  }

  lines.push("╠════════════════════════════════════════════════════════════════╣")
  lines.push("║  To sync your fork with upstream, run:                         ║")
  lines.push("║    git fetch upstream                                          ║")
  lines.push("║    git merge upstream/dev                                      ║")
  lines.push("║  Or rebase: git rebase upstream/dev                            ║")
  lines.push("╚════════════════════════════════════════════════════════════════╝")

  return lines.join("\n")
}

/**
 * Show sync notification if behind upstream
 * Call this on startup
 */
export async function showSyncNotificationIfNeeded(): Promise<void> {
  try {
    const status = await checkUpstreamSync()
    const notification = formatSyncNotification(status)

    if (notification) {
      // Log to console for visibility
      console.log("\n" + notification + "\n")
    }
  } catch (error) {
    // Silently fail - don't block startup for network issues
    log("[UpstreamSync] Failed to check upstream", {
      error: error instanceof Error ? error.message : String(error)
    })
  }
}

// ============================================================================
// CLI Command Support
// ============================================================================

/**
 * Get detailed sync report for CLI display
 */
export function getSyncReport(status: SyncStatus): string {
  const lines: string[] = []

  lines.push("=== UPSTREAM SYNC STATUS ===")
  lines.push("")
  lines.push(`Fork Version:      ${FORK_VERSION}`)
  lines.push(`Based on Upstream: ${FORK_BASE_VERSION.basedOnTag}`)
  lines.push(`Base Commit:       ${FORK_BASE_VERSION.basedOnCommit.slice(0, 8)}`)
  lines.push(`Last Sync Date:    ${FORK_BASE_VERSION.lastSyncDate}`)
  lines.push("")

  if (status.error) {
    lines.push(`Status: ERROR - ${status.error}`)
    return lines.join("\n")
  }

  if (!status.isChecked) {
    lines.push("Status: Not checked yet")
    return lines.join("\n")
  }

  lines.push(`Latest Upstream:   ${status.latestUpstreamTag ?? "unknown"}`)
  lines.push(`Commits Behind:    ${status.commitsBehind}`)
  lines.push(`Status:            ${status.isBehind ? "BEHIND" : "UP TO DATE"}`)
  lines.push("")

  if (status.newReleases.length > 0) {
    lines.push("New Releases Available:")
    for (const release of status.newReleases.slice(0, 5)) {
      lines.push(`  - ${release.tag_name} (${release.published_at.slice(0, 10)})`)
    }
  }

  lines.push("")
  lines.push("=== SYNC INSTRUCTIONS ===")
  lines.push("")
  lines.push("Option 1: Merge (preserves commit history)")
  lines.push("  git fetch upstream")
  lines.push("  git checkout dev")
  lines.push("  git merge upstream/dev")
  lines.push("  # Resolve conflicts if any")
  lines.push("  git push origin dev")
  lines.push("")
  lines.push("Option 2: Rebase (cleaner history, rewrites commits)")
  lines.push("  git fetch upstream")
  lines.push("  git checkout feature/auto-router")
  lines.push("  git rebase upstream/dev")
  lines.push("  # Resolve conflicts if any")
  lines.push("  git push --force-with-lease origin feature/auto-router")
  lines.push("")
  lines.push("After sync, update FORK_BASE_VERSION in upstream-sync/index.ts")

  return lines.join("\n")
}
