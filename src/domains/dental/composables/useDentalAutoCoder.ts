import { useDentalServices } from './useDentalServices'
import type {
  DentalServiceCatalogEntry,
  FillingMaterial,
  ToothSurface,
} from '../types/dental.types'

/**
 * Resolves a clinical intent (family + material + tooth + surfaces) to the
 * correct CDT code and the clinic's current fee. Mirrors Open Dental's
 * "Auto Codes" feature — surfaces pick the code, the code has the price.
 *
 * Usage:
 *   const { resolve } = useDentalAutoCoder()
 *   const hit = resolve({ family: 'filling', material: 'composite',
 *                         tooth: '16', surfaces: ['mesial','occlusal','distal'] })
 *   // hit.cdt_code === 'D2393', hit.clinic_price === <current fee>
 */

export type ProcedureFamily =
  | 'filling'
  | 'crown'
  | 'veneer'
  | 'rct'
  | 'rct_retreatment'
  | 'post_core'
  | 'extraction'
  | 'prophy'
  | 'fluoride'
  | 'sealant'
  | 'deep_clean'
  | 'srp'
  | 'gingivectomy'
  | 'denture_complete'
  | 'denture_partial'
  | 'bridge_pontic'
  | 'implant'
  | 'night_guard'

/**
 * CDT billing area for each family — drives the picker UI and the per-line
 * fan-out at add time:
 *
 *   tooth      → one line per tooth at full price (filling, crown, RCT…)
 *   quadrant   → one line per affected quadrant; D4341 vs D4342 picked
 *                from the per-quadrant tooth count (SRP, gingivectomy)
 *   arch       → one line per arch (complete/partial dentures)
 *   full_mouth → single line regardless of tooth involvement (prophy,
 *                fluoride, night guard, full-mouth debridement)
 */
export type ProcedureArea = 'tooth' | 'quadrant' | 'arch' | 'full_mouth'

const FAMILY_AREA: Record<ProcedureFamily, ProcedureArea> = {
  filling: 'tooth',
  crown: 'tooth',
  veneer: 'tooth',
  rct: 'tooth',
  rct_retreatment: 'tooth',
  post_core: 'tooth',
  extraction: 'tooth',
  sealant: 'tooth',
  bridge_pontic: 'tooth',
  implant: 'tooth',
  srp: 'quadrant',
  gingivectomy: 'quadrant',
  denture_complete: 'arch',
  // Partial dentures: the material variant (acrylic / flexible /
  // metal_upper / metal_lower) already encodes arch, so no separate
  // arch picker is needed — treat as a single-line procedure.
  denture_partial: 'full_mouth',
  prophy: 'full_mouth',
  fluoride: 'full_mouth',
  deep_clean: 'full_mouth',
  night_guard: 'full_mouth',
}

export function familyArea(family: ProcedureFamily): ProcedureArea {
  return FAMILY_AREA[family]
}

export type ExtractionKind = 'simple' | 'surgical' | 'soft_tissue' | 'partial_bony' | 'complete_bony' | 'residual_root'
export type CrownMaterialKey = 'resin' | 'metal' | 'pfm' | 'porcelain' | 'zircon' | 'emax' | 'temporary'
export type DentureKind = 'upper' | 'lower' | 'acrylic_partial' | 'flexible_partial' | 'metal_partial_upper' | 'metal_partial_lower'
export type SrpTeethInQuadrant = '1-3' | '4+'

export interface AutoCoderQuery {
  family: ProcedureFamily
  /** FDI number — used to infer anterior/premolar/molar and permanent/primary. */
  tooth?: string
  /** For surface-driven procedures (filling/sealant). */
  surfaces?: ToothSurface[]
  /** Material or variant modifier (e.g. 'composite', 'amalgam', 'zircon', 'surgical', 'child'). */
  material?: FillingMaterial | CrownMaterialKey | ExtractionKind | DentureKind | string
  /** SRP: teeth-in-quadrant bracket (selects D4341 vs D4342). */
  srpBracket?: SrpTeethInQuadrant
}

// ---- Tooth classification helpers (accept `t`-prefixed or plain FDI) ----

function fdiDigits(fdi: string): string {
  return fdi.startsWith('t') ? fdi.slice(1) : fdi
}

export function isAnteriorTooth(fdi?: string): boolean {
  if (!fdi) return false
  const pos = Number(fdiDigits(fdi)) % 10
  return pos >= 1 && pos <= 3
}

export function isPremolarTooth(fdi?: string): boolean {
  if (!fdi) return false
  const pos = Number(fdiDigits(fdi)) % 10
  return pos >= 4 && pos <= 5
}

export function isMolarTooth(fdi?: string): boolean {
  if (!fdi) return false
  const pos = Number(fdiDigits(fdi)) % 10
  return pos >= 6 && pos <= 8
}

export function isPrimaryTooth(fdi?: string): boolean {
  if (!fdi) return false
  const first = fdiDigits(fdi)[0] ?? ''
  return ['5', '6', '7', '8'].includes(first)
}

// ---- Code resolution ----

const AMALGAM_BY_COUNT = ['D2140', 'D2150', 'D2160', 'D2161'] as const
const COMPOSITE_ANTERIOR_BY_COUNT = ['D2330', 'D2331', 'D2332', 'D2335'] as const
const COMPOSITE_POSTERIOR_BY_COUNT = ['D2391', 'D2392', 'D2393', 'D2394'] as const

