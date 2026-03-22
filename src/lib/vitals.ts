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
