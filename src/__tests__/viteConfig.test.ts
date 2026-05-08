import { describe, expect, it } from 'vitest'
import config from '../../vite.config'

describe('vite production hardening', () => {
  it('explicitly disables production source maps', () => {
    expect(config).toMatchObject({
      build: {
        sourcemap: false,
      },
    })
  })
})
