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
export function classifyBp(reading: BpReading): BpResult {
  const { systolic: sys, diastolic: dia } = reading

  // Classify systolic
  let sysSeverity: number
  if (sys > 180) sysSeverity = 4
  else if (sys >= 140) sysSeverity = 3
  else if (sys >= 130) sysSeverity = 2
  else if (sys >= 120) sysSeverity = 1
  else sysSeverity = 0

  // Classify diastolic
  let diaSeverity: number
  if (dia > 120) diaSeverity = 4
  else if (dia >= 90) diaSeverity = 3
  else if (dia >= 80) diaSeverity = 2
  else diaSeverity = 0 // diastolic < 80 with sys 120-129 = elevated, but that's handled by systolic

  // Take the higher category
  const severity = Math.max(sysSeverity, diaSeverity)
  const match = BP_CATEGORIES.find(c => c.severity === severity) ?? BP_CATEGORIES[BP_CATEGORIES.length - 1]

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
export function classifyBpString(bp: string | null | undefined): BpResult | null {
  const reading = parseBp(bp)
  if (!reading) return null
  return classifyBp(reading)
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
): 'worsened' | 'improved' | 'same' {
  const curr = classifyBp(current)
  const prev = classifyBp(previous)

  if (curr.severity > prev.severity) return 'worsened'
  if (curr.severity < prev.severity) return 'improved'
  return 'same'
}

/**
 * Check if a BP reading is abnormal (elevated or higher).
 */
export function isBpAbnormal(reading: BpReading): boolean {
  return classifyBp(reading).severity >= 1
}

/**
 * Check if a BP reading is concerning (stage 1 or higher).
 */
export function isBpConcerning(reading: BpReading): boolean {
  return classifyBp(reading).severity >= 2
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
 * Heart rate classification (bpm).
 * < 60 Bradycardia, 60-100 Normal, > 100 Tachycardia
 */
export function classifyHr(hr: number | null | undefined): VitalStatus | null {
  if (hr == null) return null
  if (hr < 60)  return { label: 'Bradycardia', color: 'text-blue-600', severity: 'low' }
  if (hr <= 100) return NORMAL
  return { label: 'Tachycardia', color: 'text-red-600', severity: 'high' }
}

/**
 * Temperature classification (°C).
 * < 36 Hypothermia, 36-37.5 Normal, 37.6-38.5 Low-grade fever, > 38.5 High fever
 */
export function classifyTemp(temp: number | null | undefined): VitalStatus | null {
  if (temp == null) return null
  if (temp < 36)    return { label: 'Hypothermia', color: 'text-blue-600', severity: 'low' }
  if (temp <= 37.5) return NORMAL
  if (temp <= 38.5) return { label: 'Low-grade fever', color: 'text-amber-600', severity: 'elevated' }
  return { label: 'High fever', color: 'text-red-600', severity: 'high' }
}

/**
 * SpO2 classification (%).
 * >= 95 Normal, 90-94 Low, < 90 Critical
 */
export function classifySpo2(spo2: number | null | undefined): VitalStatus | null {
  if (spo2 == null) return null
  if (spo2 >= 95) return NORMAL
  if (spo2 >= 90) return { label: 'Low', color: 'text-amber-600', severity: 'low' }
  return { label: 'Critical', color: 'text-red-600', severity: 'critical' }
}

/**
 * Respiratory rate classification (breaths/min).
 * < 12 Low, 12-20 Normal, > 20 Elevated
 */
export function classifyRr(rr: number | null | undefined): VitalStatus | null {
  if (rr == null) return null
  if (rr < 12)  return { label: 'Low', color: 'text-blue-600', severity: 'low' }
  if (rr <= 20) return NORMAL
  return { label: 'Elevated', color: 'text-red-600', severity: 'high' }
}

/**
 * Blood sugar classification (mg/dL, fasting).
 * < 70 Hypoglycemia, 70-100 Normal, 101-125 Pre-diabetic, > 125 Diabetic
 */
export function classifyBloodSugar(bs: number | null | undefined): VitalStatus | null {
  if (bs == null) return null
  if (bs < 70)   return { label: 'Low (Hypoglycemia)', color: 'text-blue-600', severity: 'low' }
  if (bs <= 100) return NORMAL
  if (bs <= 125) return { label: 'Pre-diabetic', color: 'text-amber-600', severity: 'elevated' }
  return { label: 'High (Diabetic)', color: 'text-red-600', severity: 'high' }
}

/**
 * Pain score classification (0-10).
 * >= 7 High
 */
export function classifyPain(pain: number | null | undefined): VitalStatus | null {
  if (pain == null) return null
  if (pain >= 7) return { label: 'High', color: 'text-red-600', severity: 'high' }
  return null // only flag when concerning
}

/**
 * BP classification as VitalStatus (for consistent API with other vitals).
 */
export function classifyBpAsStatus(bp: string | null | undefined): VitalStatus | null {
  const result = classifyBpString(bp)
  if (!result) return null
  if (result.severity === 0) return NORMAL
  if (result.severity === 1) return { label: result.label, color: 'text-amber-600', severity: 'elevated' }
  if (result.severity >= 4)  return { label: result.label, color: 'text-red-600', severity: 'critical' }
  return { label: result.label, color: 'text-red-600', severity: 'high' }
}
