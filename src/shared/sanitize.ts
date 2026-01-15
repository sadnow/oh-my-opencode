/**
 * Data Sanitization Module
 *
 * Auto-sanitizes sensitive data (API keys, tokens, credentials) from logs,
 * toast notifications, and audit trails to prevent credential leakage.
 *
 * @module oh-my-autocode/shared/sanitize
 */

// ============================================================================
// Sensitive Data Patterns
// ============================================================================

/**
 * Patterns that indicate a key name contains sensitive data
 */
const SENSITIVE_KEY_PATTERNS: RegExp[] = [
  /api[_-]?key/i,
  /secret/i,
  /token/i,
  /password/i,
  /credential/i,
  /auth[_-]?key/i,
  /bearer/i,
  /private[_-]?key/i,
  /access[_-]?key/i,
  /session[_-]?id/i,
  /refresh[_-]?token/i,
  /client[_-]?secret/i,
]

/**
 * Patterns that indicate a value looks like a credential
 */
const SENSITIVE_VALUE_PATTERNS: RegExp[] = [
  /^sk-[a-zA-Z0-9]{20,}$/,                    // OpenAI API key
  /^sk-proj-[a-zA-Z0-9_-]{20,}$/,             // OpenAI project key
  /^sk-ant-[a-zA-Z0-9_-]{20,}$/,              // Anthropic API key
  /^AIza[a-zA-Z0-9_-]{30,}$/,                 // Google API key
  /^ghp_[a-zA-Z0-9]{36,}$/,                   // GitHub personal access token
  /^gho_[a-zA-Z0-9]{36,}$/,                   // GitHub OAuth token
  /^ghs_[a-zA-Z0-9]{36,}$/,                   // GitHub server-to-server token
  /^github_pat_[a-zA-Z0-9_]{20,}$/,           // GitHub fine-grained PAT
  /^Bearer\s+[a-zA-Z0-9._-]+$/i,              // Bearer token
  /^ya29\.[a-zA-Z0-9_-]+$/,                   // Google OAuth2 access token
  /^eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\./,  // JWT token
  /^xox[baprs]-[a-zA-Z0-9-]+$/,               // Slack token
  /^npm_[a-zA-Z0-9]{36,}$/,                   // npm token
]

/**
 * Environment variable names that are known to contain secrets
 */
const SENSITIVE_ENV_VARS: string[] = [
  "ANTHROPIC_API_KEY",
  "OPENAI_API_KEY",
  "GOOGLE_API_KEY",
  "GITHUB_TOKEN",
  "GITHUB_PAT",
  "NPM_TOKEN",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_SESSION_TOKEN",
  "AZURE_CLIENT_SECRET",
  "DATABASE_URL",
  "REDIS_URL",
  "POSTGRES_PASSWORD",
  "MYSQL_PASSWORD",
  "JWT_SECRET",
  "SESSION_SECRET",
  "ENCRYPTION_KEY",
]

// ============================================================================
// Sanitization Functions
// ============================================================================

/**
 * Check if a key name suggests sensitive data
 */
export function isSensitiveKey(key: string): boolean {
  // Check against known env var names
  if (SENSITIVE_ENV_VARS.includes(key.toUpperCase())) {
    return true
  }
  // Check against patterns
  return SENSITIVE_KEY_PATTERNS.some(pattern => pattern.test(key))
}

/**
 * Check if a value looks like a credential
 */
export function isSensitiveValue(value: string): boolean {
  return SENSITIVE_VALUE_PATTERNS.some(pattern => pattern.test(value))
}

/**
 * Redact a sensitive value, showing only first and last few characters
 */
export function redactValue(value: string): string {
  if (value.length <= 8) {
    return "[REDACTED]"
  }
  // Show first 4 and last 4 characters for debugging
  return `${value.slice(0, 4)}...${value.slice(-4)} [REDACTED]`
}

/**
 * Sanitize a single value based on its key and content
 */
