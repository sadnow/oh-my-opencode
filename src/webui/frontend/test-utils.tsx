import { render, cleanup } from '@testing-library/react'
import type { RenderOptions } from '@testing-library/react'
import type { ReactElement } from 'react'
import { Window } from 'happy-dom'
import '@testing-library/jest-dom'
import { afterEach } from 'bun:test'

// Store original globals to restore after tests
const originalWindow = global.window
const originalDocument = global.document
const originalNavigator = global.navigator
const originalHTMLElement = global.HTMLElement
const originalNode = global.Node

// Create a fresh happy-dom window for each test
let happyDomWindow: Window | null = null

/**
 * Setup happy-dom globals for React testing.
 * Call this in beforeEach or at the start of your test file.
 */
export function setupHappyDom() {
  happyDomWindow = new Window()
  // @ts-expect-error happy-dom types don't fully match DOM types
  global.window = happyDomWindow
  // @ts-expect-error happy-dom types don't fully match DOM types  
  global.document = happyDomWindow.document
  // @ts-expect-error happy-dom types don't fully match DOM types
  global.navigator = happyDomWindow.navigator
  // @ts-expect-error happy-dom types don't fully match DOM types
  global.HTMLElement = happyDomWindow.HTMLElement
  // @ts-expect-error happy-dom types don't fully match DOM types
  global.Node = happyDomWindow.Node
}

/**
 * Cleanup happy-dom globals after tests.
 * Call this in afterEach to prevent test pollution.
 */
export function cleanupHappyDom() {
  cleanup() // React testing-library cleanup
  
  if (happyDomWindow) {
    happyDomWindow.close()
    happyDomWindow = null
  }
  
  // Restore original globals (or undefined if they weren't set)
  global.window = originalWindow
  global.document = originalDocument
  global.navigator = originalNavigator
  global.HTMLElement = originalHTMLElement
  global.Node = originalNode
}

// NOTE: Happy-dom is NOT auto-setup. Each test file must call setupHappyDom() in beforeAll/beforeEach.
// This prevents global pollution when webui tests run alongside other tests.

// For backward compatibility, check if we're in a webui test file context
// The check below is a simple heuristic - if document is undefined, we set it up
if (typeof global.document === 'undefined') {
  setupHappyDom()
}

// Register cleanup hooks if in test environment
if (typeof afterEach === 'function') {
  afterEach(() => {
    cleanup() // Ensure React cleanup runs after each test
  })
}

export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  // Ensure happy-dom is set up before rendering
  if (!global.document) {
    setupHappyDom()
  }
  
  // Clean up any previous renders to prevent pollution
  cleanup()
  
  // Clear body content for a fresh start
  if (global.document?.body) {
    global.document.body.innerHTML = ''
  }
  
  return render(ui, { ...options })
}

// Re-export everything
export * from '@testing-library/react'
