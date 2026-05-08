import { describe, expect, it } from 'vitest'
import { isTrustedCheckoutUrl } from './subscriptionStore'

describe('isTrustedCheckoutUrl', () => {
  it('allows PayMongo checkout URLs over HTTPS', () => {
    expect(isTrustedCheckoutUrl('https://checkout.paymongo.com/checkout?id=cs_123')).toBe(true)
  })

  it('rejects lookalike checkout hosts', () => {
    expect(isTrustedCheckoutUrl('https://checkout.paymongo.com.evil.test/checkout')).toBe(false)
  })

  it('rejects non-HTTPS and malformed checkout URLs', () => {
    expect(isTrustedCheckoutUrl('http://checkout.paymongo.com/checkout')).toBe(false)
    expect(isTrustedCheckoutUrl('/billing/success')).toBe(false)
    expect(isTrustedCheckoutUrl('not a url')).toBe(false)
  })
})
