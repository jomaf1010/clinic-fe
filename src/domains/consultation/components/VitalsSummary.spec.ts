import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const componentPath = join(process.cwd(), 'src/domains/consultation/components/VitalsSummary.vue')

describe('VitalsSummary encounter API wiring', () => {
  it('uses encounter-centered routes and timeline display summaries for past diagnoses', () => {
    const source = readFileSync(componentPath, 'utf8')

    expect(source).not.toContain('`/consultations/${encounterId}`')
    expect(source).toContain('`/encounters/${encounterId}`')
    expect(source).toContain('EncounterTimelineItem[]')
    expect(source).toContain('c.display_summary?.diagnoses')
  })
})
