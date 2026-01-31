export const OIB_TIER_TEMPLATE = `You are setting the oh-im-broke tier control.

## ARGUMENTS
The user provides a tier argument: premium | standard | budget | economy | auto

- **premium**: Force highest quality models (Claude Opus, GPT-5.2, etc.)
- **standard**: Force mid-tier models (Claude Sonnet, GPT-5.1, etc.)
- **budget**: Force budget models (Claude Haiku, Gemini Flash, etc.)
- **economy**: Force cheapest models only
- **auto**: Clear all overrides, return to adaptive behavior

## WHAT TO DO

1. **Check if WebUI server is running**:
   - Use bash tool: \`curl -s http://localhost:3847/api/health-check --max-time 2\`
   - If it fails, tell user to run \`/oib-webui\` first.

2. **Parse the tier argument**:
   - Extract tier from $ARGUMENTS
   - Validate it's one of: premium, standard, budget, economy, auto
   - If invalid, show usage help

3. **Apply the tier change**:
   - If tier is "auto":
     \`curl -s -X POST http://localhost:3847/api/global-override/clear\`
   - Otherwise:
     \`curl -s -X POST http://localhost:3847/api/budget/override -H "Content-Type: application/json" -d '{"forcedTier": "<tier>"}'\`

4. **Confirm the change**:
   - Show success message with new tier
   - Show current status

## OUTPUT FORMAT (Success)

✅ Tier Changed Successfully

🎯 **New Tier**: premium
📝 **Mode**: Forced (manual override)

Models now restricted to premium tier:
- Claude Opus 4.5
- GPT-5.2
- O3

💡 Use \`/oib-tier auto\` to return to adaptive behavior
💡 Use \`/oib-status\` to see full budget status

## OUTPUT FORMAT (Auto/Clear)

✅ Overrides Cleared

🎯 **Mode**: Adaptive (automatic)

The system will now automatically select tiers based on:
- Budget remaining
- Task complexity
- Provider availability

💡 Use \`/oib-tier <tier>\` to force a specific tier

## OUTPUT FORMAT (Invalid)

❌ Invalid Tier

Usage: /oib-tier <premium|standard|budget|economy|auto>

Available tiers:
- **premium**: Highest quality (Claude Opus, GPT-5.2)
- **standard**: Mid-tier (Claude Sonnet, GPT-5.1)
- **budget**: Budget models (Claude Haiku, Gemini Flash)
- **economy**: Cheapest models only
- **auto**: Return to adaptive behavior

## IMPORTANT
- Always validate the tier argument
- Show clear confirmation of what changed
- Suggest next steps
`;
