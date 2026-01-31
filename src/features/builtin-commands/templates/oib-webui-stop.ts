export const OIB_WEBUI_STOP_TEMPLATE = `You are stopping the oh-im-broke WebUI server.

## WHAT TO DO

Execute this single bash command (it handles everything):

\`\`\`bash
OS=$(uname -s 2>/dev/null || echo "Windows"); \
if [[ "$OS" == MINGW* ]] || [[ "$OS" == MSYS* ]] || [[ "$OS" == "Windows" ]]; then \
  PID=$(netstat -ano | grep :3847 | grep LISTENING | awk '{print $5}' | head -1); \
  if [ -n "$PID" ] && [ "$PID" != "0" ]; then \
    powershell.exe -Command "Stop-Process -Id $PID -Force" 2>/dev/null; \
    sleep 1; \
    curl -s http://localhost:3847 --max-time 1 >/dev/null 2>&1 && echo "FAILED" || echo "STOPPED:$PID"; \
  else \
    echo "NOT_RUNNING"; \
  fi; \
else \
  PID=$(lsof -ti:3847 2>/dev/null | head -1); \
  if [ -n "$PID" ]; then \
    kill -9 $PID 2>/dev/null; \
    sleep 1; \
    curl -s http://localhost:3847 --max-time 1 >/dev/null 2>&1 && echo "FAILED" || echo "STOPPED:$PID"; \
  else \
    echo "NOT_RUNNING"; \
  fi; \
fi
\`\`\`

Parse the output and respond:
- **"STOPPED:####"** → Success, show PID
- **"NOT_RUNNING"** → Already stopped
- **"FAILED"** → Error, process didn't die

## OUTPUT FORMAT

If STOPPED:
✅ **WebUI Server Stopped** (PID: ####)
💡 Use \`/oib-webui\` to restart

If NOT_RUNNING:
ℹ️ **Server Not Running**
💡 Use \`/oib-webui\` to start

If FAILED:
❌ **Failed to Stop Server**
Try manually: \`pkill -f webui\` or Task Manager
`
