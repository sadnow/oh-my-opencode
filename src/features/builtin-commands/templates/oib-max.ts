export const OIB_MAX_TEMPLATE = `You are enabling maximum performance mode for oh-im-broke.

## PURPOSE
This command forces PREMIUM tier for meta-development of oh-im-broke itself.
When developing the tool that orchestrates AI models, you need the best models available.

## WHAT TO DO

1. **Check if WebUI server is running**:
   - Use bash tool: \`curl -s http://localhost:3847/api/health-check --max-time 2\`
   - If it fails, tell user to run \`/oib-webui\` first.

2. **Force premium tier**:
   \`curl -s -X POST http://localhost:3847/api/budget/override -H "Content-Type: application/json" -d '{"forcedTier": "premium"}'\`

3. **Confirm activation**:
   - Show success message
   - List premium models now available

## OUTPUT FORMAT

🚀 MAXIMUM PERFORMANCE MODE ACTIVATED

🎯 **Tier**: PREMIUM (forced)
⚡ **Purpose**: Meta-development of oh-im-broke

Premium models now active:
- 🧠 Claude Opus 4.5 (best reasoning)
- 🎯 GPT-5.2 (strong coding)
- 💡 O3 (deep analysis)

⚠️ **Note**: Premium tier uses more budget.
Monitor with \`/oib-status\`

💡 To return to normal: \`/oib-tier auto\`
💡 For emergency savings: \`/oib-eco\`

## IMPORTANT
- This is a shortcut for /oib-tier premium
- Designed for developing oh-im-broke itself
- Premium models provide best quality for complex orchestration work
`
