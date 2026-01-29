import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { SessionStatePersistence, CURRENT_VERSION } from "./persistence"
import type { SessionState } from "./persistence"
import * as fs from "fs"
import * as path from "path"

describe("SessionStatePersistence", () => {
  const testDir = path.join(__dirname, "__test_persistence__")
  const statePath = path.join(testDir, ".opencode", "oh-my-opencode-session-state.json")
  const backupPath = `${statePath}.backup`
  const lockPath = `${statePath}.lock`

  beforeEach(() => {
    // #given - clean test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true })
    }
    fs.mkdirSync(testDir, { recursive: true })
  })

  afterEach(() => {
    // Cleanup
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true })
    }
  })

  describe("createInitialState", () => {
    test("should create valid initial state with current version", () => {
      // #when
      const state = SessionStatePersistence.createInitialState()

      // #then
      expect(state.version).toBe(CURRENT_VERSION)
      expect(state.subagentSessions).toEqual([])
      expect(state.sessionAgentMap).toEqual({})
    })
  })

  describe("getStatePath", () => {
    test("should return correct state file path", () => {
      // #when
      const result = SessionStatePersistence.getStatePath(testDir)

      // #then
      expect(result).toBe(statePath)
    })
  })

  describe("constructor and loadState", () => {
    test("should return null for missing state file", () => {
      // #given - no state file exists

      // #when
      const persistence = new SessionStatePersistence(testDir)

      // #then
      expect(persistence.getState()).toBeNull()
    })

    test("should load and parse valid state file", () => {
      // #given - valid state file exists
      const validState: SessionState = {
        version: CURRENT_VERSION,
        subagentSessions: ["ses_abc123", "ses_def456"],
        sessionAgentMap: {
          "ses_abc123": "Prometheus (Planner)",
          "ses_def456": "sisyphus",
        },
      }

      fs.mkdirSync(path.dirname(statePath), { recursive: true })
      fs.writeFileSync(statePath, JSON.stringify(validState, null, 2))

      // #when
      const persistence = new SessionStatePersistence(testDir)

      // #then
      const state = persistence.getState()
      expect(state).not.toBeNull()
      expect(state?.version).toBe(CURRENT_VERSION)
      expect(state?.subagentSessions).toEqual(["ses_abc123", "ses_def456"])
      expect(state?.sessionAgentMap).toEqual({
        "ses_abc123": "Prometheus (Planner)",
        "ses_def456": "sisyphus",
      })
    })

    test("should fall back to backup if primary file corrupted", () => {
      // #given - primary corrupted, backup valid
      const validState: SessionState = {
        version: CURRENT_VERSION,
        subagentSessions: ["ses_backup"],
        sessionAgentMap: { "ses_backup": "oracle" },
      }

      fs.mkdirSync(path.dirname(statePath), { recursive: true })
      fs.writeFileSync(statePath, "{ corrupt JSON }")
      fs.writeFileSync(backupPath, JSON.stringify(validState, null, 2))

      // #when
      const persistence = new SessionStatePersistence(testDir)

      // #then
      const state = persistence.getState()
      expect(state).not.toBeNull()
      expect(state?.subagentSessions).toEqual(["ses_backup"])
      expect(state?.sessionAgentMap).toEqual({ "ses_backup": "oracle" })

      // Backup should be restored to primary
      expect(fs.existsSync(statePath)).toBe(true)
      const restoredContent = JSON.parse(fs.readFileSync(statePath, "utf-8"))
      expect(restoredContent.subagentSessions).toEqual(["ses_backup"])
    })

    test("should return null for corrupted state with missing fields", () => {
      // #given - state file missing required fields
      const invalidState = {
        version: CURRENT_VERSION,
        subagentSessions: ["ses_abc123"],
        // Missing sessionAgentMap
      }

      fs.mkdirSync(path.dirname(statePath), { recursive: true })
      fs.writeFileSync(statePath, JSON.stringify(invalidState, null, 2))

      // #when
      const persistence = new SessionStatePersistence(testDir)

      // #then
      expect(persistence.getState()).toBeNull()
    })

    test("should return null for invalid JSON", () => {
      // #given - completely invalid JSON
      fs.mkdirSync(path.dirname(statePath), { recursive: true })
      fs.writeFileSync(statePath, "this is not json at all {{")

      // #when
      const persistence = new SessionStatePersistence(testDir)

      // #then
      expect(persistence.getState()).toBeNull()
    })

    test("should validate field types correctly", () => {
      // #given - wrong field types
      const invalidState = {
        version: CURRENT_VERSION,
        subagentSessions: "not-an-array", // Should be array
        sessionAgentMap: ["not-an-object"], // Should be object
      }

      fs.mkdirSync(path.dirname(statePath), { recursive: true })
      fs.writeFileSync(statePath, JSON.stringify(invalidState, null, 2))

      // #when
      const persistence = new SessionStatePersistence(testDir)

      // #then
      expect(persistence.getState()).toBeNull()
    })
  })

  describe("persistState", () => {
    test("should create state file with correct content", async () => {
      // #given - persistence instance with no existing state
      const persistence = new SessionStatePersistence(testDir)
      const newState: SessionState = {
        version: CURRENT_VERSION,
        subagentSessions: ["ses_new"],
        sessionAgentMap: { "ses_new": "librarian" },
      }

      // #when
      await persistence.persistState(newState)

      // #then - state file created
      expect(fs.existsSync(statePath)).toBe(true)
      const content = JSON.parse(fs.readFileSync(statePath, "utf-8"))
      expect(content.version).toBe(CURRENT_VERSION)
      expect(content.subagentSessions).toEqual(["ses_new"])
      expect(content.sessionAgentMap).toEqual({ "ses_new": "librarian" })

      // #then - backup created
      expect(fs.existsSync(backupPath)).toBe(true)
      const backupContent = JSON.parse(fs.readFileSync(backupPath, "utf-8"))
      expect(backupContent).toEqual(content)
    })

    test("should update existing state file", async () => {
      // #given - existing state
      const initialState: SessionState = {
        version: CURRENT_VERSION,
        subagentSessions: ["ses_initial"],
        sessionAgentMap: { "ses_initial": "explore" },
      }

      fs.mkdirSync(path.dirname(statePath), { recursive: true })
      fs.writeFileSync(statePath, JSON.stringify(initialState, null, 2))

      const persistence = new SessionStatePersistence(testDir)

      // #when - update state
      const updatedState: SessionState = {
        version: CURRENT_VERSION,
        subagentSessions: ["ses_initial", "ses_updated"],
        sessionAgentMap: {
          "ses_initial": "explore",
          "ses_updated": "sisyphus",
        },
      }
      await persistence.persistState(updatedState)

      // #then - file updated
      const content = JSON.parse(fs.readFileSync(statePath, "utf-8"))
      expect(content.subagentSessions).toEqual(["ses_initial", "ses_updated"])
      expect(content.sessionAgentMap["ses_updated"]).toBe("sisyphus")
    })

    test("should handle missing directory by creating it", async () => {
      // #given - directory doesn't exist
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true })
      }

      const persistence = new SessionStatePersistence(testDir)
      const newState: SessionState = {
        version: CURRENT_VERSION,
        subagentSessions: [],
        sessionAgentMap: {},
      }

      // #when
      await persistence.persistState(newState)

      // #then - directory and file created
      expect(fs.existsSync(statePath)).toBe(true)
      expect(fs.existsSync(path.dirname(statePath))).toBe(true)
    })

    test("should update internal state after persist", async () => {
      // #given
      const persistence = new SessionStatePersistence(testDir)
      expect(persistence.getState()).toBeNull()

      const newState: SessionState = {
        version: CURRENT_VERSION,
        subagentSessions: ["ses_test"],
        sessionAgentMap: { "ses_test": "oracle" },
      }

      // #when
      await persistence.persistState(newState)

      // #then - internal state updated
      const internalState = persistence.getState()
      expect(internalState).not.toBeNull()
      expect(internalState?.subagentSessions).toEqual(["ses_test"])
      expect(internalState?.sessionAgentMap).toEqual({ "ses_test": "oracle" })
    })
  })

  describe("FileLock behavior", () => {
    test("should create and release lock file", async () => {
      // #given
      const persistence = new SessionStatePersistence(testDir)
      const newState: SessionState = {
        version: CURRENT_VERSION,
        subagentSessions: [],
        sessionAgentMap: {},
      }

      // #when
      await persistence.persistState(newState)

      // #then - lock should be released after persist
      expect(fs.existsSync(lockPath)).toBe(false)
    })

    test("should handle lock acquisition failure gracefully", async () => {
      // #given - manually create a fresh lock file
      fs.mkdirSync(path.dirname(statePath), { recursive: true })
      const lockData = {
        pid: 99999, // Different PID
        timestamp: Date.now(), // Fresh timestamp (not stale)
      }
      fs.writeFileSync(lockPath, JSON.stringify(lockData))

      const persistence = new SessionStatePersistence(testDir)
      const newState: SessionState = {
        version: CURRENT_VERSION,
        subagentSessions: ["ses_locked"],
        sessionAgentMap: {},
      }

      // #when - try to persist while locked
      await persistence.persistState(newState)

      // #then - should fail silently (lock not acquired)
      // State file should NOT be created
      expect(fs.existsSync(statePath)).toBe(false)

      // Cleanup lock
      fs.unlinkSync(lockPath)
    })

    test("should remove stale lock and acquire", async () => {
      // #given - create stale lock (older than LOCK_TIMEOUT_MS = 5000ms)
      fs.mkdirSync(path.dirname(statePath), { recursive: true })
      const staleLockData = {
        pid: 99999,
        timestamp: Date.now() - 10000, // 10 seconds old (stale)
      }
      fs.writeFileSync(lockPath, JSON.stringify(staleLockData))

      const persistence = new SessionStatePersistence(testDir)
      const newState: SessionState = {
        version: CURRENT_VERSION,
        subagentSessions: ["ses_stale_lock"],
        sessionAgentMap: {},
      }

      // #when
      await persistence.persistState(newState)

      // #then - stale lock removed, state persisted
      expect(fs.existsSync(statePath)).toBe(true)
      expect(fs.existsSync(lockPath)).toBe(false) // Lock released

      const content = JSON.parse(fs.readFileSync(statePath, "utf-8"))
      expect(content.subagentSessions).toEqual(["ses_stale_lock"])
    })
  })

  describe("atomic write behavior", () => {
    test("should use temp file for atomic write", async () => {
      // #given
      const persistence = new SessionStatePersistence(testDir)
      const newState: SessionState = {
        version: CURRENT_VERSION,
        subagentSessions: ["ses_atomic"],
        sessionAgentMap: {},
      }

      // #when
      await persistence.persistState(newState)

      // #then - temp file should be cleaned up
      const tempPath = `${statePath}.tmp`
      expect(fs.existsSync(tempPath)).toBe(false)

      // Main file should exist
      expect(fs.existsSync(statePath)).toBe(true)
    })
  })

  describe("backup restoration", () => {
    test("should restore primary from backup when primary corrupted", () => {
      // #given - primary corrupted, backup valid
      const validState: SessionState = {
        version: CURRENT_VERSION,
        subagentSessions: ["ses_restore_test"],
        sessionAgentMap: { "ses_restore_test": "Prometheus (Planner)" },
      }

      fs.mkdirSync(path.dirname(statePath), { recursive: true })
      fs.writeFileSync(statePath, "{ invalid json }")
      fs.writeFileSync(backupPath, JSON.stringify(validState, null, 2))

      // #when
      const persistence = new SessionStatePersistence(testDir)

      // #then - primary restored
      expect(fs.existsSync(statePath)).toBe(true)
      const restoredContent = JSON.parse(fs.readFileSync(statePath, "utf-8"))
      expect(restoredContent.subagentSessions).toEqual(["ses_restore_test"])

      // State loaded correctly
      const state = persistence.getState()
      expect(state?.sessionAgentMap["ses_restore_test"]).toBe("Prometheus (Planner)")
    })

    test("should return null when both primary and backup corrupted", () => {
      // #given - both files corrupted
      fs.mkdirSync(path.dirname(statePath), { recursive: true })
      fs.writeFileSync(statePath, "{ invalid }")
      fs.writeFileSync(backupPath, "{ also invalid }")

      // #when
      const persistence = new SessionStatePersistence(testDir)

      // #then
      expect(persistence.getState()).toBeNull()
    })
  })

  describe("integration: full lifecycle", () => {
    test("should persist, reload, and maintain state across instances", async () => {
      // #given - first instance persists state
      const persistence1 = new SessionStatePersistence(testDir)
      const state1: SessionState = {
        version: CURRENT_VERSION,
        subagentSessions: ["ses_lifecycle_1", "ses_lifecycle_2"],
        sessionAgentMap: {
          "ses_lifecycle_1": "sisyphus",
          "ses_lifecycle_2": "librarian",
        },
      }
      await persistence1.persistState(state1)

      // #when - second instance loads from disk
      const persistence2 = new SessionStatePersistence(testDir)

      // #then - state restored correctly
      const state2 = persistence2.getState()
      expect(state2).not.toBeNull()
      expect(state2?.subagentSessions).toEqual(["ses_lifecycle_1", "ses_lifecycle_2"])
      expect(state2?.sessionAgentMap).toEqual({
        "ses_lifecycle_1": "sisyphus",
        "ses_lifecycle_2": "librarian",
      })
    })
  })
})
