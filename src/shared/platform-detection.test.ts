import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test"
import { isWSL, getBinaryLookupCommand, getNativePlatform } from "./platform-detection"

/**
 * Anti-regression tests for platform detection utilities.
 *
 * These tests ensure the fork's cross-platform fixes remain functional:
 * - WSL detection works correctly
 * - Binary lookup uses correct command per platform
 * - Platform identification distinguishes WSL from native Linux
 *
 * @see FORK.md "Cross-Platform Binary Detection (WSL Fix)"
 */
describe("platform-detection", () => {
  describe("getBinaryLookupCommand", () => {
    test("should return 'where' on Windows", () => {
      // This test validates the fix for doctor checks failing on Windows
      // Previously, hardcoded 'which' was used everywhere
      if (process.platform === "win32") {
        expect(getBinaryLookupCommand()).toBe("where")
      }
    })

    test("should return 'which' on non-Windows platforms", () => {
      // Unix/Linux/macOS/WSL should all use 'which'
      if (process.platform !== "win32") {
        expect(getBinaryLookupCommand()).toBe("which")
      }
    })

    test("should always return either 'which' or 'where'", () => {
      // Regression guard: function must return valid command
      const result = getBinaryLookupCommand()
      expect(["which", "where"]).toContain(result)
    })
  })

  describe("isWSL", () => {
    test("should return false on Windows", () => {
      if (process.platform === "win32") {
        expect(isWSL()).toBe(false)
      }
    })

    test("should return false on macOS", () => {
      if (process.platform === "darwin") {
        expect(isWSL()).toBe(false)
      }
    })

    test("should return boolean", () => {
      // Regression guard: function must return boolean, not throw
      expect(typeof isWSL()).toBe("boolean")
    })

    // Note: WSL detection is tested implicitly when running in WSL environment
    // The function checks for "microsoft" or "wsl" in kernel release string
  })

  describe("getNativePlatform", () => {
    test("should return 'win32' on Windows", () => {
      if (process.platform === "win32") {
        expect(getNativePlatform()).toBe("win32")
      }
    })

    test("should return 'darwin' on macOS", () => {
      if (process.platform === "darwin") {
        expect(getNativePlatform()).toBe("darwin")
      }
    })

    test("should return valid platform string", () => {
      // Regression guard: must return non-empty string
      const result = getNativePlatform()
      expect(typeof result).toBe("string")
      expect(result.length).toBeGreaterThan(0)
    })

    test("should distinguish WSL from native Linux", () => {
      // On WSL, should return 'wsl', on native Linux should return 'linux'
      if (process.platform === "linux") {
        const result = getNativePlatform()
        expect(["linux", "wsl"]).toContain(result)
        // Verify consistency with isWSL()
        if (isWSL()) {
          expect(result).toBe("wsl")
        } else {
          expect(result).toBe("linux")
        }
      }
    })
  })
})

describe("platform-detection integration", () => {
  test("getBinaryLookupCommand should match platform expectations", () => {
    // This test documents the expected behavior across platforms
    const platform = getNativePlatform()
    const command = getBinaryLookupCommand()

    if (platform === "win32") {
      expect(command).toBe("where")
    } else {
      // Linux, WSL, macOS all use 'which'
      expect(command).toBe("which")
    }
  })
})
