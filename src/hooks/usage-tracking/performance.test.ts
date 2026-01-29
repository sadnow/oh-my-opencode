import { describe, expect, test, beforeEach, spyOn } from "bun:test"
import { createUsageTrackingHook } from "./index"
import { UsageTracker } from "../../features/usage-tracker"
import type { PluginInput } from "@opencode-ai/plugin"

describe("usage-tracking hook performance", () => {
  let usageTracker: UsageTracker
  let mockContext: PluginInput

  beforeEach(() => {
    usageTracker = new UsageTracker({
      enabled: true,
      persist: false,
    })

    mockContext = {
      directory: process.cwd(),
      client: {
        session: {
          messages: async ({ path }: { path: { id: string } }) => {
            // Mock SDK response with complete message data
            return {
              data: [
                {
                  info: { role: "user", sessionID: path.id },
                  parts: [{ type: "text", text: "Performance test input" }]
                },
                {
                  info: { role: "assistant", sessionID: path.id, model: { providerID: "openai", modelID: "gpt-5.2" } },
                  parts: [{ type: "text", text: "Performance test response" }]
                }
              ]
            }
          }
        }
      } as any,
      project: {} as any,
      worktree: process.cwd(),
      serverUrl: new URL("http://localhost:3000"),
      $: {} as any,
    }
  })

  test("Measure response time overhead and cumulative impact (100 sequential messages)", async () => {
    const hook = createUsageTrackingHook(mockContext, usageTracker)
    const iterations = 100
    const times: number[] = []

    console.log(`\n[Performance] Testing ${iterations} sequential messages...`)

    for (let i = 0; i < iterations; i++) {
      const sessionID = `session-seq-${i}`
      const start = performance.now()

      // 1. User message hook
      await hook?.["chat.message"]?.(
        { sessionID, model: { providerID: "openai", modelID: "gpt-5.2" }, messageID: `msg-user-${i}` },
        { message: { role: "user" }, parts: [{ type: "text", text: "Hello performance test" }] } as any
      )

      // 2. Assistant message.updated event (triggers SDK fetch)
      await hook?.event?.({
        event: {
          type: "message.updated",
          properties: {
            info: { id: `msg-assistant-${i}`, role: "assistant", sessionID }
          }
        }
      })

      const end = performance.now()
      times.push(end - start)
    }

    const totalTime = times.reduce((a, b) => a + b, 0)
    const avgTime = totalTime / iterations
    const maxTime = Math.max(...times)

    console.log(`[Performance] Total time: ${totalTime.toFixed(2)}ms`)
    console.log(`[Performance] Average time per message pair: ${avgTime.toFixed(4)}ms`)
    console.log(`[Performance] Max time: ${maxTime.toFixed(4)}ms`)

    expect(avgTime).toBeLessThan(5) // Target: < 5ms per message pair
  })

  test("Measure parallel impact (10 concurrent messages)", async () => {
    const hook = createUsageTrackingHook(mockContext, usageTracker)
    const concurrentCount = 10
    
    console.log(`\n[Performance] Testing ${concurrentCount} concurrent messages...`)
    
    const start = performance.now()
    
    const promises = Array.from({ length: concurrentCount }).map(async (_, i) => {
      const sessionID = `session-con-${i}`
      
      await hook?.["chat.message"]?.(
        { sessionID, model: { providerID: "anthropic", modelID: "claude-sonnet-4-5" }, messageID: `msg-user-con-${i}` },
        { message: { role: "user" }, parts: [{ type: "text", text: "Concurrent test" }] } as any
      )
      
      await hook?.event?.({
        event: {
          type: "message.updated",
          properties: {
            info: { id: `msg-assistant-con-${i}`, role: "assistant", sessionID }
          }
        }
      })
    })
    
    await Promise.all(promises)
    const end = performance.now()
    const totalTime = end - start
    const avgTime = totalTime / concurrentCount

    console.log(`[Performance] Concurrent total time: ${totalTime.toFixed(2)}ms`)
    console.log(`[Performance] Concurrent average time: ${avgTime.toFixed(4)}ms`)
    
    expect(avgTime).toBeLessThan(5)
  })

  test("Measure memory usage and verify no leaks", async () => {
    const hook = createUsageTrackingHook(mockContext, usageTracker)
    const iterations = 1000
    
    // Force GC if possible (Bun has it)
    if (global.Bun) {
      Bun.gc(true)
    }

    const initialMemory = process.memoryUsage().heapUsed
    console.log(`\n[Memory] Initial heap used: ${(initialMemory / 1024 / 1024).toFixed(2)} MB`)

    for (let i = 0; i < iterations; i++) {
      const sessionID = `session-mem-${i}`
      
      await hook?.["chat.message"]?.(
        { sessionID, model: { providerID: "google", modelID: "gemini-3-pro" }, messageID: `msg-user-mem-${i}` },
        { message: { role: "user" }, parts: [{ type: "text", text: "Memory test" }] } as any
      )
      
      await hook?.event?.({
        event: {
          type: "message.updated",
          properties: {
            info: { id: `msg-assistant-mem-${i}`, role: "assistant", sessionID }
          }
        }
      })
    }

    if (global.Bun) {
      Bun.gc(true)
    }

    const finalMemory = process.memoryUsage().heapUsed
    const diff = finalMemory - initialMemory
    
    console.log(`[Memory] Final heap used: ${(finalMemory / 1024 / 1024).toFixed(2)} MB`)
    console.log(`[Memory] Difference: ${(diff / 1024).toFixed(2)} KB for ${iterations} iterations`)

    // A small increase is expected due to processedMessages Set growing, 
    // but it shouldn't be massive (e.g., > 2MB for 1000 small strings)
    expect(diff).toBeLessThan(2 * 1024 * 1024) // Less than 2MB growth for 1000 messages
  })

  test("Compare performance with and without usage tracking enabled", async () => {
    const iterations = 100
    
    // 1. Without tracking (mocked empty hook)
    const startNoTrack = performance.now()
    for (let i = 0; i < iterations; i++) {
      // Simulate what happens without the hook (basically nothing)
      await Promise.resolve()
    }
    const endNoTrack = performance.now()
    const timeNoTrack = endNoTrack - startNoTrack

    // 2. With tracking
    const hook = createUsageTrackingHook(mockContext, usageTracker)
    const startWithTrack = performance.now()
    for (let i = 0; i < iterations; i++) {
      const sessionID = `session-comp-${i}`
      await hook?.["chat.message"]?.(
        { sessionID, model: { providerID: "openai", modelID: "gpt-5.2" }, messageID: `msg-user-comp-${i}` },
        { message: { role: "user" }, parts: [{ type: "text", text: "Comparison test" }] } as any
      )
      await hook?.event?.({
        event: {
          type: "message.updated",
          properties: {
            info: { id: `msg-assistant-comp-${i}`, role: "assistant", sessionID }
          }
        }
      })
    }
    const endWithTrack = performance.now()
    const timeWithTrack = endWithTrack - startWithTrack

    const overhead = (timeWithTrack - timeNoTrack) / iterations
    console.log(`\n[Comparison] Time without tracking: ${timeNoTrack.toFixed(2)}ms`)
    console.log(`[Comparison] Time with tracking: ${timeWithTrack.toFixed(2)}ms`)
    console.log(`[Comparison] Estimated overhead per message pair: ${overhead.toFixed(4)}ms`)
    
    expect(overhead).toBeLessThan(5)
  })
})
