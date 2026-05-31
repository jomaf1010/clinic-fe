import { gql } from '@apollo/client/core'
import type { DocumentNode } from '@apollo/client/core'
import { apollo } from '@/lib/apollo'
import type {
  FamilyHistoryEntry,
  Medication,
  PreventiveCareItem,
  StructuredAllergy,
} from '@/domains/patient/api/patientApi'
import type {
  BirthHistoryResponse,
  GrowthMeasurement,
  ImmunizationTieredResponse,
  MilestoneScheduleResponse,
} from '@/domains/patient/api/pediatricsApi'
import type { PatientAddress, Problem } from '@/domains/patient/types/patient.types'
import type { LifestyleData } from '@/domains/consultation/types/consultation.types'
import type { GynProfile, Pregnancy } from '@/domains/obgyn/types/obgyn.types'
import type { DentalProfile, DentalTreatmentPlan, DentalVisitDetail } from '@/domains/dental/types/dental.types'

/**
 * Single read-aggregation query: replaces the patient core + FM-section REST
 * fan-out with one round-trip. Specialty sections (e.g. pediatrics) are appended
 * only for that specialty, so their computed resolvers never run otherwise.
 * Writes stay on REST.
 */
const PATIENT_FIELDS = `
  uuid first_name middle_name last_name suffix full_name formal_name
  date_of_birth sex blood_type contact_number email note status avatar_url formatted_address
  created_at updated_at
  address {
    region_code region_name province_code province_name
    city_code city_name barangay_code barangay_name street
  }
  medicalRecord {
    problem_list { uuid description icd_code status onset_date created_at updated_at }
    medication_list { uuid drug_name dose frequency route indication started_date status discontinue_reason notes updated_at }
    structured_allergies { uuid allergen type severity reaction identified_date notes }
    family_history {
      uuid relative alive current_age age_at_death cause_of_death notes
      conditions { name icd_code age_of_onset }
    }
    lifestyle { smoking pack_years alcohol exercise diet medication_adherence }
    preventive_care { key name category interval_years status last_done_date next_due_date result notes recorded_uuid }
    social_history
  }
`

const PEDIATRICS_FIELDS = `
  pediatrics { birth_history immunizations growth_history developmental_milestones }
`

const OBGYN_FIELDS = `
  obgyn { gyn_profile pregnancies }
`

const DENTAL_FIELDS = `
  dental { profile treatment_plans visits }
`

/** Specialty keys whose sections are fetched within the same aggregate query. */
export type AggregateSpecialty = 'pediatrics' | 'obgyn' | 'dental'

const queryCache = new Map<string, DocumentNode>()

function buildQuery(specialty: AggregateSpecialty | null): DocumentNode {
  const cacheKey = specialty ?? 'base'
  const cached = queryCache.get(cacheKey)
  if (cached) return cached

  const extra = specialty === 'pediatrics'
    ? PEDIATRICS_FIELDS
    : specialty === 'obgyn'
      ? OBGYN_FIELDS
      : specialty === 'dental'
        ? DENTAL_FIELDS
        : ''
  const doc = gql(`query PatientDetail($uuid: ID!) { patient(uuid: $uuid) { ${PATIENT_FIELDS}${extra} } }`)
  queryCache.set(cacheKey, doc)
  return doc
}

export interface PatientDetailMedicalRecord {
  problem_list: Problem[]
  medication_list: Medication[]
  structured_allergies: StructuredAllergy[]
  family_history: FamilyHistoryEntry[]
  lifestyle: LifestyleData | null
  preventive_care: PreventiveCareItem[]
  social_history: Record<string, unknown> | null
}

/** Pediatric sections — pass-through computed structures (match the REST shapes). */
export interface PatientDetailPediatrics {
  birth_history: BirthHistoryResponse['data'] | null
  immunizations: ImmunizationTieredResponse | null
  growth_history: GrowthMeasurement[]
  developmental_milestones: MilestoneScheduleResponse | null
}

/** OB-GYN sections — Resource-shaped pass-through (match the REST shapes). */
export interface PatientDetailObgyn {
  gyn_profile: GynProfile | null
  pregnancies: Pregnancy[]
}

/** Dental sections — Resource-shaped pass-through (match the REST shapes). */
export interface PatientDetailDental {
  profile: DentalProfile | null
  treatment_plans: DentalTreatmentPlan[]
  visits: DentalVisitDetail[]
}

/** GraphQL projection of a patient — a subset of the REST PatientResponse plus sections. */
export interface PatientDetailGraphQL {
  uuid: string
  first_name: string
  middle_name: string | null
  last_name: string
  suffix: string | null
  full_name: string
  formal_name: string
  date_of_birth: string | null
  sex: string
  blood_type: string | null
  contact_number: string | null
  email: string | null
  note: string | null
  status: string
  avatar_url: string | null
  formatted_address: string
  created_at: string
  updated_at: string
  address: PatientAddress | null
  medicalRecord: PatientDetailMedicalRecord | null
  pediatrics?: PatientDetailPediatrics | null
  obgyn?: PatientDetailObgyn | null
  dental?: PatientDetailDental | null
}

export async function fetchPatientDetail(
  uuid: string,
  specialty: AggregateSpecialty | null = null,
): Promise<PatientDetailGraphQL | null> {
  const { data } = await apollo.query<{ patient: PatientDetailGraphQL | null }>({
    query: buildQuery(specialty),
    variables: { uuid },
  })
  // errorPolicy 'all' can resolve with undefined data on a GraphQL-level error.
  return data?.patient ?? null
}
