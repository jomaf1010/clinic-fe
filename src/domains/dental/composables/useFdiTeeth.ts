// FDI tooth-numbering helpers — used by the odontogram.
//
// Permanent: 11–18 (UR), 21–28 (UL), 31–38 (LL), 41–48 (LR)
// Primary:   51–55 (UR), 61–65 (UL), 71–75 (LL), 81–85 (LR)
//
// Layout for the chart is a 2×N grid (upper arch / lower arch), with
// teeth ordered from the patient's left to right (so the leftmost tooth
// shown is FDI 18 / 28 / 48 / 38 — clinically standard).

export const PERMANENT_UPPER_RIGHT = ['18', '17', '16', '15', '14', '13', '12', '11'] as const
export const PERMANENT_UPPER_LEFT = ['21', '22', '23', '24', '25', '26', '27', '28'] as const
export const PERMANENT_LOWER_LEFT = ['31', '32', '33', '34', '35', '36', '37', '38'] as const
export const PERMANENT_LOWER_RIGHT = ['48', '47', '46', '45', '44', '43', '42', '41'] as const

export const PRIMARY_UPPER_RIGHT = ['55', '54', '53', '52', '51'] as const
export const PRIMARY_UPPER_LEFT = ['61', '62', '63', '64', '65'] as const
export const PRIMARY_LOWER_LEFT = ['71', '72', '73', '74', '75'] as const
export const PRIMARY_LOWER_RIGHT = ['85', '84', '83', '82', '81'] as const

export const PERMANENT_UPPER = [...PERMANENT_UPPER_RIGHT, ...PERMANENT_UPPER_LEFT]
export const PERMANENT_LOWER = [...PERMANENT_LOWER_RIGHT, ...PERMANENT_LOWER_LEFT]
export const PRIMARY_UPPER = [...PRIMARY_UPPER_RIGHT, ...PRIMARY_UPPER_LEFT]
export const PRIMARY_LOWER = [...PRIMARY_LOWER_RIGHT, ...PRIMARY_LOWER_LEFT]

export const ALL_PERMANENT = [...PERMANENT_UPPER, ...PERMANENT_LOWER]
export const ALL_PRIMARY = [...PRIMARY_UPPER, ...PRIMARY_LOWER]

export function isPrimaryFdi(fdi: string): boolean {
  return ['5', '6', '7', '8'].includes(fdi[0] ?? '')
}

export function quadrantOf(fdi: string): 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | null {
  const q = parseInt(fdi[0] ?? '', 10)
  return q >= 1 && q <= 8 ? (q as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8) : null
}

// PSR sextants (general convention):
//   sextant_1 = upper right posterior (17-14)
//   sextant_2 = upper anterior (13-23)
//   sextant_3 = upper left posterior (24-27)
//   sextant_4 = lower left posterior (37-34)
//   sextant_5 = lower anterior (33-43)
//   sextant_6 = lower right posterior (44-47)
export const PSR_SEXTANTS = [
  { key: 'sextant_1' as const, label: 'UR Posterior', teeth: ['17', '16', '15', '14'] },
  { key: 'sextant_2' as const, label: 'Upper Anterior', teeth: ['13', '12', '11', '21', '22', '23'] },
  { key: 'sextant_3' as const, label: 'UL Posterior', teeth: ['24', '25', '26', '27'] },
  { key: 'sextant_4' as const, label: 'LL Posterior', teeth: ['37', '36', '35', '34'] },
  { key: 'sextant_5' as const, label: 'Lower Anterior', teeth: ['33', '32', '31', '41', '42', '43'] },
  { key: 'sextant_6' as const, label: 'LR Posterior', teeth: ['44', '45', '46', '47'] },
] as const

export type PsrSextantKey = typeof PSR_SEXTANTS[number]['key']

// ── Tooth-type metadata (for labels inside the center panel) ─────────────
export type ToothKind = 'Incisor' | 'Canine' | 'Premolar' | 'Molar'

const TOOTH_KIND: Record<string, ToothKind> = {}
function assign(fdis: number[], kind: ToothKind) {
  for (const n of fdis) TOOTH_KIND[String(n)] = kind
}
assign([11, 12, 21, 22, 31, 32, 41, 42], 'Incisor')
assign([13, 23, 33, 43], 'Canine')
assign([14, 15, 24, 25, 34, 35, 44, 45], 'Premolar')
assign([16, 17, 18, 26, 27, 28, 36, 37, 38, 46, 47, 48], 'Molar')
// Primary teeth reuse the same shape rules (5→8 quadrants map to permanent categories)
assign([51, 52, 61, 62, 71, 72, 81, 82], 'Incisor')
assign([53, 63, 73, 83], 'Canine')
assign([54, 55, 64, 65, 74, 75, 84, 85], 'Molar')

const QUADRANT_LABEL: Record<string, string> = {
  '1': 'Upper Right', '2': 'Upper Left', '3': 'Lower Left', '4': 'Lower Right',
  '5': 'Upper Right (primary)', '6': 'Upper Left (primary)',
  '7': 'Lower Left (primary)', '8': 'Lower Right (primary)',
}

export function toothKind(fdi: string): ToothKind {
  return TOOTH_KIND[fdi] ?? 'Molar'
}

export function toothLabel(fdi: string): string {
  const q = QUADRANT_LABEL[fdi[0] ?? ''] ?? ''
  return `${q} ${toothKind(fdi)}`.trim()
}

// ── Arch positioning (ported from notes/dental-chart.jsx) ────────────────
/**
 * Distribute teeth along an elliptical arc. `startAngle`/`endAngle` mirror
 * the original JSX (172° → 8°, right-to-left across the arch).
 */
export function getArchPositions(
  teeth: readonly string[],
  archCx: number,
  archCy: number,
  archRx: number,
  archRy: number,
  isUpper: boolean,
): Array<{ fdi: string; x: number; y: number }> {
  const count = teeth.length
  const startAngle = 172
  const endAngle = 8
  const out: Array<{ fdi: string; x: number; y: number }> = []
  for (let i = 0; i < count; i++) {
    const t = count > 1 ? i / (count - 1) : 0.5
    const angleDeg = startAngle + (endAngle - startAngle) * t
    const angleRad = (angleDeg * Math.PI) / 180
    const x = archCx + archRx * Math.cos(angleRad)
    const yBase = archRy * Math.sin(angleRad)
    const y = isUpper ? archCy + yBase : archCy - yBase
    out.push({ fdi: teeth[i]!, x, y })
  }
  return out
}

// Surface short-codes used for MOD/DOB etc.
export const SURFACE_CODES: Record<string, string> = {
  occlusal: 'O',
  mesial: 'M',
  distal: 'D',
  buccal: 'B',
  lingual: 'L',
}
export const SURFACES_ORDER = ['occlusal', 'mesial', 'distal', 'buccal', 'lingual'] as const
