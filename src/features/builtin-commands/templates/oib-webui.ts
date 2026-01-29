export const OIB_WEBUI_TEMPLATE = `You are launching the oh-im-broke WebUI dashboard.

## WHAT TO DO

1. **Start the WebUI server**:
   - Import and call \`startWebUI\` from \`src/webui\`
   - Default port: 3847
   - Server serves React app from \`dist/webui/\` or embedded fallback

2. **Open default browser**:
   - Use Node.js \`child_process.exec\` to open browser
   - Platform-specific commands:
     - Windows: \`start http://localhost:3847\`
     - macOS: \`open http://localhost:3847\`
     - Linux: \`xdg-open http://localhost:3847\`
   - Use \`process.platform\` to detect OS

3. **Handle errors**:
   - If server already running on port: inform user and provide URL
   - If browser fails to open: provide manual URL
   - If server fails to start: show error with troubleshooting

## IMPLEMENTATION GUIDE

Use the following approach:

1. Import \`startWebUI\` from \`src/webui/index.ts\`
2. Import \`exec\` from Node's \`child_process\` module
3. Call \`await startWebUI({ port: 3847 })\` to start server
4. Detect platform using \`process.platform\`
5. Build cross-platform open command:
   - Windows: \`start http://localhost:3847\`
   - macOS: \`open http://localhost:3847\`  
   - Linux: \`xdg-open http://localhost:3847\`
6. Execute the command with \`exec()\`
7. Handle errors gracefully (port in use, browser fails to open)
8. Return success message with URL

## OUTPUT FORMAT

Success:
\`\`\`
🚀 oh-im-broke WebUI Dashboard

✅ Server started on port 3847
🌐 Opening browser at http://localhost:3847

Dashboard features:
- Preset comparison with cost estimates
- Budget health indicators
- Routing logs and audit trail
- Export data (CSV/JSON)
- Progressive disclosure (beginner/power-user modes)

Press Ctrl+C to stop the server.
\`\`\`

Already running:
\`\`\`
ℹ️  WebUI server is already running

Visit: http://localhost:3847

To restart, stop the existing server first.
\`\`\`

## IMPORTANT

- Server runs in foreground - user must keep terminal open
- Provide clear instructions for stopping (Ctrl+C)
- If browser doesn't open automatically, show manual URL
- Server serves both React app and API endpoints`
