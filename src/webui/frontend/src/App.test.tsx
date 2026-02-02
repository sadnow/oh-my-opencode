import { describe, test, expect } from 'bun:test'
import { renderWithProviders } from '../test-utils'
import App from './App'
import { Window } from 'happy-dom'

const window = new Window()
global.window = window
global.document = window.document
global.navigator = window.navigator
global.HTMLElement = window.HTMLElement
global.Node = window.Node

describe('App', () => {
  test('renders heading', () => {
    const { getByText } = renderWithProviders(<App />)
    expect(getByText(/oh-im-broke Dashboard/i)).toBeDefined()
  })
  
  test('renders budget tagline', () => {
    const { getByText } = renderWithProviders(<App />)
    expect(getByText(/Budget-conscious AI orchestration/i)).toBeDefined()
  })
})
