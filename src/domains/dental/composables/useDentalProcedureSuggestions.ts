import { computed, type Ref } from 'vue'
import { useDentalAutoCoder, type ProcedureFamily } from './useDentalAutoCoder'
import type {
  StampedOdontogram,
  StampedToothState,
  PerioChart,
  PerioToothRecord,
  PerioPSR,
  ToothSurface,
} from '../types/dental.types'

/**
 * Suggests likely procedures based on chart findings, mirroring the
 * diagnosis suggestions rail. Each suggestion either pre-fills the
 * auto-coder form (when the dentist still needs to pick material/etc) or
 * is ready to add directly (when no further input is required).
 *
 * Standard mappings used:
 *   - Caries          → Filling (surface count drives the code; composite default)
 *   - Pulpitis        → Root canal (irreversible-pulpitis-style assumption)
 *   - Apical inflam.  → Root canal (first-line for K04.5 / K04.6)
 *   - Cracked tooth   → Crown (often with RCT, but suggest crown alone)
 *   - Extraction plan → Extraction (simple kind default; user can upgrade)
 *   - Crown needed/   → Crown
 *     Crown replace
 *   - Bruxism         → Night guard
 *   - Periodontitis   → SRP per quadrant (D4341 vs D4342 by tooth count)
 *   - Gingivitis only → Prophylaxis
 *
 * Missing teeth deliberately don't generate suggestions — the prosthetic
 * choice (implant vs bridge vs denture) is a clinical-judgment call too
 * patient-specific to auto-suggest.
 */

export interface ProcedureSuggestion {
  /** Stable id for v-for keying. */
  id: string
  family: ProcedureFamily
  /** Short label shown on the chip ("Filling MOD"). */
  label: string
  /** Plain-language reason ("MOD caries on #16"), used for the tooltip. */
  reason: string
  /** ICD-10/CDT code if predictable; null if it depends on choices the
   *  dentist still needs to make (e.g. crown material). */
  code: string | null
  /** Pre-resolved price when the code is determined and the catalog has
   *  it; null otherwise. */
  price: number | null
  /** What gets loaded into the auto-coder form on accept. */
  prefill: {
    family: ProcedureFamily
    material?: string
    teeth?: number[]
    surfaces?: ToothSurface[]
    arches?: ('upper' | 'lower')[]
  }
  /** When true, the suggestion adds a procedure directly without leaving
   *  the dentist on the form. False means "pre-fill the form, dentist
   *  picks remaining options before clicking Add". */
  canAutoAdd: boolean
}

const SURFACE_FIELDS: ToothSurface[] = ['mesial', 'distal', 'occlusal', 'buccal', 'lingual', 'incisal']

function isRemoval(v: unknown): boolean {
  return !!(v && typeof v === 'object' && (v as { __remove?: boolean }).__remove === true)
}

function liveSurfaces(map: unknown): ToothSurface[] {
  if (!map || typeof map !== 'object') return []
  const out: ToothSurface[] = []
  for (const s of SURFACE_FIELDS) {
    const leaf = (map as Record<string, unknown>)[s]
    if (leaf == null) continue
    if (isRemoval(leaf)) continue
    out.push(s)
  }
  return out
}

function maxPdFor(rec: PerioToothRecord | null | undefined): number {
  if (!rec) return 0
  let max = 0
  for (const face of [rec.facial, rec.lingual]) {
    if (!Array.isArray(face)) continue
    for (const p of face) {
      const pd = p?.pd
      if (typeof pd === 'number' && pd > max) max = pd
    }
  }
  return max
}

function bopCountFor(rec: PerioToothRecord | null | undefined): number {
  if (!rec) return 0
  let n = 0
  for (const face of [rec.facial, rec.lingual]) {
    if (!Array.isArray(face)) continue
    for (const p of face) if (p?.bop) n++
  }
  return n
}

function fdiToFdiNum(raw: string): number | null {
  const stripped = raw.startsWith('t') ? raw.slice(1) : raw
  const n = Number(stripped)
  return Number.isFinite(n) ? n : null
}

