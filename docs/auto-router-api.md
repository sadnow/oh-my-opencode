# Auto-Router API Reference

This document describes the public API for the `/autocode` auto-router system.

## Core Functions

### `createAutoRouter(config?: AutoRouterConfig): AutoRouter`

Creates and configures an auto-router instance.

**Location**: `src/features/auto-router/index.ts`

```typescript
import { createAutoRouter } from "./features/auto-router"

const router = createAutoRouter({
  enabled: true,
  defaultBudget: "free",
  autoEscalate: true,
  maxEscalations: 3,
  qualityThreshold: 0.7,
})
```

**Parameters**:
- `config.enabled` (boolean): Enable/disable auto-routing
- `config.defaultBudget` (BudgetTier): Starting budget tier
- `config.autoEscalate` (boolean): Allow automatic budget escalation
- `config.maxEscalations` (number): Maximum escalation count
- `config.qualityThreshold` (number): Quality score threshold (0-1)

---

### `classifyTask(description: string): TaskClassification`

Analyzes a task description and returns complexity classification.

**Location**: `src/features/auto-router/classifier.ts`

```typescript
import { classifyTask } from "./features/auto-router/classifier"

const classification = classifyTask("implement user authentication with OAuth")
// Returns: { tier: 2, novelty: "familiar", domains: ["backend-logic", "security-sensitive"] }
```

**Returns**:
- `tier` (1 | 2 | 3): Complexity tier
- `novelty` ("known" | "familiar" | "novel"): Familiarity level
- `domains` (DomainSignal[]): Detected domain signals

---

### `selectTechnique(classification: TaskClassification, hasTests: boolean): TechniqueCombo`

Selects the optimal technique combination based on classification.

**Location**: `src/features/auto-router/technique-selector.ts`

```typescript
import { selectTechnique } from "./features/auto-router/technique-selector"

const technique = selectTechnique({ tier: 2, novelty: "familiar" }, true)
// Returns: "ulw"
```

**Returns**: One of:
- `"direct"` - No special orchestration
- `"ulw"` - Ultrawork (parallel agents + TDD)
- `"ultrathink"` - Deep reasoning before action
- `"ralph"` - Persistent execution loop
- `"ulw+ralph"` - Ultrawork with persistence
- `"ultrathink+ulw"` - Deep reasoning + parallel execution
- `"ultrathink+ralph"` - Deep reasoning + persistence
- `"triple"` - Full orchestration (all techniques)

---

## Escalation Manager

### `EscalationManager`

State machine managing budget tier escalation.

**Location**: `src/features/auto-router/escalation-manager.ts`

```typescript
import { EscalationManager } from "./features/auto-router/escalation-manager"

const manager = new EscalationManager({
  startingTier: "free",
  maxEscalations: 3,
  autoEscalate: true,
})

// Record a failure
manager.recordFailure()

// Check if escalation is needed
if (manager.shouldEscalate()) {
  manager.escalate()
}

// Get current state
const state = manager.getState()
// { tier: "cheap", escalationCount: 1, consecutiveFailures: 0 }
```

**Methods**:
- `recordFailure()`: Record a task failure
- `recordSuccess()`: Record a task success
- `shouldEscalate()`: Check if escalation criteria met
- `escalate()`: Move to next budget tier
- `getState()`: Get current escalation state

---

## Budget Tiers

### `BUDGET_TIERS`

Configuration for each budget tier including models and limits.

**Location**: `src/features/auto-router/constants.ts`

```typescript
import { BUDGET_TIERS } from "./features/auto-router/constants"

const expensiveTier = BUDGET_TIERS.expensive
// {
//   name: "expensive",
//   models: {
//     primary: "github-copilot/gpt-5.2",
//     thinking: "github-copilot/claude-sonnet-4",
//     judge: "github-copilot/gpt-4o"
//   },
//   maxIterations: 10,
//   timeoutMs: 180000
// }
```

**Tier Configurations (v3.8.1)**:

| Tier | Primary Model | Thinking Model | Judge Model |
|------|---------------|----------------|-------------|
| free | `opencode/grok-code` | `opencode/glm-4.7-free` | `opencode/glm-4.7-free` |
| cheap | `github-copilot/gpt-4o` | `github-copilot/gpt-4o-mini` | `opencode/glm-4.7-free` |
| moderate | `github-copilot/claude-sonnet-4` | `github-copilot/gpt-4o` | `github-copilot/gpt-4o-mini` |
| expensive | `github-copilot/gpt-5.2` | `github-copilot/claude-sonnet-4` | `github-copilot/gpt-4o` |
| maximum | `github-copilot/claude-opus-4-5` | `github-copilot/gpt-5.2` | `github-copilot/claude-sonnet-4` |

---

## Rate Limit Handler

### `PROVIDER_FALLBACK_CHAIN`

Ordered list of providers for fallback when rate limited.

**Location**: `src/features/auto-router/rate-limit-handler.ts`

