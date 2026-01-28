/**
 * Debug script to understand why output tokens are 0
 * Shows the actual usage data structure
 */

const usageFilePath = `${process.env.HOME || process.env.USERPROFILE}/.config/opencode/oh-my-opencode-usage.json`

console.log("Reading usage file:", usageFilePath)

const file = Bun.file(usageFilePath)
const usageData = await file.json()

console.log("\n" + "=".repeat(80))
console.log("USAGE DATA ANALYSIS")
console.log("=".repeat(80))

console.log("\nRecords:", usageData.records.length)

for (const record of usageData.records) {
  console.log("\n---")
  console.log("ID:", record.id)
  console.log("Timestamp:", new Date(record.timestamp).toLocaleString())
  console.log("Provider:", record.provider)
  console.log("Model:", record.model)
  console.log("Input Tokens:", record.inputTokens)
  console.log("Output Tokens:", record.outputTokens, record.outputTokens === 0 ? "⚠️ ZERO!" : "")
  console.log("Cost:", `$${record.estimatedCost.toFixed(6)}`)
  console.log("Task Type:", record.taskType)
  console.log("Session:", record.sessionID)
}

console.log("\n" + "=".repeat(80))
console.log("\nKEY FINDINGS:")
if (usageData.records.some((r: any) => r.outputTokens === 0)) {
  console.log("⚠️  Some records have 0 output tokens")
  console.log("   This means the assistant message was not captured properly")
  console.log("   Possible causes:")
  console.log("   1. Assistant hadn't responded yet when hook polled")
  console.log("   2. Assistant message has no text parts")
  console.log("   3. Message structure is different than expected")
}

if (usageData.records.some((r: any) => r.provider === "unknown")) {
  console.log("\n⚠️  Some records have unknown provider")
  console.log("   Model info not available in message.info.model")
  console.log("   Falling back to input.agent which doesn't map to provider")
}

console.log("\n=".repeat(80))

