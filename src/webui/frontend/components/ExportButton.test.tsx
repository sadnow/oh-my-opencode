import { Window } from 'happy-dom'

const _origWindow = global.window
const _origDocument = global.document
const _origNavigator = global.navigator
const _origHTMLElement = global.HTMLElement
const _origNode = global.Node
const _origFetch = global.fetch
const _origCreateObjectURL = global.URL.createObjectURL
const _origRevokeObjectURL = global.URL.revokeObjectURL

const window = new Window()
;(window as any).event = undefined
global.window = window as any
global.document = window.document as any
global.navigator = window.navigator as any
global.HTMLElement = window.HTMLElement as any
global.Node = window.Node as any
global.URL.createObjectURL = () => 'blob:mock'
global.URL.revokeObjectURL = () => {}
global.fetch = async () => ({
  blob: async () => new Blob(['mock'], { type: 'text/csv' })
}) as any

import { describe, test, expect, beforeEach, afterEach, afterAll } from 'bun:test'
import { render, cleanup, waitFor } from '@testing-library/react'
import { ExportButton } from './ExportButton'
import userEvent from '@testing-library/user-event'

afterAll(() => {
  global.window = _origWindow
  global.document = _origDocument
  global.navigator = _origNavigator
  global.HTMLElement = _origHTMLElement
  global.Node = _origNode
  global.fetch = _origFetch
  global.URL.createObjectURL = _origCreateObjectURL
  global.URL.revokeObjectURL = _origRevokeObjectURL
})

describe('ExportButton', () => {
  beforeEach(() => {
    global.document.body.innerHTML = ''
  })

  afterEach(() => {
    cleanup()
  })

  test('renders button with label', () => {
    const { getByText } = render(
      <ExportButton endpoint="http://localhost/api/export/usage" label="Export Usage" filename="usage" />
    )
    expect(getByText('Export Usage')).toBeDefined()
  })

  test('opens modal on click', async () => {
    const user = userEvent.setup({ document: global.document as any })
    const { getByText } = render(
      <ExportButton endpoint="http://localhost/api/export/usage" label="Export" filename="usage" />
    )
    
    await user.click(getByText('Export'))
    expect(getByText('Select Export Format')).toBeDefined()
  })

  test('shows loading state during export', async () => {
    const user = userEvent.setup({ document: global.document as any })
    const { getByText, queryByText } = render(
      <ExportButton endpoint="http://localhost/api/export/usage" label="Export" filename="usage" />
    )
    
    await user.click(getByText('Export'))
    await user.click(getByText('CSV'))
    
    await waitFor(() => {
      expect(queryByText('Exporting...')).toBeDefined()
    })
  })
})
