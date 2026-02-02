import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test"
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"

const TEST_DIR = join(tmpdir(), "omo-test-session-manager-tools")
const TEST_MESSAGE_STORAGE = join(TEST_DIR, "message")
const TEST_PART_STORAGE = join(TEST_DIR, "part")
const TEST_SESSION_STORAGE = join(TEST_DIR, "session")
const TEST_TODO_DIR = join(TEST_DIR, "todos")
const TEST_TRANSCRIPT_DIR = join(TEST_DIR, "transcripts")

mock.module("./constants", () => ({
  OPENCODE_STORAGE: TEST_DIR,
  MESSAGE_STORAGE: TEST_MESSAGE_STORAGE,
  PART_STORAGE: TEST_PART_STORAGE,
  SESSION_STORAGE: TEST_SESSION_STORAGE,
  TODO_DIR: TEST_TODO_DIR,
  TRANSCRIPT_DIR: TEST_TRANSCRIPT_DIR,
  SESSION_LIST_DESCRIPTION: "test",
  SESSION_READ_DESCRIPTION: "test",
  SESSION_SEARCH_DESCRIPTION: "test",
  SESSION_INFO_DESCRIPTION: "test",
  SESSION_DELETE_DESCRIPTION: "test",
  TOOL_NAME_PREFIX: "session_",
}))

import { session_list, session_read, session_search, session_info } from "./tools"
import { createMockToolContext } from "../../shared/test-utils"

const mockContext = createMockToolContext()

describe("session-manager tools", () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true })
    }
    mkdirSync(TEST_DIR, { recursive: true })
    mkdirSync(TEST_MESSAGE_STORAGE, { recursive: true })
    mkdirSync(TEST_PART_STORAGE, { recursive: true })
    mkdirSync(TEST_SESSION_STORAGE, { recursive: true })
    mkdirSync(TEST_TODO_DIR, { recursive: true })
    mkdirSync(TEST_TRANSCRIPT_DIR, { recursive: true })

    // Create a test session
    const sessionID = "ses_test123"
    const sessionPath = join(TEST_MESSAGE_STORAGE, sessionID)
    mkdirSync(sessionPath, { recursive: true })
    writeFileSync(
      join(sessionPath, "msg_1.json"),
      JSON.stringify({
        id: "msg_1",
        role: "user",
        content: "hello",
        time: { created: Date.now() },
      })
    )

    // Create parts for the message
    const partDir = join(TEST_PART_STORAGE, "msg_1")
    mkdirSync(partDir, { recursive: true })
    writeFileSync(
      join(partDir, "part_1.json"),
      JSON.stringify({
        id: "part_1",
        type: "text",
        text: "hello world",
      })
    )

    // Create session metadata
    const projectID = "proj_test"
    const projectDir = join(TEST_SESSION_STORAGE, projectID)
    mkdirSync(projectDir, { recursive: true })
    writeFileSync(
      join(projectDir, `${sessionID}.json`),
      JSON.stringify({
        id: sessionID,
        projectID,
        directory: process.cwd(),
        time: { created: Date.now(), updated: Date.now() },
      })
    )
  })

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true })
    }
  })

  test("session_list executes without error", async () => {
    const result = await session_list.execute({}, mockContext)
    
    expect(typeof result).toBe("string")
    expect(result).toContain("ses_test123")
  })

  test("session_list respects limit parameter", async () => {
    const result = await session_list.execute({ limit: 5 }, mockContext)
    
    expect(typeof result).toBe("string")
  })

  test("session_list filters by date range", async () => {
    const result = await session_list.execute({
      from_date: "2025-12-01T00:00:00Z",
      to_date: "2026-12-31T23:59:59Z",
    }, mockContext)
    
    expect(typeof result).toBe("string")
  })

  test("session_list filters by project_path", async () => {
    // #given
    const projectPath = process.cwd()

    // #when
    const result = await session_list.execute({ project_path: projectPath }, mockContext)

    // #then
    expect(typeof result).toBe("string")
    expect(result).toContain("ses_test123")
  })

  test("session_list uses process.cwd() as default project_path", async () => {
    // #given - no project_path provided

    // #when
    const result = await session_list.execute({}, mockContext)

    // #then - should not throw and return string (uses process.cwd() internally)
    expect(typeof result).toBe("string")
    expect(result).toContain("ses_test123")
  })

  test("session_read handles non-existent session", async () => {
    const result = await session_read.execute({ session_id: "ses_nonexistent" }, mockContext)
    
    expect(result).toContain("not found")
  })

  test("session_read executes with valid parameters", async () => {
    const result = await session_read.execute({
      session_id: "ses_test123",
      include_todos: true,
      include_transcript: true,
    }, mockContext)
    
    expect(typeof result).toBe("string")
    expect(result).toContain("hello world")
  })

  test("session_read respects limit parameter", async () => {
    const result = await session_read.execute({
      session_id: "ses_test123",
      limit: 10,
    }, mockContext)
    
    expect(typeof result).toBe("string")
  })

  test("session_search executes without error", async () => {
    const result = await session_search.execute({ query: "hello" }, mockContext)
    
    expect(typeof result).toBe("string")
    expect(result).toContain("ses_test123")
  })

  test("session_search filters by session_id", async () => {
    const result = await session_search.execute({
      query: "hello",
      session_id: "ses_test123",
    }, mockContext)
    
    expect(typeof result).toBe("string")
    expect(result).toContain("ses_test123")
  })

  test("session_search respects case_sensitive parameter", async () => {
    const result = await session_search.execute({
      query: "HELLO",
      case_sensitive: true,
    }, mockContext)
    
    expect(typeof result).toBe("string")
    expect(result).not.toContain("ses_test123")
  })

  test("session_search respects limit parameter", async () => {
    const result = await session_search.execute({
      query: "hello",
      limit: 5,
    }, mockContext)
    
    expect(typeof result).toBe("string")
  })

  test("session_info handles non-existent session", async () => {
    const result = await session_info.execute({ session_id: "ses_nonexistent" }, mockContext)
    
    expect(result).toContain("not found")
  })

  test("session_info executes with valid session", async () => {
    const result = await session_info.execute({ session_id: "ses_test123" }, mockContext)
    
    expect(typeof result).toBe("string")
    expect(result).toContain("ses_test123")
  })
})
