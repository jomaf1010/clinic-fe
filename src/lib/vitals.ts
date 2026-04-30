/**
 * Blood pressure and vitals utilities.
 * BP classification follows AHA/ACC 2017 guidelines.
 * Rule: whichever number (systolic OR diastolic) places you
 * in a higher category determines the overall classification.
 */

export type BpCategory = 'normal' | 'elevated' | 'stage1' | 'stage2' | 'crisis'

export interface BpReading {
  systolic: number
  diastolic: number
}

export interface BpResult {
  reading: BpReading
  category: BpCategory
  label: string
  severity: number // 0=normal, 1=elevated, 2=stage1, 3=stage2, 4=crisis
}

export interface VitalsConfig {
  bp_sys_elevated: number; bp_sys_stage1: number; bp_sys_stage2: number; bp_sys_crisis: number
  bp_dia_stage1: number; bp_dia_stage2: number; bp_dia_crisis: number
  hr_low: number; hr_high: number
  temp_hypothermia: number; temp_normal_max: number; temp_low_fever_max: number
  spo2_normal: number; spo2_low: number
  rr_low: number; rr_high: number
  bs_hypoglycemia: number; bs_normal: number; bs_prediabetic: number
  pain_high: number
  bmi_underweight: number; bmi_normal: number; bmi_overweight: number
}

export const DEFAULT_VITALS_CONFIG: VitalsConfig = {
  bp_sys_elevated: 120, bp_sys_stage1: 130, bp_sys_stage2: 140, bp_sys_crisis: 180,
  bp_dia_stage1: 80, bp_dia_stage2: 90, bp_dia_crisis: 120,
  hr_low: 60, hr_high: 100,
  temp_hypothermia: 36, temp_normal_max: 37.5, temp_low_fever_max: 38.5,
  spo2_normal: 95, spo2_low: 90,
  rr_low: 12, rr_high: 20,
  bs_hypoglycemia: 70, bs_normal: 100, bs_prediabetic: 125,
  pain_high: 7,
  bmi_underweight: 18.5, bmi_normal: 25, bmi_overweight: 30,
}

const BP_CATEGORIES: { category: BpCategory; label: string; severity: number }[] = [
  { category: 'crisis', label: 'Hypertensive Crisis', severity: 4 },
  { category: 'stage2', label: 'Stage 2 Hypertension', severity: 3 },
  { category: 'stage1', label: 'Stage 1 Hypertension', severity: 2 },
  { category: 'elevated', label: 'Elevated', severity: 1 },
  { category: 'normal', label: 'Normal', severity: 0 },
]

/**
 * Parse a BP string like "130/80" into a BpReading.
 * Returns null if invalid.
 */
export function parseBp(bp: string | null | undefined): BpReading | null {
  if (!bp) return null
  const parts = bp.split('/')
  if (parts.length !== 2) return null
  const systolic = parseInt(parts[0], 10)
  const diastolic = parseInt(parts[1], 10)
  if (isNaN(systolic) || isNaN(diastolic) || systolic <= 0 || diastolic <= 0) return null
  return { systolic, diastolic }
}

/**
 * Classify a BP reading per AHA/ACC 2017 guidelines.
 *
 * | Category            | Systolic        | Diastolic       |
 * |---------------------|-----------------|-----------------|
 * | Normal              | < 120           | AND < 80        |
 * | Elevated            | 120-129         | AND < 80        |
 * | Stage 1 HTN         | 130-139         | OR 80-89        |
 * | Stage 2 HTN         | >= 140          | OR >= 90        |
 * | Hypertensive Crisis | > 180           | OR > 120        |
 *
 * When systolic and diastolic fall in different categories,
 * the HIGHER category is used.
 */
export function classifyBp(reading: BpReading, config: VitalsConfig = DEFAULT_VITALS_CONFIG): BpResult {
  const { systolic: sys, diastolic: dia } = reading

  // Classify systolic
  let sysSeverity: number
  if (sys > config.bp_sys_crisis) sysSeverity = 4
  else if (sys >= config.bp_sys_stage2) sysSeverity = 3
  else if (sys >= config.bp_sys_stage1) sysSeverity = 2
  else if (sys >= config.bp_sys_elevated) sysSeverity = 1
  else sysSeverity = 0

  // Classify diastolic
  let diaSeverity: number
  if (dia > config.bp_dia_crisis) diaSeverity = 4
  else if (dia >= config.bp_dia_stage2) diaSeverity = 3
  else if (dia >= config.bp_dia_stage1) diaSeverity = 2
  else diaSeverity = 0 // diastolic < 80 with sys 120-129 = elevated, but that's handled by systolic

  // Take the higher category
  const severity = Math.max(sysSeverity, diaSeverity)
  const match = BP_CATEGORIES.find(c => c.severity === severity) ?? BP_CATEGORIES[BP_CATEGORIES.length - 1]!

  return {
    reading,
    category: match.category,
    label: match.label,
    severity: match.severity,
  }
}

/**
 * Classify a BP string like "130/80" directly.
 * Returns null if the string is invalid.
 */
