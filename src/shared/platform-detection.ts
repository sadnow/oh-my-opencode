import { release, platform } from "node:os"

/**
 * Detects if running inside Windows Subsystem for Linux (WSL).
 * Works by checking the kernel release string for Microsoft/WSL indicators.
 */
export function isWSL(): boolean {
  if (process.platform !== "linux") return false
  try {
    const kernelRelease = release().toLowerCase()
    return kernelRelease.includes("microsoft") || kernelRelease.includes("wsl")
  } catch {
    return false
  }
}

/**
 * Returns the appropriate command to lookup binary paths.
 * - Windows native: `where`
 * - Unix/Linux/WSL/macOS: `which`
 */
export function getBinaryLookupCommand(): "which" | "where" {
  return process.platform === "win32" ? "where" : "which"
}

/**
 * Returns the native platform identifier, distinguishing WSL from native Linux.
 */
export function getNativePlatform(): "win32" | "wsl" | "linux" | "darwin" | string {
  if (process.platform === "win32") return "win32"
  if (process.platform === "darwin") return "darwin"
  if (process.platform === "linux" && isWSL()) return "wsl"
  return process.platform
}
