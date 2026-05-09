import { describe, expect, it } from 'vitest'
import { buildNarrative, buildVitalsNarrative } from './narrative'
import { boldUserHtml, escapeUserHtml } from './htmlSafety'
import type { ConsultationTriage } from '@/domains/consultation/types/consultation.types'

describe('narrative HTML safety', () => {
  it('escapes user-controlled consultation text while keeping allowed emphasis tags', () => {
    const html = buildNarrative({
      id: 'encounter-xss-check',
      complaint: '<img src=x onerror=alert(1)> Fever',
      diagnoses: ['<svg onload=alert(2)>Viral URI</svg>'],
      advice: '<script>alert(3)</script> rest',
      prescriptionItems: [
        {
          drug_name: '<img src=x onerror=alert(4)>Paracetamol',
          dose: '<script>alert(5)</script>500mg',
          frequency: 'BID',
          duration: '<iframe srcdoc=alert(6)>3 days</iframe>',
        },
      ],
    })

    expect(html).toContain('<strong>')
    expect(html).not.toContain('<img')
    expect(html).not.toContain('<svg')
    expect(html).not.toContain('<script')
    expect(html).not.toContain('<iframe')
    expect(html).not.toContain('onerror')
    expect(html).not.toContain('onload')
    expect(html).toContain('fever')
  })

  it('sanitizes vitals narrative output rendered through v-html', () => {
    const current = {
      vitals: {
        bp: '<img src=x onerror=alert(1)>120/80',
        hr: 90,
        rr: 18,
        temp: 37,
        spo2: 98,
        blood_sugar: 100,
        weight: 70,
        height: 170,
        pain_score: 1,
      },
    } satisfies ConsultationTriage

    const previous = {
      vitals: {
        bp: '110/70',
        hr: 80,
        rr: 18,
        temp: 37,
        spo2: 98,
        blood_sugar: 100,
        weight: 70,
        height: 170,
        pain_score: 1,
      },
    } satisfies ConsultationTriage

    const html = buildVitalsNarrative('vitals-xss-check', current, previous)

    expect(html).toContain('<strong>')
    expect(html).not.toContain('<img')
    expect(html).not.toContain('onerror')
  })

  it('escapes user text before wrapping narrative emphasis tags', () => {
    const html = boldUserHtml('<img src=x onerror=alert(1)>')

    expect(html).toBe('<b>&lt;img src=x onerror=alert(1)&gt;</b>')
    expect(html).not.toContain('<img')
  })

  it('escapes non-emphasized user text', () => {
    expect(escapeUserHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;')
  })
})
