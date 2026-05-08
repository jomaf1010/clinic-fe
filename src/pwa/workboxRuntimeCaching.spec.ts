import { describe, expect, it } from 'vitest'
import { runtimeCaching } from './workboxRuntimeCaching'

function matches(pattern: unknown, path: string, method = 'GET') {
  if (typeof pattern !== 'function') return false
  return pattern({
    url: new URL(`https://api.mediflow.test${path}`),
    request: { method },
  })
}

describe('PWA runtime caching', () => {
  it('does not include broad authenticated API runtime cache rules', () => {
    expect(runtimeCaching.some((rule) => rule.options?.cacheName === 'mediflow-api')).toBe(false)
  })

  it('only runtime-caches explicitly safe catalog API endpoints', () => {
    const rules = runtimeCaching.filter((rule) => rule.options?.cacheName === 'mediflow-catalogs')
    expect(rules).toHaveLength(1)
    const [catalogRule] = rules

    expect(matches(catalogRule.urlPattern, '/api/icd10/search?q=flu')).toBe(true)
    expect(matches(catalogRule.urlPattern, '/api/system-medicines')).toBe(true)
    expect(matches(catalogRule.urlPattern, '/api/specialties')).toBe(true)

    expect(matches(catalogRule.urlPattern, '/api/patients')).toBe(false)
    expect(matches(catalogRule.urlPattern, '/api/encounters/enc-1')).toBe(false)
    expect(matches(catalogRule.urlPattern, '/api/billing/invoices')).toBe(false)
    expect(matches(catalogRule.urlPattern, '/api/messages/threads')).toBe(false)
    expect(matches(catalogRule.urlPattern, '/api/queue/display/token')).toBe(false)
    expect(matches(catalogRule.urlPattern, '/api/patients', 'POST')).toBe(false)
  })
})
