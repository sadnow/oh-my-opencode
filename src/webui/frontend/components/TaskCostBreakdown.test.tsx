import { Window } from 'happy-dom'

const _origWindow = global.window
const _origDocument = global.document
const _origNavigator = global.navigator
const _origHTMLElement = global.HTMLElement
const _origNode = global.Node
const _origFetch = global.fetch

const window = new Window({ url: 'http://localhost/' })
global.window = window as any
global.document = window.document as any
global.navigator = window.navigator as any
global.HTMLElement = window.HTMLElement as any
global.Node = window.Node as any

// Override Request constructor to resolve relative URLs
const OriginalRequest = globalThis.Request
globalThis.Request = class extends OriginalRequest {
  constructor(input: RequestInfo | URL, init?: RequestInit) {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const resolvedUrl = url.startsWith('/') ? `http://localhost${url}` : url
    super(resolvedUrl, init)
  }
} as typeof Request

import { describe, test, expect, beforeEach, afterEach, afterAll } from 'bun:test'
import { render, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { TaskCostBreakdown } from './TaskCostBreakdown'

const server = setupServer(
  http.get('http://localhost/api/stats/by-category', () => {
    return HttpResponse.json({
      success: true,
      data: {
        categories: [
          { category: 'primary:task1', cost: 0.50, count: 10 },
          { category: 'primary:task2', cost: 0.30, count: 5 },
          { category: 'background-task:task3', cost: 0.15, count: 3 },
          { category: 'subagent:task4', cost: 0.05, count: 2 },
        ],
        totalCost: 1.00,
      },
    })
  })
)

afterAll(() => {
  global.window = _origWindow
  global.document = _origDocument
  global.navigator = _origNavigator
  global.HTMLElement = _origHTMLElement
  global.Node = _origNode
  global.fetch = _origFetch
  globalThis.Request = OriginalRequest
})

describe('TaskCostBreakdown', () => {
  beforeEach(() => {
    global.document.body.innerHTML = ''
    server.listen()
  })

  afterEach(() => {
    cleanup()
    server.close()
  })

  test('displays cost breakdown grouped by task type', async () => {
    //#given
    server.use(
      http.get('http://localhost/api/stats/by-category', () => {
        return HttpResponse.json({
          success: true,
          data: {
            categories: [
              { category: 'primary:task1', cost: 0.50, count: 10 },
              { category: 'primary:task2', cost: 0.30, count: 5 },
              { category: 'background-task:task3', cost: 0.15, count: 3 },
              { category: 'subagent:task4', cost: 0.05, count: 2 },
            ],
            totalCost: 1.00,
          },
        })
      })
    )

    const { getByText, container } = render(<TaskCostBreakdown />)

    //#when
    await waitFor(() => {
      expect(getByText('Task Cost Breakdown')).toBeDefined()
    })

    //#then
    expect(getByText('Primary Tasks')).toBeDefined()
    expect(getByText('Background Tasks')).toBeDefined()
    expect(getByText('Subagent Tasks')).toBeDefined()
    expect(getByText('$1.00')).toBeDefined()
  })

  test('calculates percentages that sum to 100%', async () => {
    //#given
    server.use(
      http.get('http://localhost/api/stats/by-category', () => {
        return HttpResponse.json({
          success: true,
          data: {
            categories: [
              { category: 'primary:task1', cost: 0.50, count: 10 },
              { category: 'primary:task2', cost: 0.30, count: 5 },
              { category: 'background-task:task3', cost: 0.15, count: 3 },
              { category: 'subagent:task4', cost: 0.05, count: 2 },
            ],
            totalCost: 1.00,
          },
        })
      })
    )

    const { getByText, container } = render(<TaskCostBreakdown />)

    //#when
    await waitFor(() => {
      expect(getByText('Task Cost Breakdown')).toBeDefined()
    })

    //#then
    // Primary: 0.80 / 1.00 = 80%
    // Background: 0.15 / 1.00 = 15%
    // Subagent: 0.05 / 1.00 = 5%
    expect(getByText('80.0%')).toBeDefined()
    expect(getByText('15.0%')).toBeDefined()
    expect(getByText('5.0%')).toBeDefined()

    // Verify percentages sum to 100%
    const verificationText = container.textContent || ''
    expect(verificationText).toContain('Verification:')
    expect(verificationText).toContain('100.0%')
  })

  test('handles categories without task type prefix', async () => {
    //#given
    server.use(
      http.get('http://localhost/api/stats/by-category', () => {
        return HttpResponse.json({
          success: true,
          data: {
            categories: [
              { category: 'primary', cost: 0.60, count: 12 },
              { category: 'background-task', cost: 0.30, count: 6 },
              { category: 'subagent', cost: 0.10, count: 4 },
            ],
            totalCost: 1.00,
          },
        })
      })
    )

    const { getByText } = render(<TaskCostBreakdown />)

    //#when
    await waitFor(() => {
      expect(getByText('Task Cost Breakdown')).toBeDefined()
    })

    //#then
    expect(getByText('Primary Tasks')).toBeDefined()
    expect(getByText('Background Tasks')).toBeDefined()
    expect(getByText('Subagent Tasks')).toBeDefined()
  })

  test('displays loading state', async () => {
    //#given
    server.use(
      http.get('http://localhost/api/stats/by-category', () => {
        return new Promise(resolve => {
          setTimeout(() => resolve(
            HttpResponse.json({
              success: true,
              data: {
                categories: [
                  { category: 'primary:task1', cost: 0.50, count: 10 },
                ],
                totalCost: 0.50,
              },
            })
          ), 100)
        })
      })
    )

    const { getByText } = render(<TaskCostBreakdown />)

    //#when
    expect(getByText('Loading cost breakdown...')).toBeDefined()

    //#then
    await waitFor(() => {
      expect(getByText('Primary Tasks')).toBeDefined()
    })
  })

  test('displays error state', async () => {
    //#given
    server.use(
      http.get('http://localhost/api/stats/by-category', () => {
        return HttpResponse.error()
      })
    )

    const { getByText } = render(<TaskCostBreakdown />)

    //#when
    await waitFor(() => {
      expect(getByText('Error:', { exact: false })).toBeDefined()
    })

    //#then
    expect(getByText('Failed to fetch', { exact: false })).toBeDefined()
  })

  test('displays no data message when categories are empty', async () => {
    //#given
    server.use(
      http.get('http://localhost/api/stats/by-category', () => {
        return HttpResponse.json({
          success: true,
          data: {
            categories: [],
            totalCost: 0,
          },
        })
      })
    )

    const { getByText } = render(<TaskCostBreakdown />)

    //#when
    await waitFor(() => {
      expect(getByText('Task Cost Breakdown')).toBeDefined()
    })

    //#then
    expect(getByText('No cost data available.')).toBeDefined()
  })

  test('period selector changes period', async () => {
    //#given
    server.use(
      http.get('http://localhost/api/stats/by-category', () => {
        return HttpResponse.json({
          success: true,
          data: {
            categories: [
              { category: 'primary:task1', cost: 0.50, count: 10 },
            ],
            totalCost: 0.50,
          },
        })
      })
    )

    const user = userEvent.setup({ document: global.document as any })
    const { getByLabelText, getByText } = render(<TaskCostBreakdown />)

    //#when
    await waitFor(() => {
      expect(getByText('Task Cost Breakdown')).toBeDefined()
    })

    // Note: The select doesn't have a label, so we'll select by value
    const select = document.querySelector('select') as HTMLSelectElement
    expect(select).toBeDefined()

    //#when
    await user.selectOptions(select, 'month')

    //#then
    expect(select.value).toBe('month')
  })

  test('refresh button re-fetches data', async () => {
    //#given
    let fetchCount = 0
    server.use(
      http.get('http://localhost/api/stats/by-category', () => {
        fetchCount++
        return HttpResponse.json({
          success: true,
          data: {
            categories: [
              { category: 'primary:task1', cost: 0.50, count: 10 },
            ],
            totalCost: 0.50,
          },
        })
      })
    )

    const user = userEvent.setup({ document: global.document as any })
    const { getByText } = render(<TaskCostBreakdown />)

    //#when
    await waitFor(() => {
      expect(getByText('Task Cost Breakdown')).toBeDefined()
    })

    const initialFetchCount = fetchCount

    //#when
    await user.click(getByText('⟳ Refresh'))

    //#then
    await waitFor(() => {
      expect(fetchCount).toBe(initialFetchCount + 1)
    })
  })

  test('displays task count for each type', async () => {
    //#given
    server.use(
      http.get('http://localhost/api/stats/by-category', () => {
        return HttpResponse.json({
          success: true,
          data: {
            categories: [
              { category: 'primary:task1', cost: 0.50, count: 10 },
              { category: 'background-task:task2', cost: 0.30, count: 5 },
              { category: 'subagent:task3', cost: 0.20, count: 3 },
            ],
            totalCost: 1.00,
          },
        })
      })
    )

    const { getByText } = render(<TaskCostBreakdown />)

    //#when
    await waitFor(() => {
      expect(getByText('Task Cost Breakdown')).toBeDefined()
    })

    //#then
    expect(getByText('10 tasks')).toBeDefined()
    expect(getByText('5 tasks')).toBeDefined()
    expect(getByText('3 tasks')).toBeDefined()
  })

  test('displays cost amount for each type', async () => {
    //#given
    server.use(
      http.get('http://localhost/api/stats/by-category', () => {
        return HttpResponse.json({
          success: true,
          data: {
            categories: [
              { category: 'primary:task1', cost: 0.50, count: 10 },
              { category: 'background-task:task2', cost: 0.30, count: 5 },
              { category: 'subagent:task3', cost: 0.20, count: 3 },
            ],
            totalCost: 1.00,
          },
        })
      })
    )

    const { getByText } = render(<TaskCostBreakdown />)

    //#when
    await waitFor(() => {
      expect(getByText('Task Cost Breakdown')).toBeDefined()
    })

    //#then
    expect(getByText('$0.50')).toBeDefined()
    expect(getByText('$0.30')).toBeDefined()
    expect(getByText('$0.20')).toBeDefined()
  })

  test('handles zero total cost gracefully', async () => {
    //#given
    server.use(
      http.get('http://localhost/api/stats/by-category', () => {
        return HttpResponse.json({
          success: true,
          data: {
            categories: [
              { category: 'primary:task1', cost: 0, count: 10 },
              { category: 'background-task:task2', cost: 0, count: 5 },
            ],
            totalCost: 0,
          },
        })
      })
    )

    const { getAllByText, container } = render(<TaskCostBreakdown />)

    //#when
    await waitFor(() => {
      expect(getAllByText('Task Cost Breakdown')[0]).toBeDefined()
    })

    //#then
    const zeroAmounts = getAllByText('$0.00')
    expect(zeroAmounts.length).toBeGreaterThan(0)
    // Percentages should be 0% when total is 0
    expect(getAllByText('0.0%')[0]).toBeDefined()
  })
})