export function classifyBpString(bp: string | null | undefined, config: VitalsConfig = DEFAULT_VITALS_CONFIG): BpResult | null {
  const reading = parseBp(bp)
  if (!reading) return null
  return classifyBp(reading, config)
}

/**
 * Compare two BP readings and return the direction of change.
 * Uses AHA category severity for comparison, not raw numbers.
 *
 * Returns:
 * - 'worsened' if the category severity increased
 * - 'improved' if the category severity decreased
 * - 'same' if the category is the same (even if numbers differ slightly within the same category)
 */
export function compareBp(
  current: BpReading,
  previous: BpReading,
  config: VitalsConfig = DEFAULT_VITALS_CONFIG,
): 'worsened' | 'improved' | 'same' {
  const curr = classifyBp(current, config)
  const prev = classifyBp(previous, config)

  if (curr.severity > prev.severity) return 'worsened'
  if (curr.severity < prev.severity) return 'improved'
  return 'same'
}

/**
 * Check if a BP reading is abnormal (elevated or higher).
 */
export function isBpAbnormal(reading: BpReading, config: VitalsConfig = DEFAULT_VITALS_CONFIG): boolean {
  return classifyBp(reading, config).severity >= 1
}

/**
 * Check if a BP reading is concerning (stage 1 or higher).
 */
export function isBpConcerning(reading: BpReading, config: VitalsConfig = DEFAULT_VITALS_CONFIG): boolean {
  return classifyBp(reading, config).severity >= 2
}

// ──────────────────────────────────────────────
// Generic vital status
// ──────────────────────────────────────────────

export interface VitalStatus {
  label: string
  color: string
  severity: 'normal' | 'low' | 'elevated' | 'high' | 'critical'
}

const NORMAL: VitalStatus  = { label: 'Normal', color: 'text-green-600', severity: 'normal' }

/**
 * Age-based range entry used for specialty-specific vital thresholds.
 * days_min/days_max define the age window (in days); min/max override the normal range.
 */
export interface VitalAgeBasedRange {
  days_min: number
  days_max: number | null
  min: number | null
  max: number | null
}

function resolveAgeRange(
  patientAgeDays: number | undefined,
  ageRanges: VitalAgeBasedRange[] | undefined,
): VitalAgeBasedRange | null {
  if (patientAgeDays === undefined || !ageRanges?.length) return null
  return (
    ageRanges.find(
      (r) => patientAgeDays >= r.days_min && (r.days_max === null || patientAgeDays <= r.days_max),
    ) ?? null
  )
}

/**
 * Heart rate classification (bpm).
 * < 60 Bradycardia, 60-100 Normal, > 100 Tachycardia
 * Pass patientAgeDays + ageRanges from specialty config to apply age-appropriate thresholds.
 */
export function classifyHr(
  hr: number | null | undefined,
  config: VitalsConfig = DEFAULT_VITALS_CONFIG,
  patientAgeDays?: number,
  ageRanges?: VitalAgeBasedRange[],
): VitalStatus | null {
  if (hr == null) return null
  const range = resolveAgeRange(patientAgeDays, ageRanges)
  const low = range?.min ?? config.hr_low
  const high = range?.max ?? config.hr_high
  if (hr < low)  return { label: 'Bradycardia', color: 'text-blue-600', severity: 'low' }
  if (hr <= high) return NORMAL
  return { label: 'Tachycardia', color: 'text-red-600', severity: 'high' }
}

/**
 * Temperature classification (°C).
 * < 36 Hypothermia, 36-37.5 Normal, 37.6-38.5 Low-grade fever, > 38.5 High fever
 * Pass patientAgeDays + ageRanges from specialty config to apply age-appropriate thresholds.
 */
export function classifyTemp(
  temp: number | null | undefined,
  config: VitalsConfig = DEFAULT_VITALS_CONFIG,
  patientAgeDays?: number,
  ageRanges?: VitalAgeBasedRange[],
): VitalStatus | null {
  if (temp == null) return null
  const range = resolveAgeRange(patientAgeDays, ageRanges)
  if (range) {
    const low = range.min ?? config.temp_hypothermia
    const high = range.max ?? config.temp_normal_max
    if (temp < low) return { label: 'Hypothermia', color: 'text-blue-600', severity: 'low' }
    if (temp <= high) return NORMAL
    return { label: 'Fever', color: 'text-red-600', severity: 'high' }
  }
  if (temp < config.temp_hypothermia)    return { label: 'Hypothermia', color: 'text-blue-600', severity: 'low' }
  if (temp <= config.temp_normal_max) return NORMAL
  if (temp <= config.temp_low_fever_max) return { label: 'Low-grade fever', color: 'text-amber-600', severity: 'elevated' }
  return { label: 'High fever', color: 'text-red-600', severity: 'high' }
}

/**
 * SpO2 classification (%).
 * >= 95 Normal, 90-94 Low, < 90 Critical
 * Pass patientAgeDays + ageRanges from specialty config to apply age-appropriate thresholds.
 */
