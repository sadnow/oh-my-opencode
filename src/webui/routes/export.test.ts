import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { startWebUI } from "../index";
import { UsageTracker } from "../../features/usage-tracker";
import { BudgetOrchestrator } from "../../features/budget-orchestrator";
import { initHotConfigManager } from "../../features/hot-config";
import { loadPluginConfig } from "../../plugin-config";
import { getRoutingLogger } from "../../features/budget-orchestrator/routing-logger";

describe("Export API", () => {
  let server: any;
  let baseURL: string;
  let serverAvailable = false;

  beforeAll(async () => {
    const config = loadPluginConfig(process.cwd(), null);
    const usageTracker = new UsageTracker({
      enabled: true,
      persist: false,
    });

    // Add some dummy usage data
    usageTracker.recordUsage({
      provider: "anthropic",
      model: "claude-3-opus",
      inputTokens: 100,
      outputTokens: 50,
      taskType: "primary",
      estimatedCost: 0.01,
    } as any);

    const budgetOrchestrator = new BudgetOrchestrator(
      {
        enabled: true,
        provider_budgets: { anthropic: 20 },
        target_percentage: 0.7,
        auto_downgrade: true,
        auto_upgrade: true,
        min_tier: "budget",
        routing_log_persist: false,
      },
      usageTracker,
      ["anthropic"]
    );

    const hotConfigManager = initHotConfigManager({
      directory: process.cwd(),
      initialConfig: config,
      watchFiles: false,
    });

    const port = 3849;
    baseURL = `http://localhost:${port}`;

    try {
      server = startWebUI({
        port,
        bind: "localhost",
        configManager: hotConfigManager,
        usageTracker,
        budgetOrchestrator,
      });

      await new Promise(resolve => setTimeout(resolve, 500));
      const healthCheck = await fetch(`${baseURL}/health`).catch(() => null);
      serverAvailable = healthCheck?.ok === true;
    } catch (err) {
      serverAvailable = false;
    }
  });

  afterAll(() => {
    server?.stop();
  });

  describe("GET /api/export/usage", () => {
    it("should export usage as JSON by default", async () => {
      const response = await fetch(`${baseURL}/api/export/usage`);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("application/json");
      const data = await response.json() as { success: boolean; data: any[] };
      expect(data.success).toBe(true);
      expect(data.data).toBeArray();
    });

    it("should export usage as CSV when requested", async () => {
      const response = await fetch(`${baseURL}/api/export/usage?format=csv`);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("text/csv");
      expect(response.headers.get("content-disposition")).toContain('filename="usage-export.csv"');
      const text = await response.text();
      expect(text).toContain("id,timestamp,provider,model");
    });
  });

  describe("GET /api/export/config", () => {
    it("should export config as JSON", async () => {
      const response = await fetch(`${baseURL}/api/export/config`);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("application/json");
      expect(response.headers.get("content-disposition")).toContain('filename="config-export.json"');
      const data = await response.json() as any;
      expect(data).toHaveProperty("orchestration_preset");
    });
  });

  describe("GET /api/export/presets", () => {
    it("should export presets as JSON by default", async () => {
      const response = await fetch(`${baseURL}/api/export/presets`);
      expect(response.status).toBe(200);
      const data = await response.json() as { success: boolean; data: any[] };
      expect(data.success).toBe(true);
      expect(data.data).toBeArray();
    });

    it("should export presets as CSV when requested", async () => {
      const response = await fetch(`${baseURL}/api/export/presets?format=csv`);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("text/csv");
      const text = await response.text();
      expect(text).toContain("name,description");
    });
  });

  describe("GET /api/export/routing-logs", () => {
    beforeAll(() => {
      const logger = getRoutingLogger();
      logger.clearLogs();
      // Add some dummy logs with specific timestamps
      // We need to manually add logs to control timestamps for filtering tests
      // Since addLog is private, we use the public logging methods
      // But public methods use new Date().toISOString(), so we might need to wait or mock
      // For simplicity, let's just add some logs and test basic export first
      logger.logTierChange("budget", "standard", "Test reason 1");
      logger.logTierChange("standard", "pro", "Test reason 2");
    });

    it("should export routing logs as JSON by default", async () => {
      const response = await fetch(`${baseURL}/api/export/routing-logs`);
      expect(response.status).toBe(200);
      const data = await response.json() as any[];
      expect(data).toBeArray();
      expect(data.length).toBeGreaterThanOrEqual(2);
    });

    it("should export routing logs as CSV when requested", async () => {
      const response = await fetch(`${baseURL}/api/export/routing-logs?format=csv`);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("text/csv");
      expect(response.headers.get("content-disposition")).toContain("routing-logs-");
      const text = await response.text();
      expect(text).toContain("timestamp,level,category,message,model,reason");
      expect(text).toContain("tier_change");
      expect(text).toContain("Test reason 1");
    });

    it("should filter by since parameter", async () => {
      const now = new Date();
      const future = new Date(now.getTime() + 10000).toISOString();
      const response = await fetch(`${baseURL}/api/export/routing-logs?since=${future}`);
      expect(response.status).toBe(200);
      const data = await response.json() as any[];
      expect(data.length).toBe(0);
    });

    it("should filter by until parameter", async () => {
      const past = new Date(Date.now() - 10000).toISOString();
      const response = await fetch(`${baseURL}/api/export/routing-logs?until=${past}`);
      expect(response.status).toBe(200);
      const data = await response.json() as any[];
      expect(data.length).toBe(0);
    });
  });
});
