import { describe, expect, test, beforeEach, afterEach } from "bun:test"
import { SessionStatePersistence } from "../features/claude-code-session-state/persistence"
import type { SessionState } from "../features/claude-code-session-state/persistence"
import { mkdtempSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"

/**
 * Integration test: Cross-session state continuity
 * 
 * Tests the session-state persistence fix for issue where state was lost on OpenCode restart.
 * 
 * Background:
 * - Bug: sessionAgentMap and subagentSessions stored in-memory Maps
 * - Issue: Maps cleared on process restart, breaking prometheus-md-only hook
 * - Fix: SessionStatePersistence with atomic writes, debouncing, FileLock
 * 
 * This test simulates:
 * 1. OpenCode session with active subagents
 * 2. State persisted to disk
 * 3. Process restart (new SessionStatePersistence instance)
 * 4. State restored from disk
 */
describe("Session Continuity E2E", () => {
  let tempDir: string

  beforeEach(() => {
    // #given - isolated test directory for each test
    tempDir = mkdtempSync(join(tmpdir(), "session-continuity-e2e-"))
  })

  afterEach(() => {
    // Cleanup
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  test("should restore session state across process restart", async () => {
    // #given - first "session" with active subagents
    const persistence1 = new SessionStatePersistence(tempDir)
    
    const state1: SessionState = {
      version: 1,
      subagentSessions: ["ses_bg_task_1", "ses_bg_task_2", "ses_bg_task_3"],
      sessionAgentMap: {
        "ses_main": "sisyphus",
        "ses_prometheus": "Prometheus (Planner)",
        "ses_oracle": "oracle",
        "ses_bg_task_1": "explore",
        "ses_bg_task_2": "librarian",
        "ses_bg_task_3": "explore",
      },
    }

    // #when - persist state (simulating end of session)
    await persistence1.persistState(state1)

    // Simulate process restart: create new persistence instance
    // This mimics what happens when OpenCode restarts
    const persistence2 = new SessionStatePersistence(tempDir)

    // #then - state should be restored from disk
    const state2 = persistence2.getState()
    expect(state2).not.toBeNull()
    
    // Verify subagent sessions restored
    expect(state2?.subagentSessions).toEqual(state1.subagentSessions)
    expect(state2?.subagentSessions.length).toBe(3)
    expect(state2?.subagentSessions).toContain("ses_bg_task_1")
    expect(state2?.subagentSessions).toContain("ses_bg_task_2")
    expect(state2?.subagentSessions).toContain("ses_bg_task_3")

    // Verify session agent map restored
    expect(state2?.sessionAgentMap).toEqual(state1.sessionAgentMap)
    expect(state2?.sessionAgentMap["ses_prometheus"]).toBe("Prometheus (Planner)")
    expect(state2?.sessionAgentMap["ses_oracle"]).toBe("oracle")
    expect(state2?.sessionAgentMap["ses_main"]).toBe("sisyphus")
  })

  test("should handle empty state on first run", () => {
    // #given - fresh directory with no state file

    // #when - create persistence instance (first run)
    const persistence = new SessionStatePersistence(tempDir)

    // #then - should return null (no existing state)
    const state = persistence.getState()
    expect(state).toBeNull()
  })

  test("should survive multiple restart cycles", async () => {
    // #given - first session
    const persistence1 = new SessionStatePersistence(tempDir)
    const state1: SessionState = {
      version: 1,
      subagentSessions: ["ses_cycle_1"],
      sessionAgentMap: { "ses_cycle_1": "sisyphus" },
    }
    await persistence1.persistState(state1)

    // #when - restart 1
    const persistence2 = new SessionStatePersistence(tempDir)
    expect(persistence2.getState()?.subagentSessions).toContain("ses_cycle_1")

    // Update state in second session
    const state2: SessionState = {
      version: 1,
      subagentSessions: ["ses_cycle_1", "ses_cycle_2"],
      sessionAgentMap: {
        "ses_cycle_1": "sisyphus",
        "ses_cycle_2": "oracle",
      },
    }
    await persistence2.persistState(state2)

    // #when - restart 2
    const persistence3 = new SessionStatePersistence(tempDir)
    const state3 = persistence3.getState()

    // #then - latest state persisted across restarts
    expect(state3?.subagentSessions.length).toBe(2)
    expect(state3?.subagentSessions).toContain("ses_cycle_1")
    expect(state3?.subagentSessions).toContain("ses_cycle_2")
    expect(state3?.sessionAgentMap["ses_cycle_2"]).toBe("oracle")
  })

  test("prometheus-md-only hook scenario: agent identification survives restart", async () => {
    // #given - Prometheus session active (issue #893 scenario)
    const persistence1 = new SessionStatePersistence(tempDir)
    const prometheusState: SessionState = {
      version: 1,
      subagentSessions: [],
      sessionAgentMap: {
        "ses_prometheus_planning": "Prometheus (Planner)",
      },
    }
    await persistence1.persistState(prometheusState)

    // #when - OpenCode restarts (new persistence instance)
    const persistence2 = new SessionStatePersistence(tempDir)
    const restoredState = persistence2.getState()

    // #then - prometheus-md-only hook can identify agent
    expect(restoredState?.sessionAgentMap["ses_prometheus_planning"]).toBe("Prometheus (Planner)")
    
    // Hook logic: if (["Prometheus (Planner)"].includes(agent)) { ... }
    const agent = restoredState?.sessionAgentMap["ses_prometheus_planning"]
    expect(["Prometheus (Planner)"].includes(agent!)).toBe(true)
  })

  test("should handle concurrent background tasks scenario", async () => {
    // #given - multiple background tasks from parallel delegate_task calls
    const persistence1 = new SessionStatePersistence(tempDir)
    const parallelState: SessionState = {
      version: 1,
      subagentSessions: [
        "ses_explore_1",
        "ses_explore_2",
        "ses_explore_3",
        "ses_librarian_1",
        "ses_librarian_2",
      ],
      sessionAgentMap: {
        "ses_main": "sisyphus",
        "ses_explore_1": "explore",
        "ses_explore_2": "explore",
        "ses_explore_3": "explore",
        "ses_librarian_1": "librarian",
        "ses_librarian_2": "librarian",
      },
    }
    await persistence1.persistState(parallelState)

    // #when - restart during active background tasks
    const persistence2 = new SessionStatePersistence(tempDir)
    const restoredState = persistence2.getState()

    // #then - all background task sessions restored
    expect(restoredState?.subagentSessions.length).toBe(5)
    expect(restoredState?.sessionAgentMap["ses_explore_1"]).toBe("explore")
    expect(restoredState?.sessionAgentMap["ses_librarian_2"]).toBe("librarian")
  })

  test("should maintain state across rapid save cycles", async () => {
    // #given - rapid state mutations (simulating debounced saves)
    const persistence = new SessionStatePersistence(tempDir)
    
    // Multiple rapid saves (mimics debounced behavior in state.ts)
    const state1: SessionState = {
      version: 1,
      subagentSessions: ["ses_1"],
      sessionAgentMap: { "ses_1": "sisyphus" },
    }
    await persistence.persistState(state1)

    const state2: SessionState = {
      version: 1,
      subagentSessions: ["ses_1", "ses_2"],
      sessionAgentMap: { "ses_1": "sisyphus", "ses_2": "oracle" },
    }
    await persistence.persistState(state2)

    const state3: SessionState = {
      version: 1,
      subagentSessions: ["ses_1", "ses_2", "ses_3"],
      sessionAgentMap: {
        "ses_1": "sisyphus",
        "ses_2": "oracle",
        "ses_3": "librarian",
      },
    }
    await persistence.persistState(state3)

    // #when - restart after rapid saves
    const persistence2 = new SessionStatePersistence(tempDir)
    const finalState = persistence2.getState()

    // #then - final state persisted correctly
    expect(finalState?.subagentSessions.length).toBe(3)
    expect(finalState?.sessionAgentMap["ses_3"]).toBe("librarian")
  })

  test("should recover from backup when primary corrupted", async () => {
    // #given - valid state persisted
    const persistence1 = new SessionStatePersistence(tempDir)
    const validState: SessionState = {
      version: 1,
      subagentSessions: ["ses_backup_test"],
      sessionAgentMap: { "ses_backup_test": "sisyphus" },
    }
    await persistence1.persistState(validState)

    // Manually corrupt the primary file (simulating crash during write)
    const fs = require("fs")
    const path = require("path")
    const statePath = path.join(tempDir, ".opencode", "oh-my-opencode-session-state.json")
    fs.writeFileSync(statePath, "{ corrupt json }")

    // #when - restart with corrupted primary
    const persistence2 = new SessionStatePersistence(tempDir)
    const restoredState = persistence2.getState()

    // #then - state restored from backup
    expect(restoredState).not.toBeNull()
    expect(restoredState?.subagentSessions).toContain("ses_backup_test")
    expect(restoredState?.sessionAgentMap["ses_backup_test"]).toBe("sisyphus")
  })
})
