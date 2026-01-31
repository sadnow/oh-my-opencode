export const OIB_WEBUI_STOP_TEMPLATE = `You are stopping the oh-im-broke WebUI server.

## WHAT TO DO

1. **Detect the OS**:
   - Use bash tool: \`uname -s\`
   - MINGW/MSYS = Windows
   - Darwin = macOS
   - Linux = Linux

2. **Stop the server**:
   - Windows: \`taskkill /F /IM bun.exe 2>/dev/null || echo "No bun processes found"\`
   - macOS/Linux: \`pkill -f "bun run webui" || pkill -f "webui" || echo "No webui processes found"\`

3. **Verify it stopped**:
   - Check: \`curl -s http://localhost:3847 --max-time 2\`
   - If it fails (connection refused), server is stopped successfully

4. **Confirm to user**:
   - Show success message

## OUTPUT FORMAT (Success)

✅ WebUI Server Stopped

🛑 **Status**: Server on port 3847 is no longer running

The oh-im-broke WebUI dashboard has been stopped.

💡 Use \`/oib-webui\` to start it again

## OUTPUT FORMAT (Not Running)

ℹ️ WebUI Server Not Running

The server was not running (port 3847 is free).

💡 Use \`/oib-webui\` to start the dashboard

## IMPORTANT
- Use bash tool to kill the process
- Handle both Windows and Unix systems
- Verify the port is free after stopping
- Don't fail if already stopped
`;
