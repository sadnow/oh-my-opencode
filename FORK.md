# oh-im-broke

**A budget-focused fork of [oh-my-opencode](https://github.com/code-yeongyu/oh-my-opencode)**

## Why "oh-im-broke"?

A playful take on "oh-my-opencode" that reflects the fork's main philosophy: **vibe code without breaking the bank.**

This fork prioritizes cost-efficiency while maintaining the power of multi-model orchestration. Perfect for developers who want professional-grade AI coding assistance on a budget.

## Key Changes from Upstream

### Deadlock Detection for Background Agents

The primary addition in this fork is robust deadlock detection and recovery for background agent tasks:

- **Stability-based completion**: Tasks are marked stable after 3 consecutive idle polls with no message count changes
- **Deadlock detection**: If a task reaches stability but isn't actually idle (still "busy"), it's flagged as potentially deadlocked
- **Automatic recovery**: After `maxStabilityResets` (default: 3) deadlock detections, the task is force-cancelled with detailed logging
- **Absolute timeout**: 25-minute hard limit prevents infinite hangs

See `src/features/background-agent/manager.ts` for implementation details.

### Additional Fixes

- **Async bug fix in notification context**: Fixed race condition where agent/model context wasn't available during parent session notifications (manager.ts:1091-1099)
- **Sync fallback for error paths**: Error handling now uses synchronous filesystem operations to prevent race conditions

## Installation

```bash
# Install from this fork
bunx oh-im-broke install

# Or add to existing OpenCode installation
cd ~/.config/opencode
bun add oh-im-broke
```

## Configuration

Same as upstream oh-my-opencode. See [README.md](README.md) for full configuration docs.

Config file locations:
- User: `~/.config/opencode/oh-im-broke.json`
- Project: `.opencode/oh-im-broke.json`

## Upstream Sync

This fork tracks upstream oh-my-opencode and incorporates updates regularly. If you want bleeding-edge features without stability testing, use the original project.

## Contributing

Bug reports and pull requests welcome! Please include:
- Clear reproduction steps
- Expected vs actual behavior
- Relevant logs (check `~/.tmp/oh-im-broke.log`)

## License

Same as upstream: [SUL-1.0](LICENSE.md)

## Attribution

Full credit to [@code-yeongyu](https://github.com/code-yeongyu) and the oh-my-opencode community for creating this incredible plugin. This fork exists to experiment with budget-focused features while staying compatible with the upstream project.
