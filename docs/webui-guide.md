# oh-im-broke WebUI Guide

**Version**: 3.0  
**Last Updated**: 2026-01-31

---

## Overview

The oh-im-broke WebUI is a **dense, professional budget analytics dashboard** designed with a Bloomberg Terminal aesthetic. It provides real-time monitoring of API usage, budget tracking, quota management, and cost optimization insights.

### Key Features

- **Compact Design**: 30% more content visible on screen compared to standard dashboards
- **8 Visualization Components**: Heatmaps, timelines, gauges, leaderboards, and more
- **Real-time Updates**: 30-second polling (WebSocket backend ready for future enhancement)
- **Zero External Dependencies**: All charts built with native SVG
- **Professional Aesthetic**: Bloomberg Terminal-inspired dark theme

---

## Getting Started

### Starting the WebUI

```bash
# From project root
bun run webui

# Or using the CLI command
bunx oh-im-broke webui
```

The server starts on **http://localhost:3847** by default.

### Configuration

The WebUI server can be configured via environment variables or command-line flags:

```bash
# Custom port
bun run webui --port 8080

# Custom bind address
bun run webui --bind 0.0.0.0

# Both
bun run webui --port 8080 --bind 0.0.0.0
```

---

## Dashboard Tabs

### 1. Budget Tab

**Purpose**: Monitor overall budget health and spending patterns

**Components**:
- **Budget Gauge**: Circular progress showing budget utilization with color-coded thresholds
  - Green: < 70% used
  - Yellow: 70-90% used
  - Red: > 90% used
- **Spending Heatmap**: 24×7 grid showing time-of-day spending patterns
  - Darker colors = higher spending
  - Hover for exact amounts
  - Identifies peak usage hours
- **Cost Timeline**: Horizontal timeline with events and spending curve
  - Shows tier changes, alerts, anomalies
  - Overlay spending trend
  - Click events for details
- **KPI Cards**: Total spent, remaining budget, daily average, projected end-of-month
- **Provider Breakdown**: Spending by provider (Anthropic, OpenAI, Google, etc.)

**Use Cases**:
- Quick budget health check
- Identify spending spikes
- Detect unusual patterns
- Plan budget adjustments

### 2. Stats Tab

**Purpose**: Analyze efficiency, ROI, and usage patterns

**Components**:
- **Model Leaderboard**: Efficiency rankings by tokens-per-dollar
  - Top 3 models highlighted with badges (🥇🥈🥉)
  - ROI metrics for each model
  - Sortable by efficiency, cost, tokens
- **Summary Stats**: Weekly/monthly totals, averages, trends
- **Category Breakdown**: Spending by task category (visual-engineering, ultrabrain, etc.)
- **Provider Trends**: Historical spending by provider with trend indicators
- **Session Stats**: Average session cost, duration, token usage

**Use Cases**:
- Optimize model selection
- Identify most cost-effective models
- Track efficiency improvements
- Analyze category spending

### 3. Usage Tab

**Purpose**: Track quotas and real-time usage

**Components**:
- **Quota Matrix**: Unified view of all quotas
  - Claude Max: Requests remaining, reset time
  - Copilot: Completions/chat remaining, reset time
  - API Budgets: Per-provider limits and usage
- **Claude Max Usage**: Detailed Claude Max quota tracking
  - Requests used/remaining
  - Reset countdown
  - Historical usage chart
  - Refresh button for manual updates
- **Copilot Usage**: GitHub Copilot quota tracking
  - Completions and chat quotas
  - OAuth status
  - Historical usage

**Use Cases**:
- Monitor quota consumption
- Plan usage around reset times
- Avoid quota exhaustion
- Track subscription value

### 4. Routing Logs Tab

**Purpose**: Audit model routing decisions and debug issues

**Components**:
- **Routing Logs Viewer**: Detailed log of all model routing decisions
  - Timestamp, model selected, reason, cost
  - Filter by provider, model, date range
  - Search by session ID or prompt
- **Audit Trail**: Historical routing decisions
- **Logged Alerts**: Budget alerts and warnings

**Use Cases**:
- Debug unexpected model selections
- Audit routing logic
- Track tier changes
- Investigate cost spikes

### 5. Settings Tab

**Purpose**: Configure adaptive budget settings and overrides

