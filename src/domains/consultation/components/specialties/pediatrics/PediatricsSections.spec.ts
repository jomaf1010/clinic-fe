import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const consultationPedsDir = join(process.cwd(), 'src/domains/consultation/components/specialties/pediatrics')
const assessmentFactoryPath = join(process.cwd(), 'src/domains/consultation/components/specialties/AssessmentFactory.vue')
const baseAssessmentPath = join(process.cwd(), 'src/domains/consultation/components/specialties/BaseAssessmentSection.vue')
const patientPedsSectionsPath = join(process.cwd(), 'src/domains/patient/components/specialties/pediatrics/PediatricsPatientSections.vue')
const vitalsSummaryPath = join(process.cwd(), 'src/domains/consultation/components/VitalsSummary.vue')

function readSource(path: string) {
  return readFileSync(path, 'utf8')
}

describe('pediatrics consultation cleanup', () => {
  it('does not keep stale growth/development TODOs now surfaced in patient pediatrics flows', () => {
    const triageSource = readSource(join(consultationPedsDir, 'PediatricsTriageSection.vue'))
    const assessmentSource = readSource(baseAssessmentPath)
    const patientPedsSource = readSource(patientPedsSectionsPath)
    const vitalsSource = readSource(vitalsSummaryPath)

    expect(triageSource).not.toContain('TODO: Growth chart section')
    expect(triageSource).not.toContain('TODO: Developmental screening section')
    expect(assessmentSource).not.toContain('TODO: Developmental screening section')

    expect(vitalsSource).toContain('<GrowthChartDialog v-if="isPediatrics"')
    expect(patientPedsSource).toContain('<GrowthChart')
    expect(patientPedsSource).toContain('Developmental Milestones')
    expect(patientPedsSource).toContain('Developmental Assessment')
  })

  it('routes general and pediatrics assessment to the shared base section', () => {
    const factorySource = readSource(assessmentFactoryPath)

    expect(factorySource).toContain("import BaseAssessmentSection from './BaseAssessmentSection.vue'")
    expect(factorySource).toContain("case 'pediatrics': return BaseAssessmentSection")
    expect(factorySource).toContain('default: return BaseAssessmentSection')
    expect(factorySource).not.toContain('GeneralAssessmentSection')
    expect(factorySource).not.toContain('PediatricsAssessmentSection')
  })
})