export function classifySpo2(
  spo2: number | null | undefined,
  config: VitalsConfig = DEFAULT_VITALS_CONFIG,
  patientAgeDays?: number,
  ageRanges?: VitalAgeBasedRange[],
): VitalStatus | null {
  if (spo2 == null) return null
  const range = resolveAgeRange(patientAgeDays, ageRanges)
  const normal = range?.max ?? config.spo2_normal
  const low = range?.min ?? config.spo2_low
  if (spo2 >= normal) return NORMAL
  if (spo2 >= low) return { label: 'Low', color: 'text-amber-600', severity: 'low' }
  return { label: 'Critical', color: 'text-red-600', severity: 'critical' }
}

/**
 * Respiratory rate classification (breaths/min).
 * < 12 Low, 12-20 Normal, > 20 Elevated
 * Pass patientAgeDays + ageRanges from specialty config to apply age-appropriate thresholds.
 */
export function classifyRr(
  rr: number | null | undefined,
  config: VitalsConfig = DEFAULT_VITALS_CONFIG,
  patientAgeDays?: number,
  ageRanges?: VitalAgeBasedRange[],
): VitalStatus | null {
  if (rr == null) return null
  const range = resolveAgeRange(patientAgeDays, ageRanges)
  const low = range?.min ?? config.rr_low
  const high = range?.max ?? config.rr_high
  if (rr < low)  return { label: 'Low', color: 'text-blue-600', severity: 'low' }
  if (rr <= high) return NORMAL
  return { label: 'Elevated', color: 'text-red-600', severity: 'high' }
}

export type BloodGlucoseTiming = 'fasting' | 'random' | 'postprandial' | 'pre_meal' | 'post_meal' | 'bedtime'

/**
 * Blood sugar classification (mg/dL). Fasting/pre-meal uses the tighter
 * 100/126 thresholds; random/post-meal/bedtime uses 140/200.
 * Pass patientAgeDays + ageRanges from specialty config to apply age-appropriate thresholds.
 */
export function classifyBloodSugar(
  bs: number | null | undefined,
  config: VitalsConfig = DEFAULT_VITALS_CONFIG,
  timing?: BloodGlucoseTiming | string | null,
  patientAgeDays?: number,
  ageRanges?: VitalAgeBasedRange[],
): VitalStatus | null {
  if (bs == null) return null
  const range = resolveAgeRange(patientAgeDays, ageRanges)
  if (range) {
    const low = range.min ?? config.bs_hypoglycemia
    const high = range.max ?? config.bs_normal
    if (bs < low) return { label: 'Low (Hypoglycemia)', color: 'text-blue-600', severity: 'low' }
    if (bs <= high) return NORMAL
    return { label: 'High', color: 'text-red-600', severity: 'high' }
  }
  const isFastingLike = timing === 'fasting' || timing === 'pre_meal'
  if (bs < config.bs_hypoglycemia) return { label: 'Low (Hypoglycemia)', color: 'text-blue-600', severity: 'low' }
  if (isFastingLike) {
    if (bs <= config.bs_normal) return NORMAL
    if (bs <= config.bs_prediabetic) return { label: 'Pre-diabetic', color: 'text-amber-600', severity: 'elevated' }
    return { label: 'High (Diabetic)', color: 'text-red-600', severity: 'high' }
  }
  if (bs < 140) return NORMAL
  if (bs < 200) return { label: 'Pre-diabetic', color: 'text-amber-600', severity: 'elevated' }
  return { label: 'High (Diabetic)', color: 'text-red-600', severity: 'high' }
}

/**
 * Pain score classification (0-10).
 * >= 7 High
 */
export function classifyPain(pain: number | null | undefined, config: VitalsConfig = DEFAULT_VITALS_CONFIG): VitalStatus | null {
  if (pain == null) return null
  if (pain >= config.pain_high) return { label: 'High', color: 'text-red-600', severity: 'high' }
  return null // only flag when concerning
}

/**
 * BMI classification.
 * < 18.5 Underweight, 18.5-24.9 Normal, 25-29.9 Overweight, >= 30 Obese
 */
export function classifyBmi(bmi: number | null | undefined, config: VitalsConfig = DEFAULT_VITALS_CONFIG): VitalStatus | null {
  if (bmi == null) return null
  if (bmi < config.bmi_underweight) return { label: 'Underweight', color: 'text-blue-600', severity: 'low' }
  if (bmi < config.bmi_normal)      return { label: 'Normal', color: 'text-green-600', severity: 'normal' }
  if (bmi < config.bmi_overweight)  return { label: 'Overweight', color: 'text-amber-600', severity: 'elevated' }
  return { label: 'Obese', color: 'text-red-600', severity: 'high' }
}

/**
 * BP classification as VitalStatus (for consistent API with other vitals).
 */
export function classifyBpAsStatus(bp: string | null | undefined, config: VitalsConfig = DEFAULT_VITALS_CONFIG): VitalStatus | null {
  const result = classifyBpString(bp, config)
  if (!result) return null
  if (result.severity === 0) return NORMAL
  if (result.severity === 1) return { label: result.label, color: 'text-amber-600', severity: 'elevated' }
  if (result.severity >= 4)  return { label: result.label, color: 'text-red-600', severity: 'critical' }
  return { label: result.label, color: 'text-red-600', severity: 'high' }
}