**Components**:
- **Adaptive Settings**: Configure learning mode, auto-upgrade/downgrade
- **Quota Targets**: Set target utilization percentages
- **Global Overrides**: Emergency mode, max tier limits, provider disabling
- **Zen Usage Override**: Manual budget adjustments

**Use Cases**:
- Enable/disable adaptive features
- Set emergency budget limits
- Override automatic decisions
- Fine-tune budget behavior

---

## Visualization Components

### Spending Heatmap

**What it shows**: Time-of-day spending patterns across the week

**How to read**:
- **X-axis**: Hours (0-23)
- **Y-axis**: Days (Mon-Sun)
- **Color intensity**: Spending amount (darker = more expensive)
- **Hover**: Exact amount and timestamp

**Insights**:
- Identify peak usage hours
- Detect unusual activity times
- Plan budget around usage patterns

### Model Leaderboard

**What it shows**: Model efficiency rankings

**Metrics**:
- **Tokens per Dollar**: Higher is better (more tokens for your money)
- **Cost per Token**: Lower is better
- **Average Cost per Call**: Total cost divided by number of calls
- **Quality Score**: Optional user-defined rating

**How to use**:
- Sort by efficiency to find best value models
- Compare similar models (e.g., GPT-4 vs Claude Opus)
- Identify underutilized efficient models

### Cost Timeline

**What it shows**: Chronological view of spending and events

**Elements**:
- **Events**: Tier changes, alerts, anomalies (markers on timeline)
- **Spending Curve**: Cumulative or daily spending overlay
- **Zoom Controls**: Focus on specific time ranges

**Use Cases**:
- Correlate events with spending changes
- Identify cause of cost spikes
- Track impact of tier changes

### Budget Gauge

**What it shows**: Current budget utilization percentage

**Color Coding**:
- **Green** (0-70%): Healthy usage
- **Yellow** (70-90%): Approaching limit
- **Red** (90-100%): Critical, near exhaustion

**Interaction**:
- Click for detailed breakdown
- Hover for exact percentage

### Quota Matrix

**What it shows**: All quotas in one unified view

**Quotas Tracked**:
1. **Claude Max**: Anthropic's free tier quota
2. **Copilot**: GitHub Copilot completions and chat
3. **API Budgets**: Per-provider spending limits

**Information Displayed**:
- Used / Total
- Percentage consumed
- Reset time (countdown)
- Status indicator (OK / Warning / Critical)

### Session Cost Chart

**What it shows**: Per-session spending breakdown

**Features**:
- Bar chart of session costs
- Grouped by date
- Filterable by provider
- Sortable by cost, duration, tokens

**Use Cases**:
- Identify expensive sessions
- Track session-level ROI
- Optimize session patterns

### Provider Comparison

**What it shows**: Side-by-side provider metrics

**Metrics Compared**:
- Total cost
- Total tokens
- Average cost per call
- Efficiency (tokens per dollar)
- Call count

**Highlighting**:
- **Green**: Best in category
- **Red**: Worst in category

### Alert Timeline

**What it shows**: Vertical timeline of budget alerts

**Alert Types**:
- Budget threshold warnings (70%, 90%, 100%)
- Quota exhaustion alerts
- Anomaly detections
- Tier change notifications

**Features**:
- Color-coded by severity
- Filterable by type
- Clickable for details

---

## Design System

### Typography

- **Extra Small**: 11px (labels, metadata)
- **Small**: 12px (body text, table cells)
- **Base**: 14px (default text)
- **Medium**: 16px (headings, emphasis)
- **Large**: 18px (section titles)

### Spacing Scale

- **1**: 4px (tight spacing)
- **2**: 8px (compact spacing)
- **3**: 12px (default spacing)
- **4**: 16px (comfortable spacing)

### Color Palette

**Background**:
- Primary: `#0a0a0a` (near black)
- Secondary: `#1a1a1a` (dark gray)
- Tertiary: `#2a2a2a` (medium gray)

**Text**:
- Primary: `#e0e0e0` (light gray)
- Secondary: `#a0a0a0` (medium gray)
- Muted: `#707070` (dark gray)

**Status Colors**:
- Success: `#4caf50` (green)
- Warning: `#ff9800` (orange)
- Error: `#f44336` (red)
- Info: `#2196f3` (blue)

### Density Modes

