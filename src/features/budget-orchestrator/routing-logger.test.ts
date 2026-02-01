import { expect, test, describe, beforeEach, afterEach } from "bun:test"
import { RoutingLogger } from "./routing-logger"
import * as fs from "fs"
import * as path from "path"

const TEST_LOG_FILE = "oh-my-opencode-routing-logs.json"

describe("RoutingLogger Persistence", () => {
  let logger: RoutingLogger

  beforeEach(() => {
    if (fs.existsSync(TEST_LOG_FILE)) {
      fs.unlinkSync(TEST_LOG_FILE)
    }
    logger = new RoutingLogger()
  })

  afterEach(() => {
    if (fs.existsSync(TEST_LOG_FILE)) {
      fs.unlinkSync(TEST_LOG_FILE)
    }
  })

  test("should not persist by default", async () => {
    logger.logInfo("tier_change", "Test message")
    expect(fs.existsSync(TEST_LOG_FILE)).toBe(false)
  })

  test("should persist when enabled", async () => {
    logger.setPersist(true)
    logger.logInfo("tier_change", "Persisted message")
    
    // Wait a bit for async write if implemented as such, 
    // but we'll likely use synchronous or awaitable writes.
    // For now assuming it writes immediately or we can check file.
    
    expect(fs.existsSync(TEST_LOG_FILE)).toBe(true)
    const content = JSON.parse(fs.readFileSync(TEST_LOG_FILE, "utf-8"))
    expect(content.length).toBe(1)
    expect(content[0].message).toBe("Persisted message")
  })

  test("should load existing logs on initialization if persist is enabled", async () => {
    const initialLogs = [
      {
        timestamp: new Date().toISOString(),
        level: "info",
        category: "tier_change",
        message: "Existing log"
      }
    ]
    fs.writeFileSync(TEST_LOG_FILE, JSON.stringify(initialLogs))

    const newLogger = new RoutingLogger()
    newLogger.setPersist(true) // This should trigger load
    
    const logs = newLogger.getLogs()
    expect(logs.length).toBe(1)
    expect(logs[0].message).toBe("Existing log")
  })

  test("should rotate logs at 1000 entries", async () => {
    logger.setPersist(true)
    // Add 1005 logs
    for (let i = 0; i < 1005; i++) {
      logger.logInfo("tier_change", `Log ${i}`)
    }

    const logs = logger.getLogs()
    expect(logs.length).toBe(1000)
    // getLogs() returns reversed (most recent first)
    expect(logs[0].message).toBe("Log 1004")
    expect(logs[999].message).toBe("Log 5")

    const fileContent = JSON.parse(fs.readFileSync(TEST_LOG_FILE, "utf-8"))
    expect(fileContent.length).toBe(1000)
    expect(fileContent[0].message).toBe("Log 5") // File is not reversed
    expect(fileContent[999].message).toBe("Log 1004")
  }, 30000) // Increase timeout for 1000 writes

  test("should log debug messages with correct format", async () => {
    const metadata = {
      timestamp: new Date().toISOString(),
      use_case: "chat",
      candidates: ["anthropic", "copilot"],
      weights: { "anthropic": 0.5, "copilot": 1.3 },
      selected: "copilot",
      reason: "highest weight"
    }
    
    logger.logDebug("routing_decision", "Selected copilot", metadata)
    
    const logs = logger.getLogs()
    expect(logs.length).toBe(1)
    expect(logs[0].level).toBe("debug")
    expect(logs[0].category).toBe("routing_decision")
    expect(logs[0].metadata).toEqual(metadata)
  })
})
