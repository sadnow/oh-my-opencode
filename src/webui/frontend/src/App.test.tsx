import { describe, test, expect } from 'bun:test'
import { renderWithProviders } from '../test-utils'
import App from './App'

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
