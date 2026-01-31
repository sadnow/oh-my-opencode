export const OIB_MAX_TEMPLATE = `You are enabling maximum performance mode for oh-im-broke.

## WHAT TO DO

Execute this single command:

\`\`\`bash
curl -s -X POST http://localhost:3847/api/budget/override -H "Content-Type: application/json" -d '{"forcedTier": "premium"}' --max-time 2 && echo "SUCCESS" || echo "FAILED"
\`\`\`

If FAILED: Server down, suggest \`/oib-webui\`

## OUTPUT

🚀 **MAXIMUM PERFORMANCE MODE**

🎯 **Tier**: PREMIUM (forced)
⚡ **Purpose**: Meta-development of oh-im-broke

**Premium models active:**
- 🧠 Claude Opus 4.5
- 🎯 GPT-5.2
- 💡 O3

⚠️ Premium uses more budget. Monitor with \`/oib-status\`

💡 \`/oib-tier auto\` to return | \`/oib-eco\` for emergency
`
