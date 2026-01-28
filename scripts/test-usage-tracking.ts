#!/usr/bin/env bun
/**
 * Autonomous Usage Tracking Test
 * 
 * Tests the usage tracking implementation by:
 * 1. Checking if WebUI is running
 * 2. Fetching usage data from the API
 * 3. Verifying data structure
 * 4. Reporting results
 */

const WEBUI_PORT = 3847;
const BASE_URL = `http://localhost:${WEBUI_PORT}`;

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  data?: unknown;
}

const results: TestResult[] = [];

async function testWebUIAvailability(): Promise<boolean> {
  try {
    const response = await fetch(`${BASE_URL}/`);
    const passed = response.ok;
    results.push({
      name: "WebUI Availability",
      passed,
      message: passed
        ? `WebUI is running on port ${WEBUI_PORT}`
        : `WebUI returned status ${response.status}`,
    });
    return passed;
  } catch (error) {
    results.push({
      name: "WebUI Availability",
      passed: false,
      message: `Cannot connect to WebUI: ${error}`,
    });
    return false;
  }
}

async function testUsageAPIEndpoint(): Promise<boolean> {
  try {
    const response = await fetch(`${BASE_URL}/api/usage`);
    const data = await response.json();

    const passed = response.ok && data.success;
    results.push({
      name: "Usage API Endpoint",
      passed,
      message: passed
        ? "Usage API endpoint responded successfully"
        : `Usage API returned error: ${data.error || "Unknown"}`,
      data,
    });
    return passed;
  } catch (error) {
    results.push({
      name: "Usage API Endpoint",
      passed: false,
      message: `Failed to fetch usage data: ${error}`,
    });
    return false;
  }
}

async function testUsageDataStructure(): Promise<boolean> {
  try {
    const response = await fetch(`${BASE_URL}/api/usage`);
    const data = await response.json();

    if (!data.success) {
      results.push({
        name: "Usage Data Structure",
        passed: false,
        message: "API returned error",
      });
      return false;
    }

    const hasData = data.data && typeof data.data === "object";
    const hasSummaries = hasData && "summaries" in data.data;
    const hasTotalCost = hasData && "totalCost" in data.data;

    const passed = hasData && hasSummaries && hasTotalCost;

    results.push({
      name: "Usage Data Structure",
      passed,
      message: passed
        ? "Usage data has expected structure (summaries + totalCost)"
        : "Usage data structure is incorrect",
      data: data.data,
    });

    return passed;
  } catch (error) {
    results.push({
      name: "Usage Data Structure",
      passed: false,
      message: `Error checking data structure: ${error}`,
    });
    return false;
  }
}

async function testUsageDataPopulated(): Promise<boolean> {
  try {
    const response = await fetch(`${BASE_URL}/api/usage`);
    const data = await response.json();

    if (!data.success || !data.data) {
      results.push({
        name: "Usage Data Populated",
        passed: false,
        message: "No usage data available",
      });
      return false;
    }

    const { summaries, totalCost } = data.data;
    const hasRecords =
      summaries &&
      typeof summaries === "object" &&
      Object.keys(summaries).length > 0;

    const passed = hasRecords || totalCost > 0;

    results.push({
      name: "Usage Data Populated",
      passed,
      message: passed
        ? `Usage tracking is recording data! Total cost: $${totalCost.toFixed(4)}, Providers: ${Object.keys(summaries || {}).length}`
        : "No usage data recorded yet (summaries empty, total cost $0.00)",
      data: {
        providers: Object.keys(summaries || {}),
        totalCost,
        summaryCount: Object.keys(summaries || {}).length,
      },
    });

    return passed;
  } catch (error) {
    results.push({
      name: "Usage Data Populated",
      passed: false,
      message: `Error checking usage data: ${error}`,
    });
    return false;
  }
}

