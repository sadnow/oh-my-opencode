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

## Contributing Back

These fixes should be contributed upstream via PR.
