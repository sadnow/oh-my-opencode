export const OIB_ECO_TEMPLATE = `You are enabling ECONOMY mode for oh-im-broke.

## PURPOSE
This command activates EMERGENCY MODE - only economy tier models allowed.
Use when budget is critical and you need to minimize spending immediately.

## WHAT TO DO

1. **Check if WebUI server is running**:
   - Use bash tool: \`curl -s http://localhost:3847/api/health-check --max-time 2\`
   - If it fails, tell user to run \`/oib-webui\` first.

2. **Enable emergency mode**:
   \`curl -s -X POST http://localhost:3847/api/global-override/emergency-mode -H "Content-Type: application/json" -d '{"enabled": true}'\`

3. **Confirm activation**:
   - Show warning about reduced capabilities
   - List economy models now active

## OUTPUT FORMAT

🔴 ECONOMY MODE ACTIVATED

💰 **Mode**: EMERGENCY (economy only)
⚠️ **Warning**: Reduced model capabilities

Economy models now active:
- 💨 Gemini Flash (fast, cheap)
- 🐇 Claude Haiku (quick responses)
- 📦 GPT-4.1-nano (minimal cost)
- 🥒 big-pickle (ultimate fallback)

**What this means:**
- ❌ No premium models (Opus, GPT-5.2, O3)
- ❌ No standard models (Sonnet, GPT-5.1)
- ✅ Only budget/economy models
- ✅ Minimum spending

💡 To return to normal: \`/oib-tier auto\`
💡 For full power: \`/oib-max\`
💡 Check status: \`/oib-status\`

## IMPORTANT
- This enables GLOBAL emergency mode
- All providers affected
- Use when budget is critically low
- Quality will be reduced but costs minimized
`
