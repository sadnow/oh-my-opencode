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
    expect(getByText(/Oh My OpenCode/i)).toBeDefined()
  })
  
  test('renders React infrastructure message', () => {
    const { getByText } = renderWithProviders(<App />)
    expect(getByText(/React infrastructure ready/i)).toBeDefined()
  })
})
