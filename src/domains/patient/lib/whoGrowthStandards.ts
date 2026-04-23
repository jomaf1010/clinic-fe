// WHO Child Growth Standards — LMS tables and computation
// Ported from the iOS implementation. Math: LMS method (Box-Cox power transformation).
// Age range: 0–60 months. Checkpoints: 23 per table.

export type GrowthMetric = 'weight' | 'height' | 'headCircumference'
export type PatientSex = 'male' | 'female'

interface LMSEntry {
  ageMonths: number
  l: number
  m: number
  s: number
}

// ── Raw LMS tables ─────────────────────────────────────────────────────────────

const WEIGHT_BOYS: LMSEntry[] = [
  { ageMonths: 0, l: 0.3487, m: 3.3464, s: 0.14602 },
  { ageMonths: 1, l: 0.2297, m: 4.4709, s: 0.13395 },
  { ageMonths: 2, l: 0.1970, m: 5.5675, s: 0.12385 },
  { ageMonths: 3, l: 0.1738, m: 6.3762, s: 0.11727 },
  { ageMonths: 4, l: 0.1553, m: 7.0023, s: 0.11316 },
  { ageMonths: 5, l: 0.1395, m: 7.5105, s: 0.10977 },
  { ageMonths: 6, l: 0.1257, m: 7.9340, s: 0.10680 },
  { ageMonths: 7, l: 0.1134, m: 8.2970, s: 0.10457 },
  { ageMonths: 8, l: 0.1022, m: 8.6151, s: 0.10248 },
  { ageMonths: 9, l: 0.0919, m: 8.9014, s: 0.10065 },
  { ageMonths: 10, l: 0.0823, m: 9.1649, s: 0.09894 },
  { ageMonths: 11, l: 0.0732, m: 9.4122, s: 0.09736 },
  { ageMonths: 12, l: 0.0647, m: 9.6479, s: 0.09592 },
  { ageMonths: 15, l: 0.0375, m: 10.3357, s: 0.09269 },
  { ageMonths: 18, l: 0.0124, m: 10.9341, s: 0.09012 },
  { ageMonths: 21, l: -0.0106, m: 11.4803, s: 0.08840 },
  { ageMonths: 24, l: -0.0317, m: 12.0110, s: 0.08711 },
  { ageMonths: 30, l: -0.0694, m: 13.0341, s: 0.08576 },
  { ageMonths: 36, l: -0.1009, m: 14.0122, s: 0.08527 },
  { ageMonths: 42, l: -0.1277, m: 14.9458, s: 0.08511 },
  { ageMonths: 48, l: -0.1510, m: 15.8537, s: 0.08519 },
  { ageMonths: 54, l: -0.1716, m: 16.7460, s: 0.08542 },
  { ageMonths: 60, l: -0.1902, m: 17.6275, s: 0.08576 },
]

const WEIGHT_GIRLS: LMSEntry[] = [
  { ageMonths: 0, l: 0.3809, m: 3.2322, s: 0.14171 },
  { ageMonths: 1, l: 0.1714, m: 4.1873, s: 0.13724 },
  { ageMonths: 2, l: 0.0962, m: 5.1282, s: 0.13000 },
  { ageMonths: 3, l: 0.0402, m: 5.8458, s: 0.12619 },
  { ageMonths: 4, l: -0.0050, m: 6.4237, s: 0.12306 },
  { ageMonths: 5, l: -0.0430, m: 6.8985, s: 0.12036 },
  { ageMonths: 6, l: -0.0756, m: 7.2981, s: 0.11820 },
  { ageMonths: 7, l: -0.1039, m: 7.6422, s: 0.11636 },
  { ageMonths: 8, l: -0.1288, m: 7.9487, s: 0.11473 },
  { ageMonths: 9, l: -0.1507, m: 8.2254, s: 0.11340 },
  { ageMonths: 10, l: -0.1700, m: 8.4800, s: 0.11218 },
  { ageMonths: 11, l: -0.1872, m: 8.7192, s: 0.11117 },
  { ageMonths: 12, l: -0.2025, m: 8.9481, s: 0.11020 },
  { ageMonths: 15, l: -0.2391, m: 9.5363, s: 0.10817 },
  { ageMonths: 18, l: -0.2693, m: 10.0859, s: 0.10656 },
  { ageMonths: 21, l: -0.2942, m: 10.6073, s: 0.10517 },
  { ageMonths: 24, l: -0.3144, m: 11.1211, s: 0.10385 },
  { ageMonths: 30, l: -0.3468, m: 12.1142, s: 0.10161 },
  { ageMonths: 36, l: -0.3727, m: 13.0911, s: 0.10005 },
  { ageMonths: 42, l: -0.3931, m: 14.0362, s: 0.09940 },
  { ageMonths: 48, l: -0.4093, m: 14.9674, s: 0.09954 },
  { ageMonths: 54, l: -0.4219, m: 15.8879, s: 0.10018 },
  { ageMonths: 60, l: -0.4318, m: 16.7970, s: 0.10113 },
]

