/** The 6 standard vital keys that belong in the `vitals` API field (not `extended_vitals`). */
export const CORE_VITAL_KEYS = ['bp', 'hr', 'rr', 'temp', 'spo2', 'blood_sugar'] as const

/**
 * Split a flat `allVitals` record back into the `vitals` + `extended_vitals` shape
 * expected by the API. Keys in `coreKeys` go to `vitals`; the rest go to `extended_vitals`.
 */
export function splitVitalsForApi(
  allVitals: Record<string, string | number | null>,
  coreKeys: readonly string[],
): {
  vitals: Record<string, string | number | null>
  extended_vitals: Record<string, string | number | null>
} {
  const coreSet = new Set(coreKeys)
  const vitals: Record<string, string | number | null> = {}
  const extended_vitals: Record<string, string | number | null> = {}

  for (const [key, val] of Object.entries(allVitals)) {
    if (coreSet.has(key)) {
      vitals[key] = val
    } else {
      extended_vitals[key] = val
    }
  }

  return { vitals, extended_vitals }
}
