# Troubleshooting Guide

## OpenCode Crashes on Startup: "CPU lacks AVX support"

### Symptoms

When running `opencode`, you see:
```
CPU lacks AVX support. Please consider upgrading to a newer CPU.
panic(main thread): Illegal instruction at address 0x7FF7...
oh no: Bun has crashed.
```

### Cause

OpenCode ships two Windows binaries:
- `opencode-windows-x64` - Optimized, requires AVX CPU instructions
- `opencode-windows-x64-baseline` - Compatible with older CPUs (SSE4.2 only)

The launcher script may pick the wrong binary due to filesystem ordering.

### Quick Fix

**PowerShell (run as Administrator or regular user):**
```powershell
# Set permanently for your user account
[System.Environment]::SetEnvironmentVariable(
  'OPENCODE_BIN_PATH',
  'C:\Users\YOUR_USERNAME\AppData\Roaming\npm\node_modules\opencode-ai\node_modules\opencode-windows-x64-baseline\bin\opencode.exe',
  'User'
)
```

Replace `YOUR_USERNAME` with your actual Windows username.

**For current session only:**
```powershell
$env:OPENCODE_BIN_PATH = "C:\Users\YOUR_USERNAME\AppData\Roaming\npm\node_modules\opencode-ai\node_modules\opencode-windows-x64-baseline\bin\opencode.exe"
```

After setting the environment variable, **close and reopen your terminal**.

### Verify the Fix

```powershell
opencode --version
```

Should print the version number without crashing.

### Check Your CPU

To see if your CPU has AVX support:
```powershell
wmic cpu get name
# Then search for your CPU model's specs online
```

Or check the crash output - it will show `no_avx no_avx2` in the Features line if AVX is missing.

---

## Known Working Versions

| opencode-ai Version | Status | Notes |
|---------------------|--------|-------|
| 1.1.19 | Working | Tested with OPENCODE_BIN_PATH workaround |
| 1.1.20 | Working | Tested with OPENCODE_BIN_PATH workaround |
| 1.1.21 | Working | Tested with OPENCODE_BIN_PATH workaround |
| 1.1.22 | Working | Tested with OPENCODE_BIN_PATH workaround |

**Note:** All versions require the `OPENCODE_BIN_PATH` workaround on non-AVX CPUs.

---

## How to Rollback to a Known Good State

If you encounter issues after updating, you can rollback:

### 1. Rollback opencode-ai
```powershell
npm uninstall -g opencode-ai
npm install -g opencode-ai@1.1.19
```

### 2. Rollback oh-my-opencode plugin
```bash
cd path/to/oh-my-opencode
git checkout v3.2.1-stable-baseline
bun run build
```

### 3. Verify
```powershell
opencode --version  # Should show 1.1.19
```

---

## Plugin Build Issues

### "bun: command not found"

Install Bun:
```powershell
npm install -g bun
```

### Build fails with TypeScript errors

```bash
bun run typecheck  # Check for specific errors
bun test           # Run tests to verify functionality
```

### Tests failing after upstream merge

Run the full test suite:
```bash
bun test
npx tsx test-auto-router.ts
```

If tests fail, check:
1. Did upstream change any APIs?
2. Are there new dependencies needed?
3. Check `CHANGELOG.fork.md` for breaking changes

---

## Reporting Issues

### For oh-my-opencode (this fork)
File issues at: https://github.com/sadnow/oh-my-opencode/issues

Include:
- OS and version
- Node.js version (`node --version`)
- Bun version (`bun --version`)
- opencode-ai version (`npm list -g opencode-ai`)
- Error message/stack trace
- Steps to reproduce

### For upstream OpenCode
File issues at: https://github.com/opencode-ai/opencode/issues

---

## Environment Variables Reference

| Variable | Purpose | Example |
|----------|---------|---------|
| `OPENCODE_BIN_PATH` | Force specific OpenCode binary | `C:\...\opencode-windows-x64-baseline\bin\opencode.exe` |
| `OPENCODE_CONFIG_DIR` | Custom config directory | `C:\Users\Me\.opencode` |

---

## FAQ

**Q: Why does OpenCode need AVX?**
A: OpenCode uses Bun runtime, which is compiled with AVX optimizations for performance. The baseline version sacrifices some speed for compatibility.

**Q: Will the baseline version be slower?**
A: Slightly, but not noticeably for most tasks. The difference is in low-level operations.

**Q: Is this a bug in oh-my-opencode?**
A: No. This is an upstream OpenCode issue. The oh-my-opencode plugin loads AFTER OpenCode starts, so it cannot cause this crash.

**Q: Will this be fixed upstream?**
A: We've reported it. The fix would be to detect AVX support before selecting the binary.