const HEIGHT_BOYS: LMSEntry[] = [
  { ageMonths: 0, l: 1, m: 49.8842, s: 0.03795 },
  { ageMonths: 1, l: 1, m: 54.7244, s: 0.03557 },
  { ageMonths: 2, l: 1, m: 58.4249, s: 0.03424 },
  { ageMonths: 3, l: 1, m: 61.4292, s: 0.03328 },
  { ageMonths: 4, l: 1, m: 63.8860, s: 0.03257 },
  { ageMonths: 5, l: 1, m: 65.9026, s: 0.03204 },
  { ageMonths: 6, l: 1, m: 67.6236, s: 0.03165 },
  { ageMonths: 7, l: 1, m: 69.1645, s: 0.03139 },
  { ageMonths: 8, l: 1, m: 70.5994, s: 0.03117 },
  { ageMonths: 9, l: 1, m: 71.9819, s: 0.03101 },
  { ageMonths: 10, l: 1, m: 73.2812, s: 0.03084 },
  { ageMonths: 11, l: 1, m: 74.5388, s: 0.03068 },
  { ageMonths: 12, l: 1, m: 75.7488, s: 0.03055 },
  { ageMonths: 15, l: 1, m: 79.1214, s: 0.03029 },
  { ageMonths: 18, l: 1, m: 82.3432, s: 0.03022 },
  { ageMonths: 21, l: 1, m: 85.1470, s: 0.03013 },
  { ageMonths: 24, l: 1, m: 87.8161, s: 0.03293 },
  { ageMonths: 30, l: 1, m: 92.9523, s: 0.03293 },
  { ageMonths: 36, l: 1, m: 96.1092, s: 0.03293 },
  { ageMonths: 42, l: 1, m: 99.0866, s: 0.03293 },
  { ageMonths: 48, l: 1, m: 101.9124, s: 0.03293 },
  { ageMonths: 54, l: 1, m: 104.5995, s: 0.03293 },
  { ageMonths: 60, l: 1, m: 107.1605, s: 0.03293 },
]

const HEIGHT_GIRLS: LMSEntry[] = [
  { ageMonths: 0, l: 1, m: 49.1477, s: 0.03790 },
  { ageMonths: 1, l: 1, m: 53.6872, s: 0.03600 },
  { ageMonths: 2, l: 1, m: 57.0673, s: 0.03530 },
  { ageMonths: 3, l: 1, m: 59.8029, s: 0.03431 },
  { ageMonths: 4, l: 1, m: 62.0899, s: 0.03390 },
  { ageMonths: 5, l: 1, m: 64.0301, s: 0.03350 },
  { ageMonths: 6, l: 1, m: 65.7311, s: 0.03320 },
  { ageMonths: 7, l: 1, m: 67.2873, s: 0.03294 },
  { ageMonths: 8, l: 1, m: 68.7498, s: 0.03274 },
  { ageMonths: 9, l: 1, m: 70.1435, s: 0.03252 },
  { ageMonths: 10, l: 1, m: 71.4818, s: 0.03234 },
  { ageMonths: 11, l: 1, m: 72.7710, s: 0.03218 },
  { ageMonths: 12, l: 1, m: 74.0150, s: 0.03204 },
  { ageMonths: 15, l: 1, m: 77.4670, s: 0.03170 },
  { ageMonths: 18, l: 1, m: 80.7476, s: 0.03155 },
  { ageMonths: 21, l: 1, m: 83.7044, s: 0.03140 },
  { ageMonths: 24, l: 1, m: 86.4153, s: 0.03343 },
  { ageMonths: 30, l: 1, m: 91.4907, s: 0.03343 },
  { ageMonths: 36, l: 1, m: 95.1165, s: 0.03343 },
  { ageMonths: 42, l: 1, m: 98.6239, s: 0.03343 },
  { ageMonths: 48, l: 1, m: 101.9971, s: 0.03343 },
  { ageMonths: 54, l: 1, m: 105.2336, s: 0.03343 },
  { ageMonths: 60, l: 1, m: 108.3434, s: 0.03343 },
]

