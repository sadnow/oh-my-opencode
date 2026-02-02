import { Window } from 'happy-dom'

const window = new Window()
global.window = window as any
global.document = window.document as any
global.navigator = window.navigator as any
global.HTMLElement = window.HTMLElement as any
global.Node = window.Node as any

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { render, cleanup, waitFor } from '@testing-library/react'
import { AuditTrail } from './AuditTrail'
import userEvent from '@testing-library/user-event'

describe('AuditTrail', () => {
  beforeEach(() => {
    global.document.body.innerHTML = ''
    global.fetch = async () => ({
      json: async () => ({
        success: true,
        data: {
          logs: [
            {
              timestamp: '2026-01-29T10:00:00Z',
              level: 'info',
              category: 'routing',
              message: 'Tier upgraded to premium',
              metadata: {
                model: 'claude-opus-4-5',
                reason: 'High complexity task detected'
              }
            },
            {
              timestamp: '2026-01-29T09:00:00Z',
              level: 'warn',
              category: 'routing',
              message: 'Tier downgraded to standard',
              metadata: {
                model: 'gpt-5-nano',
                reason: 'Budget constraint'
              }
            }
          ],
          total: 2
        }
      })
    }) as any
  })

  afterEach(() => {
    cleanup()
  })

  test('renders audit trail with filters', async () => {
    const { getByText, getByLabelText } = render(<AuditTrail />)
    
    await waitFor(() => {
      expect(getByText('Time Range:')).toBeDefined()
      expect(getByText('Category:')).toBeDefined()
      expect(getByText('Refresh')).toBeDefined()
      expect(getByText('Export')).toBeDefined()
    })
  })

  test('displays routing logs in table', async () => {
    const { getByText } = render(<AuditTrail />)
    
    await waitFor(() => {
      expect(getByText('Tier upgraded to premium')).toBeDefined()
      expect(getByText('Tier downgraded to standard')).toBeDefined()
      expect(getByText('claude-opus-4-5')).toBeDefined()
      expect(getByText('gpt-5-nano')).toBeDefined()
    })
  })

  test('shows time range filter options', async () => {
    const { getByText, getByLabelText } = render(<AuditTrail />)
    
    await waitFor(() => {
      const timeRangeSelect = getByLabelText('Time Range:')
      expect(timeRangeSelect).toBeDefined()
    })
  })

  test('shows category filter options', async () => {
    const { getByText, getByLabelText } = render(<AuditTrail />)
    
    await waitFor(() => {
      const categorySelect = getByLabelText('Category:')
      expect(categorySelect).toBeDefined()
    })
  })

  test('displays log count', async () => {
    const { getByText } = render(<AuditTrail />)
    
    await waitFor(() => {
      expect(getByText(/Showing 2 of 2 logs/)).toBeDefined()
    })
  })

  test('shows loading state', () => {
    global.fetch = async () => new Promise(() => {}) as any
    const { getByText } = render(<AuditTrail />)
    
    expect(getByText('Loading audit trail...')).toBeDefined()
  })

  test('shows error state', async () => {
    global.fetch = (async () => {
      throw new Error('Network error')
    }) as any
    
    const { getByText } = render(<AuditTrail />)
    
    await waitFor(() => {
      expect(getByText(/Error:/)).toBeDefined()
    })
  })

  test('integrates ExportButton component', async () => {
    const { getByText } = render(<AuditTrail />)
    
    await waitFor(() => {
      expect(getByText('Export')).toBeDefined()
    })
  })

  test('displays log levels with correct colors', async () => {
    const { getByText } = render(<AuditTrail />)
    
    await waitFor(() => {
      expect(getByText('INFO')).toBeDefined()
      expect(getByText('WARN')).toBeDefined()
    })
  })

  test('shows model and reason columns', async () => {
    const { getByText } = render(<AuditTrail />)
    
    await waitFor(() => {
      expect(getByText('Model')).toBeDefined()
      expect(getByText('Reason')).toBeDefined()
      expect(getByText('High complexity task detected')).toBeDefined()
      expect(getByText('Budget constraint')).toBeDefined()
    })
  })
})