const CROWN_MATERIAL_CODES: Record<CrownMaterialKey, string> = {
  resin: 'D2710',
  metal: 'D2720',
  pfm: 'D2750',
  porcelain: 'D2740-P',
  zircon: 'D2740-Z',
  emax: 'D2740-E',
  temporary: 'D2799',
}

const EXTRACTION_CODES: Record<ExtractionKind, string> = {
  simple: 'D7140',
  surgical: 'D7210',
  soft_tissue: 'D7220',
  partial_bony: 'D7230',
  complete_bony: 'D7240',
  residual_root: 'D7250',
}

const DENTURE_CODES: Record<DentureKind, string> = {
  upper: 'D5110',
  lower: 'D5120',
  acrylic_partial: 'D5281',
  flexible_partial: 'D5225',
  metal_partial_upper: 'D5213',
  metal_partial_lower: 'D5214',
}

/**
 * Map surface count to the 4-bucket CDT table (1 / 2 / 3 / 4+).
 * Returns `null` when no surfaces were supplied — callers must pick at least
 * one surface for a filling before a code can be resolved.
 */
function surfaceBucket(surfaces: ToothSurface[] | undefined): 0 | 1 | 2 | 3 | null {
  const n = surfaces?.length ?? 0
  if (n === 0) return null
  if (n === 1) return 0
  if (n === 2) return 1
  if (n === 3) return 2
  return 3
}

export function resolveDentalCode(q: AutoCoderQuery): string | undefined {
  switch (q.family) {
    case 'filling': {
      const mat = (q.material ?? 'composite') as FillingMaterial
      if (mat === 'glass_ionomer' || mat === 'rmgi') return 'D2330-GIC'
      if (mat === 'temporary') return 'D2799'
      const bucket = surfaceBucket(q.surfaces)
      // Surface-driven materials require at least one surface to pick a code.
      if (bucket === null) return undefined
      if (mat === 'amalgam') return AMALGAM_BY_COUNT[bucket]
      if (mat === 'composite') {
        return isAnteriorTooth(q.tooth)
          ? COMPOSITE_ANTERIOR_BY_COUNT[bucket]
          : COMPOSITE_POSTERIOR_BY_COUNT[bucket]
      }
      return undefined
    }
    case 'crown': {
      const mat = (q.material ?? 'pfm') as CrownMaterialKey
      return CROWN_MATERIAL_CODES[mat]
    }
    case 'veneer': {
      if (q.material === 'porcelain') return 'D2962'
      return 'D2960'  // composite direct
    }
    case 'rct': {
      // RCT codes depend on tooth class; refuse to resolve without a tooth
      // rather than silently pricing as molar.
      if (!q.tooth) return undefined
      // Primary teeth use pulpal-therapy codes (D3230 anterior /
      // D3240 posterior) instead of full root-canal codes — distinct
      // billing and clinically pulpotomy-style. Without this branch the
      // resolver returned the adult anterior code D3310 for a primary
      // anterior tooth, which insurance rejects.
      if (isPrimaryTooth(q.tooth)) {
        return isAnteriorTooth(q.tooth) ? 'D3230' : 'D3240'
      }
      if (isAnteriorTooth(q.tooth)) return 'D3310'
      if (isPremolarTooth(q.tooth)) return 'D3320'
      if (isMolarTooth(q.tooth)) return 'D3330'
      return undefined
    }
    case 'rct_retreatment': {
      if (!q.tooth) return undefined
      // Primary teeth don't have a retreatment code — fall back to the
      // pulpal-therapy code clinically appropriate for the tooth.
      if (isPrimaryTooth(q.tooth)) {
        return isAnteriorTooth(q.tooth) ? 'D3230' : 'D3240'
      }
      if (isPremolarTooth(q.tooth)) return 'D3347'
      if (isMolarTooth(q.tooth)) return 'D3348'
      // Anterior retreat isn't a standalone code in our seeder;
      // fall back to anterior RCT pricing.
      if (isAnteriorTooth(q.tooth)) return 'D3310'
      return undefined
    }
    case 'post_core':
      return 'POST-CORE'
    case 'extraction': {
      const kind = (q.material ?? 'simple') as ExtractionKind
      return EXTRACTION_CODES[kind] ?? 'D7140'
    }
    case 'prophy':
      // Primary tooth or explicit `child` hint → pediatric prophy
      if (q.material === 'child' || isPrimaryTooth(q.tooth)) return 'D1120'
      return 'D1110'
    case 'fluoride':
      return 'D1206'
    case 'sealant':
      return 'D1351'
    case 'deep_clean':
      return 'D4355'
    case 'srp':
      return q.srpBracket === '1-3' ? 'D4342' : 'D4341'
    case 'gingivectomy':
      return 'D4210'
    case 'denture_complete': {
      const kind = (q.material ?? 'upper') as DentureKind
      return DENTURE_CODES[kind] ?? 'D5110'
    }
    case 'denture_partial': {
      const kind = (q.material ?? 'acrylic_partial') as DentureKind
      return DENTURE_CODES[kind] ?? 'D5281'
    }
    case 'bridge_pontic':
      return 'D6240'
    case 'implant':
      return 'D6010'
    case 'night_guard':
      return 'D9940'
    default:
      return undefined
  }
}

export function useDentalAutoCoder() {
  const { findByCode, ensureLoaded } = useDentalServices()

  function resolve(query: AutoCoderQuery): DentalServiceCatalogEntry | undefined {
    const code = resolveDentalCode(query)
    if (!code) return undefined
    return findByCode(code)
  }

  return { resolve, resolveCode: resolveDentalCode, ensureLoaded }
}
