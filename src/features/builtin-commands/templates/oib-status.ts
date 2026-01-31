export const OIB_STATUS_TEMPLATE = `You are showing the oh-im-broke budget status.

## WHAT TO DO

1. **Check if WebUI server is running**:
   - Use bash tool: \`curl -s http://localhost:3847/api/budget/dashboard --max-time 2\`
   - If it fails, tell user to run \`/oib-webui\` first to start the server.

2. **If running - fetch budget data**:
   - Call: \`curl -s http://localhost:3847/api/budget/dashboard\`
   - Call: \`curl -s http://localhost:3847/api/usage\`
   - Call: \`curl -s http://localhost:3847/api/alerts\`

3. **Format and display**:
   - Parse JSON responses
   - Show formatted status with emojis

## OUTPUT FORMAT

📊 oh-im-broke Budget Status

💰 **Budget Overview**
- Total Spent: $X.XX / $Y.YY (Z%)
- Burn Rate: $X.XX/day
- Days Remaining: N days

📈 **Provider Status**
| Provider | Spent | Budget | Tier | Status |
|----------|-------|--------|------|--------|
| anthropic | $X.XX | $Y.YY | premium | ✅ OK |
| openai | $X.XX | $Y.YY | standard | ⚠️ 80% |

🔔 **Active Alerts** (N)
- [WARN] Provider X approaching limit
- [INFO] Auto-downgrade scheduled

🎯 **Current Tier**: premium (forced) | adaptive
🔄 **Override Status**: None | Forced to X until HH:MM

💡 Tip: Use /oib-tier <tier> to change tier, /oib-webui for full dashboard

## IMPORTANT
- Always check server first
- Format numbers with 2 decimal places
- Use appropriate status emojis (✅ OK, ⚠️ Warning, 🔴 Critical)
- If no data, show "No budget data available"
`;
