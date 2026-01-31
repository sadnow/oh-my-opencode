import { Window } from 'happy-dom'

const window = new Window()
global.window = window as any
global.document = window.document as any
global.navigator = window.navigator as any
global.HTMLElement = window.HTMLElement as any
global.Node = window.Node as any

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { ROIComparison } from './ROIComparison'

describe('ROIComparison', () => {
  const mockProps = {
    currentModel: 'claude-3-5-sonnet',
    currentCost: 10.50,
    inputTokens: 1000000,
    outputTokens: 500000,
    alternatives: [
      {
        model: 'gpt-4o-mini',
        tier: 'economy',
        estimatedCost: 2.10,
        savings: 8.40,
        savingsPercent: 80.0
      },
      {
        model: 'claude-3-haiku',
        tier: 'budget',
        estimatedCost: 1.05,
        savings: 9.45,
        savingsPercent: 90.0
      },
      {
        model: 'gpt-4o',
        tier: 'premium',
        estimatedCost: 15.75,
        savings: -5.25,
        savingsPercent: -50.0
      }
    ]
  }

  beforeEach(() => {
    global.document.body.innerHTML = ''
  })

  afterEach(() => {
    cleanup()
  })

  test('renders current model info correctly', () => {
    const { getByText } = render(<ROIComparison {...mockProps} />)
    
    expect(getByText('claude-3-5-sonnet')).toBeDefined()
    expect(getByText('$10.50')).toBeDefined()
    expect(getByText('1.0M')).toBeDefined() // Input tokens
    expect(getByText('500.0K')).toBeDefined() // Output tokens
    expect(getByText('1.5M')).toBeDefined() // Total tokens
  })

  test('renders alternative models table', () => {
    const { getAllByText, getAllByRole } = render(<ROIComparison {...mockProps} />)
    
    expect(getAllByText('gpt-4o-mini').length).toBeGreaterThan(0)
    expect(getAllByText('claude-3-haiku').length).toBeGreaterThan(0)
    expect(getAllByText('gpt-4o').length).toBeGreaterThan(0)
    
    // Check if table rows are rendered (header + 3 alternatives)
    const rows = getAllByRole('row')
    expect(rows.length).toBe(4)
  })

  test('highlights recommended model (highest savings)', () => {
    const { getAllByText } = render(<ROIComparison {...mockProps} />)
    
    // claude-3-haiku has the highest savings (9.45)
    const recommendedBadges = getAllByText('Recommended')
    expect(recommendedBadges.length).toBe(1)
    
    // Check if it's next to the correct model
    const row = recommendedBadges[0].closest('tr')
    expect(row?.textContent).toContain('claude-3-haiku')
  })

  test('shows correct savings percentages', () => {
    const { getAllByText } = render(<ROIComparison {...mockProps} />)
    
    expect(getAllByText('-90.0%').length).toBeGreaterThan(0) // claude-3-haiku
    expect(getAllByText('-80.0%').length).toBeGreaterThan(0) // gpt-4o-mini
    expect(getAllByText('+50.0%').length).toBeGreaterThan(0) // gpt-4o (negative savings)
  })

  test('handles empty alternatives array', () => {
    const emptyProps = { ...mockProps, alternatives: [] }
    const { getByText, queryByText } = render(<ROIComparison {...emptyProps} />)
    
    expect(getByText('No alternative models available')).toBeDefined()
    expect(queryByText('ROI Summary')).toBeNull()
  })

  test('formats currency correctly', () => {
    const { getAllByText } = render(<ROIComparison {...mockProps} />)
    
    // Current cost
    expect(getAllByText('$10.50').length).toBeGreaterThan(0)
    // Savings for haiku
    expect(getAllByText('-$9.45').length).toBeGreaterThan(0)
    // Cost for gpt-4o
    expect(getAllByText('+$5.25').length).toBeGreaterThan(0)
  })

  test('shows tier badges with correct labels', () => {
    const { getAllByText } = render(<ROIComparison {...mockProps} />)
    
    expect(getAllByText('economy').length).toBeGreaterThan(0)
    expect(getAllByText('budget').length).toBeGreaterThan(0)
    expect(getAllByText('premium').length).toBeGreaterThan(0)
  })

  test('renders ROI Summary card with best alternative', () => {
    const { getByText, getAllByText } = render(<ROIComparison {...mockProps} />)
    
    expect(getByText('ROI Summary')).toBeDefined()
    expect(getByText('Max Savings')).toBeDefined()
    
    // Best alternative info in summary
    const bestModelElements = getAllByText('claude-3-haiku')
    // One in table, one in summary card
    expect(bestModelElements.length).toBe(2)
    
    expect(getByText('90.0% discount')).toBeDefined()
  })

  test('sorts alternatives by savings (highest first)', () => {
    const { getAllByRole } = render(<ROIComparison {...mockProps} />)
    const rows = getAllByRole('row')
    
    // Row 0 is header
    // Row 1 should be claude-3-haiku (9.45 savings)
    // Row 2 should be gpt-4o-mini (8.40 savings)
    // Row 3 should be gpt-4o (-5.25 savings)
    
    expect(rows[1].textContent).toContain('claude-3-haiku')
    expect(rows[2].textContent).toContain('gpt-4o-mini')
    expect(rows[3].textContent).toContain('gpt-4o')
  })
})
