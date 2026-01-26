# Fork: sadnow/oh-my-opencode

This is a fork of [code-yeongyu/oh-my-opencode](https://github.com/code-yeongyu/oh-my-opencode) with stability fixes and enhanced features.

## What This Fork Adds

### Configuration Presets

Pre-configured model/agent presets optimized for different use cases and budgets.

**Available Presets:**

| Preset | Cost | Best For | Claude Usage |
|--------|------|----------|--------------|
| `balanced` | Moderate | Daily development, parallel agents | ~10% (oracle only) |
| `best` | High | Critical projects, production code | ~60% (heavy) |
| `free` | $0 | Learning, experimentation | 0% (Copilot + Antigravity only) |
| `maintainer-default` | High | Official recommended experience | ~50% |

**Switching Presets:**

```bash
# Linux/macOS/WSL
cd ~/.config/opencode/presets
./switch-preset.sh balanced

# Windows PowerShell
cd $env:USERPROFILE\.config\opencode\presets
.\switch-preset.ps1 balanced
```

Presets configure:
- **Categories**: Task domains with optimal model assignments (visual-engineering, artistry, writing, etc.)
- **Agents**: Specialized workers with tuned models (explore, debug, implement, oracle, sisyphus, etc.)
- **Background Concurrency**: Per-provider and per-model limits for parallel agents

See `~/.config/opencode/presets/README.md` for detailed documentation.

---

### Background Agent Deadlock Detection

**Problem**: When a background task reaches stability (3 polls with same message count) but the session status never becomes idle, the polling loop resets and continues indefinitely. This has been observed to iterate 18,000+ times, consuming resources and never completing.

**Solution**: Added `stabilityResets` counter that tracks consecutive stability resets. After `maxStabilityResets` (default: 10), the task is force-completed with a clear error.

```toml
# oh-my-opencode.toml
[background_task]
maxStabilityResets = 10  # Range: 1-100, default: 10
```

### Session Abort on Deadlock

When deadlock is detected, the session is now properly aborted with a `cancelled` status rather than just completing silently.

---

### Cross-Platform Binary Detection (WSL Fix)

**Problem**: Doctor checks and other binary lookups used hardcoded `which` command, which fails on Windows native (should use `where`).

**Solution**: Added `getBinaryLookupCommand()` in `src/shared/platform-detection.ts` that returns the correct command for each platform:
- Windows native: `where`
- Unix/Linux/WSL/macOS: `which`

Also added `isWSL()` and `getNativePlatform()` utilities for platform-specific behavior.

---

### Ralph Loop Verbosity Reduction

**Problem**: Continuation prompts repeated the full task on every iteration, wasting ~150 tokens per loop. Models also echoed iteration status unnecessarily.

**Solution**:
1. Condensed continuation prompt (no task re-injection)
2. Added explicit instruction to NOT mention iteration counts or time limits
3. Added `verbose_continuations` config option for legacy behavior if needed

```json
// oh-my-opencode.json
{
  "ralph_loop": {
    "enabled": true,
    "verbose_continuations": false  // Set true for old behavior
  }
}
```

---

### Deadlock Detection Enhancements

Added multiple layers of deadlock prevention:

1. **Completion Lock**: Prevents race conditions during task completion
   - `completionInProgress` flag guards against double-completion

2. **Absolute Maximum Runtime**: Tasks force-cancel after 25 minutes
   - Prevents runaway tasks that produce output but never complete

3. **Time-Based Escalation**: After 5 stability resets, threshold reduces to 60%
   - Speeds up deadlock detection for persistently stuck sessions

4. **Activity-Based Grace Period** (v1.x.x+): 30-second window for recent activity
   - If `task.progress.lastUpdate` is within 30s, stability resets are skipped
   - Prevents false deadlock detection for agents processing complex tasks
   - Agents in "busy" state with recent tool calls won't be terminated prematurely

**Recommended config for parallel agents:**

```json
{
  "background_task": {
    "staleTimeoutMs": 600000,
    "maxStabilityResets": 25
  }
}
```

With `maxStabilityResets: 25`, the escalated threshold becomes 15 (vs 6 with default 10), giving agents ~90-120 seconds of processing time instead of ~30-60 seconds.

---

### Ralph Loop Opt-In Config

Ralph loop now requires explicit opt-in (upstream only checks `disabled_hooks`):

```toml
# oh-my-opencode.toml
[ralph_loop]
enabled = true  # Required to enable ralph loop
```

---

## Syncing with Upstream

```bash
git fetch upstream
git merge upstream/dev
```

---

## Changelog (Fork vs Upstream)

This section tracks all changes made in this fork for anti-regression purposes.

### Files Added

| File | Purpose | Tests |
|------|---------|-------|
| `src/shared/platform-detection.ts` | Cross-platform binary detection | `src/shared/platform-detection.test.ts` |

### Files Modified

| File | Change | Anti-Regression Test |
|------|--------|---------------------|
| `src/cli/doctor/checks/dependencies.ts` | Use `getBinaryLookupCommand()` instead of `"which"` | `src/shared/platform-detection.test.ts` |
| `src/cli/doctor/checks/gh.ts` | Use `getBinaryLookupCommand()` instead of `"which"` | `src/cli/doctor/checks/gh.test.ts` |
| `src/hooks/ralph-loop/index.ts` | Condensed continuation prompt, no task re-injection | `src/hooks/ralph-loop/index.test.ts` |
| `src/features/builtin-commands/templates/ralph-loop.ts` | Added "DO NOT mention iteration" instruction | `src/hooks/ralph-loop/index.test.ts` |
| `src/config/schema.ts` | Added `verbose_continuations` option | `src/config/schema.test.ts` |
| `src/features/background-agent/manager.ts` | Deadlock detection: `stabilityResets`, completion lock, max runtime, activity grace period | `src/features/background-agent/manager.test.ts` |
| `src/features/background-agent/types.ts` | Added `completionInProgress`, `stabilityResets` fields | N/A (type definitions) |
| `src/shared/index.ts` | Export platform-detection utilities | N/A (re-exports) |

### Configuration Additions

| Config Key | File | Default | Purpose |
|------------|------|---------|---------|
| `background_task.maxStabilityResets` | `schema.ts` | 10 | Max stability resets before force-cancel |
| `ralph_loop.enabled` | `schema.ts` | false | Explicit opt-in required |
| `ralph_loop.verbose_continuations` | `schema.ts` | false | Use full prompt in continuations |

---

## Running Anti-Regression Tests

```bash
# Run all tests
bun test

# Run fork-specific tests
bun test src/shared/platform-detection.test.ts
bun test src/hooks/ralph-loop/index.test.ts
bun test src/features/background-agent/manager.test.ts

# Type check
bun run typecheck
```

### Key Test Cases to Verify

1. **Platform Detection** (`platform-detection.test.ts`)
   - `getBinaryLookupCommand()` returns `"where"` on Windows, `"which"` elsewhere
   - `isWSL()` correctly detects WSL environment
   - `getNativePlatform()` distinguishes WSL from native Linux

2. **Ralph Loop Verbosity** (`ralph-loop/index.test.ts`)
   - Condensed continuation prompt does NOT include original task
   - `verbose_continuations: true` DOES include original task
   - Continuation includes "DO NOT mention iteration" instruction

3. **Deadlock Detection** (`background-agent/manager.test.ts`)
   - `stabilityResets` increments on each stability reset
   - Task force-cancels after `maxStabilityResets`
   - `completionInProgress` prevents double-completion
   - Tasks force-cancel after 25 minutes max runtime
   - Activity grace period skips stability resets if `lastUpdate` is within 30s

---

## Syncing with Upstream

```bash
git fetch upstream
git merge upstream/dev
# Resolve conflicts, prioritizing fork changes for files listed above
bun test  # Verify anti-regression tests pass
```

## Contributing Back

These fixes should be contributed upstream via PR:
- [ ] Platform detection utilities (PR ready)
- [ ] Ralph loop verbosity reduction (PR ready)
- [ ] Deadlock detection enhancements (PR ready)
- [ ] Configuration presets (documentation only)
