export const OIB_STATUS_TEMPLATE = `You are showing the oh-im-broke budget status.

## WHAT TO DO

Execute this single command (fetches all data at once):

\`\`\`bash
curl -s http://localhost:3847/api/budget/dashboard --max-time 2 > /tmp/dash.json 2>&1 && \
curl -s http://localhost:3847/api/usage --max-time 2 > /tmp/usage.json 2>&1 && \
curl -s http://localhost:3847/api/alerts --max-time 2 > /tmp/alerts.json 2>&1 && \
echo "SUCCESS" || echo "SERVER_DOWN"
\`\`\`

If "SERVER_DOWN": Tell user to run \`/oib-webui\` first.

If "SUCCESS": Read the 3 JSON files and display formatted status.

## OUTPUT FORMAT

📊 **oh-im-broke Budget Status**

💰 **Budget** - $X.XX / $Y.YY (Z%) | Burn: $X.XX/day | Days left: N

📈 **Providers**
- anthropic: $X.XX (tier) ✅/⚠️/🔴
- openai: $X.XX (tier) ✅/⚠️/🔴

🔔 **Alerts** (N)
- [level] message

🎯 **Tier**: current | Override: none/forced

💡 Tip: \`/oib-tier <tier>\` to change, \`/oib-webui\` for full dashboard
`