function hasMod(tooth: StampedToothState, kind: string): boolean {
  // Kind-collapse honoring `__remove` (matches OdontogramMergeService).
  const map = new Map<string, boolean>()
  for (const m of tooth.mods ?? []) {
    if (!m?.kind) continue
    map.set(m.kind, !((m as { __remove?: boolean }).__remove === true))
  }
  return map.get(kind) === true
}

function hasSpecial(tooth: StampedToothState, kind: string): boolean {
  const map = new Map<string, boolean>()
  for (const s of tooth.specials ?? []) {
    if (!s?.kind) continue
    map.set(s.kind, !((s as { __remove?: boolean }).__remove === true))
  }
  return map.get(kind) === true
}

function surfaceShorthand(surfaces: ToothSurface[]): string {
  // Anterior teeth use 'I' for incisal, posterior use 'O'. The caller
  // already filtered to one tooth, so we just compose initials.
  const order: ToothSurface[] = ['mesial', 'occlusal', 'incisal', 'distal', 'buccal', 'lingual']
  return order
    .filter((s) => surfaces.includes(s))
    .map((s) => {
      if (s === 'occlusal') return 'O'
      if (s === 'incisal') return 'I'
      return s.charAt(0).toUpperCase()
    })
    .join('')
}

const FILLING_AUTO_ADD = false  // material can default to composite, but
// the user said "don't auto-create when material still needs picking" —
// so we pre-fill only.
const CROWN_AUTO_ADD = false  // material is a real decision (PFM vs zircon vs e.max)

const FAMILIES_THAT_AUTO_ADD = new Set<ProcedureFamily>([
  'rct',           // tooth class drives code; nothing else to pick
  'rct_retreatment',
  'extraction',    // default 'simple' is the modal case
  'prophy',        // full mouth, single code
  'fluoride',
  'deep_clean',
  'night_guard',
  'sealant',
  'post_core',
])

function familyAutoAdds(family: ProcedureFamily): boolean {
  if (family === 'filling' && FILLING_AUTO_ADD) return true
  if (family === 'crown' && CROWN_AUTO_ADD) return true
  return FAMILIES_THAT_AUTO_ADD.has(family)
}

