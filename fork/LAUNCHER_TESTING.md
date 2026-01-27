# Fork Launcher Testing Guide

## Quick Test

```powershell
# From the fork/ directory
cd C:\000DEV\oh-my-opencode-fork\fork

# Test 1: Start server on default port
python run.py

# Expected output:
# ==================================================
# oh-my-opencode Fork WebUI
# ==================================================
# Project root: C:\000DEV\oh-my-opencode-fork
# Server URL:   http://localhost:3847
# Dashboard:    http://localhost:3847/budget-dashboard
# ==================================================
#
# Starting WebUI Server...
# WebUI running at http://localhost:3847
# Budget Dashboard: http://localhost:3847/budget-dashboard
#
# Press Ctrl+C to stop
```

## Test Different Ports

```powershell
# If port 3847 is in use, you'll see:
python run.py

# ERROR: Port 3847 is already in use.
#
# To fix this, either:
#   1. Stop the existing server on port 3847
#   2. Use a different port: python run.py --port <PORT>
#
# To find the process using port 3847:
#   Windows: netstat -ano | findstr :3847
#   Then kill it: taskkill /PID <PID> /F

# Use a different port:
python run.py --port 8080
```

## Test API Endpoints

```powershell
# In another terminal, test the endpoints:

# Dashboard HTML
curl http://localhost:3847/budget-dashboard

# Claude Max usage
curl http://localhost:3847/api/claude-max/usage

# Copilot usage
curl http://localhost:3847/api/copilot/usage

# Available presets
curl http://localhost:3847/api/presets

# Stats summary
curl http://localhost:3847/api/stats/summary?period=weekly

# Adaptive settings
curl http://localhost:3847/api/adaptive/settings
```

## Test CLI Options

```powershell
# Help
python run.py --help

# Custom port
python run.py --port 8080

# Open browser automatically
python run.py --open

# Bind to all interfaces (allow external connections)
python run.py --bind 0.0.0.0

# Combined
python run.py --port 8080 --bind 0.0.0.0 --open
```

## Manual Verification Checklist

- [ ] Server starts without errors
- [ ] Dashboard loads at http://localhost:3847/budget-dashboard
- [ ] Tier Management section visible
- [ ] Analytics section visible
- [ ] Toggle switches work (auto-upgrade/downgrade)
- [ ] Learning mode buttons work
- [ ] Claude Max usage shows real data
- [ ] Copilot usage shows real data
- [ ] Quota sliders update values
- [ ] API endpoints return JSON

## Automated Tests

Run the integration tests:

```powershell
# From project root
bun test src/webui/integration.test.ts

# Run all fork tests
bun test src/features/budget-orchestrator/ src/features/claude-max-usage/ src/features/copilot-usage/ src/webui/integration.test.ts

# Expected: 56 pass, 0 fail
```

## Troubleshooting

### Error: "bun is not installed"

**Cause**: Python subprocess can't find bun in PATH

**Fix**: This should be automatically handled by `shell=True` in the subprocess calls. If it still fails:

1. Check if bun is in PATH:
   ```powershell
   bun --version
   ```

2. If not, add bun to PATH or use full path in run.py

### Error: "Port already in use"

**Cause**: Another server is using the port

**Fix**:
```powershell
# Find the process
netstat -ano | findstr :3847

# Kill it (replace PID with actual process ID)
taskkill /PID <PID> /F

# Or use a different port
python run.py --port 8080
```

### Error: Module not found

**Cause**: Missing dependencies

**Fix**:
```powershell
# Install dependencies
bun install
```

## Success Indicators

✅ Server starts and shows:
```
WebUI running at http://localhost:3847
Budget Dashboard: http://localhost:3847/budget-dashboard
```

✅ Dashboard loads with all sections visible

✅ API endpoints return JSON with `"success": true`

✅ Claude Max and Copilot data updates every 60 seconds

✅ Ctrl+C stops the server gracefully