```typescript
import { PROVIDER_FALLBACK_CHAIN } from "./features/auto-router/rate-limit-handler"

// Capability-first ordering:
// ["github-copilot", "openai", "google", "opencode", "amazon-bedrock"]
```

### `getModelWithFallback(state: RateLimitState, model: string)`

Returns model with fallback if original provider is rate limited.

```typescript
import { getModelWithFallback, loadRateLimitState } from "./features/auto-router/rate-limit-handler"

const state = loadRateLimitState()
const { model, didFallback } = getModelWithFallback(state, "github-copilot/gpt-5.2")
```

---

## Model Validation

### `validateModelId(model: string): ModelValidationResult`

Validates model IDs and suggests corrections for typos.

**Location**: `src/features/auto-router/constants.ts`

```typescript
import { validateModelId } from "./features/auto-router/constants"

const result = validateModelId("qpt-4o-mini")
// { valid: false, suggestion: "github-copilot/gpt-4o-mini", message: "Did you mean..." }
```

### `KNOWN_MODELS`

Set of all valid model IDs.

```typescript
import { KNOWN_MODELS } from "./features/auto-router/constants"

// Includes:
// - github-copilot/gpt-4o, gpt-4o-mini, gpt-5, gpt-5.1, gpt-5.2, claude-sonnet-4, claude-opus-4-5
// - google/antigravity-gemini-3-flash, antigravity-gemini-3-pro-high
// - opencode/glm-4.7-free, grok-code
// - openai/gpt-4o, gpt-4o-mini, gpt-5, gpt-5.1, gpt-5.2, o1, o1-mini
// - amazon-bedrock/claude-sonnet-4, claude-opus-4-5, claude-haiku-3-5
```

---

## Development Presets

### `DEVELOPMENT_PRESETS`

Pre-configured settings for common development patterns.

**Location**: `src/features/auto-router/constants.ts`

```typescript
import { DEVELOPMENT_PRESETS } from "./features/auto-router/constants"

const gamePreset = DEVELOPMENT_PRESETS["game-prototype"]
// {
//   name: "Game Prototype",
//   description: "Rapid game development iteration, lower quality bar",
//   defaultTechnique: "ulw+ralph",
//   startingBudget: "moderate",
//   maxBudget: "expensive",
//   qualityThreshold: 0.6
// }
```

**Available Presets**:
- `game-prototype` - Rapid game iteration (quality: 0.6)
- `production-app` - Production-quality code (quality: 0.8)
- `quick-fix` - Fast bug fixes (quality: 0.7)
- `security-audit` - Security-sensitive changes (quality: 0.85)
- `exploration` - Research and exploration (quality: 0.65)

---

## Magic Keywords

### `MAGIC_KEYWORDS`

Shortcuts for forcing specific technique/budget combinations.

**Location**: `src/features/auto-router/constants.ts`

| Keyword | Technique | Budget |
|---------|-----------|--------|
| `ultrawork` | ulw | moderate |
| `deepthink` | ultrathink | expensive |
| `fullsend` | triple | maximum |
| `quickfix` | direct | cheap |
| `careful` | ultrathink+ulw | expensive |

**Usage**:
```
/autocode ultrawork: implement the login feature
/autocode fullsend: critical security refactor
```

---

## Agent Provider Mappings

### `selectAgentsForTask(tier, domains, providers)`

Selects which agents to spawn based on task complexity and domain signals.

**Location**: `src/features/auto-router/constants.ts`

```typescript
import { selectAgentsForTask } from "./features/auto-router/constants"

const agents = selectAgentsForTask(2, ["ui-heavy"], ["opencode", "google"])
// [
//   { agentName: "explore", model: "opencode/grok-code" },
//   { agentName: "librarian", model: "opencode/glm-4.7-free" },
//   { agentName: "frontend-ui-ux-engineer", model: "google/gemini-3-pro-preview" }
// ]
```

**Agent Defaults**:
- `explore` - opencode/grok-code (free)
- `librarian` - opencode/glm-4.7-free (free)
- `oracle` - openai/gpt-5.2 (expensive)
- `frontend-ui-ux-engineer` - google/gemini-3-pro-preview (moderate)
- `document-writer` - google/gemini-3-flash (cheap)

---

## Types

### `BudgetTier`

```typescript
type BudgetTier = "free" | "cheap" | "moderate" | "expensive" | "maximum"
```

### `TechniqueCombo`

```typescript
type TechniqueCombo =
  | "direct"
  | "ulw"
  | "ultrathink"
  | "ralph"
  | "ulw+ralph"
  | "ultrathink+ulw"
  | "ultrathink+ralph"
  | "triple"
```

### `DomainSignal`

```typescript
type DomainSignal =
  | "crypto-trading"
  | "real-time"
  | "data-aggregation"
  | "research-analysis"
  | "ui-heavy"
  | "backend-logic"
  | "infrastructure"
  | "documentation"
  | "testing"
  | "security-sensitive"
  | "performance-critical"
```
