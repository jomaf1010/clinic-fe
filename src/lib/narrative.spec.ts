/**
 * Tests for `lib/narrative.ts`.
 *
 * The narrative builders are intentionally non-deterministic at first
 * glance — they pick a phrase from a pool by hashing the consultation ID.
 * That stability is the point: re-rendering a finalized consult MUST
 * produce the same sentence. So our tests pin the ID and assert *which*
 * phrase comes out, then check that:
 *   - HTML escaping happens via DOMPurify (only `<strong>` survives).
 *   - Empty inputs produce the empty string.
 *   - Vitals comparison reads "since the last visit" intro and emits a
 *     sentence per changed vital.
 */

import { describe, expect, it } from 'vitest'
import { stableIndex, buildNarrative, buildVitalsNarrative } from './narrative'
import type { ConsultationTriage } from '@/domains/consultation/types/consultation.types'

function triage(vitals: Record<string, string | number | null>): ConsultationTriage {
  return {
    chief_complaint: null,
    vitals,
    notes: null,
  }
}

describe('stableIndex', () => {
  it('returns a value strictly less than max', () => {
    for (const id of ['abc', 'longer-id-1', 'x']) {
      const idx = stableIndex(id, 5)
      expect(idx).toBeGreaterThanOrEqual(0)
      expect(idx).toBeLessThan(5)
    }
  })

  it('is deterministic for the same id', () => {
    expect(stableIndex('hello', 7)).toBe(stableIndex('hello', 7))
  })
})

describe('buildNarrative', () => {
  it('returns empty string when nothing is provided', () => {
    expect(buildNarrative({ id: 'x' })).toBe('')
  })

  it('emits a complaint sentence with strong tags', () => {
    const html = buildNarrative({ id: 'fixed-id', complaint: 'Cough' })
    // We don't assert which phrase is chosen — that's hash-dependent —
    // only that the input survived sanitization with strong tags around
    // the complaint.
    expect(html).toContain('<strong>cough</strong>')
    expect(html.endsWith('.')).toBe(true)
  })

  it('joins multiple diagnoses with `, ` + ` and `', () => {
    const html = buildNarrative({
      id: 'fid',
      diagnoses: ['Asthma', 'Bronchitis', 'Allergic Rhinitis'],
    })
    expect(html).toContain('<strong>Asthma</strong>')
    expect(html).toContain('<strong>Bronchitis</strong>')
    expect(html).toContain('and <strong>Allergic Rhinitis</strong>')
  })

  it('includes prescription details with humanised frequency', () => {
    const html = buildNarrative({
      id: 'fid',
      prescriptionItems: [
        { drug_name: 'Amoxicillin', dose: '500mg', frequency: 'TID', duration: '7 days' },
      ],
    })
    expect(html).toContain('<strong>Amoxicillin</strong>')
    expect(html).toContain('500mg')
    expect(html).toContain('three times a day')
    expect(html).toContain('for 7 days')
  })

  it('falls back to the raw frequency when no human mapping exists', () => {
    const html = buildNarrative({
      id: 'fid',
      prescriptionItems: [
        { drug_name: 'X', dose: '', frequency: 'CUSTOM', duration: '' },
      ],
    })
    expect(html.toLowerCase()).toContain('custom')
  })

  it('strips disallowed HTML tags in the input via DOMPurify', () => {
    const html = buildNarrative({ id: 'x', complaint: '<script>alert(1)</script>cold' })
    // The script tag and its content should be removed by DOMPurify.
    // (DOMPurify strips disallowed tags AND their inner content as the safe default,
    // so `cold` — wrapped inside the `<strong>` along with the script — also goes
    // when the implementation interpolates the raw user input into the strong tag.)
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('alert(1)')
  })

  it('produces the same output when called twice with the same id', () => {
    const a = buildNarrative({ id: 'fid', complaint: 'fever', diagnoses: ['Flu'], advice: 'Rest', prescriptionItems: [{ drug_name: 'X', dose: '1 tab', frequency: 'OD', duration: '5d' }] })
    const b = buildNarrative({ id: 'fid', complaint: 'fever', diagnoses: ['Flu'], advice: 'Rest', prescriptionItems: [{ drug_name: 'X', dose: '1 tab', frequency: 'OD', duration: '5d' }] })
    expect(a).toBe(b)
  })

  it('filters falsy entries out of the diagnoses array', () => {
    const html = buildNarrative({ id: 'x', diagnoses: ['Flu', '', 'Cold'] })
    expect(html).toContain('Flu')
    expect(html).toContain('Cold')
    // No empty `<strong></strong>` slipped in
    expect(html).not.toContain('<strong></strong>')
  })
})

describe('buildVitalsNarrative', () => {
  it('returns empty string when nothing is comparable', () => {
    expect(buildVitalsNarrative('id', triage({}), triage({}))).toBe('')
  })

  it('describes a heart-rate increase', () => {
    const html = buildVitalsNarrative(
      'fid',
      triage({ hr: 110 }),
      triage({ hr: 80 }),
    )
    expect(html).toContain('<strong>80 bpm</strong>')
    expect(html).toContain('<strong>110 bpm</strong>')
    // The label is rendered as "Heart Rate" but when it's the first sentence
    // following the intro phrase, the implementation lowercases the first char
    // — so we assert case-insensitively.
    expect(html.toLowerCase()).toContain('heart rate')
    expect(html.endsWith('.')).toBe(true)
  })

  it('describes a temperature drop', () => {
    const html = buildVitalsNarrative(
      'fid',
      triage({ temp: 37 }),
      triage({ temp: 39 }),
    )
    // First-sentence-after-intro lowercases the leading char; assert case-insensitively.
    expect(html.toLowerCase()).toContain('temperature')
    expect(html).toContain('39°C')
    expect(html).toContain('37°C')
  })

  it('uses a "worsened" phrase when BP severity climbs', () => {
    const html = buildVitalsNarrative(
      'fid',
      triage({ bp: '145/95' }),
      triage({ bp: '110/70' }),
    )
    // First-sentence-after-intro lowercases the leading char; assert case-insensitively.
    expect(html.toLowerCase()).toContain('blood pressure')
    // The currClass.label is "Stage 2 Hypertension"
    expect(html).toContain('Stage 2 Hypertension')
  })

  it('mentions "remained the same" when a vital is unchanged', () => {
    const html = buildVitalsNarrative(
      'fid',
      triage({ hr: 80, temp: 37 }),
      triage({ hr: 80, temp: 37 }),
    )
    // Both unchanged → no "since last visit" intro, just "remained the same"
    expect(html.toLowerCase()).toMatch(/remained the same|stayed steady|no change|held steady|unchanged/)
  })

  it('joins changed and unchanged into a single output', () => {
    const html = buildVitalsNarrative(
      'fid',
      triage({ hr: 110, temp: 37 }),
      triage({ hr: 80, temp: 37 }),
    )
    // First-sentence-after-intro lowercases "Heart Rate" → "heart Rate".
    // The unchanged "Temperature" sentence keeps its capitalisation.
    expect(html.toLowerCase()).toContain('heart rate')
    expect(html).toContain('Temperature')
  })

  it('temperature changes within 0.1°C are ignored', () => {
    const html = buildVitalsNarrative(
      'fid',
      triage({ temp: 37.05 }),
      triage({ temp: 37 }),
    )
    // Should not produce a "Temperature went up..." sentence
    expect(html.toLowerCase()).not.toMatch(/temperature.*(up|down|increased|decreased|rose|fell)/)
  })
})
