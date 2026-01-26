# Adaptive Budget Intelligence: Analysis & Improvements

## Potential Failure Modes

### 1. Cold Start Problem
**Issue**: When the system first starts, it has zero historical data. Predictions are unreliable until `minSamplesForPrediction` (default: 10) sessions are recorded.

**Impact**: Early tier recommendations may be too conservative or too aggressive.

**Mitigation Ideas**:
- Use provider-reported historical usage via API if available
- Allow manual seeding of initial spending velocity
- Start with more conservative defaults, gradually loosen as confidence builds

### 2. Price Estimation Drift
**Issue**: Cost estimates use hardcoded token prices in `usage-tracker/tracker.ts`. Provider pricing changes over time.

**Impact**: Accumulating error in budget tracking - could think you're under budget when actually over, or vice versa.

**Mitigation Ideas**:
- Fetch pricing from provider APIs
- Add config option to override prices per model
- Include "last updated" timestamps and warn if pricing is stale

### 3. Provider Reset Schedule Mismatches
**Issue**: Reset schedules are hardcoded (Anthropic=weekly Sunday, others=monthly 1st). These may not match actual billing cycles.

**Impact**: System thinks budget resets when it doesn't, leading to overspending.

**Mitigation Ideas**:
- Allow config override for reset schedules
- Query provider APIs for actual billing period
- Auto-detect from usage patterns

### 4. State File Corruption/Loss
**Issue**: If `~/.config/opencode/oh-my-opencode-adaptive-*.json` gets corrupted or deleted, all learned patterns are lost.

**Impact**: System resets to cold start, losing weeks/months of learning.

**Mitigation Ideas**:
- Keep rolling backups of state files
- Add checksum validation
- Cloud sync option for state

### 5. Multi-Instance Race Conditions
**Issue**: If user runs multiple opencode instances simultaneously, they compete to read/write the same state files.

**Impact**: State corruption, lost updates, inconsistent tier decisions.

**Mitigation Ideas**:
- Use file locking (e.g., `flock`)
- Use a single background service for budget management
- Store in database instead of JSON files

### 6. Credit Accumulation Gaming
**Issue**: User doesn't use system for days, accumulates massive credits, then blows them all at once on expensive models.

**Impact**: Defeats the purpose of budget management - week's budget spent in one day.

**Current Mitigation**:
- `maxCreditHours` caps at 48 hours worth of credits
- `burstAllowancePercent` (30%) limits single-session spending

**Additional Ideas**:
- Exponential decay on very old credits
- Hard cap on credits regardless of idle time

### 7. Model Availability
**Issue**: Tier system maps to specific models. If a model is deprecated, unavailable, or rate-limited, fallback may not exist.

**Impact**: Tier change fails silently, using original model.

**Mitigation Ideas**:
- Check model availability before recommending
- Have deeper fallback chains per provider
- Alert user when preferred model unavailable

### 8. Budget Misconfiguration
**Issue**: User sets `provider_budgets: { anthropic: 0 }` or very low values.

**Impact**: System might divide by zero, always recommend economy tier, or behave unexpectedly.

**Mitigation Ideas**:
- Validate config values (min budget thresholds)
- Warn user if budget seems unreasonably low
- Graceful handling of edge cases

---

## Rough Edges

### 1. No CLI Command for Budget Status
Users can't easily see current budget state, predictions, or recommendations without reading logs or running test scripts.

**Fix**: Add `opencode budget` or `opencode status` command showing:
- Current usage vs budget per provider
- Accumulated credits
- Recommended tier
- Prediction confidence

### 2. Unclear Session Boundaries
The system tracks sessions but it's unclear when they start/end. Currently relies on `recordSessionStart()` / `recordSessionEnd()` being called manually.

**Fix**:
- Auto-detect session start on first API call after idle
- Auto-detect session end after N minutes of inactivity
- Hook into conversation lifecycle events

### 3. Incomplete Model Tier Mapping
Many models aren't in `MODEL_TIERS`. Unknown models return `null` tier and aren't managed.

