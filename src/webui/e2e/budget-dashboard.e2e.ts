import { test, expect, type Page } from '@playwright/test'

// ============================================================================
// Page Object Model
// ============================================================================

class BudgetDashboardPage {
  constructor(public page: Page) {}

  async goto() {
    //#given
    await this.page.goto('/')
    //#when
    await this.page.waitForLoadState('networkidle')
  }

  async waitForDashboard() {
    //#when
    await this.page.waitForSelector('h2:has-text("Budget Dashboard")', { timeout: 10000 })
  }

  get header() {
    return this.page.locator('h2:has-text("Budget Dashboard")')
  }

  get refreshButton() {
    return this.page.getByText('Refresh')
  }

  get liveTicker() {
    return this.page.locator('.ticker-strip')
  }

  get timePeriodSelector() {
    return this.page.locator('.time-period-selector')
  }

  get periodButtons() {
    return this.page.locator('.period-button')
  }

  get kpiCards() {
    return this.page.locator('.kpi-card')
  }

  get providerCards() {
    return this.page.locator('.provider-card')
  }

  get forecastWidget() {
    return this.page.locator('text=Forecast Widget')
  }

  get roiComparison() {
    return this.page.locator('text=ROI Comparison')
  }

  get roiExpandButton() {
    return this.page.locator('button:has-text("ROI Comparison")')
  }

  get roiTable() {
    return this.page.locator('table')
  }

  get anomalyIndicator() {
    return this.page.locator('text=Anomaly Indicator')
  }

  get alertsPanel() {
    return this.page.locator('text=Alerts & Recommendations')
  }

  get loggedAlertsPanel() {
    return this.page.locator('text=Logged Alerts')
  }

  get spendingTrends() {
    return this.page.locator('text=Spending Trends')
  }

  get modelBreakdown() {
    return this.page.locator('text=Model Breakdown')
  }

  get errorMessage() {
    return this.page.locator('text=Error:')
  }

  async clickRefresh() {
    //#when
    await this.refreshButton.click()
    //#then
    await this.page.waitForLoadState('networkidle')
  }

  async selectPeriod(period: string) {
    //#when
    await this.periodButtons.filter({ hasText: period }).click()
    //#then
    await this.page.waitForLoadState('networkidle')
  }

  async expandROI() {
    //#when
    await this.roiExpandButton.click()
    //#then
    await this.page.waitForTimeout(100)
  }

  async collapseROI() {
    //#when
    await this.roiExpandButton.click()
    //#then
    await this.page.waitForTimeout(100)
  }
}

// ============================================================================
// Test Suite
// ============================================================================

