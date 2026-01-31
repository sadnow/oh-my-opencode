import { Window } from 'happy-dom'

const window = new Window()
global.window = window as any
global.document = window.document as any
global.navigator = window.navigator as any
global.HTMLElement = window.HTMLElement as any
global.Node = window.Node as any

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { ForecastWidget } from './ForecastWidget'

describe('ForecastWidget', () => {
  const defaultProps = {
    predicted24h: 100,
    predicted7d: 700,
    predicted30d: 3000,
    predictionAccuracy: 0.9,
    learningProgress: 0.5,
    spendingVelocity: 1,
    hourlyAllowance: 2,
    budget: 1000,
    used: 100,
    daysRemaining: 10
  }

  beforeEach(() => {
    global.document.body.innerHTML = ''
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  test('renders forecast values correctly', () => {
    const { getByText } = render(<ForecastWidget {...defaultProps} />)
    
    expect(getByText('$100.00')).toBeDefined()
    expect(getByText('$700.00')).toBeDefined()
    expect(getByText('$3,000.00')).toBeDefined()
  })

  test('shows correct confidence color (green >80%)', () => {
    const { getByTestId } = render(<ForecastWidget {...defaultProps} predictionAccuracy={0.85} />)
    const confidenceElement = getByTestId('confidence-value')
    expect(confidenceElement.getAttribute('data-confidence-color')).toBe('var(--color-success, #28a745)')
  })

  test('shows correct confidence color (yellow 50-80%)', () => {
    const { getByTestId } = render(<ForecastWidget {...defaultProps} predictionAccuracy={0.6} />)
    const confidenceElement = getByTestId('confidence-value')
    expect(confidenceElement.getAttribute('data-confidence-color')).toBe('var(--color-warning, #ffc107)')
  })

  test('shows correct confidence color (red <50%)', () => {
    const { getByTestId } = render(<ForecastWidget {...defaultProps} predictionAccuracy={0.4} />)
    const confidenceElement = getByTestId('confidence-value')
    expect(confidenceElement.getAttribute('data-confidence-color')).toBe('var(--color-danger, #dc3545)')
  })

  test('displays learning progress correctly', () => {
    const { getByText } = render(<ForecastWidget {...defaultProps} learningProgress={0.75} />)
    expect(getByText('75%')).toBeDefined()
  })

  test('shows days until exhausted calculation', () => {
    // (1000 - 100) / (1 * 24) = 900 / 24 = 37.5 -> Math.round(37.5) = 38
    const { getByText } = render(<ForecastWidget {...defaultProps} budget={1000} used={100} spendingVelocity={1} />)
    expect(getByText('38 days until budget exhausted')).toBeDefined()
  })

  test('edge case: spendingVelocity = 0 shows "Budget never exhausted"', () => {
    const { getByText } = render(<ForecastWidget {...defaultProps} spendingVelocity={0} />)
    expect(getByText('Budget never exhausted')).toBeDefined()
  })

  test('shows correct trend direction (up)', () => {
    const { getByText } = render(<ForecastWidget {...defaultProps} spendingVelocity={3} hourlyAllowance={2} />)
    expect(getByText('▲')).toBeDefined()
    expect(getByText('Over')).toBeDefined()
  })

  test('shows correct trend direction (down)', () => {
    const { getByText } = render(<ForecastWidget {...defaultProps} spendingVelocity={0.5} hourlyAllowance={2} />)
    expect(getByText('▼')).toBeDefined()
    expect(getByText('Under')).toBeDefined()
  })

  test('shows correct trend direction (flat)', () => {
    const { getByText } = render(<ForecastWidget {...defaultProps} spendingVelocity={1.5} hourlyAllowance={2} />)
    expect(getByText('→')).toBeDefined()
    expect(getByText('On track')).toBeDefined()
  })
})
