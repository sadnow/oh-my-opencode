import { render } from '@testing-library/react'
import type { RenderOptions } from '@testing-library/react'
import type { ReactElement } from 'react'
import { Window } from 'happy-dom'
import '@testing-library/jest-dom'

// Setup happy-dom globals for React testing
const window = new Window()
// @ts-expect-error happy-dom types don't fully match DOM types
global.window = window
// @ts-expect-error happy-dom types don't fully match DOM types  
global.document = window.document
// @ts-expect-error happy-dom types don't fully match DOM types
global.navigator = window.navigator
// @ts-expect-error happy-dom types don't fully match DOM types
global.HTMLElement = window.HTMLElement
// @ts-expect-error happy-dom types don't fully match DOM types
global.Node = window.Node

export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, { ...options })
}

// Re-export everything
export * from '@testing-library/react'