**Compact Mode** (default):
- Minimal padding
- Smaller fonts
- Tight spacing
- Maximum information density

**Comfortable Mode**:
- Increased padding (+25%)
- Slightly larger fonts (+10%)
- More whitespace
- Easier reading

Toggle via the density button in the header.

---

## Keyboard Shortcuts

> **Note**: Keyboard shortcuts are planned but not yet implemented (Task 19)

**Planned Shortcuts**:
- `1-7`: Switch between tabs
- `?`: Show help modal with all shortcuts
- `/`: Focus search/filter input
- `Esc`: Close modals and dialogs
- `r`: Refresh current tab data
- `d`: Toggle density mode

---

## API Endpoints

The WebUI backend exposes the following REST API endpoints:

### Budget & Usage

- `GET /api/budget` - Current budget status
- `GET /api/budget/dashboard` - Dashboard summary data
- `GET /api/budget/trends` - Historical budget trends
- `GET /api/usage` - Overall usage statistics
- `GET /api/usage/:provider` - Provider-specific usage

### Stats & Analytics

- `GET /api/stats/summary?period=weekly|monthly` - Summary statistics
- `GET /api/stats/by-category` - Spending by category
- `GET /api/stats/efficiency` - Model efficiency rankings
- `GET /api/stats/sessions` - Session-level statistics
- `GET /api/stats/all-providers?range=7d|30d` - Provider comparison

### Quotas

- `GET /api/claude-max/usage` - Claude Max quota status
- `GET /api/claude-max/history` - Historical Claude Max usage
- `POST /api/claude-max/refresh` - Refresh Claude Max data
- `GET /api/copilot/usage` - Copilot quota status
- `GET /api/copilot/history` - Historical Copilot usage
- `POST /api/copilot/refresh` - Refresh Copilot data

### Logs & Alerts

- `GET /api/routing-logs?limit=100` - Routing decision logs
- `GET /api/alerts` - Budget alerts and warnings
- `GET /api/anomalies` - Detected spending anomalies

### Configuration

- `GET /api/adaptive/settings` - Adaptive budget settings
- `POST /api/adaptive/settings` - Update adaptive settings
- `GET /api/config` - Current configuration
- `POST /api/config` - Update configuration

### Health & Monitoring

- `GET /api/health-check` - Server health status
- `GET /ws` - WebSocket endpoint (upgrade required)

---

## WebSocket Support

### Backend (Ready)

The WebSocket backend is fully implemented and ready to use:

**Endpoint**: `ws://localhost:3847/ws`

**Message Types**:
```typescript
{
  type: 'connected' | 'budget_update' | 'usage_update' | 'tier_change' | 'alert',
  timestamp: number,
  data: any
}
```

### Frontend (Not Yet Implemented)

The frontend currently uses 30-second polling. To enable real-time WebSocket updates:

1. Create `src/webui/frontend/src/hooks/useWebSocket.tsx`
2. Implement WebSocket connection with reconnection logic
3. Update dashboard components to use the hook
4. Fall back to polling if WebSocket unavailable

See `.sisyphus/notepads/webui-revamp/issues.md` for implementation details.

---

## Troubleshooting

### Dashboard Not Loading

**Symptoms**: Blank page or "Cannot GET /" error

**Solutions**:
1. Verify server is running: `bun run webui`
2. Check port is not in use: `lsof -i :3847` (Unix) or `netstat -ano | findstr :3847` (Windows)
3. Check browser console for errors
4. Try clearing browser cache

### 404 Errors in Console

**Symptoms**: Console shows "404 Not Found" for API endpoints

**Solutions**:
1. Verify all endpoints exist (see API Endpoints section)
2. Check server logs for routing errors
3. Ensure frontend build is up to date: `cd src/webui/frontend && bun run build`

### Data Not Updating

**Symptoms**: Dashboard shows stale data

**Solutions**:
1. Check polling interval (default: 30 seconds)
2. Manually refresh the page
3. Check server logs for errors
4. Verify usage tracker is running

### High Memory Usage

**Symptoms**: Server consuming excessive memory

**Solutions**:
1. Restart the server
2. Clear routing logs: `POST /api/routing-logs/clear`
3. Reduce polling frequency in frontend components
4. Check for memory leaks in custom components

---

## Performance Optimization

### Current Bundle Size