const HC_BOYS: LMSEntry[] = [
  { ageMonths: 0, l: 1, m: 34.4618, s: 0.03686 },
  { ageMonths: 1, l: 1, m: 37.2759, s: 0.03133 },
  { ageMonths: 2, l: 1, m: 39.1285, s: 0.02997 },
  { ageMonths: 3, l: 1, m: 40.5135, s: 0.02918 },
  { ageMonths: 4, l: 1, m: 41.6317, s: 0.02861 },
  { ageMonths: 5, l: 1, m: 42.5623, s: 0.02829 },
  { ageMonths: 6, l: 1, m: 43.3306, s: 0.02808 },
  { ageMonths: 7, l: 1, m: 43.9749, s: 0.02794 },
  { ageMonths: 8, l: 1, m: 44.5157, s: 0.02783 },
  { ageMonths: 9, l: 1, m: 44.9782, s: 0.02776 },
  { ageMonths: 10, l: 1, m: 45.3767, s: 0.02773 },
  { ageMonths: 11, l: 1, m: 45.7195, s: 0.02771 },
  { ageMonths: 12, l: 1, m: 46.0193, s: 0.02770 },
  { ageMonths: 15, l: 1, m: 46.6629, s: 0.02770 },
  { ageMonths: 18, l: 1, m: 47.1765, s: 0.02776 },
  { ageMonths: 21, l: 1, m: 47.5901, s: 0.02786 },
  { ageMonths: 24, l: 1, m: 47.9313, s: 0.02803 },
  { ageMonths: 30, l: 1, m: 48.4413, s: 0.02842 },
  { ageMonths: 36, l: 1, m: 48.8401, s: 0.02880 },
  { ageMonths: 42, l: 1, m: 49.1594, s: 0.02916 },
  { ageMonths: 48, l: 1, m: 49.4216, s: 0.02950 },
  { ageMonths: 54, l: 1, m: 49.6437, s: 0.02982 },
  { ageMonths: 60, l: 1, m: 49.8384, s: 0.03012 },
]

const HC_GIRLS: LMSEntry[] = [
  { ageMonths: 0, l: 1, m: 33.8787, s: 0.03496 },
  { ageMonths: 1, l: 1, m: 36.5463, s: 0.03114 },
  { ageMonths: 2, l: 1, m: 38.3016, s: 0.02993 },
  { ageMonths: 3, l: 1, m: 39.5328, s: 0.02947 },
  { ageMonths: 4, l: 1, m: 40.5168, s: 0.02920 },
  { ageMonths: 5, l: 1, m: 41.3164, s: 0.02903 },
  { ageMonths: 6, l: 1, m: 41.9844, s: 0.02893 },
  { ageMonths: 7, l: 1, m: 42.5448, s: 0.02888 },
  { ageMonths: 8, l: 1, m: 43.0207, s: 0.02884 },
  { ageMonths: 9, l: 1, m: 43.4279, s: 0.02882 },
  { ageMonths: 10, l: 1, m: 43.7837, s: 0.02883 },
  { ageMonths: 11, l: 1, m: 44.0947, s: 0.02886 },
  { ageMonths: 12, l: 1, m: 44.3680, s: 0.02890 },
  { ageMonths: 15, l: 1, m: 44.9321, s: 0.02905 },
  { ageMonths: 18, l: 1, m: 45.3792, s: 0.02927 },
  { ageMonths: 21, l: 1, m: 45.7338, s: 0.02953 },
  { ageMonths: 24, l: 1, m: 46.0235, s: 0.02980 },
  { ageMonths: 30, l: 1, m: 46.4534, s: 0.03038 },
  { ageMonths: 36, l: 1, m: 46.7817, s: 0.03093 },
  { ageMonths: 42, l: 1, m: 47.0391, s: 0.03146 },
  { ageMonths: 48, l: 1, m: 47.2519, s: 0.03196 },
  { ageMonths: 54, l: 1, m: 47.4338, s: 0.03242 },
  { ageMonths: 60, l: 1, m: 47.5925, s: 0.03284 },
]

