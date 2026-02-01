import { describe, it, expect } from 'bun:test'
import { toCanonicalProviderId, fromCanonicalProviderId, isLegacyProviderId } from './provider-id-mapping'

describe('provider-id-mapping', () => {
  describe('toCanonicalProviderId', () => {
    //#given legacy provider IDs
    //#when converting to canonical
    //#then returns canonical provider ID
    it('converts claude-max to anthropic', () => {
      expect(toCanonicalProviderId('claude-max')).toBe('anthropic')
    })
    
    it('converts copilot to github-copilot', () => {
      expect(toCanonicalProviderId('copilot')).toBe('github-copilot')
    })

    it('converts opencode_zen to opencode', () => {
      expect(toCanonicalProviderId('opencode_zen')).toBe('opencode')
    })
    
    it('passes through already-canonical IDs', () => {
      expect(toCanonicalProviderId('anthropic')).toBe('anthropic')
      expect(toCanonicalProviderId('github-copilot')).toBe('github-copilot')
    })

    it('passes through unknown IDs', () => {
      expect(toCanonicalProviderId('unknown')).toBe('unknown')
    })
  })

  describe('fromCanonicalProviderId', () => {
    //#given canonical provider IDs
    //#when converting to legacy
    //#then returns legacy provider ID
    it('converts anthropic to claude-max', () => {
      expect(fromCanonicalProviderId('anthropic')).toBe('claude-max')
    })

    it('converts github-copilot to copilot', () => {
      expect(fromCanonicalProviderId('github-copilot')).toBe('copilot')
    })

    it('converts opencode to opencode_zen', () => {
      expect(fromCanonicalProviderId('opencode')).toBe('opencode_zen')
    })

    it('passes through already-legacy IDs', () => {
      expect(fromCanonicalProviderId('claude-max')).toBe('claude-max')
    })

    it('passes through unknown IDs', () => {
      expect(fromCanonicalProviderId('unknown')).toBe('unknown')
    })
  })

  describe('isLegacyProviderId', () => {
    //#given provider IDs
    //#when checking if legacy
    //#then returns true for legacy IDs, false otherwise
    it('returns true for claude-max', () => {
      expect(isLegacyProviderId('claude-max')).toBe(true)
    })

    it('returns true for copilot', () => {
      expect(isLegacyProviderId('copilot')).toBe(true)
    })

    it('returns true for opencode_zen', () => {
      expect(isLegacyProviderId('opencode_zen')).toBe(true)
    })

    it('returns false for anthropic', () => {
      expect(isLegacyProviderId('anthropic')).toBe(false)
    })

    it('returns false for unknown', () => {
      expect(isLegacyProviderId('unknown')).toBe(false)
    })
  })
})