- **Uncompressed**: 333 KB
- **Gzipped**: 87 KB

### Optimization Opportunities

1. **Code Splitting**: Lazy load tabs to reduce initial bundle
2. **Tree Shaking**: Remove unused chart code
3. **Memoization**: Cache expensive calculations
4. **Dynamic Imports**: Load heavy components on demand

### Lighthouse Score

Target: > 90

**Current Optimizations**:
- SVG-based charts (no heavy libraries)
- Minimal dependencies
- Efficient polling (30s intervals)
- Compact CSS (18 KB)

---

## Mobile Support

> **Note**: Mobile responsive design is planned but not yet implemented (Task 22)

**Current Status**: Desktop-only (optimized for 1920×1080 and above)

**Planned Improvements**:
- Responsive grid breakpoints (768px, 480px)
- Collapsible sections for dense data
- Touch-friendly tap targets (44px minimum)
- Single-column layout on mobile

**Workaround**: Use desktop browser or tablet in landscape mode

---

## Development

### Building the Frontend

```bash
cd src/webui/frontend
bun install
bun run build
```

Output: `dist/webui/` (served by backend)

### Running in Development Mode

```bash
# Terminal 1: Backend
bun run webui

# Terminal 2: Frontend dev server (optional)
cd src/webui/frontend
bun run dev
```

### Adding New Components

1. Create component in `src/webui/frontend/components/`
2. Follow compact design system (use CSS variables)
3. Use SVG for charts (no external libraries)
4. Add to appropriate dashboard tab
5. Update this documentation

### Testing

```bash
# Type check
cd src/webui/frontend
bun run typecheck

# Build (validates production bundle)
bun run build

# E2E tests (when implemented)
bun run test:e2e
```

---

## FAQ

### Q: Why is the bundle size over 300KB?

**A**: The target was 300KB uncompressed, but we're at 333KB (11% over). However, the gzipped size is only 87KB, which is acceptable for an internal tool. Further optimization would require code splitting and lazy loading.

### Q: Can I use this on mobile?

**A**: Not yet. The dashboard is optimized for desktop (1920×1080+). Mobile responsive design is planned (Task 22) but not implemented.

### Q: Why polling instead of WebSocket?

**A**: The WebSocket backend is ready, but the frontend integration was blocked by implementation issues. Polling works reliably and updates every 30 seconds, which is sufficient for budget monitoring.

### Q: How do I customize the color scheme?

**A**: Edit `src/webui/frontend/src/styles/design-system.css` and modify the CSS variables under `:root`. Rebuild the frontend after changes.

### Q: Can I export data?

**A**: Yes! Use the export endpoints:
- `/api/export/usage` - Export usage data as CSV
- `/api/export/config` - Export configuration as JSON
- `/api/export/routing-logs` - Export routing logs as CSV

### Q: How do I reset all data?

**A**: Use the clear endpoints:
- `DELETE /api/usage` - Clear all usage data
- `POST /api/routing-logs/clear` - Clear routing logs
- `POST /api/adaptive/reset-learning` - Reset adaptive learning

---

## Support

For issues, questions, or feature requests:

1. Check this guide first
2. Review `.sisyphus/notepads/webui-revamp/` for known issues
3. Check server logs for errors
4. Open an issue on GitHub (if applicable)

---

## Changelog

### Version 3.0 (2026-01-31)

**Added**:
- Compact design system (Bloomberg Terminal aesthetic)
- 8 new visualization components
- WebSocket backend for real-time updates
- Quota matrix for unified quota tracking
- Model leaderboard for efficiency rankings
- Spending heatmap for time-of-day patterns
- Cost timeline with events overlay
- Budget gauge with color-coded thresholds
- Session cost chart
- Provider comparison
- Alert timeline

**Changed**:
- Reduced font sizes by 40% (48px → 24px)
- Reduced padding by 40% (20px → 12px)
- 30% more content visible on screen
- All components now use compact design system

**Fixed**:
- Server path bug preventing React app from loading
- TypeScript errors in production code
- API endpoint mismatches

**Known Issues**:
- WebSocket frontend not implemented (polling works)
- Mobile responsive design not implemented
- Keyboard shortcuts not implemented
- E2E tests not created

---

**Last Updated**: 2026-01-31  
**Maintainer**: oh-im-broke team  
**License**: Same as oh-im-broke project