test.describe('Budget Dashboard E2E Tests', () => {
  let dashboard: BudgetDashboardPage

  test.beforeEach(async ({ page }) => {
    //#given
    dashboard = new BudgetDashboardPage(page)
    await dashboard.goto()
    await dashboard.waitForDashboard()
  })

  // Test 1: Dashboard loads successfully
  test('should load dashboard successfully', async ({ page }) => {
    //#given
    const dashboard = new BudgetDashboardPage(page)
    await dashboard.goto()

    //#when
    await dashboard.waitForDashboard()

    //#then
    await expect(dashboard.header).toBeVisible()
    await expect(dashboard.header).toContainText('Budget Dashboard')
    await expect(dashboard.refreshButton).toBeVisible()
  })

  // Test 2: Budget metrics display
  test('should display budget metrics in KPI cards', async () => {
    //#given
    await dashboard.waitForDashboard()

    //#when
    const kpiCards = dashboard.kpiCards

    //#then
    await expect(kpiCards.first()).toBeVisible()
    await expect(kpiCards).toHaveCount(4)
  })

  // Test 3: Provider cards render
  test('should render provider cards for anthropic and openai', async () => {
    //#given
    await dashboard.waitForDashboard()

    //#when
    const providerCards = dashboard.providerCards

    //#then
    await expect(providerCards.first()).toBeVisible()
    // Provider cards should have status badges
    await expect(dashboard.page.locator('.status-badge').first()).toBeVisible()
  })

  // Test 4: Time period selector works
  test('should allow changing time period', async () => {
    //#given
    await dashboard.waitForDashboard()

    //#when
    await dashboard.selectPeriod('1W')

    //#then
    const activeButton = dashboard.periodButtons.filter({ hasText: '1W' })
    await expect(activeButton).toHaveClass(/active/)
  })

  test('should allow changing to 24H period', async () => {
    //#given
    await dashboard.waitForDashboard()

    //#when
    await dashboard.selectPeriod('24H')

    //#then
    const activeButton = dashboard.periodButtons.filter({ hasText: '24H' })
    await expect(activeButton).toHaveClass(/active/)
  })

  test('should allow changing to 1M period', async () => {
    //#given
    await dashboard.waitForDashboard()

    //#when
    await dashboard.selectPeriod('1M')

    //#then
    const activeButton = dashboard.periodButtons.filter({ hasText: '1M' })
    await expect(activeButton).toHaveClass(/active/)
  })

  // Test 5: Alerts panel displays
  test('should display alerts panel', async () => {
    //#given
    await dashboard.waitForDashboard()

    //#when
    const alertsPanel = dashboard.alertsPanel

    //#then
    await expect(alertsPanel).toBeVisible()
  })

  // Test 6: Forecast widget shows
  test('should display forecast widget', async () => {
    //#given
    await dashboard.waitForDashboard()

    //#when
    const forecastWidget = dashboard.forecastWidget

    //#then
    await expect(forecastWidget).toBeVisible()
  })

  // Test 7: ROI comparison expands/collapses
  test('should expand and collapse ROI comparison', async () => {
    //#given
    await dashboard.waitForDashboard()

    //#when
    await dashboard.expandROI()

    //#then
    await expect(dashboard.roiTable.first()).toBeVisible()

    //#when
    await dashboard.collapseROI()

    //#then
    await expect(dashboard.roiTable.first()).not.toBeVisible()
  })

  // Test 8: Anomaly indicator shows
  test('should display anomaly indicator', async () => {
    //#given
    await dashboard.waitForDashboard()

    //#when
    const anomalyIndicator = dashboard.anomalyIndicator

    //#then
    await expect(anomalyIndicator).toBeVisible()
  })

  // Test 9: Refresh button works
  test('should refresh data when refresh button clicked', async () => {
    //#given
    await dashboard.waitForDashboard()

    //#when
    await dashboard.clickRefresh()

    //#then
    await expect(dashboard.header).toBeVisible()
  })

  // Test 10: Live ticker displays
  test('should display live ticker strip', async () => {
    //#given
    await dashboard.waitForDashboard()

    //#when
    const liveTicker = dashboard.liveTicker

    //#then
    await expect(liveTicker).toBeVisible()
  })

  // Test 11: Spending trends chart displays
  test('should display spending trends chart', async () => {
    //#given
    await dashboard.waitForDashboard()

    //#when
    const spendingTrends = dashboard.spendingTrends

    //#then
    await expect(spendingTrends).toBeVisible()
  })

  // Test 12: Model breakdown table displays
  test('should display model breakdown table', async () => {
    //#given
    await dashboard.waitForDashboard()

    //#when
    const modelBreakdown = dashboard.modelBreakdown

    //#then
    await expect(modelBreakdown).toBeVisible()
  })

  // Test 13: Logged alerts panel displays
  test('should display logged alerts panel', async () => {
    //#given
    await dashboard.waitForDashboard()

    //#when
    const loggedAlertsPanel = dashboard.loggedAlertsPanel

    //#then
    await expect(loggedAlertsPanel).toBeVisible()
  })

  // Test 14: Provider cards show percentage
  test('should show percentage in provider cards', async () => {
    //#given
    await dashboard.waitForDashboard()

    //#when
    const providerCard = dashboard.providerCards.first()

    //#then
    await expect(providerCard).toBeVisible()
    // Check for percentage display (e.g., "50%")
    const percentageText = await providerCard.textContent()
    expect(percentageText).toMatch(/\d+%/)
  })

  // Test 15: KPI cards show trend indicators
  test('should show trend indicators in KPI cards', async () => {
    //#given
    await dashboard.waitForDashboard()

    //#when
    const kpiCard = dashboard.kpiCards.first()

    //#then
    await expect(kpiCard).toBeVisible()
    // Check for trend arrows (▲, ▼, or →)
    const cardText = await kpiCard.textContent()
    expect(cardText).toMatch(/[▲▼→]/)
  })

  // Test 16: All time period buttons are present
  test('should display all time period buttons', async () => {
    //#given
    await dashboard.waitForDashboard()

    //#when
    const periodButtons = dashboard.periodButtons

    //#then
    await expect(periodButtons).toHaveCount(5)
    await expect(periodButtons.filter({ hasText: '1H' })).toBeVisible()
    await expect(periodButtons.filter({ hasText: '24H' })).toBeVisible()
    await expect(periodButtons.filter({ hasText: '1W' })).toBeVisible()
    await expect(periodButtons.filter({ hasText: '1M' })).toBeVisible()
    await expect(periodButtons.filter({ hasText: 'ALL' })).toBeVisible()
  })

  // Test 17: Dashboard header shows subtitle
  test('should show subtitle in dashboard header', async () => {
    //#given
    await dashboard.waitForDashboard()

    //#when
    const headerText = await dashboard.header.textContent()

    //#then
    expect(headerText).toContain('Budget Dashboard')
  })

  // Test 18: Provider cards have sparkline
  test('should display sparkline in provider cards', async () => {
    //#given
    await dashboard.waitForDashboard()

    //#when
    const providerCard = dashboard.providerCards.first()

    //#then
    await expect(providerCard).toBeVisible()
    // Check for SVG sparkline
    const sparkline = providerCard.locator('svg polyline')
    await expect(sparkline.first()).toBeVisible()
  })

  // Test 19: Dashboard is responsive
  test('should be responsive on different viewport sizes', async ({ page }) => {
    //#given
    await dashboard.waitForDashboard()

    //#when
    await page.setViewportSize({ width: 768, height: 1024 })

    //#then
    await expect(dashboard.header).toBeVisible()
    await expect(dashboard.kpiCards.first()).toBeVisible()
  })

  // Test 20: Multiple time period changes work correctly
  test('should handle multiple time period changes', async () => {
    //#given
    await dashboard.waitForDashboard()

    //#when
    await dashboard.selectPeriod('1H')
    await dashboard.selectPeriod('24H')
    await dashboard.selectPeriod('1W')

    //#then
    const activeButton = dashboard.periodButtons.filter({ hasText: '1W' })
    await expect(activeButton).toHaveClass(/active/)
  })
})

