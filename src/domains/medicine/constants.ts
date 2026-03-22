export const FREQUENCIES = [
  { value: 'OD', label: 'OD - Once daily' },
  { value: 'BID', label: 'BID - Twice daily' },
  { value: 'TID', label: 'TID - Three times daily' },
  { value: 'QID', label: 'QID - Four times daily' },
  { value: 'Q4H', label: 'Q4H - Every 4 hours' },
  { value: 'Q6H', label: 'Q6H - Every 6 hours' },
  { value: 'Q8H', label: 'Q8H - Every 8 hours' },
  { value: 'Q12H', label: 'Q12H - Every 12 hours' },
  { value: 'PRN', label: 'PRN - As needed' },
  { value: 'STAT', label: 'STAT - Immediately' },
  { value: 'QHS', label: 'QHS - At bedtime' },
  { value: 'QAM', label: 'QAM - Every morning' },
  { value: 'QPM', label: 'QPM - Every evening' },
  { value: 'QOD', label: 'QOD - Every other day' },
  { value: 'Weekly', label: 'Weekly' },
] as const

/** Maps frequency codes to doses per day. null = not computable (doctor must specify quantity). */
export const FREQUENCY_DOSES_PER_DAY: Record<string, number | null> = {
  OD: 1,
  BID: 2,
  TID: 3,
  QID: 4,
  Q4H: 6,
  Q6H: 4,
  Q8H: 3,
  Q12H: 2,
  QHS: 1,
  QAM: 1,
  QPM: 1,
  QOD: 0.5,
  Weekly: 1 / 7,
  PRN: null,
  STAT: null,
}

/** Maps frequency codes to casual human-readable text. */
export const FREQUENCY_HUMAN: Record<string, string> = {
  OD: 'once a day',
  BID: 'twice a day',
  TID: 'three times a day',
  QID: 'four times a day',
  Q4H: 'every 4 hours',
  Q6H: 'every 6 hours',
  Q8H: 'every 8 hours',
  Q12H: 'every 12 hours',
  PRN: 'as needed',
  STAT: 'right away',
  QHS: 'at bedtime',
  QAM: 'every morning',
  QPM: 'every evening',
  QOD: 'every other day',
  Weekly: 'once a week',
}

export const ROUTES = [
  'Oral',
  'Sublingual',
  'Topical',
  'Intravenous',
  'Intramuscular',
  'Subcutaneous',
  'Inhalation',
  'Rectal',
  'Ophthalmic',
  'Otic',
  'Nasal',
] as const
