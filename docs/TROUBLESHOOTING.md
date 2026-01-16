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

## Windows Defender Blocks TUI DLL: "error code 225"

### Symptoms

When running `opencode`, the TUI fails to initialize:
```
Failed to initialize OpenTUI render library: error code 225
```

Or OpenCode crashes immediately after startup without showing the TUI.

### Cause

Windows Defender identifies OpenCode's temporary TUI DLL as a threat:
- **Detection name:** `Trojan:HTML/Wabattack.S!ctv` (false positive)
- **Location:** `%LOCALAPPDATA%\Temp`

This is a **false positive** caused by heuristic scanning of the unpacked DLL.

### Quick Fix

**PowerShell (run as Administrator):**
```powershell
# Add exclusion for Temp directory (where DLL is extracted)
Add-MpPreference -ExclusionPath "$env:LOCALAPPDATA\Temp"
```

**Alternative - Exclude specific file pattern:**
```powershell
Add-MpPreference -ExclusionPath "$env:LOCALAPPDATA\Temp\opencode*"
```

### Verify the Exclusion

```powershell
# List current exclusions
Get-MpPreference | Select-Object -ExpandProperty ExclusionPath
```

### After Adding Exclusion

1. Close any running OpenCode instances
2. Clear the temp folder (optional): `Remove-Item "$env:LOCALAPPDATA\Temp\opencode*" -Force -ErrorAction SilentlyContinue`
3. Restart OpenCode: `opencode`

### Verify the Fix

```powershell
opencode --version
```

The TUI should now render correctly.

### Security Considerations

- This is a **false positive** - OpenCode is safe
- The exclusion is limited to the Temp directory, not system-wide
- You can review the excluded files in Windows Security app
- If concerned, submit the DLL to Microsoft for analysis: https://www.microsoft.com/wdsi/filesubmission

### Why This Happens

OpenCode extracts a rendering DLL at runtime to `%LOCALAPPDATA%\Temp`. Windows Defender's real-time protection scans this extraction and incorrectly flags it based on behavioral heuristics (code execution from temp directory + DLL loading pattern).

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

## Auto-Router Provider Fallback System (v3.7.x)

### How Provider Fallback Works

The auto-router includes an intelligent provider fallback system that handles both rate limits (HTTP 429) and authentication errors (HTTP 401/403, missing API keys).

**Provider Fallback Chain:**
```
github-copilot → google → opencode → amazon-bedrock
```

**Blocked Providers (never used directly):**
- `anthropic` - Direct Anthropic API is blocked; use via github-copilot instead

### Symptoms of Provider Errors

**Rate Limit Error (429):**
```
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
[AUTO-ROUTER] PROVIDER RATE LIMIT ERROR
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
Provider: github-copilot
Model: github-copilot/claude-sonnet-4
Error: 429 Too Many Requests
Cooldown: 1 minutes
Action: Falling back to google
Fallback: github-copilot/claude-sonnet-4 → google/antigravity-gemini-3-flash
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
```

**Authentication Error (API Key Missing):**
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

### Cooldown Periods

| Error Type | Cooldown | Reason |
|------------|----------|--------|
| Rate Limit (429) | 1 minute | Temporary throttling, recovers quickly |
| Rate Limit (Anthropic) | 5 minutes | Anthropic has stricter limits |
| Auth Error | 30 minutes | Requires manual API key configuration |

### Checking Provider Status

The auto-router logs provider status before spawning subagents:

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

### Resolving Auth Errors

1. **Google (Antigravity/Gemini)**
   - Get API key: https://aistudio.google.com/apikey
   - Set environment variable: `GOOGLE_GENERATIVE_AI_API_KEY=your-key`

2. **OpenAI**
   - Get API key: https://platform.openai.com/api-keys
   - Set environment variable: `OPENAI_API_KEY=your-key`

3. **GitHub Copilot**
   - Ensure you have an active GitHub Copilot subscription
   - Sign in via: `gh auth login`

### Rate Limit State File

Provider cooldowns are persisted to:
```
~/.opencode/rate-limit-state.json
```

To manually reset all cooldowns (force retry all providers):
```bash
rm ~/.opencode/rate-limit-state.json
```

---

## OpenCode Plugin API Limitations & Workarounds

### ⚠️ Hooks NOT Currently Wired Up

The following hooks are defined in the auto-router but **not active** due to OpenCode Plugin API limitations:

| Hook | Purpose | Status |
|------|---------|--------|
| `chat.params` | Runtime model switching | ❌ Read-only in OpenCode |
| `chat.error` | Error interception | ❌ Not exposed by OpenCode |

### Why Model Switching Doesn't Work

OpenCode's plugin API allows hooks to read `chat.params` but **not modify** the model field. The `output.message.model` field is read-only.

**Current Workaround:**
- Model recommendations are injected into the prompt text
- Users must configure agent variants in `opencode.json` to use different models
- The `/auto` command shows which model SHOULD be used in console output

### Configuring Agent Variants (Workaround)

Since runtime model switching isn't possible, configure agents with different default models:

```json
// opencode.json
{
  "agents": {
    "auto-free": {
      "model": { "providerID": "opencode", "modelID": "glm-4.7-free" }
    },
    "auto-cheap": {
      "model": { "providerID": "github-copilot", "modelID": "gpt-4o-mini" }
    },
    "auto-moderate": {
      "model": { "providerID": "google", "modelID": "antigravity-gemini-3-flash" }
    },
    "auto-expensive": {
      "model": { "providerID": "github-copilot", "modelID": "claude-sonnet-4" }
    },
    "auto-maximum": {
      "model": { "providerID": "github-copilot", "modelID": "claude-opus-4-5" }
    }
  }
}
```

### Error Detection Without chat.error Hook

Since `chat.error` isn't exposed, the auto-router detects errors via:

1. **Subagent spawn failures** - Caught in try/catch when launching background tasks
2. **Retry-with-fallback** - Automatically retries with next provider in chain
3. **Persistent state** - Records failures to disk for future session awareness

### Future Improvements (Pending OpenCode API)

When/if OpenCode adds these capabilities:
- `chat.params` write access → Direct model switching
- `chat.error` hook → Real-time rate limit detection
- `session.model.set` → Programmatic model selection

---

## New Functions Reference (v3.7.x)

### `isProviderUnavailableError(error)`

Detects both rate limit and authentication errors.

**Returns:** `{ isUnavailable: boolean, isAuthError: boolean }`

```typescript
const { isUnavailable, isAuthError } = isProviderUnavailableError(err)
if (isUnavailable) {
  if (isAuthError) {
    // API key missing/invalid - 30 min cooldown
  } else {
    // Rate limit - 1 min cooldown
  }
}
```

### `recordProviderAuthError(state, provider, errorMessage)`

Records an authentication error with extended cooldown (30 minutes).

```typescript
const newState = recordProviderAuthError(rateLimitState, "google", "API key missing")
saveRateLimitState(newState)
```

### `launchSubagentWithFallback(manager, input, model, state, maxRetries)`

Launches a subagent with automatic retry/fallback on provider errors.

```typescript
const { result, newRateLimitState } = await launchSubagentWithFallback(
  backgroundManager,
  { description, prompt, agent, parentSessionID, parentMessageID, model },
  "google/antigravity-gemini-3-flash",
  rateLimitState,
  3 // maxRetries
)
```

### `logProviderStatus(rateLimitState)`

Logs current provider availability to console.

```typescript
logProviderStatus(rateLimitState)
// Output:
// [AUTO-ROUTER] Provider Status:
//   github-copilot: ✓ available
//   google: ✗ unavailable (cooldown 28m remaining)
//   ...
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