**Fix**:
- Add more models to tier definitions
- Default unknown models to "standard" tier
- Allow config to define custom model-tier mappings

### 4. No Grace Period for Burst Spending
A single expensive request that pushes over budget triggers immediate downgrade consideration.

**Fix**:
- Allow configurable "grace" percentage (e.g., 5% over budget OK)
- Only trigger downgrade after sustained overspending
- Consider request-in-progress cost, not just historical

### 5. Excessive Logging
The `[budget-orchestrator]` and `[adaptive-budget]` logs can overwhelm debug output.

**Fix**:
- Add log level configuration
- Only log significant events (tier changes, warnings)
- Optional verbose mode for debugging

### 6. Pattern Learning Assumes Regular Usage
Hourly/daily patterns need consistent usage to be meaningful. Sporadic users (once a week) get noisy patterns.

**Fix**:
- Weight recent patterns more heavily
- Require minimum samples before using patterns
- Add weekly patterns for sporadic users

### 7. No Task Complexity Awareness
Budget treats all tasks equally - a simple "what time is it?" gets same tier consideration as "refactor entire codebase."

**Fix**:
- Estimate task complexity from prompt length, keywords
- Allow task-specific tier overrides
- Track cost per task type separately

---

## Improvement Opportunities

### High Priority

1. **Budget CLI Command**
   ```
   $ opencode budget

   Anthropic (Weekly, resets Sun):
     Used: $12.50 / $20.00 (62.5%)
     Daily allowance: $2.85
     Credits: +$1.42 (5 hours idle)
     Recommended tier: standard
     Confidence: 78%
   ```

2. **Provider API Integration**
   - Query actual usage from Anthropic, OpenAI APIs
   - Compare estimates vs reality
   - Auto-calibrate pricing estimates

3. **Better State Management**
   - File locking for multi-instance safety
   - Automatic backups
   - Export/import state

4. **User Notifications**
   - Warning when approaching budget limit
   - Notification on tier change
   - Weekly budget summary

### Medium Priority

5. **Task Complexity Scoring**
   - Analyze prompt to estimate cost before execution
   - Pre-emptively select appropriate tier
   - Learn cost patterns per task type

6. **Configurable Learning Parameters**
   ```yaml
   adaptive_budget:
     ema_decay: 0.1
     min_samples: 10
     max_credit_hours: 48
     conservative_factor: 0.7
   ```

7. **Grace Period Configuration**
   ```yaml
   budget:
     grace_percent: 0.05  # 5% over budget OK
     grace_duration: 3600  # 1 hour grace period
   ```

8. **Model Capability Matching**
   - Some tasks genuinely need premium models
   - Allow user to mark tasks as "must be premium"
   - Consider task requirements in tier selection

### Lower Priority

9. **Historical Visualization (WebUI)**
   - Chart: spending over time
   - Chart: predictions vs actuals
   - Tier usage breakdown

10. **Prediction Accuracy Dashboard**
    - Show how accurate predictions have been
    - Highlight when system is learning vs confident

11. **Budget Alerts Integration**
    - Email/Slack when budget critical
    - Integration with notification services

12. **Multi-Provider Budget Pooling**
    - Combined budget across all providers
    - Shift load to cheapest available provider

---

## Implementation Priority

Based on risk vs effort:

| Priority | Item | Risk Mitigated | Effort |
|----------|------|----------------|--------|
| P0 | File locking | Data corruption | Low |
| P0 | Config validation | Edge case crashes | Low |
| P1 | Budget CLI command | Usability | Medium |
| P1 | Better session detection | Accuracy | Medium |
| P1 | More model tier mappings | Coverage | Low |
| P2 | Provider API integration | Drift | High |
| P2 | Task complexity scoring | Accuracy | High |
| P2 | State backups | Data loss | Low |
| P3 | WebUI visualization | Usability | High |
| P3 | Multi-provider pooling | Flexibility | High |
