import { describe, it, expect } from 'bun:test'
import {
  VELOCITY_PENALTY_MIN,
  VELOCITY_PENALTY_MAX,
  VELOCITY_PENALTY_ENABLED,
} from './provider-classification'

describe('provider-classification velocity penalty constants', () => {
  //#given velocity penalty constants
  //#when validating defaults
  //#then they match the configured values
  it('exports velocity penalty bounds', () => {
    expect(VELOCITY_PENALTY_MIN).toBe(0.3)
    expect(VELOCITY_PENALTY_MAX).toBe(1.5)
  })

  //#given velocity penalty feature flag
  //#when validating defaults
  //#then it is enabled
  it('exports velocity penalty feature flag', () => {
    expect(VELOCITY_PENALTY_ENABLED).toBe(true)
  })
})
