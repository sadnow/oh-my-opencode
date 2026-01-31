import { describe, it, expect, vi, beforeEach } from "bun:test";
import { handleGetAlerts } from "./alerts";
import { handleGetAnomalies } from "./anomaly";
import { handleGetStatsRoiComparison } from "./stats";
import { getRoutingLogger } from "../../features/budget-orchestrator/routing-logger";

vi.mock("../../features/budget-orchestrator/routing-logger", () => ({
  getRoutingLogger: vi.fn(),
}));

describe("Budget API Integration Tests", () => {
  describe("handleGetAlerts", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should return alerts and stats", async () => {
      //#given
      const mockLogs = [
        { timestamp: "2026-01-31T10:00:00Z", level: "info", category: "budget_alert", message: "Test alert" }
      ];
      const mockStats = { total: 1, byLevel: { info: 1 } };
      
      const mockLogger = {
        getLogs: vi.fn().mockReturnValue(mockLogs),
        getStats: vi.fn().mockReturnValue(mockStats),
      };
      (getRoutingLogger as any).mockReturnValue(mockLogger);

      const request = new Request("http://localhost/api/alerts?limit=10&level=info&category=budget_alert");

      //#when
      const response = handleGetAlerts(request);
      const data = await response.json() as any;

      //#then
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.alerts).toEqual(mockLogs);
      expect(data.data.stats).toEqual(mockStats);
      expect(mockLogger.getLogs).toHaveBeenCalledWith(10, "info", "budget_alert");
    });

    it("should use default values for limit and category", async () => {
      //#given
      const mockLogger = {
        getLogs: vi.fn().mockReturnValue([]),
        getStats: vi.fn().mockReturnValue({}),
      };
      (getRoutingLogger as any).mockReturnValue(mockLogger);

      const request = new Request("http://localhost/api/alerts");

      //#when
      await handleGetAlerts(request).json();

      //#then
      expect(mockLogger.getLogs).toHaveBeenCalledWith(50, null, "budget_alert");
    });
  });

  describe("handleGetAnomalies", () => {
    const mockOrchestrator = {
      getConfiguredProviders: vi.fn(),
      getAnomalies: vi.fn(),
    };

    it("should return 503 if budget orchestrator is not enabled", async () => {
      //#given
      const ctx = { budgetOrchestrator: null };
      const request = new Request("http://localhost/api/anomalies");

      //#when
      const response = handleGetAnomalies(request, ctx);
      const data = await response.json() as any;

      //#then
      expect(response.status).toBe(503);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Budget orchestration not enabled");
    });

    it("should return filtered anomalies", async () => {
      //#given
      const mockAnomalies = [
        { timestamp: Date.now(), type: "spike", amount: 10, provider: "anthropic" },
        { timestamp: Date.now() - 1000, type: "drift", amount: 5, provider: "openai" }
      ];
      mockOrchestrator.getConfiguredProviders.mockReturnValue(["anthropic", "openai"]);
      mockOrchestrator.getAnomalies.mockImplementation((p: string) => 
        mockAnomalies.filter(a => a.provider === p)
      );

      const ctx = { budgetOrchestrator: mockOrchestrator as any };
      const request = new Request("http://localhost/api/anomalies?type=spike&limit=1");

      //#when
      const response = handleGetAnomalies(request, ctx);
      const data = await response.json() as any;

      //#then
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.anomalies).toHaveLength(1);
      expect(data.data.anomalies[0].type).toBe("spike");
      expect(data.data.stats.total).toBe(1); // Total after type filter
    });

    it("should filter by since timestamp", async () => {
      //#given
      const now = Date.now();
      const mockAnomalies = [
        { timestamp: now, type: "spike", provider: "anthropic" },
        { timestamp: now - 10000, type: "spike", provider: "anthropic" }
      ];
      mockOrchestrator.getConfiguredProviders.mockReturnValue(["anthropic"]);
      mockOrchestrator.getAnomalies.mockReturnValue(mockAnomalies);

      const ctx = { budgetOrchestrator: mockOrchestrator as any };
      const since = now - 5000;
      const request = new Request(`http://localhost/api/anomalies?since=${since}`);

      //#when
      const response = handleGetAnomalies(request, ctx);
      const data = await response.json() as any;

      //#then
      expect(data.data.anomalies).toHaveLength(1);
      expect(data.data.anomalies[0].timestamp).toBe(now);
    });
  });

  describe("handleGetStatsRoiComparison", () => {
    const mockUsageTracker = {
      getWeeklySummary: vi.fn(),
    };

    it("should return 503 if usage tracker is not enabled", async () => {
      //#given
      const ctx = { usageTracker: null, budgetOrchestrator: null };

      //#when
      const response = handleGetStatsRoiComparison(ctx);
      const data = await response.json() as any;

      //#then
      expect(response.status).toBe(503);
      expect(data.success).toBe(false);
    });

    it("should return ROI comparison data", async () => {
      //#given
      const mockSummary = {
        current: { totalInputTokens: 1000, totalOutputTokens: 500 }
      };
      mockUsageTracker.getWeeklySummary.mockReturnValue(mockSummary);
      const ctx = { usageTracker: mockUsageTracker as any, budgetOrchestrator: null };

      //#when
      const response = handleGetStatsRoiComparison(ctx);
      const data = await response.json() as any;

      //#then
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(mockUsageTracker.getWeeklySummary).toHaveBeenCalled();
    });

    it("should return 500 on error", async () => {
      //#given
      mockUsageTracker.getWeeklySummary.mockImplementation(() => {
        throw new Error("Test error");
      });
      const ctx = { usageTracker: mockUsageTracker as any, budgetOrchestrator: null };

      //#when
      const response = handleGetStatsRoiComparison(ctx);
      const data = await response.json() as any;

      //#then
      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Error: Test error");
    });
  });
});
