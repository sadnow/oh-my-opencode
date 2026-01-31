import { describe, test, expect } from 'bun:test'
import { TokenizerAdapter } from './tokenizer-adapter'

describe('TokenizerAdapter', () => {
  test('counts tokens for anthropic claude', () => {
    const adapter = new TokenizerAdapter()
    const count = adapter.countTokens('anthropic', 'claude-3-opus', 'Hello world')
    expect(count).toBeGreaterThan(0)
  })
  
  test('counts tokens for openai gpt', () => {
    const adapter = new TokenizerAdapter()
    const count = adapter.countTokens('openai', 'gpt-4', 'Hello world')
    expect(count).toBeGreaterThan(0)
  })
  
  test('counts tokens for google gemini', () => {
    const adapter = new TokenizerAdapter()
    const count = adapter.countTokens('google', 'gemini-pro', 'Hello world')
    expect(count).toBeGreaterThan(0)
  })
})
