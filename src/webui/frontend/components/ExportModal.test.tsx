import { Window } from 'happy-dom'

const window = new Window()
global.window = window as any
global.document = window.document as any
global.navigator = window.navigator as any
global.HTMLElement = window.HTMLElement as any
global.Node = window.Node as any

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { render, cleanup } from '@testing-library/react'
import { ExportModal } from './ExportModal'
import userEvent from '@testing-library/user-event'

describe('ExportModal', () => {
  beforeEach(() => {
    global.document.body.innerHTML = ''
  })

  afterEach(() => {
    cleanup()
  })

  test('renders format options', () => {
    const { getByText } = render(
      <ExportModal onClose={() => {}} onExport={() => {}} />
    )
    expect(getByText('CSV')).toBeDefined()
    expect(getByText('JSON')).toBeDefined()
  })

  test('calls onExport with CSV format', async () => {
    const user = userEvent.setup({ document: global.document as any })
    let format: string | undefined
    const handleExport = (f: 'csv' | 'json') => { format = f }
    
    const { getByText } = render(
      <ExportModal onClose={() => {}} onExport={handleExport} />
    )
    
    await user.click(getByText('CSV'))
    expect(format).toBe('csv')
  })

  test('calls onClose when cancel clicked', async () => {
    const user = userEvent.setup({ document: global.document as any })
    let closed = false
    const handleClose = () => { closed = true }
    
    const { getByText } = render(
      <ExportModal onClose={handleClose} onExport={() => {}} />
    )
    
    await user.click(getByText('Cancel'))
    expect(closed).toBe(true)
  })
})
