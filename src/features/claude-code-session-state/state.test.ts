import { describe, test, expect, beforeEach, afterEach, spyOn } from "bun:test"
import {
  setSessionAgent,
  getSessionAgent,
  clearSessionAgent,
  updateSessionAgent,
  setMainSession,
  getMainSessionID,
  _resetForTesting,
  subagentSessions,
} from "./state"
import * as fs from "fs"
import * as path from "path"

describe("claude-code-session-state", () => {
  beforeEach(() => {
    // #given - clean state before each test
    _resetForTesting()
  })

  afterEach(() => {
    // #then - cleanup after each test to prevent pollution
    _resetForTesting()
  })

  describe("setSessionAgent", () => {
    test("should store agent for session", () => {
      // #given
      const sessionID = "test-session-1"
      const agent = "Prometheus (Planner)"

      // #when
      setSessionAgent(sessionID, agent)

      // #then
      expect(getSessionAgent(sessionID)).toBe(agent)
    })

    test("should NOT overwrite existing agent (first-write wins)", () => {
      // #given
      const sessionID = "test-session-1"
      setSessionAgent(sessionID, "Prometheus (Planner)")

      // #when - try to overwrite
      setSessionAgent(sessionID, "sisyphus")

      // #then - first agent preserved
      expect(getSessionAgent(sessionID)).toBe("Prometheus (Planner)")
    })

    test("should return undefined for unknown session", () => {
      // #given - no session set

      // #when / #then
      expect(getSessionAgent("unknown-session")).toBeUndefined()
    })
  })

  describe("updateSessionAgent", () => {
    test("should overwrite existing agent", () => {
      // #given
      const sessionID = "test-session-1"
      setSessionAgent(sessionID, "Prometheus (Planner)")

      // #when - force update
      updateSessionAgent(sessionID, "sisyphus")

      // #then
      expect(getSessionAgent(sessionID)).toBe("sisyphus")
    })
  })

  describe("clearSessionAgent", () => {
    test("should remove agent from session", () => {
      // #given
      const sessionID = "test-session-1"
      setSessionAgent(sessionID, "Prometheus (Planner)")
      expect(getSessionAgent(sessionID)).toBe("Prometheus (Planner)")

      // #when
      clearSessionAgent(sessionID)

      // #then
      expect(getSessionAgent(sessionID)).toBeUndefined()
    })
  })

  describe("mainSessionID", () => {
    test("should store and retrieve main session ID", () => {
      // #given
      const mainID = "main-session-123"

      // #when
      setMainSession(mainID)

      // #then
      expect(getMainSessionID()).toBe(mainID)
    })

    test("should return undefined when not set", () => {
      // #given - explicit reset to ensure clean state (parallel test isolation)
      _resetForTesting()
      // #then
      expect(getMainSessionID()).toBeUndefined()
    })
  })

  describe("prometheus-md-only integration scenario", () => {
    test("should correctly identify Prometheus agent for permission checks", () => {
      // #given - Prometheus session
      const sessionID = "test-prometheus-session"
      const prometheusAgent = "Prometheus (Planner)"

      // #when - agent is set (simulating chat.message hook)
      setSessionAgent(sessionID, prometheusAgent)

      // #then - getSessionAgent returns correct agent for prometheus-md-only hook
      const agent = getSessionAgent(sessionID)
      expect(agent).toBe("Prometheus (Planner)")
      expect(["Prometheus (Planner)"].includes(agent!)).toBe(true)
    })

    test("should return undefined when agent not set (bug scenario)", () => {
      // #given - session exists but no agent set (the bug)
      const sessionID = "test-prometheus-session"

      // #when / #then - this is the bug: agent is undefined
      expect(getSessionAgent(sessionID)).toBeUndefined()
    })
  })

  describe("issue #893: custom agent switch reset", () => {
    test("should preserve custom agent when default agent is sent on subsequent messages", () => {
      // #given - user switches to custom agent "MyCustomAgent"
      const sessionID = "test-session-custom"
      const customAgent = "MyCustomAgent"
      const defaultAgent = "sisyphus"

      // User switches to custom agent (via UI)
      setSessionAgent(sessionID, customAgent)
      expect(getSessionAgent(sessionID)).toBe(customAgent)

      // #when - first message after switch sends default agent
      // This simulates the bug: input.agent = "Sisyphus" on first message
      // Using setSessionAgent (first-write wins) should preserve custom agent
      setSessionAgent(sessionID, defaultAgent)

      // #then - custom agent should be preserved, NOT overwritten
      expect(getSessionAgent(sessionID)).toBe(customAgent)
    })

    test("should allow explicit agent update via updateSessionAgent", () => {
      // #given - custom agent is set
      const sessionID = "test-session-explicit"
      const customAgent = "MyCustomAgent"
      const newAgent = "AnotherAgent"

      setSessionAgent(sessionID, customAgent)

      // #when - explicit update (user intentionally switches)
      updateSessionAgent(sessionID, newAgent)

      // #then - should be updated
      expect(getSessionAgent(sessionID)).toBe(newAgent)
    })
  })

  describe("persistence integration", () => {
    const statePath = path.join(process.cwd(), ".opencode", "oh-my-opencode-session-state.json")
    const backupPath = `${statePath}.backup`

    // Helper to wait for debounced save (100ms + buffer)
    const waitForSave = () => new Promise(resolve => setTimeout(resolve, 150))

    // Helper to read persisted state
    const readPersistedState = () => {
      if (!fs.existsSync(statePath)) return null
      return JSON.parse(fs.readFileSync(statePath, "utf-8"))
    }

    afterEach(() => {
      // Clean up persisted files after persistence tests
      if (fs.existsSync(statePath)) fs.unlinkSync(statePath)
      if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath)
    })

    test("setSessionAgent should trigger persisted save after debounce", async () => {
      // #given - clean state
      _resetForTesting()
      const sessionID = "persist-test-1"
      const agent = "sisyphus"

      // #when - set agent (triggers scheduleSave)
      setSessionAgent(sessionID, agent)

      // #then - wait for debounced save
      await waitForSave()

      // State should be persisted to disk
      const persistedState = readPersistedState()
      expect(persistedState).not.toBeNull()
      expect(persistedState?.sessionAgentMap[sessionID]).toBe(agent)
    })

    test("updateSessionAgent should trigger persisted save", async () => {
      // #given - existing agent
      _resetForTesting()
      const sessionID = "persist-test-2"
      setSessionAgent(sessionID, "oracle")
      await waitForSave()

      // #when - update agent
      updateSessionAgent(sessionID, "librarian")
      await waitForSave()

      // #then - updated value persisted
      const persistedState = readPersistedState()
      expect(persistedState?.sessionAgentMap[sessionID]).toBe("librarian")
    })

    test("clearSessionAgent should trigger persisted save", async () => {
      // #given - agent exists
      _resetForTesting()
      const sessionID = "persist-test-3"
      setSessionAgent(sessionID, "explore")
      await waitForSave()
      expect(readPersistedState()?.sessionAgentMap[sessionID]).toBe("explore")

      // #when - clear agent
      clearSessionAgent(sessionID)
      await waitForSave()

      // #then - agent removed from persisted state
      const persistedState = readPersistedState()
      expect(persistedState?.sessionAgentMap[sessionID]).toBeUndefined()
    })

    test("subagentSessions.add should trigger persisted save", async () => {
      // #given - clean state
      _resetForTesting()
      const sessionID = "persist-subagent-1"

      // #when - add subagent session
      subagentSessions.add(sessionID)
      await waitForSave()

      // #then - persisted to disk
      const persistedState = readPersistedState()
      expect(persistedState?.subagentSessions).toContain(sessionID)
    })

    test("subagentSessions.delete should trigger persisted save", async () => {
      // #given - subagent session exists
      _resetForTesting()
      const sessionID = "persist-subagent-2"
      subagentSessions.add(sessionID)
      await waitForSave()
      expect(readPersistedState()?.subagentSessions).toContain(sessionID)

      // #when - delete subagent session
      subagentSessions.delete(sessionID)
      await waitForSave()

      // #then - removed from persisted state
      const persistedState = readPersistedState()
      expect(persistedState?.subagentSessions).not.toContain(sessionID)
    })

    test("multiple state mutations should batch into single save", async () => {
      // #given - clean state
      _resetForTesting()

      // #when - multiple rapid mutations (debounce should batch)
      setSessionAgent("batch-1", "sisyphus")
      setSessionAgent("batch-2", "oracle")
      subagentSessions.add("batch-sub-1")
      
      // #then - wait for single batched save
      await waitForSave()

      const persistedState = readPersistedState()
      expect(persistedState?.sessionAgentMap["batch-1"]).toBe("sisyphus")
      expect(persistedState?.sessionAgentMap["batch-2"]).toBe("oracle")
      expect(persistedState?.subagentSessions).toContain("batch-sub-1")
    })

    test("_resetForTesting should clear pending saves", async () => {
      // #given - mutation scheduled
      _resetForTesting()
      setSessionAgent("reset-test", "sisyphus")

      // #when - reset before save completes
      _resetForTesting()

      // #then - save should not occur
      await waitForSave()
      // State file may not exist or may not contain reset-test
      const persistedState = readPersistedState()
      if (persistedState) {
        expect(persistedState.sessionAgentMap["reset-test"]).toBeUndefined()
      }
    })
  })
})
