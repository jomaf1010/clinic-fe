import { describe, expect, it } from 'vitest'
import { hasActiveDisplayToken, hasLaunchableDisplayToken } from './displayTokenStatus'
import type { QueueDisplayTokenStatus } from '../types/queue.types'

const status = (overrides: Partial<QueueDisplayTokenStatus>): QueueDisplayTokenStatus => ({
  active: false,
  token: null,
  created_at: null,
  expires_at: null,
  ...overrides,
})

describe('queue display token status helpers', () => {
  it('treats generated one-time token responses as launchable', () => {
    const generated = status({ active: true, token: 'raw-token-once' })

    expect(hasActiveDisplayToken(generated)).toBe(true)
    expect(hasLaunchableDisplayToken(generated)).toBe(true)
  })

  it('treats status responses without raw tokens as active but not launchable', () => {
    const existing = status({ active: true, token: null })

    expect(hasActiveDisplayToken(existing)).toBe(true)
    expect(hasLaunchableDisplayToken(existing)).toBe(false)
  })

  it('treats revoked or missing display links as inactive', () => {
    const missing = status({ active: false, token: null })

    expect(hasActiveDisplayToken(missing)).toBe(false)
    expect(hasLaunchableDisplayToken(missing)).toBe(false)
  })
})
