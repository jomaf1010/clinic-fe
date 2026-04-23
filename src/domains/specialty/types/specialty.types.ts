export interface VitalAgeRange {
  band: string
  days_min: number
  days_max: number | null
  min: number | null
  max: number | null
}

export interface VitalShowIf {
  patient_age_days_max?: number
}

export interface VitalFieldOption {
  value: string
  label: string
}

export interface VitalFieldAlert {
  id: string
  severity: 'info' | 'warning' | 'critical'
  condition_type: 'gte' | 'lte' | 'gt' | 'lt' | 'out_of_range'
  threshold_low: number | null
  threshold_high: number | null
  context_filter: string | null
  message: string
}

export interface VitalFieldConfig {
  key: string
  label: string
  unit: string | null
  type: 'bp' | 'integer' | 'numeric' | 'enum'
  input_type: 'number' | 'text' | 'select' | 'paired_number' | 'paired_text'
  min: number | null
  max: number | null
  required: boolean
  order: number
  age_ranges: VitalAgeRange[] | null
  show_if: VitalShowIf | null
  options: VitalFieldOption[] | null
}

export interface SpecialtyConfig {
  key: string
  display_name: string
  version: string
  vitals: VitalFieldConfig[]
  triage_sections: unknown
  assessment_sections: unknown
  patient_profile_sections: unknown
  calculators: unknown
  growth_charts: unknown
  immunization_tracker: unknown
}
