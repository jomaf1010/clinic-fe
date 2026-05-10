import { describe, expect, it } from 'vitest'
import { centrifugoApi as canonicalCentrifugoApi } from '@/api/centrifugoApi'
import { centrifugoApi } from './centrifugoApi'

describe('queue centrifugoApi compatibility export', () => {
  it('uses the canonical shared Centrifugo API module', () => {
    expect(centrifugoApi).toBe(canonicalCentrifugoApi)
  })
})
