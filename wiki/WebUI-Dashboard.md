# WebUI Budget Dashboard

**Last updated:** 2026-02-03

---

## Overview

Bloomberg-terminal-style dark theme dashboard for monitoring budget usage, model routing, and provider health in real-time. Designed for power users who want full visibility into how their AI credits are being spent.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite |
| Backend | Bun.serve |
| Real-time | WebSocket |
| Charts | recharts (new) + custom SVG (existing) |
| Styling | Plain CSS with design tokens (NO Tailwind) |

### Design System
- Background: `--color-bg-primary: #0a0a0a` (near-black)
- Fonts: Monospace (JetBrains Mono / system monospace)
- Layout: Compact, data-dense, Bloomberg-terminal aesthetic
- Design tokens: `src/webui/frontend/design-system.css`

---

## Dashboard Tabs

### Circuit Breaker Tab (Primary)
Real-time provider/model status grid.
- **ProviderModelCell**: Status light per model (green = healthy, yellow = half-open, red = open/failed)
- **CircuitBreakerGrid**: Full grid of all providers and models (541 lines)
- **CircuitDetailModal**: Click a cell for failure history, latency, reset timers
- **useCircuitStatus**: React hook with polling + WebSocket updates

### Budget Tab
Cost tracking and distribution.
- **BudgetUsageChart**: recharts real-time line chart showing spend over time
- **ModelDistributionChart**: recharts pie chart showing which models consume what percentage
- **CostTimeline**: Custom SVG timeline (pre-existing)
- **SpendingHeatmap**: Custom SVG heatmap (pre-existing)
- **ForecastWidget**: Custom SVG spend forecast (pre-existing)

### Health Tab
Provider health overview.
- **ProviderHealthMatrix**: Grid view of provider health metrics (496 lines)
- **ProviderComparison**: Custom SVG comparison (pre-existing)

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/orchestration/circuit-status` | GET | Current circuit breaker state for all providers |

### WebSocket Events

| Event Type | Direction | Description |
|------------|-----------|-------------|
| `circuit_update` | Server -> Client | Broadcast when circuit breaker state changes |

---

## Component Architecture

```
src/webui/
├── server.ts                          # Bun.serve backend, WebSocket, route registration
├── routes/
│   └── orchestration.ts               # /api/orchestration/* handlers
└── frontend/
    ├── src/
    │   └── App.tsx                     # Main app with tab navigation
    ├── components/
    │   ├── circuit-breaker/
    │   │   ├── useCircuitStatus.ts     # React hook (polling + WebSocket)
    │   │   ├── ProviderModelCell.tsx   # Status light cell
    │   │   ├── CircuitBreakerGrid.tsx  # Main grid (541 lines)
    │   │   └── CircuitDetailModal.tsx  # Detail modal
    │   ├── charts/
    │   │   ├── BudgetUsageChart.tsx    # recharts line chart
    │   │   ├── ModelDistributionChart.tsx # recharts pie chart
    │   │   └── index.ts               # Barrel export
    │   └── ProviderHealthMatrix.tsx    # Provider health grid (496 lines)
    └── design-system.css              # Design tokens
```

---

## How to Launch

```bash
# Via the CLI command (if registered)
/oib-webui

# Or directly
bun run src/webui/server.ts
```

The dashboard opens in your default browser.

---

## Current State (2026-02-03)

| Wave | Status | What |
|------|--------|------|
| Wave 1: Setup | DONE | recharts installed, circuit-status API, WebSocket broadcast |
| Wave 2: Circuit Breaker | DONE | All 5 components built and integrated |
| Wave 3: Charts | DONE | BudgetUsageChart + ModelDistributionChart |
| Wave 4: Data Views | DONE | ProviderHealthMatrix |
| Wave 5: Integration | PARTIAL | Components wired into tabs. Missing: WebSocket real-time for charts, integration tests |
| Wave 6: Bug Hunting | PENDING | 48 pre-existing test failures to investigate |
| Wave 7: GitHub Issues | PENDING | 12 open issues (#16, #15, #11 high priority) |

### Intent vs Current Gaps

| Intent | Current Gap |
|--------|-------------|
| Full real-time dashboard with WebSocket push for all metrics | Charts use polling only, not WebSocket |
| Integration tests for all WebUI components | No integration tests written yet |
| All 4 existing custom SVG charts integrated with new recharts | Coexist but not unified |

---

*Last updated: 2026-02-03*
