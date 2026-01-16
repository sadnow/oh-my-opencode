# Changelog: oh-my-autocode

> **oh-my-autocode** is a fork of [oh-my-opencode](https://github.com/code-yeongyu/oh-my-opencode)
> adding intelligent task orchestration via the `/auto` command.

All notable changes specific to this fork are documented here.

For upstream changes, see the [original repository](https://github.com/code-yeongyu/oh-my-opencode).

---

## [v3.7.0] - 2026-01-16

### Auth Error Fallback & Improved Subagent Logging

Major enhancement to the provider fallback system to handle authentication errors (not just rate limits) and improved visibility into subagent execution.

**Problem Solved:**
When using `/auto`, the system would fail silently when a provider's API key was missing or invalid. For example, "Google Generative AI API key is missing" would cause the task to fail instead of falling back to an available provider.

**Solution:**

#### Extended Error Detection
- New `isProviderUnavailableError(error)` function returns `{ isUnavailable, isAuthError }`
- Detects HTTP 401/403 status codes as auth errors
- Detects API key patterns: "api key", "unauthorized", "forbidden", "missing key", etc.
- Detects provider-specific patterns: `GOOGLE_GENERATIVE_AI_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`
- Backward compatible: `isRateLimitError()` still works (now wraps new function)

#### Auth Error Cooldown
- Auth errors use 30-minute cooldown (vs 1 minute for rate limits)
- Rationale: Auth errors require manual API key configuration
- New `recordProviderAuthError(state, provider, errorMessage)` function
- New `COOLDOWN_MS.auth_error` constant (30 min)

#### Retry-with-Fallback for Subagents
- New `launchSubagentWithFallback()` function with automatic retry
- Attempts up to 3 providers before failing
- Console shows clear "PROVIDER AUTH ERROR" or "PROVIDER RATE LIMIT ERROR" messages
- Fallback chain: github-copilot → google → opencode → amazon-bedrock

#### Verbose Console Output

**On provider error:**
```
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
[AUTO-ROUTER] PROVIDER AUTH ERROR
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
Provider: google
Model: google/antigravity-gemini-3-flash
Error: Google Generative AI API key is missing
Cooldown: 30 minutes
Action: Falling back to opencode
Fallback: google/antigravity-gemini-3-flash → opencode/glm-4.7-free
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
```

**Provider status display:**
```
[AUTO-ROUTER] Provider Status:
----------------------------------------
  github-copilot: ✓ available
  google: ✗ unavailable (cooldown 28m remaining)
  opencode: ✓ available
  amazon-bedrock: ✓ available
  anthropic: ✗ BLOCKED (direct API disabled)
----------------------------------------
```

**Subagent lifecycle:**
```
[SUBAGENT] Launching: auto-expensive
[SUBAGENT]   Model: github-copilot/claude-sonnet-4
[SUBAGENT]   Task: [AUTO-ROUTER] Create mobile game...
[SUBAGENT]   Parent: session_abc1...

[SUBAGENT] Completed: auto-expensive (2m 34s)
[SUBAGENT]   Task ID: bg_abc12345
[SUBAGENT]   Tool Calls: 47
[SUBAGENT]   Model: github-copilot/claude-sonnet-4
```

### Files Changed

| File | Changes |
|------|---------|
| `src/features/auto-router/rate-limit-handler.ts` | Added `isProviderUnavailableError()`, `recordProviderAuthError()`, `COOLDOWN_MS.auth_error` |
| `src/features/auto-router/rate-limit-handler.test.ts` | Added 20 new tests for auth error detection |
| `src/hooks/auto-router/index.ts` | Added `launchSubagentWithFallback()`, `logProviderStatus()`, retry-fallback logic |
| `src/features/background-agent/manager.ts` | Added verbose console output for launch/error/completion |
| `docs/TROUBLESHOOTING.md` | Added provider fallback docs, API limitations, new functions reference |

### OpenCode Plugin API Limitations Documented

Added comprehensive documentation on current OpenCode Plugin API limitations and workarounds:

- `chat.params` hook is read-only (cannot switch models at runtime)
- `chat.error` hook is not exposed (cannot intercept errors directly)
- Workaround: Configure agent variants in `opencode.json` with different models
- Workaround: Error detection via try/catch in subagent spawn

### Testing

- **New tests**: 20 auth error detection tests
- **Total tests**: 1268+ passing
- All TypeScript type checks passing
- Build succeeds

---

## [v3.6.7] - 2026-01-16

### Verbose Model Logging & Setup Wizard

Adds comprehensive model/provider visibility and a Python CLI setup wizard.

**Verbose Logging:**
- Console output shows exactly which model and provider is being used
- Rate limit events display with full provider status
- Model switching clearly indicates fallback vs primary selection

**Console Output Example:**
```
========================================
[AUTO-ROUTER] MODEL SELECTION
========================================
Session: abc12345...
Budget Tier: MODERATE
----------------------------------------
Original Request:
  Provider: github-copilot
  Model: claude-sonnet-4
----------------------------------------
Final Selection:
  Provider: github-copilot
  Model: claude-sonnet-4
  Fallback: NO
========================================
```

**Setup Wizard (autocode_setup.py):**
- Interactive CLI mode with arrow key navigation
- Command-line options mode for scripting
- Rate limit configuration (cooldown periods)
- Provider enable/disable management
- Budget tier presets
- Rebuild option
- Rate limit state reset

**Usage:**
```bash
python autocode_setup.py              # Interactive mode
python autocode_setup.py --options    # Show all options
python autocode_setup.py --status     # Show current config
python autocode_setup.py --set-budget moderate
python autocode_setup.py --enable-verbose --rebuild
```

**New Files:**
- `autocode_setup.py` - Comprehensive CLI setup wizard
- Updated `src/shared/notifications.ts` - New notification functions
- Updated `src/hooks/auto-router/index.ts` - Verbose logging

---

## [v3.6.6] - 2026-01-16

### Rate Limit Protection & Provider Fallback

Implements automatic rate limit detection and provider fallback to prevent hitting API rate limits (especially Claude Max accounts).

**Problem Solved:**
When using `/auto`, the system was hitting Anthropic's rate limits directly (429 errors with "3h 44m retry" messages) despite having budget tier configs for non-direct providers.

**Solution:**
- **Rate limit detection**: Detects 429 errors and `rate_limit_error` responses
- **Circuit breaker pattern**: CLOSED → OPEN → HALF_OPEN → CLOSED
- **Automatic fallback**: Routes to next available provider when rate limited
- **Persistent state**: Survives restarts (`~/.opencode/rate-limit-state.json`)

**Cooldown Periods:**
- Anthropic: 5 minutes
- Other providers: 1 minute

**Provider Fallback Chain:**
1. `github-copilot` (preferred)
2. `google` (Antigravity)
3. `opencode` (free models)
4. `amazon-bedrock` (Bedrock Claude)

**Blocked Providers:**
- `anthropic` (direct API blocked since Jan 2026)

**New Files:**
- `src/features/auto-router/rate-limit-handler.ts` - Core rate limit handling
- `src/features/auto-router/rate-limit-handler.test.ts` - 30 test cases

**Hook Changes:**
- Added `chat.error` handler to detect rate limits
- Modified `chat.params` to apply fallback before model selection
- Added `getRateLimitSummary()` for debugging

### Tests
- **New tests**: 30 rate limit handler tests
- **Total tests**: 1248+ passing

---

## [v3.6.5] - 2026-01-16

### Terminal Cleanup on Exit

Fixes terminal corruption (mouse tracking escape sequences) when OpenCode sessions exit or crash.

**Problem:**
After session exit/crash, PowerShell showed raw SGR mouse tracking codes like `[555;102;13M` when moving mouse.

**Solution:**
- New `src/shared/terminal-cleanup.ts` module with `resetTerminal()` function
- Disables all mouse tracking modes before process exit
- Added to all signal handlers (SIGINT, SIGTERM, SIGBREAK)

**Files Updated:**
- `src/shared/terminal-cleanup.ts` - NEW: Terminal reset function
- `src/tools/lsp/client.ts` - Added resetTerminal() to signal handlers
- `src/features/skill-mcp-manager/manager.ts` - Added resetTerminal() to signal handlers
- `src/features/background-agent/manager.ts` - Added resetTerminal() to registerProcessSignal()
- `src/cli/run/runner.ts` - Added resetTerminal() to SIGINT handler

**What resetTerminal() Does:**
- Disables SGR mouse tracking (`\x1b[?1006l`)
- Disables X11 mouse tracking (`\x1b[?1000l`)
- Resets text attributes (`\x1b[0m`)
- Exits alternate screen buffer
- Shows cursor

---

## [v3.6.4] - 2026-01-15

### Full Session Context Preservation

Implements true session context preservation across sequential `/auto` commands. This completes the work started in v3.6.3.

**What's Fixed:**
- Session context is now stored per-session (not module-scope)
- Context flows through `createAutoRouter` → `classifyTaskWithIntent`
- Intent and tools merge properly between commands
- `PRESERVED CONTEXT` section injected in prompts

**New Functions:**
- `mergeIntents()` - Intelligently inherits intents when current command is vague
- `IntentAwareClassification` - Renamed from `EnhancedClassification` to avoid conflict

**Behavior:**
- Required tools **accumulate** across commands (playwright + cypress = both)
- Explicit intents override preserved intents
- Different sessions remain isolated
- Iteration count increments, createdAt preserved

### Tests
- **Total tests**: 1218 passing (+6 new)
- New tests: session context preservation, tool accumulation, iteration tracking

### OpenCode Version Note

**Important**: OpenCode 1.1.22 has AVX issues with the baseline binary. Use 1.1.19:
```powershell
npm install -g opencode-ai@1.1.19
```

---

## [v3.6.3] - 2026-01-15

### Task Intent Preservation

Fixed critical bug where `/auto "play through entire game with playwright"` would switch to Vercel deployment instead of continuing playwright testing.

**Root Causes Addressed:**
1. Ralph loop threshold too restrictive for testing tasks
2. Project artifacts (vercel.json, DEPLOY.md) contaminated classification
3. "Next step: deploy" in docs overrode user's explicit testing request
4. No preservation of task intent across classification phases

**New Features:**

#### Task Intent Detection (`src/features/auto-router/classifier.ts`)
- `extractTaskIntent()` - Extracts user intent from prompt ONLY (not project artifacts)
- `filterDomainSignalsByIntent()` - Removes infrastructure signals when testing intent detected
- `containsIgnorableArtifactSignals()` - Filters "next step", "recommended", "future work" noise
- Intent types: `test`, `deploy`, `build`, `fix`, `explore`, `refactor`, `unknown`

#### Flexible /auto Command Parsing (`src/hooks/auto-router/constants.ts`)
- `parseAutoCommand()` - Supports quotes, unquoted, and multiline prompts
- No longer requires quotes around task description
- Handles `--options` after task description

#### Ralph Loop Threshold Changes (`src/features/auto-router/wizard.ts`)
- Testing intents (`test`, `play`, `verify`, `validate`, `e2e`) always enable ralph loop
- Browser automation tools (`playwright`, `puppeteer`, `cypress`) always enable ralph loop
- More aggressive persistence for interactive tasks

### Known Limitations

- **Session context not fully implemented**: `sessionContext` variable is updated but not read between commands - sequential `/auto` commands don't truly preserve context yet. Planned for v3.6.4.

### Added
- `TaskIntent` type in `src/hooks/auto-router/types.ts`
- `TASK_INTENT_KEYWORDS` constant with 25+ intent keywords
- `EXPLICIT_TOOL_KEYWORDS` constant with 15+ tool names
- `IGNORED_PROJECT_ARTIFACT_SIGNALS` constant
- 44 new tests for intent preservation and command parsing

### Tests
- **Total tests**: 1212 passing
- **New tests added**: 44 (task intent, parseAutoCommand, session context)
- All TypeScript type checks passing

---

## [v3.2.1-stable-baseline] - 2026-01-15

### Incident: OpenCode AVX CPU Crash

**Issue:** OpenCode would crash immediately on startup with "CPU lacks AVX support" error on Windows systems with older CPUs.

**Root Cause:** OpenCode ships two Windows binaries:
- `opencode-windows-x64` - Requires AVX CPU instructions (modern CPUs)
- `opencode-windows-x64-baseline` - Works on older CPUs (SSE4.2 only)

The launcher script (`bin/opencode`) searches for packages starting with `opencode-windows-x64`. Both binaries match this pattern. The first match wins, which depends on filesystem ordering - essentially random.

**Fix:** Set environment variable to force the baseline binary:
```powershell
[System.Environment]::SetEnvironmentVariable(
  'OPENCODE_BIN_PATH',
  'C:\Users\YOUR_USERNAME\AppData\Roaming\npm\node_modules\opencode-ai\node_modules\opencode-windows-x64-baseline\bin\opencode.exe',
  'User'
)
```

**Affected versions:** All opencode-ai versions (1.1.x) are affected on non-AVX CPUs.

**Documentation:**
- Added `docs/TROUBLESHOOTING.md` with comprehensive troubleshooting guides
- Added troubleshooting section to README.md
- Created GitHub issue for upstream fix

### Added
- `docs/TROUBLESHOOTING.md` - Comprehensive troubleshooting guide
- Troubleshooting section in README.md
- Data sanitization module (`src/shared/sanitize.ts`) - Auto-redacts API keys and credentials from logs
- Verbose notification formatting (`src/shared/notifications.ts`) - Enhanced /auto toast messages
- Meta-development guard hook (`src/hooks/meta-development-guard/`) - Protection for plugin self-modification

---

## [v3.6.0] - 2026-01-15

### Merged from Upstream v3.0.0-beta.8

Synced with 99 commits from upstream, bringing in major improvements while preserving all fork features.

#### Upstream Features Incorporated
- **Bun single-file executable distribution** - Standalone binaries for all platforms
- **Windows/PowerShell support** - Cross-platform shell environment detection
- **Background agent concurrency hardening** - Fixed race conditions and task leaks
- **LSP tools consolidation** - Merged duplicate tools into unified interface
- **Sisyphus-task-retry hook** - New automatic retry mechanism
- **HTTP MCP transport support** - Enhanced MCP connectivity

#### Fork Features Preserved
- All auto-router functionality (`/auto` command)
- Completion-judge integration for ralph-loop
- Free-tier model preferences
- Upstream sync notifications
- Per-provider rate limiting

### Conflict Resolutions
- `src/hooks/ralph-loop/index.ts` - Merged completion-judge with upstream's message storage
- `src/cli/config-manager.ts` - Combined multi-provider fallback with free-tier preferences
- `src/hooks/index.ts` - Added both auto-router and sisyphus-task-retry exports

---

## [v3.5.1] - 2026-01-15

### Added

#### Upstream Sync Notification System

Automatically checks for updates from the upstream repository (`code-yeongyu/oh-my-opencode`) on startup and notifies when new releases are available.

**Features:**
- Compares fork version against upstream releases via GitHub API
- Shows notification on startup if behind upstream
- Provides sync instructions (merge vs rebase)
- Non-blocking - doesn't slow down startup

**Configuration:**
```typescript
// src/features/upstream-sync/index.ts
FORK_BASE_VERSION = {
  basedOnTag: "v3.0.0-beta.7",     // Update after syncing
  basedOnCommit: "325ce12...",     // Update after syncing
  lastSyncDate: "2026-01-10",      // Update after syncing
}
```

**Example notification:**
```
╔════════════════════════════════════════════════════════════════╗
║  UPSTREAM UPDATE AVAILABLE                                     ║
╠════════════════════════════════════════════════════════════════╣
║  Latest upstream release: v3.0.0-beta.8                        ║
║  Your fork is based on:   v3.0.0-beta.7                        ║
║  Commits behind upstream: 99                                   ║
╠════════════════════════════════════════════════════════════════╣
║  To sync your fork with upstream, run:                         ║
║    git fetch upstream                                          ║
║    git merge upstream/dev                                      ║
╚════════════════════════════════════════════════════════════════╝
```

#### Per-Provider Concurrent Agent Rate Limiting

We throttle ourselves out of caution and respect for providers offering free or cheap services.

**Policy:**
- Each provider gets **2 concurrent agents maximum**:
  - 1 free model agent (if provider offers free models)
  - 1 paid model agent
- With 3 providers configured → **6 concurrent agents maximum**
- If a provider only offers paid models, both slots can be used for paid agents

**Example with 3 providers:**

| Provider | Free Agent | Paid Agent | Total |
|----------|------------|------------|-------|
| github-copilot | gpt-4o-mini | claude-sonnet-4 | 2 |
| google | gemini-flash | gemini-pro | 2 |
| opencode | glm-4.7-free | grok-code | 2 |
| **Total** | 3 | 3 | **6** |

**Rationale:**
- Respects provider rate limits
- Avoids overwhelming free tier services
- Ensures fair usage across providers
- Allows budget escalation within each provider's allocation
- Conservative approach to maintain good standing with providers

**New exports:**
```typescript
import {
  AGENTS_PER_PROVIDER,          // 2
  FREE_AGENTS_PER_PROVIDER,     // 1
  PAID_AGENTS_PER_PROVIDER,     // 1
  calculateMaxConcurrentAgents, // (providerCount) => max agents
  getProviderAgentAllocation,   // (providerId, hasFreeModels) => allocation
} from "./constants"
```

#### Claude Models via Copilot-CLI (Refactored)

Updated budget tiers to access Claude models through `github-copilot` provider instead of direct Anthropic API:

| Tier | Model |
|------|-------|
| expensive | `github-copilot/claude-sonnet-4` |
| maximum | `github-copilot/claude-opus-4-5` |

Direct Anthropic API access is blocked for OpenCode as of Jan 2026.

---

## [v3.5.0] - 2026-01-14

### Fixed

#### CRITICAL: Judge Invoker No Longer Fakes Success

**The Problem**: Judge invoker returned `passed: true` even when:
- Judge was disabled/skipped
- LLM parsing failed
- LLM call threw an error

**The Fix**: Now returns honest results:
```typescript
// Before (BROKEN):
if (!llmInvoker) return { passed: true }  // FAKE SUCCESS
if (parseError) return { passed: true }   // FAKE SUCCESS
catch (error) return { passed: true }      // FAKE SUCCESS

// After (HONEST):
if (!llmInvoker) return { passed: null, skipped: true }  // Not evaluated
if (parseError) return { passed: false, error: true }     // Real failure
catch (error) return { passed: false, error: true }       // Real failure
```

#### Silent Error Handlers Now Log

Replaced all `.catch(() => {})` with proper error logging in:
- `src/hooks/auto-router/index.ts`
- `src/hooks/ralph-loop/index.ts`

### Added

#### Agent-Based Model Switching (v3.5.0)

Since OpenCode's `chat.params` API doesn't support runtime model switching, we use the **agent system** instead:

**How it works:**
1. Configure agents with different models in `opencode.jsonc`
2. Auto-router recommends agent based on budget tier
3. Prompt tells AI to use recommended agent for subagents

**Budget Tier → Agent Mapping:**
```typescript
const BUDGET_TIER_AGENTS = {
  free: "auto-free",        // google/gemini-2.5-flash
  cheap: "auto-cheap",      // anthropic/claude-haiku-4-5
  moderate: "auto-moderate", // anthropic/claude-sonnet-4-5
  expensive: "auto-expensive", // claude-sonnet + thinking
  maximum: "auto-maximum",   // anthropic/claude-opus-4-5
}
```

**Sample config**: See `assets/opencode-sample.jsonc`

#### Parallel Agent Spawning (v3.5.0)

Complex tasks (Tier 3, ultrawork, triple) now spawn **parallel exploration agents**:

```typescript
// For complex tasks, auto-router spawns:
// - explore agent: Analyzes codebase structure
// - librarian agent: Finds related implementations

// Conservative limits for rate limits:
const DEFAULT_MAX_PARALLEL_AGENTS = 2
```

**Configuration:**
```json
{
  "auto_router": {
    "parallel_agents": {
      "enabled": true,
      "max_concurrent": 2,
      "agents_for_tier3": ["explore", "librarian"]
    }
  }
}
```

**Toast shows**: `Technique: ulw+ralph | Budget: moderate | 🔄 Ralph Loop | 🚀 2 agents`

### Changed

#### Semantic Search Clearly Marked as Stub

Added prominent warnings that semantic search is NOT implemented:
- Module header warns: "⚠️ THIS IS A STUB IMPLEMENTATION"
- Functions return empty arrays
- Log warning on first use

### Files Changed

| File | Changes |
|------|---------|
| `src/features/auto-router/judge-invoker.ts` | Fix fake success returns |
| `src/features/auto-router/constants.ts` | Add BUDGET_TIER_AGENTS, parallel config |
| `src/features/auto-router/index.ts` | Export new constants |
| `src/features/auto-router/semantic-search.ts` | Add stub warnings |
| `src/hooks/auto-router/index.ts` | Add parallel agents, model tier injection |
| `src/hooks/auto-router/types.ts` | Add BackgroundManagerLike, parallel config |
| `src/hooks/ralph-loop/index.ts` | Replace silent catches |
| `src/index.ts` | Pass backgroundManager to auto-router |
| `assets/opencode-sample.jsonc` | NEW: Sample config with tier agents |

---

## [v3.4.0] - 2026-01-14

### Fixed

#### CRITICAL: Auto-Router Now Actually WORKS (Not Just Cosmetic!)

**The Problem**: `/auto` command was purely cosmetic. It:
- Classified tasks and showed toasts
- Added text saying "ralph loop enabled"
- **BUT did NOT actually start ralph-loop**
- **Did NOT change execution behavior at all**

**The Fix**: Auto-router now ACTUALLY integrates with ralph-loop:

```typescript
// In src/index.ts - After auto-router classifies:
if (autoRouter && ralphLoop) {
  const routerState = autoRouter.getSessionState(input.sessionID);
  if (routerState?.ralphLoopEnabled && routerState.taskDescription) {
    // ACTUALLY start ralph-loop with auto-router's config
    ralphLoop.startLoop(input.sessionID, routerState.taskDescription, {
      maxIterations: budgetConfig.maxIterations,
    });
  }
}
```

**New Behavior**:
- `/auto "task"` → Classifies task → Determines technique
- If technique includes "ralph" → **Ralph loop ACTUALLY STARTS**
- Ralph loop uses budget tier's `maxIterations` config
- Toast shows technique + budget + "Ralph Loop" indicator

### Changed

#### Auto-Router Hook Now Properly Instantiated

**Before**: `createAutoRouterHook` was imported but NEVER called in `src/index.ts`
**After**: Auto-router hook is now properly instantiated and wired up:

```typescript
// src/index.ts
const autoRouter = isHookEnabled("auto-router")
  ? createAutoRouterHook(ctx, {
      config: pluginConfig.auto_router,
      directory: ctx.directory,
    })
  : null;

// chat.message handler now calls auto-router
await autoRouter?.["chat.message"]?.(input, output);

// event handler now calls auto-router
await autoRouter?.event(input);
```

#### Model Config Helpers Added

New helper functions for budget tier model configuration:

```typescript
// src/features/auto-router/constants.ts
export interface ModelConfig {
  providerID: string
  modelID: string
}

export function parseModelString(modelString: string): ModelConfig
export function getBudgetTierModelConfig(tier: BudgetTier): ModelConfig
```

### Known Limitation

**Model Switching Not Supported**: OpenCode's plugin API `chat.params` hook does NOT support runtime model switching. The `output` object only allows modifying `temperature`, `topP`, `topK`, and `options` - not the model itself.

The auto-router's budget tier model recommendations are injected into the prompt, but the actual model used is determined by session/agent configuration, not dynamically switched.

**Workaround**: Configure different agents in OpenCode with different models, and the auto-router's prompt will recommend which agent/model tier should be used.

**Files Changed**:
- `src/index.ts` - Added auto-router instantiation and ralph-loop integration
- `src/hooks/auto-router/index.ts` - Added `chat.params` handler (internal use)
- `src/hooks/auto-router/types.ts` - Fixed type compatibility with plugin API
- `src/features/auto-router/constants.ts` - Added model config helpers

---

## [v3.3.1] - 2026-01-14

### Fixed

#### CRITICAL: Ralph Loop Now VERIFIES Completion (No More Lies!)

**The Problem**: AI would claim `<promise>DONE</promise>` when task was NOT actually done. Ralph loop blindly trusted this marker.

**The Fix**: Ralph loop now runs **mandatory verification checks** BEFORE accepting completion:

```typescript
// When AI says "DONE", we now verify:
1. TypeScript compilation (npx tsc --noEmit)
2. Build command (npm run build / bun run build)
3. Entry point exists (index.html or src/index.ts)

// If verification FAILS:
- Reject the completion claim
- Inject error message: "You claimed done but checks FAILED: [errors]"
- Continue the loop until ACTUALLY fixed
```

**New Behavior**:
- `<promise>DONE</promise>` + verification pass → ✅ Actually complete
- `<promise>DONE</promise>` + verification fail → ❌ "No you're not, fix these errors"
- Toast shows "Verification Failed!" when AI lies about completion

**Files Changed**:
- `src/hooks/ralph-loop/index.ts` - Added `runVerificationChecks()` and verification logic

---

## [v3.3.0] - 2026-01-14

### Changed

#### Resource Optimization - Minimize Tokens While Maintaining Quality

**Key Principle**: Simple tasks use minimal resources; complex tasks get appropriate investment.

**Technique Selection Matrix (Tier 1 Updates)**:
```typescript
// BEFORE (wasteful):
"tier1-familiar-notests": "ulw"       // Parallel agents for simple task
"tier1-novel-notests": "ulw+ralph"    // Full persistence for simple task

// AFTER (optimized):
"tier1-familiar-notests": "direct"    // Direct execution - no overhead
"tier1-novel-notests": "ulw"          // Exploration only when needed
```

**Proactive Budget Assignment**:
- Tier 1 tasks: `free` budget (simple, complete quickly)
- Tier 2 familiar: `cheap` budget
- Tier 2 novel: `moderate` budget
- Tier 3 known: `moderate` budget
- Tier 3 novel: `expensive` budget (avoid wasting iterations)

**Intelligent Ralph Loop**:
Ralph loop is now enabled ONLY when actually needed:
- Tier 3 complex tasks (always need persistence)
- Tier 2 novel tasks (exploration may require multiple tries)
- High-risk domains: crypto-trading, security-sensitive
- NOT enabled for Tier 1 tasks or Tier 2 familiar tasks

#### Wizard-Classifier Integration

New complexity-aware wizard functions:
```typescript
// Determine if ralph loop is needed
shouldEnableRalphLoop(complexityTier, noveltyLevel, domainSignals, fullAutonomy)

// Select technique based on classification
selectTechniqueFromClassification(classification, fullAutonomy)

// Get minimum budget for complexity
getMinBudgetForComplexity(complexityTier, noveltyLevel)

// Build config with classification data
buildConfigFromAnswersWithClassification(answers, classification)
```

### Added

#### Example Test Scenarios

**Simple Game Update** (Bird Death Sound):
- Task: "Add screaming sound effect when the bird dies"
- Expected: Tier 1, `direct` technique, `cheap` budget
- Result: ✅ No ralph loop wasted, minimal resources used

**Angry Birds Clone** (Complex Task):
- Task: "Create an Angry Birds clone game with physics, collision, abilities..."
- Expected: Tier 2+, ralph-loop technique, `moderate+` budget
- Result: ✅ Ralph loop enabled, higher budget for quality

### Testing
- **41 total test cases** (was 35)
  - 7 core routing tests
  - 10 edge case tests
  - 7 integration tests
  - 6 wizard tests
  - 4 production-ready tests
  - 6 v3.3.0 resource optimization tests
  - 1 escalation manager test

---

## [v3.2.0] - 2026-01-14

### Added

#### Wizard Mode (`/auto-wizard` interface)
Interactive configuration flow for "complete autonomy for almost-dummies".

**Features:**
- 4-question wizard flow: project type, criticality, autonomy, budget
- Quick config presets: quick-fix, standard, production, free-only, full-power
- Command-line flag parsing: `--free`, `--quick`, `--production`, `--critical`, `--supervised`
- Human-readable configuration summary
- State machine for multi-step wizard progress

**Usage:**
```typescript
// Interactive wizard
const questions = getWizardQuestions()
const result = buildConfigFromAnswers(answers)

// Quick presets
const config = createQuickConfig("production") // ulw+ralph, quality 0.8

// CLI flags
const partial = parseWizardFlags(["--free", "--quick"])
```

#### Free Model Budget Tier
$0 cost option using free model APIs.

**Configuration:**
- Primary: `opencode/glm-4.7-free`
- Thinking: `opencode/grok-code`
- Judge: `opencode/glm-4.7-free`
- Max iterations: 3 (same as cheap)
- Timeout: 120s (longer for free models)

**Escalation:**
- Free → Cheap after 2 consecutive failures
- Free → Cheap on quality score < 0.5
- Free → Cheap on stuck pattern detection

#### Ralph-Loop Auto-Enable
Automatic persistence mode when technique includes "ralph".

**Features:**
- Techniques with ralph: `ralph`, `ulw+ralph`, `ultrathink+ralph`, `triple`
- Auto-injects ralph-loop instructions into prompt
- Session state tracks `ralphLoopEnabled` and `technique`
- Toast notification shows "🔄 Ralph Loop" when enabled
- `isRalphLoopEnabled(sessionId)` API for external access

#### Production-Ready Checklist
Verification system for task completion quality gates.

**Checks:**
- Build pass (npm/bun/yarn build)
- Clean diagnostics (TypeScript errors)
- Tests pass (npm/bun/yarn test)
- LLM judge approval (quality threshold)

**API:**
```typescript
const result = await verifyProductionReady(config.productionReadyChecks, {
  directory: process.cwd(),
  judgeScore: 0.85,
  qualityThreshold: 0.7,
})
// result.allPassed, result.checks, result.summary

const report = formatChecklistReport(result)
```

**Default Configuration:**
- Build: required
- Diagnostics: required
- Tests: optional
- Judge: optional

### Changed

#### Budget Tier Order
- Now 5 tiers: free → cheap → moderate → expensive → maximum
- Quality thresholds: free=0.5, cheap=0.6, moderate=0.7, expensive=0.8, maximum=0.85

#### AutoRouterConfig Extended
New fields added:
- `wizardMode?: boolean` - Enable wizard prompts
- `fullAutonomy?: boolean` - Run without interruption
- `productionReadyChecks?` - Completion verification config

### Testing
- **35 total test cases** (was 23)
  - 8 core + 10 edge cases + 7 integration + 6 wizard + 4 production-ready

---

## [v3.1.0] - 2026-01-14

### Added

#### Technique Orchestration (`/auto` command)
Intelligent task routing system that goes beyond simple model selection.

**Features:**
- `/auto "task description"` command for automatic technique selection
- 10 execution techniques: direct, ulw, ultrathink, ralph, and 7 combinations
- 4-tier budget system (cheap → moderate → expensive → maximum)
- Automatic budget escalation based on failure patterns and quality scores
- Project-type awareness (10 types: web-app, api-server, game, cli, etc.)
- LLM-as-judge quality rubrics for evaluation
- Domain-specific overrides (crypto-trading, security-sensitive, etc.)

**Technical:**
- Task classification with 11 domain signals and 3 complexity tiers
- Memory-safe session management (max 100 sessions, 1-hour expiry)
- Race condition protection in escalation logic
- Type-safe implementation with Zod validation

**Usage:**
```
/auto "fix the typo in README"                    # Simple → direct technique
/auto "implement user auth with JWT"              # Moderate → ulw+ralph
/auto "refactor payment system for PCI compliance" # Complex → triple technique
/auto "task" --budget=expensive                   # Budget override
/auto "task" --force-technique=ultrathink         # Technique override
```

**Files:**
- `src/features/auto-router/` - Core feature (~3,500 LOC)
- `src/hooks/auto-router/` - Hook integration (~500 LOC)
- `src/config/schema.ts` - Config schema extension

#### Development Presets
Auto-application of optimal settings based on project type.

**Features:**
- 5 development presets: `quick-fix`, `production-app`, `game-prototype`, `security-audit`, `exploration`
- Automatic preset selection based on project type and domain signals
- Technique and budget adjustments based on preset configuration
- Quality threshold enforcement per preset

**Preset Mappings:**
| Project Type | Default Preset |
|--------------|----------------|
| game | game-prototype |
| web-app, api-server, library, data-pipeline, monorepo | production-app |
| cli, bot, static-site | quick-fix |
| indexer-crawler | exploration |
| crypto-trading, security-sensitive (domain) | security-audit |

#### Magic Keywords Integration
User shortcuts for forcing specific technique/budget combinations.

**Keywords:**
- `ultrawork:` / `ulw:` → ulw technique, moderate budget
- `deepthink:` → ultrathink technique, expensive budget
- `fullsend:` → triple technique, maximum budget
- `quickfix:` → direct technique, cheap budget
- `secure:` → ulw+ralph technique, expensive budget

**Usage:**
```
/auto ultrawork: implement a new feature    # Forces ulw + moderate budget
/auto deepthink: complex algorithm design   # Forces ultrathink + expensive budget
/auto fullsend: critical payment refactor   # Forces triple technique + maximum budget
```

#### Analytics Tracking
Session-scoped analytics for technique effectiveness learning.

**Features:**
- Execution history tracking (max 1000 records)
- Per-technique statistics (success rate, avg duration, escalation count)
- Per-project-type and complexity breakdown
- Recommended technique suggestions based on historical performance
- Cost savings estimation
- Export/import for persistence

**API:**
```typescript
// Record an execution
recordExecution({ technique, projectType, complexityTier, success, duration, ... })

// Get technique statistics
getTechniqueStats("ultrathink") // → { successRate, avgDuration, ... }

// Get analytics summary
getAnalyticsSummary() // → { recommendations, costSavingsEstimate, ... }

// Get recommended technique
getRecommendedTechnique(projectType, complexity, signals) // → "ulw+ralph"
```

#### Judge Invoker Integration
Integrates LLM-as-judge evaluation into the execution flow.

**Features:**
- `invokeJudge()` function for triggering quality evaluation
- Automatic threshold determination based on classification and budget
- Quality gate pass/fail with detailed rubric scores
- Format helpers for displaying judge results
- Error-tolerant (doesn't fail task on judge errors)

**API:**
```typescript
const result = await invokeJudge(
  classification,
  taskDescription,
  codeOutput,
  { enabled: true, budgetTier: "moderate" },
  llmInvoker
)
// result.passed, result.evaluation, result.reason
```

#### Semantic Search Interface (Skeleton)
Foundation for future vector/semantic search integration.

**Features:**
- `SemanticSearchProvider` interface for pluggable backends
- `searchCodeContext()` for relevant code retrieval
- `findDefinitions()` and `findUsageExamples()` helpers
- `enhanceClassificationWithContext()` for context-enriched classification
- Stub provider (returns empty results until real provider configured)

**Future Integration Points:**
- Vector embeddings (OpenAI, Voyage, local models)
- Vector databases (ChromaDB, Pinecone, Qdrant)
- AST-based search (tree-sitter, ast-grep)
- Hybrid search (semantic + structural + text)

### Fixed
- Magic keywords were defined but never integrated - now properly detected in hook
- TypeScript type mismatches in judge-invoker (RubricScoreData.total vs .score)
- `createEscalationManager` factory missing `maxBudget` parameter

### Testing
- 23 total test cases (8 core + 8 edge cases + 7 integration)
- Project detection, judge rubrics, end-to-end, routing summary
- Escalation transitions, prompt structure, parse judge response

---

## Comparison with Upstream

| Feature | Upstream | This Fork |
|---------|----------|-----------|
| Task routing | Keyword detection | Intelligent classification |
| Model selection | Manual per-agent | Automatic based on complexity |
| Technique selection | User specifies | Auto-selected from 10 strategies |
| Budget management | Fixed per agent | Adaptive escalation (5 tiers) |
| Quality assessment | None | LLM-as-judge rubrics |
| Project awareness | None | 10 project types detected |
| Free models | None | $0 tier with free model support |
| Interactive setup | None | Wizard mode for easy config |
| Completion checks | None | Production-ready verification |
| Persistence mode | Manual | Auto-enable ralph-loop |
| Resource optimization | None | Complexity-aware routing (v3.3.0) |
| Simple task handling | Same as complex | Direct execution, minimal overhead |
| Proactive budgeting | None | Higher budget for complex tasks upfront |
| Auto-router + Ralph | Not integrated | `/auto` command STARTS ralph-loop (v3.4.0) |
| Completion verification | None | Build + TypeScript checks before accepting DONE |
