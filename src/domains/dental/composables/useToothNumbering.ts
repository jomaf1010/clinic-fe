import { computed } from 'vue'
import { useAuthStore } from '@/domains/auth/stores/authStore'

/**
 * Display-only tooth numbering preference. Persistence (odontogram_delta,
 * perio_chart, dental profile, etc.) ALWAYS uses FDI / ISO-3950 — this
 * composable only controls how the numbers are rendered.
 *
 * Effective preference is layered:
 *
 *   user.preferences.tooth_numbering   (dentist override; Account → Preferences)
 *     ↓ falls through if null
 *   clinic.settings.tooth_numbering    (clinic-wide default; Clinic Settings → Specialties)
 *     ↓ falls through if null
 *   'fdi'                              (international default)
 *
 * Writes happen on the dedicated settings pages — this composable is
 * read-only.
 */
export type ToothNumbering = 'fdi' | 'universal' | 'palmer'

// ── FDI → Universal Numbering System ────────────────────────────────
const FDI_TO_UNIVERSAL_PERMANENT: Record<number, string> = {
  18: '1',  17: '2',  16: '3',  15: '4',  14: '5',  13: '6',  12: '7',  11: '8',
  21: '9',  22: '10', 23: '11', 24: '12', 25: '13', 26: '14', 27: '15', 28: '16',
  38: '17', 37: '18', 36: '19', 35: '20', 34: '21', 33: '22', 32: '23', 31: '24',
  41: '25', 42: '26', 43: '27', 44: '28', 45: '29', 46: '30', 47: '31', 48: '32',
}

const FDI_TO_UNIVERSAL_PRIMARY: Record<number, string> = {
  55: 'A', 54: 'B', 53: 'C', 52: 'D', 51: 'E',
  61: 'F', 62: 'G', 63: 'H', 64: 'I', 65: 'J',
  75: 'K', 74: 'L', 73: 'M', 72: 'N', 71: 'O',
  81: 'P', 82: 'Q', 83: 'R', 84: 'S', 85: 'T',
}

function fdiToPalmer(fdi: number): string {
  const q = Math.floor(fdi / 10)
  const t = fdi % 10
  const quadrant: Record<number, string> = {
    1: 'UR', 2: 'UL', 3: 'LL', 4: 'LR',
    5: 'UR', 6: 'UL', 7: 'LL', 8: 'LR',
  }
  const prefix = quadrant[q]
  if (!prefix || t < 1 || t > 8) return String(fdi)
  const isPrimary = q >= 5 && q <= 8
  if (isPrimary) {
    if (t < 1 || t > 5) return String(fdi)
    const letter = String.fromCharCode('A'.charCodeAt(0) + (t - 1))
    return `${prefix}${letter}`
  }
  return `${prefix}${t}`
}

function fdiToUniversal(fdi: number): string {
  return FDI_TO_UNIVERSAL_PERMANENT[fdi] ?? FDI_TO_UNIVERSAL_PRIMARY[fdi] ?? String(fdi)
}

export function formatTooth(fdi: number, system: ToothNumbering): string {
  if (!Number.isFinite(fdi)) return String(fdi)
  switch (system) {
    case 'universal': return fdiToUniversal(fdi)
    case 'palmer':    return fdiToPalmer(fdi)
    default:          return String(fdi)
  }
}

// ── Inverse: parse user input (in active system) back to FDI ────────
const UNIVERSAL_PERMANENT_TO_FDI: Record<string, number> = Object.fromEntries(
  Object.entries(FDI_TO_UNIVERSAL_PERMANENT).map(([fdi, us]) => [us, Number(fdi)]),
)
const UNIVERSAL_PRIMARY_TO_FDI: Record<string, number> = Object.fromEntries(
  Object.entries(FDI_TO_UNIVERSAL_PRIMARY).map(([fdi, letter]) => [letter, Number(fdi)]),
)

const PALMER_QUADRANT_PERMANENT: Record<string, number> = { UR: 1, UL: 2, LL: 3, LR: 4 }
const PALMER_QUADRANT_PRIMARY:   Record<string, number> = { UR: 5, UL: 6, LL: 7, LR: 8 }

function palmerToFdi(input: string): number | null {
  const m = input.toUpperCase().match(/^(UR|UL|LL|LR)([1-8A-E])$/)
  if (!m) return null
  const prefix = m[1] as keyof typeof PALMER_QUADRANT_PERMANENT
  const t = m[2]!
  if (/[A-E]/.test(t)) {
    const pos = t.charCodeAt(0) - 64 // A=1, …, E=5
    const q = PALMER_QUADRANT_PRIMARY[prefix]
    return q != null ? q * 10 + pos : null
  }
  const pos = parseInt(t, 10)
  if (pos < 1 || pos > 8) return null
  const q = PALMER_QUADRANT_PERMANENT[prefix]
  return q != null ? q * 10 + pos : null
}

/**
 * Parse a single user-typed tooth label into its FDI numeric value.
 * Accepts the active `system`; returns `null` for unparseable tokens so the
 * caller can show validation errors or skip them quietly.
 */
export function parseToothInput(input: string, system: ToothNumbering): number | null {
  const s = input.trim()
  if (!s) return null
  if (system === 'fdi') {
    const n = parseInt(s, 10)
    return Number.isInteger(n) && n >= 11 && n <= 85 ? n : null
  }
  if (system === 'universal') {
    const upper = s.toUpperCase()
    if (UNIVERSAL_PRIMARY_TO_FDI[upper] != null) return UNIVERSAL_PRIMARY_TO_FDI[upper]
    // Strip leading zeros so "08" matches the lookup key "8". Without
    // this the picker silently rejected zero-padded input.
    const numeric = s.replace(/^0+(?=\d)/, '')
    return UNIVERSAL_PERMANENT_TO_FDI[numeric] ?? null
  }
  return palmerToFdi(s)
}

export function useToothNumbering() {
  const auth = useAuthStore()

  const numbering = computed<ToothNumbering>(() => {
    const userPref = auth.user?.preferences?.tooth_numbering ?? null
    if (userPref) return userPref
    const clinicPref = auth.currentClinic?.settings?.tooth_numbering ?? null
    if (clinicPref) return clinicPref
    return 'fdi'
  })

  function format(fdi: number): string {
    return formatTooth(fdi, numbering.value)
  }

  return { numbering, format }
}
