// Maps the raw classification enums returned by the chronic-trends endpoint
// (see backend ChronicTrendsController::CLASSIFICATION_RULES) to human-readable
// labels and tooltip-friendly hex colors. Kept here, not in the component,
// because both the FM widget and the trends dialog render the same values.

const LABELS: Record<string, string> = {
  // BP
  normal: 'Normal',
  elevated: 'Elevated',
  high_stage_1: 'Stage 1 HTN',
  high_stage_2: 'Stage 2 HTN',
  // Blood sugar
  pre_diabetic: 'Pre-diabetic',
  diabetic: 'Diabetic',
  // BMI
  underweight: 'Underweight',
  overweight: 'Overweight',
  obese: 'Obese',
}

export function classificationLabel(raw: string | null | undefined): string {
  if (!raw) return ''
  return LABELS[raw] ?? raw.replace(/_/g, ' ')
}

export function classificationColor(raw: string | null | undefined): string {
  if (!raw) return '#6b7280'
  const lower = raw.toLowerCase()
  if (lower.includes('normal')) return '#16a34a'
  if (lower.includes('elevated') || lower.includes('pre') || lower === 'underweight' || lower === 'overweight') return '#d97706'
  return '#dc2626'
}
