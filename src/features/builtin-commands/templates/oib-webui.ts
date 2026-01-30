export const OIB_WEBUI_TEMPLATE = `You are launching the oh-im-broke WebUI dashboard.

## WHAT TO DO

1. **Check if server is running**:
   - Use bash tool: \`curl -s http://localhost:3847 --max-time 2\`
   - If it succeeds (exit code 0), server is running.
   - If it fails, server is NOT running.

2. **If NOT running - START IT AUTOMATICALLY**:
   - Show message: "🔄 Starting WebUI server..."
   - Use bash tool to start server in background:
     - Windows (Git Bash/MINGW): \`cd /c/000DEV/oh-my-opencode-fork && nohup bun run webui > /dev/null 2>&1 &\`
     - macOS/Linux: \`cd ~/path/to/project && nohup bun run webui > /dev/null 2>&1 &\`
   - Wait for server to be ready (poll every 2 seconds, max 10 attempts):
     \`\`\`bash
     curl -s http://localhost:3847 --max-time 2
     \`\`\`
   - Once ready, proceed to step 3.
   - If not ready after 20 seconds, show error message with server logs.

3. **Open browser**:
   - Use bash tool to open default browser:
     - Windows (Git Bash/MINGW): \`cmd.exe /c start http://localhost:3847\`
     - macOS: \`open http://localhost:3847\`
     - Linux: \`xdg-open http://localhost:3847\`
   - Detect OS from \`uname -s\` output (MINGW = Windows)
   - Return a success message.

## OUTPUT FORMAT (Server was already running)

🚀 oh-im-broke WebUI Dashboard

✅ Server is running on port 3847
🌐 Opening browser at http://localhost:3847

Dashboard features:
- Preset comparison with cost estimates
- Budget health indicators
- Routing logs and audit trail  
- Export data (CSV/JSON)
- Usage tracking (Claude Max & Copilot)

To stop the server, use: /oib-webui-stop

## OUTPUT FORMAT (Server was started)

🚀 oh-im-broke WebUI Dashboard

🔄 Server was not running - starting it now...
✅ Server started successfully on port 3847
🌐 Opening browser at http://localhost:3847

Dashboard features:
- Preset comparison with cost estimates
- Budget health indicators
- Routing logs and audit trail  
- Export data (CSV/JSON)
- Usage tracking (Claude Max & Copilot)

To stop the server, use: /oib-webui-stop

## IMPORTANT

- ALWAYS try to start the server automatically if not running.
- Use bash tool with \`start /B\` on Windows to run in background.
- Poll the server endpoint to confirm it's ready before opening browser.
- Provide clear feedback at each step.
- Confirm the port number (3847).`
