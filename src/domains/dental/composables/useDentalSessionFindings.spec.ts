/**
 * Tests for `useDentalSessionFindings`.
 *
 * The composable is a derivation: given an odontogram delta map keyed
 * by FDI (with optional `t`-prefix from BSON serialisation) and a perio
 * chart, return the set of FDIs that have *meaningful* findings this
 * visit. "Meaningful" excludes `__remove` sentinels and the default
 * `base: 'tooth'` value.
 *
 * The exported `hasMeaningfulDelta` and `hasMeaningfulPerio` helpers
 * carry most of the logic, so we exercise them directly too.
 */

import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import {
  hasMeaningfulDelta,
  hasMeaningfulPerio,
  useDentalSessionFindings,
} from './useDentalSessionFindings'
import type {
  StampedToothState,
  PerioToothRecord,
  PerioChart,
} from '../types/dental.types'

// Cast helper — these tests construct partial deltas where strict typing
// is not load-bearing.
function delta(d: Partial<StampedToothState>): Partial<StampedToothState> {
  return d
}

describe('hasMeaningfulDelta', () => {
  it('returns false for null/undefined/empty', () => {
    expect(hasMeaningfulDelta(null)).toBe(false)
    expect(hasMeaningfulDelta(undefined)).toBe(false)
    expect(hasMeaningfulDelta({})).toBe(false)
  })

  it('detects a live caries surface', () => {
    expect(
      hasMeaningfulDelta(delta({ caries: { mesial: { kind: 'enamel' } } as never })),
    ).toBe(true)
  })

  it('detects a live filling surface', () => {
    expect(
      hasMeaningfulDelta(delta({ fillings: { occlusal: { material: 'composite' } } as never })),
    ).toBe(true)
  })

  it('ignores a __remove leaf inside the surface map', () => {
    expect(
      hasMeaningfulDelta(
        delta({ caries: { mesial: { __remove: true } } as never }),
      ),
    ).toBe(false)
  })

  it('ignores a __remove on the surface map itself', () => {
    expect(
      hasMeaningfulDelta(delta({ caries: { __remove: true } as never })),
    ).toBe(false)
  })

  it('detects scalar leaves (crown / endo / etc.)', () => {
    expect(hasMeaningfulDelta(delta({ crown: { material: 'pfm' } } as never))).toBe(true)
    expect(hasMeaningfulDelta(delta({ endo: { material: 'rcf' } } as never))).toBe(true)
    expect(hasMeaningfulDelta(delta({ missing: true } as never))).toBe(true)
  })

  it('ignores scalar leaves marked __remove', () => {
    expect(hasMeaningfulDelta(delta({ crown: { __remove: true } } as never))).toBe(false)
  })

  it('detects live mods/specials list entries', () => {
    expect(
      hasMeaningfulDelta(delta({ mods: [{ kind: 'cariogenic-pattern' }] } as never)),
    ).toBe(true)
  })

  it('cancels a list entry when a __remove of the same kind appears later', () => {
    expect(
      hasMeaningfulDelta(
        delta({
          mods: [
            { kind: 'note' },
            { kind: 'note', __remove: true },
          ],
        } as never),
      ),
    ).toBe(false)
  })

  it('detects non-empty notes', () => {
    expect(hasMeaningfulDelta(delta({ notes: 'recheck' } as never))).toBe(true)
  })

  it('ignores blank notes', () => {
    expect(hasMeaningfulDelta(delta({ notes: '   ' } as never))).toBe(false)
  })

  it('detects base switching to milktooth or implant', () => {
    expect(hasMeaningfulDelta(delta({ base: 'milktooth' } as never))).toBe(true)
    expect(hasMeaningfulDelta(delta({ base: 'implant' } as never))).toBe(true)
  })

  it('treats default base "tooth" as not meaningful', () => {
    expect(hasMeaningfulDelta(delta({ base: 'tooth' } as never))).toBe(false)
  })
})

describe('hasMeaningfulPerio', () => {
  it('returns false for empty', () => {
    expect(hasMeaningfulPerio(null)).toBe(false)
    expect(hasMeaningfulPerio({} as PerioToothRecord)).toBe(false)
  })

  it('returns true when any probing depth is recorded', () => {
    expect(
      hasMeaningfulPerio({
        facial: [{ pd: 4, bop: false }],
        lingual: [],
      } as unknown as PerioToothRecord),
    ).toBe(true)
  })

  it('returns true when any BOP flag is set', () => {
    expect(
      hasMeaningfulPerio({
        facial: [{ pd: null, bop: true }],
        lingual: [],
      } as unknown as PerioToothRecord),
    ).toBe(true)
  })

  it('returns true when mobility > 0', () => {
    expect(
      hasMeaningfulPerio({ facial: [], lingual: [], mobility: 2 } as unknown as PerioToothRecord),
    ).toBe(true)
  })
})

describe('useDentalSessionFindings', () => {
  it('returns the set of FDIs with meaningful deltas', () => {
    const d = ref<Record<string, Partial<StampedToothState>> | null | undefined>({
      // 11: crown — meaningful
      '11': delta({ crown: { material: 'pfm' } } as never),
      // 12: only base=tooth — not meaningful
      '12': delta({ base: 'tooth' } as never),
      // 13: __remove'd missing — not meaningful
      '13': delta({ missing: { __remove: true } } as never),
    })
    const p = ref<PerioChart | null | undefined>({})

    const { findingFdis } = useDentalSessionFindings(d, p)
    expect(findingFdis.value.has(11)).toBe(true)
    expect(findingFdis.value.has(12)).toBe(false)
    expect(findingFdis.value.has(13)).toBe(false)
  })

  it('strips the t-prefix on BSON-encoded keys', () => {
    const d = ref<Record<string, Partial<StampedToothState>> | null | undefined>({
      't11': delta({ crown: { material: 'pfm' } } as never),
    })
    const p = ref<PerioChart | null | undefined>({})

    const { findingFdis } = useDentalSessionFindings(d, p)
    expect(findingFdis.value.has(11)).toBe(true)
  })

  it('includes FDIs with meaningful perio entries even when delta is empty', () => {
    const d = ref<Record<string, Partial<StampedToothState>> | null | undefined>({})
    const p = ref<PerioChart | null | undefined>({
      '21': { facial: [{ pd: 5 }], lingual: [] } as unknown as PerioToothRecord,
    })

    const { findingFdis } = useDentalSessionFindings(d, p)
    expect(findingFdis.value.has(21)).toBe(true)
  })

  it('skips entries whose key cannot be parsed as a number', () => {
    const d = ref<Record<string, Partial<StampedToothState>> | null | undefined>({
      'tabc': delta({ crown: { material: 'pfm' } } as never),
    })
    const p = ref<PerioChart | null | undefined>({})

    const { findingFdis } = useDentalSessionFindings(d, p)
    expect(findingFdis.value.size).toBe(0)
  })

  it('handles null/undefined inputs gracefully', () => {
    const d = ref<Record<string, Partial<StampedToothState>> | null | undefined>(null)
    const p = ref<PerioChart | null | undefined>(null)

    const { findingFdis } = useDentalSessionFindings(d, p)
    expect(findingFdis.value.size).toBe(0)
  })
})
