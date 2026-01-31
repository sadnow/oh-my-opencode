import { render, fireEvent } from '@testing-library/react'
import { AnomalyIndicator } from './AnomalyIndicator'
import { AnomalyRecord } from '../../../features/budget-orchestrator/anomaly-detector'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Window } from 'happy-dom'

const window = new Window()
const document = window.document
// @ts-ignore
global.window = window
// @ts-ignore
global.document = document
// @ts-ignore
global.navigator = window.navigator
// @ts-ignore
global.Node = window.Node
// @ts-ignore
global.Element = window.Element
// @ts-ignore
global.HTMLElement = window.HTMLElement
// @ts-ignore
global.HTMLButtonElement = window.HTMLButtonElement
// @ts-ignore
global.HTMLDivElement = window.HTMLDivElement
// @ts-ignore
global.HTMLSpanElement = window.HTMLSpanElement

const mockAnomalies: AnomalyRecord[] = [
  {
    id: 'test-spike',
    type: 'spike',
    zScore: 3.5,
    value: 100,
    baseline: 50,
    threshold: 2.0,
    timestamp: new Date(),
    dismissed: false
  },
  {
    id: 'test-sustained',
    type: 'sustained_high',
    zScore: 2.5,
    value: 75,
    baseline: 50,
    threshold: 2.0,
    timestamp: new Date(Date.now() - 1000 * 60 * 5), // 5m ago
    dismissed: false
  },
  {
    id: 'test-drop',
    type: 'sudden_drop',
    zScore: -3.0,
    value: 10,
    baseline: 50,
    threshold: 2.0,
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2h ago
    dismissed: false
  }
]

describe('AnomalyIndicator', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('renders empty state when no anomalies', () => {
    const { container } = render(<AnomalyIndicator anomalies={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders empty state when all anomalies are dismissed', () => {
    const dismissedAnomalies = mockAnomalies.map(a => ({ ...a, dismissed: true }))
    const { container } = render(<AnomalyIndicator anomalies={dismissedAnomalies} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders anomaly list correctly', () => {
    const { getByText } = render(<AnomalyIndicator anomalies={mockAnomalies} />)
    expect(getByText(/3 Anomaly/)).toBeDefined()
    expect(getByText(/SPIKE/i)).toBeDefined()
    expect(getByText(/SUSTAINED HIGH/i)).toBeDefined()
    expect(getByText(/SUDDEN DROP/i)).toBeDefined()
  })

  it('shows correct icon for "spike" type (⚡)', () => {
    const { getByText } = render(<AnomalyIndicator anomalies={[mockAnomalies[0]]} />)
    expect(getByText('⚡')).toBeDefined()
  })

  it('shows correct icon for "sustained_high" type (📈)', () => {
    const { getByText } = render(<AnomalyIndicator anomalies={[mockAnomalies[1]]} />)
    expect(getByText('📈')).toBeDefined()
  })

  it('shows correct icon for "sudden_drop" type (📉)', () => {
    const { getByText } = render(<AnomalyIndicator anomalies={[mockAnomalies[2]]} />)
    expect(getByText('📉')).toBeDefined()
  })

  it('uses correct color for each severity', () => {
    const { container } = render(<AnomalyIndicator anomalies={mockAnomalies} />)
    const anomalyItems = container.querySelectorAll('div[style*="border-radius: 6px"]')
    
    // Spike - danger color
    expect(anomalyItems[0].getAttribute('style')).toContain('border-radius: 6px')
    
    // Sustained high - warning color
    expect(anomalyItems[1].getAttribute('style')).toContain('border-radius: 6px')
    
    // Sudden drop - info color
    expect(anomalyItems[2].getAttribute('style')).toContain('border-radius: 6px')
  })

  it('dismiss button calls onDismiss callback', () => {
    const onDismiss = vi.fn()
    const { getByText } = render(<AnomalyIndicator anomalies={[mockAnomalies[0]]} onDismiss={onDismiss} />)
    
    const dismissButton = getByText('✕')
    fireEvent.click(dismissButton)
    
    expect(onDismiss).toHaveBeenCalledWith('test-spike')
  })

  it('shows Z-score and baseline values', () => {
    const { getByText } = render(<AnomalyIndicator anomalies={[mockAnomalies[0]]} />)
    expect(getByText(/Z-Score:/)).toBeDefined()
    expect(getByText(/3.5/)).toBeDefined()
    expect(getByText(/threshold: 2/)).toBeDefined()
    expect(getByText(/Value:/)).toBeDefined()
    expect(getByText(/100/)).toBeDefined()
    expect(getByText(/vs baseline: 50/)).toBeDefined()
  })

  it('formats timestamp correctly', () => {
    const { getByText } = render(<AnomalyIndicator anomalies={mockAnomalies} />)
    expect(getByText(/Just now/)).toBeDefined()
    expect(getByText(/5m ago/)).toBeDefined()
    expect(getByText(/2h ago/)).toBeDefined()
  })

  it('pulsing animation class applied to active anomalies', () => {
    const { container, getByText } = render(<AnomalyIndicator anomalies={[mockAnomalies[0]]} />)
    const pulsingDot = container.querySelector('div[style*="animation: pulse 1.5s ease-in-out infinite"]')
    expect(pulsingDot).toBeDefined()
    
    const bellIcon = getByText('🔔')
    expect(bellIcon.getAttribute('style')).toContain('animation: pulse 2s ease-in-out infinite')
  })
})
