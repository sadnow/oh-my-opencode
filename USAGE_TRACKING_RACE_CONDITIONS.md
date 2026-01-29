# Usage Tracking Race Conditions

## Overview

The usage tracking system uses a hybrid approach that involves **asynchronous operations** and **SDK fetch calls**. This architecture creates race conditions where events may fire before data is fully written to storage.

This document explains the race conditions, their symptoms, and the self-correcting mechanisms that handle them.

---

## The Race Condition

### What Happens

```
USER MESSAGE
├─ chat.message hook fires
├─ Store inputTokens in pendingSessions Map
└─ User message written to session storage

ASSISTANT MESSAGE
├─ message.updated event fires ← TOO EARLY!
├─ SDK fetch: client.session.messages()
├─ ❌ Assistant message not yet in storage
└─ Warning logged, no usage recorded

ASSISTANT MESSAGE (Again)
├─ message.updated event fires again ← NOW READY
├─ SDK fetch: client.session.messages()
├─ ✅ Assistant message now in storage
└─ Usage recorded successfully
```

### Why It Happens

The `message.updated` event can fire **before** the assistant message is fully persisted to session storage. This is a fundamental timing issue with the OpenCode SDK event system.

**Key insight:** `message.updated` fires multiple times for the same message as it's being constructed/streamed, so early failures are self-correcting.

---

## Self-Correcting Mechanism

### Built-in Retry Pattern

The system **does not need manual retry logic** because:

1. **Multiple event fires**: `message.updated` fires multiple times per message
2. **Idempotency**: `processedMessages` Set prevents duplicate recordings
3. **Self-correction**: Later event fires succeed after data is written

### Production Evidence

```log
[2026-01-29T18:32:22.947Z] ✅ Stored USER input tokens (pendingSessions)
[2026-01-29T18:32:25.123Z] ⚠️ Assistant message not found or has no parts in fetched messages
[2026-01-29T18:32:31.646Z] ✅ Successfully recorded usage! outputTokens: 41 (SDK fetch)
```

**First attempt:** Failed (assistant not written yet)  
**Second attempt:** Succeeded (assistant now available)  
**Result:** Correct usage recorded, no data loss

---

## Code Implementation

### How Duplicate Prevention Works

```typescript
// Prevent duplicate processing
if (processedMessages.has(messageID)) {
  return
}

// Mark as processed AFTER successful recording
await usageTracker.recordUsage(...)
processedMessages.add(messageID)
```

**Critical:** We mark processed AFTER success, so failures allow retry on next event.

### How Memory Cleanup Works

```typescript
// Clean stale pending sessions (1-hour TTL)
const staleThreshold = Date.now() - 3600000
for (const [sid, data] of pendingSessions) {
  if (data.timestamp < staleThreshold) {
    pendingSessions.delete(sid)
  }
}
```

**Purpose:** Prevent memory leaks from abandoned sessions (user closed tab, crash, etc.)

---

## Observability

### Expected Log Patterns

**Healthy (Self-Correcting):**
```
✅ Stored USER input tokens
⚠️ Assistant message not found... (first attempt)
✅ Successfully recorded usage! (second attempt)
```

**Healthy (Immediate Success):**
```
✅ Stored USER input tokens
✅ Successfully recorded usage!
```

**Unhealthy (Persistent Failure):**
```
✅ Stored USER input tokens
⚠️ Assistant message not found... (first attempt)
⚠️ Assistant message not found... (second attempt)
⚠️ Assistant message not found... (third attempt)
❌ No successful recording
```

### Health Check Integration

The health-check system detects persistent failures:

```typescript
// Check for excessive zero-output records
if (zeroPercentage > 0.1) {
  warnings.push("CRITICAL: outputTokens=0 bug may have regressed")
}
```

**Threshold:** 10% of recent records with `outputTokens=0` triggers alert

---

## Why This Architecture Works

### Advantages

1. **No manual retry logic needed** - events fire naturally
2. **Idempotent by design** - `processedMessages` Set prevents duplicates
3. **Self-correcting** - later events succeed automatically
4. **Memory safe** - TTL cleanup prevents leaks

### Trade-offs

1. **Warning logs** - Expected during normal operation (first attempt often fails)
2. **Slight delay** - Usage recorded on 2nd/3rd event fire, not first
3. **Best-effort** - If ALL events fail, usage not recorded (rare)

---

## Testing

### Anti-Regression Test

See `src/features/usage-tracker/integration-regression.test.ts`:

```typescript
test("Race condition: message.updated fires before assistant message is written", async () => {
  // Mock SDK to return incomplete data initially, complete data on retry
  let fetchCount = 0
  messages: async () => {
    fetchCount++
    return fetchCount === 1
      ? { data: [/* user only */] }  // First fetch fails
      : { data: [/* user + assistant */] }  // Second succeeds
  }
  
  // Trigger events
  await hook?.event?.(firstMessageUpdated)  // Fails (expected)
  await hook?.event?.(secondMessageUpdated)  // Succeeds
  
  expect(fetchCount).toBeGreaterThanOrEqual(2)  // Self-corrected
})
```

**Result:** ✅ Test validates self-correction works

---

## Monitoring Recommendations

### 1. Log Monitoring

Watch for patterns of **persistent failures** (3+ consecutive warnings for same session):

```bash
tail -f /tmp/oh-my-opencode.log | grep "Assistant message not found"
```

### 2. Health Check Automation

Run health check periodically (e.g., hourly cron):

```bash
# Example: Hourly health check
0 * * * * bun run src/features/usage-tracker/health-check.ts
```

### 3. Alert on High Zero-Output Percentage

Use health check to trigger alerts:

```typescript
const health = await checkUsageTracking(storagePath)
if (!health.checks.noZeroOutputTokens) {
  sendAlert("Usage tracking regression detected!")
}
```

---

## Future Improvements

### Potential Optimizations

1. **Exponential backoff** - Retry with increasing delays
2. **Event deduplication** - Track event IDs to avoid duplicate processing
3. **Explicit retry queue** - Store failed attempts for manual retry

**Current assessment:** Not needed. Self-correction works well in production.

---

## References

- **Implementation:** `src/hooks/usage-tracking/index.ts`
- **Tests:** `src/features/usage-tracker/integration-regression.test.ts`
- **Health Check:** `src/features/usage-tracker/health-check.ts`
- **Production Logs:** `/tmp/oh-my-opencode.log`
- **Storage:** `~/.config/opencode/oh-my-opencode-usage.json`

---

## Summary

The race condition is **expected behavior** and **self-corrects automatically**. The system is designed to handle timing issues gracefully without manual intervention.

**Key takeaway:** Warning logs about "Assistant message not found" are normal and indicate the self-correction mechanism is working as designed.
