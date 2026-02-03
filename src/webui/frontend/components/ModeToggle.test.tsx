import { Window } from 'happy-dom'

const _origWindow = global.window
const _origDocument = global.document
const _origNavigator = global.navigator
const _origHTMLElement = global.HTMLElement
const _origNode = global.Node
const _origLocalStorage = global.localStorage

const window = new Window()
global.window = window as any
global.document = window.document as any
global.navigator = window.navigator as any
global.HTMLElement = window.HTMLElement as any
global.Node = window.Node as any

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} }
  }
})()
global.localStorage = localStorageMock as any

import { describe, test, expect, beforeEach, afterEach, afterAll } from 'bun:test'
import { render, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ModeToggle } from './ModeToggle'
import { ModeProvider } from '../context/ModeContext'

afterAll(() => {
  global.window = _origWindow
  global.document = _origDocument
  global.navigator = _origNavigator
  global.HTMLElement = _origHTMLElement
  global.Node = _origNode
  global.localStorage = _origLocalStorage
})

describe('ModeToggle', () => {
  beforeEach(() => {
    global.document.body.innerHTML = ''
    localStorage.clear()
  })

  afterEach(() => {
    cleanup()
  })

  test('persists mode to localStorage', async () => {
    const user = userEvent.setup({ document: global.document as any })
    const { getByText } = render(
      <ModeProvider>
        <ModeToggle />
      </ModeProvider>
    )

    //#given
    expect(localStorage.getItem('oh-im-broke-user-mode')).toBeNull()

    //#when
    await user.click(getByText('Switch to Power User'))

    //#then
    expect(localStorage.getItem('oh-im-broke-user-mode')).toBe('power-user')
  })

  test('respects config override', async () => {
    const user = userEvent.setup({ document: global.document as any })
    const { getByText, queryByText } = render(
      <ModeProvider defaultMode="power-user">
        <ModeToggle />
      </ModeProvider>
    )

    //#given
    localStorage.setItem('oh-im-broke-user-mode', 'beginner')

    //#when
    await waitFor(() => {
      expect(queryByText('Switch to Beginner')).toBeDefined()
    })

    //#then
    expect(queryByText('Switch to Power User')).toBeNull()
  })

  test('defaults to beginner mode', async () => {
    const { getByText } = render(
      <ModeProvider>
        <ModeToggle />
      </ModeProvider>
    )

    //#given
    expect(localStorage.getItem('oh-im-broke-user-mode')).toBeNull()

    //#when
    await waitFor(() => {
      expect(getByText('Switch to Power User')).toBeDefined()
    })

    //#then
    expect(getByText('Switch to Power User')).toBeDefined()
  })

  test('toggles between modes', async () => {
    const user = userEvent.setup({ document: global.document as any })
    const { getByText } = render(
      <ModeProvider>
        <ModeToggle />
      </ModeProvider>
    )

    //#given
    await waitFor(() => {
      expect(getByText('Switch to Power User')).toBeDefined()
    })

    //#when
    await user.click(getByText('Switch to Power User'))

    //#then
    await waitFor(() => {
      expect(getByText('Switch to Beginner')).toBeDefined()
    })

    //#when
    await user.click(getByText('Switch to Beginner'))

    //#then
    await waitFor(() => {
      expect(getByText('Switch to Power User')).toBeDefined()
    })
  })
})