// ── Table lookup ───────────────────────────────────────────────────────────────

function tableFor(sex: PatientSex, metric: GrowthMetric): LMSEntry[] {
  if (metric === 'weight') return sex === 'male' ? WEIGHT_BOYS : WEIGHT_GIRLS
  if (metric === 'height') return sex === 'male' ? HEIGHT_BOYS : HEIGHT_GIRLS
  return sex === 'male' ? HC_BOYS : HC_GIRLS
}

// ── Normal inverse (Beasley-Springer-Moro rational approximation) ─────────────

export function normalInverse(p: number): number {
  const a = [2.515517, 0.802853, 0.010328]
  const b = [1.432788, 0.189269, 0.001308]

  function rational(t: number): number {
    return t - (a[0]! + t * (a[1]! + t * a[2]!)) / (1 + t * (b[0]! + t * (b[1]! + t * b[2]!)))
  }

  if (p <= 0 || p >= 1) return NaN
  if (p < 0.5) {
    const t = Math.sqrt(-2 * Math.log(p))
    return -rational(t)
  } else {
    const t = Math.sqrt(-2 * Math.log(1 - p))
    return rational(t)
  }
}

// ── Linear interpolation between two LMS checkpoints ─────────────────────────

export function interpolatedLMS(
  ageMonths: number,
  sex: PatientSex,
  metric: GrowthMetric,
): { l: number; m: number; s: number } | null {
  const table = tableFor(sex, metric)

  // Clamp to range
  const first = table[0]
  const last = table[table.length - 1]
  if (!first || !last || ageMonths < first.ageMonths || ageMonths > last.ageMonths) {
    return null
  }

  // Exact match
  const exact = table.find((e) => e.ageMonths === ageMonths)
  if (exact) return { l: exact.l, m: exact.m, s: exact.s }

  // Find bracketing entries
  let lower: LMSEntry | undefined
  let upper: LMSEntry | undefined
  for (let i = 0; i < table.length - 1; i++) {
    const lo = table[i]!
    const hi = table[i + 1]!
    if (lo.ageMonths <= ageMonths && hi.ageMonths >= ageMonths) {
      lower = lo
      upper = hi
      break
    }
  }

  if (!lower || !upper) return null

  const span = upper.ageMonths - lower.ageMonths
  const t = (ageMonths - lower.ageMonths) / span

  return {
    l: lower.l + t * (upper.l - lower.l),
    m: lower.m + t * (upper.m - lower.m),
    s: lower.s + t * (upper.s - lower.s),
  }
}

// ── Value at a given percentile for age/sex/metric ────────────────────────────

export function valueAtPercentile(
  percentile: number,
  ageMonths: number,
  sex: PatientSex,
  metric: GrowthMetric,
): number | null {
  const lms = interpolatedLMS(ageMonths, sex, metric)
  if (!lms) return null

  const { l, m, s } = lms
  const z = normalInverse(percentile / 100)

  if (Math.abs(l) < 1e-6) {
    // l ≈ 0: use log-normal
    return m * Math.exp(s * z)
  }
  return m * Math.pow(1 + l * s * z, 1 / l)
}

// ── Generate a sampled percentile curve for ECharts ───────────────────────────
// Returns [ageMonths, value][] sampled every 0.5 months from 0 to 60.

export function percentileCurve(
  percentile: number,
  sex: PatientSex,
  metric: GrowthMetric,
): Array<[number, number]> {
  const points: Array<[number, number]> = []
  for (let age = 0; age <= 60; age += 0.5) {
    const val = valueAtPercentile(percentile, age, sex, metric)
    if (val !== null) {
      points.push([parseFloat(age.toFixed(1)), parseFloat(val.toFixed(3))])
    }
  }
  return points
}
