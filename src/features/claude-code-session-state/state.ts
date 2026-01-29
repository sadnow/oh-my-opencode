import { SessionStatePersistence, SessionState } from "./persistence"
import { log } from "../../shared/logger"

export const subagentSessions = new Set<string>()
const originalAdd = subagentSessions.add.bind(subagentSessions)
const originalDelete = subagentSessions.delete.bind(subagentSessions)

const sessionAgentMap = new Map<string, string>()

subagentSessions.add = function(value: string) {
  console.error(`[session-state] subagentSessions.add entry: value=${value}, sessionAgentMap.size=${sessionAgentMap.size}, subagentSessions.size=${subagentSessions.size}, timestamp=${Date.now()}`)
  const result = originalAdd(value)
  scheduleSave()
  console.error(`[session-state] subagentSessions.add exit: value=${value}, sessionAgentMap.size=${sessionAgentMap.size}, subagentSessions.size=${subagentSessions.size}, timestamp=${Date.now()}`)
  return result
}

subagentSessions.delete = function(value: string) {
  console.error(`[session-state] subagentSessions.delete entry: value=${value}, sessionAgentMap.size=${sessionAgentMap.size}, subagentSessions.size=${subagentSessions.size}, timestamp=${Date.now()}`)
  const result = originalDelete(value)
  scheduleSave()
  console.error(`[session-state] subagentSessions.delete exit: value=${value}, sessionAgentMap.size=${sessionAgentMap.size}, subagentSessions.size=${subagentSessions.size}, timestamp=${Date.now()}`)
  return result
} 

// Initialize persistence layer
const persistence = new SessionStatePersistence(process.cwd())

// Load saved state on module initialization
const savedState = persistence.getState()
if (savedState) {
  console.error(`[session-state] Loading saved state: subagentSessions=${savedState.subagentSessions.length}, sessionAgentMap=${Object.keys(savedState.sessionAgentMap).length}, timestamp=${Date.now()}`)
  
  // Restore subagentSessions
  for (const sessionID of savedState.subagentSessions) {
    originalAdd(sessionID)
  }
  
  // Restore sessionAgentMap
  for (const [sessionID, agent] of Object.entries(savedState.sessionAgentMap)) {
    sessionAgentMap.set(sessionID, agent)
  }
  
  console.error(`[session-state] State loaded successfully: sessionAgentMap.size=${sessionAgentMap.size}, subagentSessions.size=${subagentSessions.size}, timestamp=${Date.now()}`)
} else {
  console.error(`[session-state] No saved state found, starting fresh: timestamp=${Date.now()}`)
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
  console.error(`[session-state] setSessionAgent entry: sessionID=${sessionID}, agent=${agent}, sessionAgentMap.size=${sessionAgentMap.size}, subagentSessions.size=${subagentSessions.size}, timestamp=${Date.now()}`)
  if (!sessionAgentMap.has(sessionID)) {
    sessionAgentMap.set(sessionID, agent)
    scheduleSave()
  }
  console.error(`[session-state] setSessionAgent exit: sessionID=${sessionID}, agent=${agent}, sessionAgentMap.size=${sessionAgentMap.size}, subagentSessions.size=${subagentSessions.size}, timestamp=${Date.now()}`)
}

export function updateSessionAgent(sessionID: string, agent: string): void {
  console.error(`[session-state] updateSessionAgent entry: sessionID=${sessionID}, agent=${agent}, sessionAgentMap.size=${sessionAgentMap.size}, subagentSessions.size=${subagentSessions.size}, timestamp=${Date.now()}`)
  sessionAgentMap.set(sessionID, agent)
  scheduleSave()
  console.error(`[session-state] updateSessionAgent exit: sessionID=${sessionID}, agent=${agent}, sessionAgentMap.size=${sessionAgentMap.size}, subagentSessions.size=${subagentSessions.size}, timestamp=${Date.now()}`)
}

export function getSessionAgent(sessionID: string): string | undefined {
  return sessionAgentMap.get(sessionID)
}

export function clearSessionAgent(sessionID: string): void {
  console.error(`[session-state] clearSessionAgent entry: sessionID=${sessionID}, sessionAgentMap.size=${sessionAgentMap.size}, subagentSessions.size=${subagentSessions.size}, timestamp=${Date.now()}`)
  sessionAgentMap.delete(sessionID)
  scheduleSave()
  console.error(`[session-state] clearSessionAgent exit: sessionID=${sessionID}, sessionAgentMap.size=${sessionAgentMap.size}, subagentSessions.size=${subagentSessions.size}, timestamp=${Date.now()}`)
}
