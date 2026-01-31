export const OIB_WEBUI_TEMPLATE = `You are launching the oh-im-broke WebUI dashboard.

## WHAT TO DO

Execute this single bash script (handles check, start, wait, and open):

\`\`\`bash
PORT=3847; \
URL="http://localhost:$PORT"; \
OS=$(uname -s 2>/dev/null || echo "Windows"); \
\
# Check if already running
curl -s $URL --max-time 1 >/dev/null 2>&1 && STATUS="RUNNING" || STATUS="NOT_RUNNING"; \
\
# Start if not running
if [ "$STATUS" = "NOT_RUNNING" ]; then \
  if [[ "$OS" == MINGW* ]] || [[ "$OS" == MSYS* ]] || [[ "$OS" == "Windows" ]]; then \
    cd /c/000DEV/oh-my-opencode-fork && nohup bun run webui > /dev/null 2>&1 & \
  else \
    nohup bun run webui > /dev/null 2>&1 & \
  fi; \
  \
  # Wait for server (max 20s)
  for i in {1..10}; do \
    sleep 2; \
    curl -s $URL --max-time 1 >/dev/null 2>&1 && STATUS="STARTED" && break; \
  done; \
  \
  # Check if it actually started
  curl -s $URL --max-time 1 >/dev/null 2>&1 || STATUS="TIMEOUT"; \
fi; \
\
# Open browser if running
if [ "$STATUS" = "RUNNING" ] || [ "$STATUS" = "STARTED" ]; then \
  if [[ "$OS" == MINGW* ]] || [[ "$OS" == MSYS* ]] || [[ "$OS" == "Windows" ]]; then \
    cmd.exe /c start $URL; \
  elif [[ "$OS" == "Darwin" ]]; then \
    open $URL; \
  else \
    xdg-open $URL 2>/dev/null || echo "Please open manually: $URL"; \
  fi; \
fi; \
\
echo "$STATUS"
\`\`\`

Parse output and respond:
- **"RUNNING"** → Already running, opened browser
- **"STARTED"** → Started successfully, opened browser  
- **"TIMEOUT"** → Failed to start within 20s

## OUTPUT FORMAT

If RUNNING:
🚀 **oh-im-broke WebUI Dashboard**
✅ Server running on port 3847
🌐 Browser opened at http://localhost:3847

If STARTED:
🚀 **oh-im-broke WebUI Dashboard**
🔄 Server started successfully
🌐 Browser opened at http://localhost:3847

If TIMEOUT:
❌ **Failed to Start WebUI**
Server didn't respond after 20 seconds
Try manually: \`cd /c/000DEV/oh-my-opencode-fork && bun run webui\`

**Dashboard features:**
- Budget status & alerts
- Usage tracking
- Cost forecasting & ROI
- Routing logs

💡 Use \`/oib-webui-stop\` to stop server
`
