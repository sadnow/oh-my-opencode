/**
 * Usage Storage
 * Persistence layer for usage tracking data
 */

import * as fs from "fs"
import * as path from "path"
import { getOpenCodeConfigDir } from "../../shared"
import type { UsageStorage, UsageRecord, ProviderUsageSummary } from "./types"

const STORAGE_FILENAME = "oh-my-opencode-usage.json"
const CURRENT_VERSION = 1

/**
 * Get the default storage path for usage data.
 */
export function getDefaultStoragePath(): string {
  const configDir = getOpenCodeConfigDir({ binary: "opencode" })
  return path.join(configDir, STORAGE_FILENAME)
}

/**
 * Create an empty usage storage object.
 */
export function createEmptyStorage(): UsageStorage {
  return {
    version: CURRENT_VERSION,
    lastUpdated: new Date(),
    records: [],
    summaries: {},
  }
}

/**
 * Load usage data from disk.
 * Returns empty storage if file doesn't exist or is invalid.
 */
export function loadUsageStorage(storagePath?: string): UsageStorage {
  const filePath = storagePath ?? getDefaultStoragePath()

  try {
    if (!fs.existsSync(filePath)) {
      return createEmptyStorage()
    }

    const content = fs.readFileSync(filePath, "utf-8")
    const data = JSON.parse(content) as UsageStorage

    // Version check and migration
    if (data.version !== CURRENT_VERSION) {
      return migrateStorage(data)
    }

    // Deserialize dates
    return deserializeStorage(data)
  } catch {
    // If file is corrupted, start fresh
    return createEmptyStorage()
  }
}

/**
 * Save usage data to disk.
 */
export function saveUsageStorage(storage: UsageStorage, storagePath?: string): void {
  const filePath = storagePath ?? getDefaultStoragePath()

  try {
    // Ensure directory exists
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    storage.lastUpdated = new Date()
    const content = JSON.stringify(storage, null, 2)
    fs.writeFileSync(filePath, content, "utf-8")
  } catch (error) {
    console.error("[usage-tracker] Failed to save usage data:", error)
  }
}

/**
 * Deserialize date strings back to Date objects.
 */
function deserializeStorage(data: UsageStorage): UsageStorage {
  return {
    ...data,
    lastUpdated: new Date(data.lastUpdated),
    records: data.records.map((record) => ({
      ...record,
      timestamp: new Date(record.timestamp),
    })),
    summaries: Object.fromEntries(
      Object.entries(data.summaries).map(([key, summary]) => [
        key,
        {
          ...summary,
          periodStart: new Date(summary.periodStart),
          nextReset: new Date(summary.nextReset),
        },
      ])
    ),
  }
}

/**
 * Migrate storage from older versions.
 */
function migrateStorage(data: UsageStorage): UsageStorage {
  // For now, just update the version and return
  // Future migrations can be added here
  return {
    ...deserializeStorage(data),
    version: CURRENT_VERSION,
  }
}

/**
 * Prune records older than the oldest active billing period.
 * This keeps the storage file from growing indefinitely.
 */
export function pruneOldRecords(
  storage: UsageStorage,
  cutoffDate: Date
): UsageStorage {
  const prunedRecords = storage.records.filter(
    (record) => new Date(record.timestamp) >= cutoffDate
  )

  return {
    ...storage,
    records: prunedRecords,
  }
}

/**
 * Add a usage record to storage.
 */
export function addRecord(
  storage: UsageStorage,
  record: UsageRecord
): UsageStorage {
  return {
    ...storage,
    records: [...storage.records, record],
  }
}

/**
 * Update or create a provider summary.
 */
export function updateSummary(
  storage: UsageStorage,
  summary: ProviderUsageSummary
): UsageStorage {
  return {
    ...storage,
    summaries: {
      ...storage.summaries,
      [summary.provider]: summary,
    },
  }
}

/**
 * Get records for a specific provider within a date range.
 */
export function getRecordsForProvider(
  storage: UsageStorage,
  provider: string,
  startDate: Date,
  endDate: Date = new Date()
): UsageRecord[] {
  return storage.records.filter(
    (record) =>
      record.provider === provider &&
      new Date(record.timestamp) >= startDate &&
      new Date(record.timestamp) <= endDate
  )
}

/**
 * Clear all usage data for a specific provider.
 */
export function clearProviderData(
  storage: UsageStorage,
  provider: string
): UsageStorage {
  return {
    ...storage,
    records: storage.records.filter((r) => r.provider !== provider),
    summaries: Object.fromEntries(
      Object.entries(storage.summaries).filter(([key]) => key !== provider)
    ),
  }
}

/**
 * Clear all usage data.
 */
export function clearAllData(storage: UsageStorage): UsageStorage {
  return createEmptyStorage()
}
