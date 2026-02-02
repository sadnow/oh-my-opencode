import { SessionStatePersistence, SessionState } from "./persistence"
import { log } from "../../shared/logger"

export const subagentSessions = new Set<string>()
const originalAdd = subagentSessions.add.bind(subagentSessions)
const originalDelete = subagentSessions.delete.bind(subagentSessions)

const sessionAgentMap = new Map<string, string>()

subagentSessions.add = function(value: string) {
  const result = originalAdd(value)
  scheduleSave()
  return result
}

subagentSessions.delete = function(value: string) {
  const result = originalDelete(value)
  scheduleSave()
  return result
} 

// Initialize persistence layer
const persistence = new SessionStatePersistence(process.cwd())

// Load saved state on module initialization
const savedState = persistence.getState()
if (savedState) {
  // Restore subagentSessions
  for (const sessionID of savedState.subagentSessions) {
    originalAdd(sessionID)
  }
  
  // Restore sessionAgentMap
  for (const [sessionID, agent] of Object.entries(savedState.sessionAgentMap)) {
    sessionAgentMap.set(sessionID, agent)
  }
}

// Debounced save function
let saveTimeout: ReturnType<typeof setTimeout> | undefined

function scheduleSave(): void {
  if (saveTimeout) {
    clearTimeout(saveTimeout)
  }
  
  saveTimeout = setTimeout(() => {
    const state: SessionState = {
      version: 1,
      subagentSessions: Array.from(subagentSessions),
      sessionAgentMap: Object.fromEntries(sessionAgentMap),
    }
    
    persistence.persistState(state).catch((error) => {
      log("[session-state] Failed to persist state:", error)
    })
  }, 100)
}

let _mainSessionID: string | undefined

export function setMainSession(id: string | undefined) {
  _mainSessionID = id
}

export function getMainSessionID(): string | undefined {
  return _mainSessionID
}

/** @internal For testing only */
export function _resetForTesting(): void {
  _mainSessionID = undefined
  subagentSessions.clear()
  sessionAgentMap.clear()
  
  // Clear any pending save timeout
  if (saveTimeout) {
    clearTimeout(saveTimeout)
    saveTimeout = undefined
  }
}

export function setSessionAgent(sessionID: string, agent: string): void {
  if (!sessionAgentMap.has(sessionID)) {
    sessionAgentMap.set(sessionID, agent)
    scheduleSave()
  }
}

export function updateSessionAgent(sessionID: string, agent: string): void {
  sessionAgentMap.set(sessionID, agent)
  scheduleSave()
}

export function getSessionAgent(sessionID: string): string | undefined {
  return sessionAgentMap.get(sessionID)
}

export function getRestoredStateCounts(): { subagentSessions: number; agentMappings: number } {
  return {
    subagentSessions: subagentSessions.size,
    agentMappings: sessionAgentMap.size,
  }
}

export function clearSessionAgent(sessionID: string): void {
  sessionAgentMap.delete(sessionID)
  scheduleSave()
}

/**
 * Flush any pending state changes synchronously.
 * Call this during shutdown to ensure state is persisted before process exit.
 */
export function flushStateSync(): boolean {
  // Cancel any pending debounced save
  if (saveTimeout) {
    clearTimeout(saveTimeout)
    saveTimeout = undefined
  }
  
  // Persist current state synchronously
  const state: SessionState = {
    version: 1,
    subagentSessions: Array.from(subagentSessions),
    sessionAgentMap: Object.fromEntries(sessionAgentMap),
  }
  
  return persistence.persistStateSync(state)
}
