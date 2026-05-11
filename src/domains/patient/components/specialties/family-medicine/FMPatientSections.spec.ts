import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const componentPath = join(process.cwd(), 'src/domains/patient/components/specialties/family-medicine/FMPatientSections.vue')

describe('FMPatientSections cleanup', () => {
  it('does not keep the retired local trends chart option or TypeScript suppression', () => {
    const source = readFileSync(componentPath, 'utf8')

    expect(source).not.toContain('@ts-expect-error TS6133')
    expect(source).not.toContain('const trendsChartOption = computed')
    expect(source).toContain('<ChronicTrendsDialog v-model:open="showTrendsModal" />')
  })
})
