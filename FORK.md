# Fork: sadnow/oh-my-opencode

This is a fork of [code-yeongyu/oh-my-opencode](https://github.com/code-yeongyu/oh-my-opencode) with stability fixes.

## What This Fork Adds

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
