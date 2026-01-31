export const OIB_TIER_TEMPLATE = `You are setting the oh-im-broke tier control.

## ARGUMENTS
Extract tier from $ARGUMENTS: premium | standard | budget | economy | auto

## WHAT TO DO

Execute this single command:

\`\`\`bash
TIER="$ARGUMENTS"; \
if [[ "$TIER" == "auto" ]]; then \
  curl -s -X POST http://localhost:3847/api/global-override/clear --max-time 2 && echo "CLEARED" || echo "FAILED"; \
elif [[ "$TIER" =~ ^(premium|standard|budget|economy)$ ]]; then \
  curl -s -X POST http://localhost:3847/api/budget/override -H "Content-Type: application/json" -d "{\"forcedTier\": \"$TIER\"}" --max-time 2 && echo "SET:$TIER" || echo "FAILED"; \
else \
  echo "INVALID:$TIER"; \
fi
\`\`\`

Parse output:
- **"SET:tier"** → Success
- **"CLEARED"** → Returned to adaptive
- **"INVALID:X"** → Show usage
- **"FAILED"** → Server down, suggest /oib-webui

## OUTPUT

If SET:
✅ **Tier Changed** → **tier**
Models: [list 2-3 top models for this tier]
💡 \`/oib-tier auto\` to return to adaptive

If CLEARED:
✅ **Adaptive Mode**
System will auto-select tiers based on budget
💡 \`/oib-tier <tier>\` to force

If INVALID:
❌ **Invalid Tier**
Usage: /oib-tier <premium|standard|budget|economy|auto>
`