async function testProviderSummaries(): Promise<boolean> {
  try {
    const response = await fetch(`${BASE_URL}/api/usage`);
    const data = await response.json();

    if (!data.success || !data.data || !data.data.summaries) {
      results.push({
        name: "Provider Summaries",
        passed: false,
        message: "No provider summaries available",
      });
      return false;
    }

    const { summaries } = data.data;
    const providers = Object.keys(summaries);

    if (providers.length === 0) {
      results.push({
        name: "Provider Summaries",
        passed: false,
        message: "No provider summaries found (empty)",
      });
      return false;
    }

    // Check first provider has expected fields
    const firstProvider = providers[0];
    const firstSummary = summaries[firstProvider];
    const hasExpectedFields =
      firstSummary &&
      "inputTokens" in firstSummary &&
      "outputTokens" in firstSummary &&
      "totalCost" in firstSummary;

    results.push({
      name: "Provider Summaries",
      passed: hasExpectedFields,
      message: hasExpectedFields
        ? `Found ${providers.length} provider(s): ${providers.join(", ")}`
        : "Provider summaries missing expected fields",
      data: {
        providers,
        exampleSummary: firstSummary,
      },
    });

    return hasExpectedFields;
  } catch (error) {
    results.push({
      name: "Provider Summaries",
      passed: false,
      message: `Error checking provider summaries: ${error}`,
    });
    return false;
  }
}

async function checkUsageFile(): Promise<boolean> {
  try {
    const fs = await import("fs");
    const path = await import("path");
    const os = await import("os");

    const usageFilePath = path.join(
      os.homedir(),
      ".config",
      "opencode",
      "oh-my-opencode-usage.json"
    );

    const exists = fs.existsSync(usageFilePath);

    if (!exists) {
      results.push({
        name: "Usage File Persistence",
        passed: false,
        message: `Usage file does not exist: ${usageFilePath}`,
      });
      return false;
    }

    const content = fs.readFileSync(usageFilePath, "utf-8");
    const json = JSON.parse(content);

    const hasData =
      json &&
      typeof json === "object" &&
      Object.keys(json).length > 0;

    results.push({
      name: "Usage File Persistence",
      passed: hasData,
      message: hasData
        ? `Usage file exists with data (${Object.keys(json).length} keys)`
        : "Usage file exists but is empty",
      data: { path: usageFilePath, keys: Object.keys(json) },
    });

    return hasData;
  } catch (error) {
    results.push({
      name: "Usage File Persistence",
      passed: false,
      message: `Error checking usage file: ${error}`,
    });
    return false;
  }
}

function printResults() {
  console.log("\n" + "=".repeat(80));
  console.log("USAGE TRACKING TEST RESULTS");
  console.log("=".repeat(80) + "\n");

  let passed = 0;
  let failed = 0;

  for (const result of results) {
    const icon = result.passed ? "✅" : "❌";
    console.log(`${icon} ${result.name}`);
    console.log(`   ${result.message}`);

    if (result.data) {
      console.log(`   Data: ${JSON.stringify(result.data, null, 2).split("\n").join("\n   ")}`);
    }

    console.log();

    if (result.passed) {
      passed++;
    } else {
      failed++;
    }
  }

  console.log("=".repeat(80));
  console.log(`SUMMARY: ${passed} passed, ${failed} failed`);
  console.log("=".repeat(80) + "\n");

  return failed === 0;
}

async function main() {
  console.log("Starting autonomous usage tracking tests...\n");

  // Run tests sequentially
  await testWebUIAvailability();
  await testUsageAPIEndpoint();
  await testUsageDataStructure();
  await testUsageDataPopulated();
  await testProviderSummaries();
  await checkUsageFile();

  const allPassed = printResults();

  if (!allPassed) {
    console.log("⚠️  Some tests failed. This could mean:");
    console.log("  1. Usage tracking hook is not firing");
    console.log("  2. No conversations have happened yet");
    console.log("  3. UsageTracker is not recording data");
    console.log("  4. WebUI is not running");
    console.log("\nTo debug:");
    console.log("  1. Check OpenCode logs for '[usage-tracking]' messages");
    console.log("  2. Send a test message in OpenCode");
    console.log("  3. Re-run this test script");
    process.exit(1);
  }

  console.log("✅ All tests passed! Usage tracking is working correctly.");
  process.exit(0);
}

main();
