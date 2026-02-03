import { Window } from 'happy-dom'

const _origWindow = global.window
const _origDocument = global.document
const _origNavigator = global.navigator
const _origHTMLElement = global.HTMLElement
const _origNode = global.Node
const _origFetch = global.fetch

const window = new Window()
global.window = window as any
global.document = window.document as any
global.navigator = window.navigator as any
global.HTMLElement = window.HTMLElement as any
global.Node = window.Node as any

import { describe, test, expect, beforeEach, afterEach, afterAll } from 'bun:test'
import { render, cleanup, waitFor, fireEvent } from '@testing-library/react'
import { LoggedAlertsPanel } from './LoggedAlertsPanel'

afterAll(() => {
  global.window = _origWindow
  global.document = _origDocument
  global.navigator = _origNavigator
  global.HTMLElement = _origHTMLElement
  global.Node = _origNode
  global.fetch = _origFetch
})

describe('LoggedAlertsPanel', () => {
  beforeEach(() => {
    global.document.body.innerHTML = ''
    // Default mock for fetch
    global.fetch = (async () => ({
      json: async () => ({
        success: true,
        data: {
          logs: [],
          stats: {}
        }
      })
    })) as any
  })

  afterEach(() => {
    cleanup()
    global.fetch = _origFetch
  })

  test('renders loading state initially', () => {
    // Mock fetch to never resolve to keep it in loading state
    global.fetch = (() => new Promise(() => {})) as any
    
    const { getByText } = render(<LoggedAlertsPanel />)
    expect(getByText('Loading alerts...')).toBeDefined()
  })

  test('renders alerts list with mock data', async () => {
    const mockLogs = [
      { 
        timestamp: '2024-01-01T00:00:00Z', 
        level: 'warning', 
        category: 'budget_alert', 
        message: 'Budget 80% consumed' 
      },
      { 
        timestamp: '2024-01-01T01:00:00Z', 
        level: 'error', 
        category: 'tier_change', 
        message: 'Critical error occurred' 
      }
    ]

    global.fetch = (async () => ({
      json: async () => ({
        success: true,
        data: {
          logs: mockLogs,
          stats: {}
        }
      })
    })) as any

    const { getByText } = render(<LoggedAlertsPanel />)

    await waitFor(() => {
      expect(getByText('Budget 80% consumed')).toBeDefined()
      expect(getByText('Critical error occurred')).toBeDefined()
      expect(getByText('warning')).toBeDefined()
      expect(getByText('error')).toBeDefined()
      expect(getByText('budget_alert')).toBeDefined()
      expect(getByText('tier_change')).toBeDefined()
    })
  })

  test('empty state shows "No alerts to display"', async () => {
    global.fetch = (async () => ({
      json: async () => ({
        success: true,
        data: {
          logs: [],
          stats: {}
        }
      })
    })) as any

    const { getByText } = render(<LoggedAlertsPanel />)

    await waitFor(() => {
      expect(getByText('No alerts to display')).toBeDefined()
    })
  })

  test('level filter changes displayed results', async () => {
    const mockLogs = [
      { 
        timestamp: '2024-01-01T00:00:00Z', 
        level: 'warning', 
        category: 'budget_alert', 
        message: 'Warning message' 
      },
      { 
        timestamp: '2024-01-01T01:00:00Z', 
        level: 'error', 
        category: 'tier_change', 
        message: 'Error message' 
      }
    ]

    global.fetch = (async () => ({
      json: async () => ({
        success: true,
        data: {
          logs: mockLogs,
          stats: {}
        }
      })
    })) as any

    const { getByText, getByLabelText, queryByText } = render(<LoggedAlertsPanel />)

    await waitFor(() => {
      expect(getByText('Warning message')).toBeDefined()
      expect(getByText('Error message')).toBeDefined()
    })

    const levelFilter = getByLabelText('Level:')
    fireEvent.change(levelFilter, { target: { value: 'error' } })

    expect(queryByText('Warning message')).toBeNull()
    expect(getByText('Error message')).toBeDefined()
    expect(getByText('Showing 1 of 2 alerts')).toBeDefined()
  })

  test('shows error state when fetch fails', async () => {
    global.fetch = (async () => { throw new Error('Network error') }) as any

    const { getByText } = render(<LoggedAlertsPanel />)

    await waitFor(() => {
      expect(getByText(/Error:/)).toBeDefined()
      expect(getByText(/Network error/)).toBeDefined()
    })
  })
})