export function sanitizeValue(key: string, value: unknown): unknown {
  if (value === null || value === undefined) {
    return value
  }

  if (typeof value === "string") {
    // Check if key name suggests sensitive data
    if (isSensitiveKey(key)) {
      return redactValue(value)
    }
    // Check if value looks like a credential
    if (isSensitiveValue(value)) {
      return redactValue(value)
    }
    return value
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value
  }

  if (Array.isArray(value)) {
    return value.map((item, index) => sanitizeValue(`${key}[${index}]`, item))
  }

  if (typeof value === "object") {
    return sanitizeObject(value as Record<string, unknown>)
  }

  return value
}

/**
 * Recursively sanitize all values in an object
 */
export function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(obj)) {
    result[key] = sanitizeValue(key, value)
  }

  return result
}

/**
 * Sanitize any data for safe logging
 * This is the main entry point for sanitization
 */
export function sanitizeForLogging(data: unknown): unknown {
  if (data === null || data === undefined) {
    return data
  }

  if (typeof data === "string") {
    // Check if the string itself looks like a credential
    if (isSensitiveValue(data)) {
      return redactValue(data)
    }
    return data
  }

  if (typeof data === "number" || typeof data === "boolean") {
    return data
  }

  if (Array.isArray(data)) {
    return data.map((item, index) => sanitizeValue(String(index), item))
  }

  if (typeof data === "object") {
    return sanitizeObject(data as Record<string, unknown>)
  }

  return data
}

/**
 * Sanitize error messages that might contain credentials
 */
export function sanitizeErrorMessage(message: string): string {
  let sanitized = message

  // Replace any string that looks like an API key
  // Remove anchors (^ and $) from patterns to match within text
  for (const pattern of SENSITIVE_VALUE_PATTERNS) {
    const source = pattern.source
      .replace(/^\^/, "")  // Remove leading anchor
      .replace(/\$$/, "")  // Remove trailing anchor
    sanitized = sanitized.replace(new RegExp(source, "g"), "[REDACTED]")
  }

  return sanitized
}

/**
 * Sanitize a URL that might contain credentials in query params or auth
 */
export function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url)

    // Redact password in URL
    if (parsed.password) {
      parsed.password = "[REDACTED]"
    }

    // Redact sensitive query params
    for (const [key] of parsed.searchParams.entries()) {
      if (isSensitiveKey(key)) {
        parsed.searchParams.set(key, "[REDACTED]")
      }
    }

    return parsed.toString()
  } catch {
    // If URL parsing fails, just return the original with basic redaction
    return sanitizeErrorMessage(url)
  }
}

// ============================================================================
// Test Helpers (for verification)
// ============================================================================

/**
 * Test if sanitization is working correctly
 * @internal
 */
export function testSanitization(): { passed: boolean; failures: string[] } {
  const failures: string[] = []

  // Test key detection
  const sensitiveKeys = ["api_key", "apiKey", "API_KEY", "secret", "token", "password"]
  for (const key of sensitiveKeys) {
    if (!isSensitiveKey(key)) {
      failures.push(`Failed to detect sensitive key: ${key}`)
    }
  }

  // Test value detection
  const sensitiveValues = [
    "sk-1234567890abcdefghijklmnop",
    "AIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz12345",
    "ghp_abcdefghijklmnopqrstuvwxyz123456789012",
  ]
  for (const value of sensitiveValues) {
    if (!isSensitiveValue(value)) {
      failures.push(`Failed to detect sensitive value: ${value.slice(0, 10)}...`)
    }
  }

  // Test object sanitization
  const testObj = {
    api_key: "sk-secret123456789012345678901234",
    safe_value: "hello world",
    nested: {
      password: "super_secret",
    },
  }
  const sanitized = sanitizeObject(testObj) as Record<string, unknown>
  if (typeof sanitized.api_key === "string" && !sanitized.api_key.includes("[REDACTED]")) {
    failures.push("Failed to sanitize api_key in object")
  }

  return {
    passed: failures.length === 0,
    failures,
  }
}
