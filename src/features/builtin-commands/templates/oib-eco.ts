export const OIB_ECO_TEMPLATE = `You are enabling ECONOMY mode for oh-im-broke.

## WHAT TO DO

Execute this single command:

\`\`\`bash
curl -s -X POST http://localhost:3847/api/global-override/emergency-mode -H "Content-Type: application/json" -d '{"enabled": true}' --max-time 2 && echo "SUCCESS" || echo "FAILED"
\`\`\`

If FAILED: Server down, suggest \`/oib-webui\`

## OUTPUT

🔴 **ECONOMY MODE ACTIVATED**

💰 **Mode**: EMERGENCY (economy only)
⚠️ **Warning**: Reduced capabilities

**Economy models active:**
- 💨 Gemini Flash
- 🐇 Claude Haiku
- 📦 GPT-4.1-nano
- 🥒 big-pickle

**Restrictions:**
- ❌ No premium (Opus, GPT-5.2, O3)
- ❌ No standard (Sonnet, GPT-5.1)
- ✅ Minimum spending

💡 \`/oib-tier auto\` to return | \`/oib-max\` for full power
`
