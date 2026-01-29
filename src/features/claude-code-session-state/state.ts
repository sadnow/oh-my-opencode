export const subagentSessions = new Set<string>()
const originalAdd = subagentSessions.add.bind(subagentSessions)
const originalDelete = subagentSessions.delete.bind(subagentSessions)

subagentSessions.add = function(value: string) {
  console.error(`[session-state] subagentSessions.add entry: value=${value}, sessionAgentMap.size=${sessionAgentMap.size}, subagentSessions.size=${subagentSessions.size}, timestamp=${Date.now()}`)
  const result = originalAdd(value)
  console.error(`[session-state] subagentSessions.add exit: value=${value}, sessionAgentMap.size=${sessionAgentMap.size}, subagentSessions.size=${subagentSessions.size}, timestamp=${Date.now()}`)
  return result
}

subagentSessions.delete = function(value: string) {
  console.error(`[session-state] subagentSessions.delete entry: value=${value}, sessionAgentMap.size=${sessionAgentMap.size}, subagentSessions.size=${subagentSessions.size}, timestamp=${Date.now()}`)
  const result = originalDelete(value)
  console.error(`[session-state] subagentSessions.delete exit: value=${value}, sessionAgentMap.size=${sessionAgentMap.size}, subagentSessions.size=${subagentSessions.size}, timestamp=${Date.now()}`)
  return result
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
}

const sessionAgentMap = new Map<string, string>()

export function setSessionAgent(sessionID: string, agent: string): void {
  console.error(`[session-state] setSessionAgent entry: sessionID=${sessionID}, agent=${agent}, sessionAgentMap.size=${sessionAgentMap.size}, subagentSessions.size=${subagentSessions.size}, timestamp=${Date.now()}`)
  if (!sessionAgentMap.has(sessionID)) {
    sessionAgentMap.set(sessionID, agent)
  }
  console.error(`[session-state] setSessionAgent exit: sessionID=${sessionID}, agent=${agent}, sessionAgentMap.size=${sessionAgentMap.size}, subagentSessions.size=${subagentSessions.size}, timestamp=${Date.now()}`)
}

export function updateSessionAgent(sessionID: string, agent: string): void {
  console.error(`[session-state] updateSessionAgent entry: sessionID=${sessionID}, agent=${agent}, sessionAgentMap.size=${sessionAgentMap.size}, subagentSessions.size=${subagentSessions.size}, timestamp=${Date.now()}`)
  sessionAgentMap.set(sessionID, agent)
  console.error(`[session-state] updateSessionAgent exit: sessionID=${sessionID}, agent=${agent}, sessionAgentMap.size=${sessionAgentMap.size}, subagentSessions.size=${subagentSessions.size}, timestamp=${Date.now()}`)
}

export function getSessionAgent(sessionID: string): string | undefined {
  return sessionAgentMap.get(sessionID)
}

export function clearSessionAgent(sessionID: string): void {
  console.error(`[session-state] clearSessionAgent entry: sessionID=${sessionID}, sessionAgentMap.size=${sessionAgentMap.size}, subagentSessions.size=${subagentSessions.size}, timestamp=${Date.now()}`)
  sessionAgentMap.delete(sessionID)
  console.error(`[session-state] clearSessionAgent exit: sessionID=${sessionID}, sessionAgentMap.size=${sessionAgentMap.size}, subagentSessions.size=${subagentSessions.size}, timestamp=${Date.now()}`)
}