export function useDentalProcedureSuggestions(
  odontogram: Ref<StampedOdontogram | null | undefined>,
  perio: Ref<PerioChart | null | undefined>,
  psr: Ref<PerioPSR | null | undefined>,
) {
  const { resolve, resolveCode } = useDentalAutoCoder()

  const suggestions = computed<ProcedureSuggestion[]>(() => {
    const out: ProcedureSuggestion[] = []
    const og = odontogram.value ?? {}
    const pc = perio.value ?? {}

    // ── Per-tooth findings ─────────────────────────────────────────────
    for (const [rawKey, t] of Object.entries(og)) {
      if (!t) continue
      const fdi = fdiToFdiNum(rawKey)
      if (fdi == null) continue
      const tooth = t as StampedToothState

      // Caries → Filling, surfaces pre-filled, composite default.
      const cariesSurfs = liveSurfaces(tooth.caries)
      if (cariesSurfs.length > 0) {
        const material = 'composite'
        const codeCandidate = resolveCode({
          family: 'filling',
          material,
          tooth: String(fdi),
          surfaces: cariesSurfs,
        })
        const resolved = resolve({
          family: 'filling',
          material,
          tooth: String(fdi),
          surfaces: cariesSurfs,
        })
        out.push({
          id: `filling-${fdi}-${cariesSurfs.join('')}`,
          family: 'filling',
          label: `Filling ${surfaceShorthand(cariesSurfs)} #${fdi}`,
          reason: `${surfaceShorthand(cariesSurfs)} caries on tooth #${fdi}`,
          code: codeCandidate ?? null,
          price: resolved?.clinic_price ?? resolved?.default_price ?? null,
          prefill: {
            family: 'filling',
            material,
            teeth: [fdi],
            surfaces: cariesSurfs,
          },
          canAutoAdd: familyAutoAdds('filling'),
        })
      }

      // Pulpitis → RCT (irreversible pulpitis-style first-line treatment).
      if (tooth.pulpitis) {
        const code = resolveCode({ family: 'rct', tooth: String(fdi) })
        const resolved = resolve({ family: 'rct', tooth: String(fdi) })
        out.push({
          id: `rct-pulp-${fdi}`,
          family: 'rct',
          label: `RCT #${fdi}`,
          reason: `Pulpitis on tooth #${fdi} → root canal therapy`,
          code: code ?? null,
          price: resolved?.clinic_price ?? resolved?.default_price ?? null,
          prefill: { family: 'rct', teeth: [fdi] },
          canAutoAdd: familyAutoAdds('rct'),
        })
      }

      // Apical periodontitis (contained or fistula) → RCT.
      const hasApical = hasMod(tooth, 'inflammation-inside') || hasMod(tooth, 'inflammation-outside')
      // Skip duplicate when pulpitis already produced an RCT suggestion.
      if (hasApical && !tooth.pulpitis) {
        const code = resolveCode({ family: 'rct', tooth: String(fdi) })
        const resolved = resolve({ family: 'rct', tooth: String(fdi) })
        const fistula = hasMod(tooth, 'inflammation-outside')
        out.push({
          id: `rct-apical-${fdi}`,
          family: 'rct',
          label: `RCT #${fdi}`,
          reason: fistula
            ? `Periapical abscess with sinus on #${fdi} → root canal therapy`
            : `Chronic apical periodontitis on #${fdi} → root canal therapy`,
          code: code ?? null,
          price: resolved?.clinic_price ?? resolved?.default_price ?? null,
          prefill: { family: 'rct', teeth: [fdi] },
          canAutoAdd: familyAutoAdds('rct'),
        })
      }

      // Fracture → Crown (cracked tooth typically needs full coverage).
      if (tooth.fracture) {
        out.push({
          id: `crown-fracture-${fdi}`,
          family: 'crown',
          label: `Crown #${fdi}`,
          reason: `Cracked tooth on #${fdi} → full coverage crown`,
          code: null,
          price: null,
          prefill: { family: 'crown', teeth: [fdi] },
          canAutoAdd: familyAutoAdds('crown'),
        })
      }

      // Extraction plan special → Extraction.
      if (hasSpecial(tooth, 'extraction-plan')) {
        const material = 'simple'
        const code = resolveCode({ family: 'extraction', material })
        const resolved = resolve({ family: 'extraction', material })
        out.push({
          id: `extraction-${fdi}`,
          family: 'extraction',
          label: `Extraction #${fdi}`,
          reason: `Extraction planned on #${fdi}`,
          code: code ?? null,
          price: resolved?.clinic_price ?? resolved?.default_price ?? null,
          prefill: { family: 'extraction', material, teeth: [fdi] },
          canAutoAdd: familyAutoAdds('extraction'),
        })
      }

      // Crown needed / replace specials → Crown.
      const crownNeeded = hasSpecial(tooth, 'crown-needed')
      const crownReplace = hasSpecial(tooth, 'crown-replace')
      // Skip duplicate when fracture already produced a crown suggestion.
      if ((crownNeeded || crownReplace) && !tooth.fracture) {
        out.push({
          id: `crown-flag-${fdi}`,
          family: 'crown',
          label: `Crown #${fdi}`,
          reason: crownReplace
            ? `Crown replace planned on #${fdi}`
            : `Crown needed on #${fdi}`,
          code: null,
          price: null,
          prefill: {
            family: 'crown',
            // Carry forward the existing crown's material when replacing,
            // so the dentist sees the previous choice as the default.
            material: crownReplace ? tooth.crown?.material : undefined,
            teeth: [fdi],
          },
          canAutoAdd: familyAutoAdds('crown'),
        })
      }
    }

    // Bruxism → single Night guard suggestion (any tooth qualifies).
    const hasBruxism = Object.values(og).some(
      (t) => (t as StampedToothState | null | undefined)?.bruxism != null
        && !isRemoval((t as { bruxism?: unknown }).bruxism),
    )
    if (hasBruxism) {
      const resolved = resolve({ family: 'night_guard' })
      out.push({
        id: 'night-guard',
        family: 'night_guard',
        label: 'Night guard',
        reason: 'Bruxism / attrition recorded → occlusal guard',
        code: 'D9940',
        price: resolved?.clinic_price ?? resolved?.default_price ?? null,
        prefill: { family: 'night_guard' },
        canAutoAdd: familyAutoAdds('night_guard'),
      })
    }

    // ── Periodontal ────────────────────────────────────────────────────
    const perioMaxPd = (() => {
      let max = 0
      for (const rec of Object.values(pc)) {
        const m = maxPdFor(rec as PerioToothRecord)
        if (m > max) max = m
      }
      return max
    })()

    if (perioMaxPd >= 4) {
      // Group affected teeth (PD ≥4) into one SRP suggestion that
      // pre-selects them all. Add fan-out (D4341 vs D4342 by quadrant
      // tooth count) happens in the view's existing draft-line logic.
      const affected: number[] = []
      for (const [k, rec] of Object.entries(pc)) {
        const max = maxPdFor(rec as PerioToothRecord)
        if (max < 4) continue
        const fdi = fdiToFdiNum(k)
        if (fdi != null) affected.push(fdi)
      }
      affected.sort((a, b) => a - b)
      out.push({
        id: 'srp',
        family: 'srp',
        label: `SRP · ${affected.length} ${affected.length === 1 ? 'tooth' : 'teeth'}`,
        reason: `Periodontitis (max PD ${perioMaxPd}mm) → scaling & root planing`,
        // Code unknown until quadrant tooth count is computed at add time.
        code: null,
        price: null,
        prefill: { family: 'srp', teeth: affected },
        canAutoAdd: familyAutoAdds('srp'),
      })
    } else {
      // BOP without deep PD → plaque-induced gingivitis → prophylaxis.
      let totalBop = 0
      for (const rec of Object.values(pc)) totalBop += bopCountFor(rec as PerioToothRecord)
      if (totalBop > 0) {
        const resolved = resolve({ family: 'prophy' })
        out.push({
          id: 'prophy-gingivitis',
          family: 'prophy',
          label: 'Prophylaxis',
          reason: `Gingival bleeding (${totalBop} site${totalBop === 1 ? '' : 's'}) → prophylaxis`,
          code: 'D1110',
          price: resolved?.clinic_price ?? resolved?.default_price ?? null,
          prefill: { family: 'prophy', material: 'adult' },
          canAutoAdd: familyAutoAdds('prophy'),
        })
      } else if (psr.value) {
        // PSR fallback when no full perio chart entries.
        const sextants = [
          psr.value.sextant_1, psr.value.sextant_2, psr.value.sextant_3,
          psr.value.sextant_4, psr.value.sextant_5, psr.value.sextant_6,
        ].filter((v): v is number => typeof v === 'number')
        const maxPsr = sextants.length ? Math.max(...sextants) : 0
        if (maxPsr >= 4) {
          out.push({
            id: 'srp-psr',
            family: 'srp',
            label: 'SRP',
            reason: `PSR ${maxPsr} → scaling & root planing`,
            code: null,
            price: null,
            prefill: { family: 'srp' },
            canAutoAdd: false,
          })
        } else if (maxPsr === 3) {
          const resolved = resolve({ family: 'prophy' })
          out.push({
            id: 'prophy-psr',
            family: 'prophy',
            label: 'Prophylaxis',
            reason: `PSR 3 (calculus) → prophylaxis`,
            code: 'D1110',
            price: resolved?.clinic_price ?? resolved?.default_price ?? null,
            prefill: { family: 'prophy', material: 'adult' },
            canAutoAdd: familyAutoAdds('prophy'),
          })
        }
      }
    }

    return out
  })

  return { suggestions }
}

