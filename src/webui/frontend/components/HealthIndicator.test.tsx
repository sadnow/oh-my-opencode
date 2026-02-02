import { Window } from 'happy-dom'

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

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { render, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { HealthIndicator } from './HealthIndicator'

const server = setupServer(
  http.get('http://localhost/api/health-check', () => {
    return HttpResponse.json({
      success: true,
      data: {
        healthy: true,
        warnings: [],
        checks: {
          fileExists: true,
          recentlyUpdated: true,
          hasRecentRecords: true,
          noZeroOutputTokens: true,
          validCosts: true,
        },
        stats: {
          totalRecords: 100,
          recentRecords: 10,
          avgInputTokens: 1000,
          avgOutputTokens: 500,
          avgCost: 0.01,
          lastUpdateAge: 1000,
        },
      },
    })
  })
)

describe('HealthIndicator', () => {
  beforeEach(() => {
    global.document.body.innerHTML = ''
    server.listen()
  })

  afterEach(() => {
    cleanup()
    server.close()
  })

  test('displays green status when healthy', async () => {
    //#given
    server.use(
      http.get('http://localhost/api/health-check', () => {
        return HttpResponse.json({
          success: true,
          data: {
            healthy: true,
            warnings: [],
            checks: {
              fileExists: true,
              recentlyUpdated: true,
              hasRecentRecords: true,
              noZeroOutputTokens: true,
              validCosts: true,
            },
            stats: {
              totalRecords: 100,
              recentRecords: 10,
              avgInputTokens: 1000,
              avgOutputTokens: 500,
              avgCost: 0.01,
              lastUpdateAge: 1000,
            },
          },
        })
      })
    )

    const { getByText, container } = render(<HealthIndicator />)

    //#when
    await waitFor(() => {
      expect(getByText('Health Status')).toBeDefined()
    })

    //#then
    expect(container.querySelector('[style*="background-color: #28a745"]')).toBeDefined()
    expect(getByText('Healthy')).toBeDefined()
  })

  test('displays yellow status with warnings', async () => {
    //#given
    server.use(
      http.get('http://localhost/api/health-check', () => {
        return HttpResponse.json({
          success: true,
          data: {
            healthy: false,
            warnings: ['Storage file not updated in 10 minutes'],
            checks: {
              fileExists: true,
              recentlyUpdated: false,
              hasRecentRecords: true,
              noZeroOutputTokens: true,
              validCosts: true,
            },
            stats: {
              totalRecords: 100,
              recentRecords: 10,
              avgInputTokens: 1000,
              avgOutputTokens: 500,
              avgCost: 0.01,
              lastUpdateAge: 600000,
            },
          },
        })
      })
    )

    const { getByText, container } = render(<HealthIndicator />)

    //#when
    await waitFor(() => {
      expect(getByText('Health Status')).toBeDefined()
    })

    //#then
    expect(container.querySelector('[style*="background-color: #ffc107"]')).toBeDefined()
    expect(getByText('Warning')).toBeDefined()
    expect(getByText('Storage file not updated in 10 minutes')).toBeDefined()
  })

  test('displays red status with errors', async () => {
    //#given
    server.use(
      http.get('http://localhost/api/health-check', () => {
        return HttpResponse.json({
          success: true,
          data: {
            healthy: false,
            warnings: [
              '⚠️ CRITICAL: 50% of recent records have outputTokens=0',
              'This may indicate the outputTokens bug has regressed!',
            ],
            checks: {
              fileExists: true,
              recentlyUpdated: true,
              hasRecentRecords: true,
              noZeroOutputTokens: false,
              validCosts: true,
            },
            stats: {
              totalRecords: 100,
              recentRecords: 10,
              avgInputTokens: 1000,
              avgOutputTokens: 0,
              avgCost: 0.01,
              lastUpdateAge: 1000,
            },
          },
        })
      })
    )

    const { getByText, container } = render(<HealthIndicator />)

    //#when
    await waitFor(() => {
      expect(getByText('Health Status')).toBeDefined()
    })

    //#then
    expect(container.querySelector('[style*="background-color: #dc3545"]')).toBeDefined()
    expect(getByText('Critical')).toBeDefined()
    expect(getByText('⚠️ CRITICAL: 50% of recent records have outputTokens=0')).toBeDefined()
  })

  test('refresh button re-fetches health data', async () => {
    //#given
    let fetchCount = 0
    server.use(
      http.get('http://localhost/api/health-check', () => {
        fetchCount++
        return HttpResponse.json({
          success: true,
          data: {
            healthy: true,
            warnings: [],
            checks: {
              fileExists: true,
              recentlyUpdated: true,
              hasRecentRecords: true,
              noZeroOutputTokens: true,
              validCosts: true,
            },
            stats: {
              totalRecords: 100,
              recentRecords: 10,
              avgInputTokens: 1000,
              avgOutputTokens: 500,
              avgCost: 0.01,
              lastUpdateAge: 1000,
            },
          },
        })
      })
    )

    const user = userEvent.setup({ document: global.document as any })
    const { getByText } = render(<HealthIndicator />)

    //#when
    await waitFor(() => {
      expect(getByText('Health Status')).toBeDefined()
    })

    const initialFetchCount = fetchCount

    //#when
    await user.click(getByText('⟳ Refresh'))

    //#then
    await waitFor(() => {
      expect(fetchCount).toBe(initialFetchCount + 1)
    })
  })

  test('displays loading state', async () => {
    //#given
    server.use(
      http.get('http://localhost/api/health-check', () => {
        return new Promise(resolve => {
          setTimeout(() => resolve(
            HttpResponse.json({
              success: true,
              data: {
                healthy: true,
                warnings: [],
                checks: {
                  fileExists: true,
                  recentlyUpdated: true,
                  hasRecentRecords: true,
                  noZeroOutputTokens: true,
                  validCosts: true,
                },
                stats: {
                  totalRecords: 100,
                  recentRecords: 10,
                  avgInputTokens: 1000,
                  avgOutputTokens: 500,
                  avgCost: 0.01,
                  lastUpdateAge: 1000,
                },
              },
            })
          ), 100)
        })
      })
    )

    const { getByText } = render(<HealthIndicator />)

    //#when
    expect(getByText('Loading health status...')).toBeDefined()

    //#then
    await waitFor(() => {
      expect(getByText('Healthy')).toBeDefined()
    })
  })

  test('displays error state', async () => {
    //#given
    server.use(
      http.get('http://localhost/api/health-check', () => {
        return HttpResponse.error()
      })
    )

    const { getByText } = render(<HealthIndicator />)

    //#when
    await waitFor(() => {
      expect(getByText('Error:', { exact: false })).toBeDefined()
    })

    //#then
    expect(getByText('Failed to fetch', { exact: false })).toBeDefined()
  })
})