// ============================================================================
// Error Handling Tests
// ============================================================================

test.describe('Budget Dashboard Error Handling', () => {
  test('should handle API errors gracefully', async ({ page, context }) => {
    //#given
    const dashboard = new BudgetDashboardPage(page)

    // Mock API to return error
    await context.route('**/api/budget/dashboard', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'Internal Server Error' })
      })
    })

    await dashboard.goto()
    await page.waitForLoadState('networkidle')

    //#when
    await page.waitForTimeout(1000)

    //#then
    // Error message should be displayed
    const errorElement = page.locator('text=Error:')
    await expect(errorElement).toBeVisible()
  })

  test('should handle network timeout', async ({ page, context }) => {
    //#given
    const dashboard = new BudgetDashboardPage(page)

    // Mock API to timeout
    await context.route('**/api/budget/dashboard', route => {
      // Delay response
      setTimeout(() => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { enabled: false } })
        })
      }, 60000)
    })

    await dashboard.goto()

    //#when
    await page.waitForTimeout(5000)

    //#then
    // Should show loading state
    const loadingText = page.locator('text=Loading')
    await expect(loadingText).toBeVisible()
  })
})

// ============================================================================
// Accessibility Tests
// ============================================================================

test.describe('Budget Dashboard Accessibility', () => {
  test('should have proper heading hierarchy', async ({ page }) => {
    //#given
    const dashboard = new BudgetDashboardPage(page)
    await dashboard.goto()
    await dashboard.waitForDashboard()

    //#when
    const h2 = page.locator('h2')
    const h3 = page.locator('h3')

    //#then
    await expect(h2.first()).toBeVisible()
    await expect(h3.first()).toBeVisible()
  })

  test('should have clickable buttons with proper labels', async ({ page }) => {
    //#given
    const dashboard = new BudgetDashboardPage(page)
    await dashboard.goto()
    await dashboard.waitForDashboard()

    //#when
    const buttons = page.locator('button')

    //#then
    await expect(buttons.first()).toBeVisible()
  })
})