import { computed, type Ref } from 'vue'
import { formatTooth, useToothNumbering, type ToothNumbering } from './useToothNumbering'
import type {
  StampedOdontogram,
  StampedToothState,
  PerioChart,
  PerioToothRecord,
  PerioPSR,
} from '../types/dental.types'

/**
 * Suggested diagnoses derived from the odontogram + perio chart. The dentist
 * still owns the diagnosis list (free-text) — these are tap-to-accept
 * suggestions that pre-fill an ICD-10 code, with no auto-application.
 *
 * Keep the rule-set conservative: prefer one general code per category over
 * many specific codes. Dentists who want fine-grained codes can edit after
 * accepting. The goal is "I don't have to remember K05.32" not "system
 * auto-codes everything correctly".
 */
export interface DiagnosisSuggestion {
  /** Stable id for v-for keying / dedup. Composed from category + qualifier. */
  id: string
  /** ICD-10 code. */
  code: string
  /** What gets typed into the diagnoses textarea on accept. */
  description: string
  /** Optional list of FDIs that contributed — surfaced in tooltip. */
  teeth?: number[]
}

const CARIES_SURFACES = ['mesial', 'occlusal', 'distal', 'buccal', 'lingual', 'incisal'] as const

function teethList(arr: number[], numbering: ToothNumbering): string {
  if (arr.length === 0) return ''
  const labels = arr.map((fdi) => formatTooth(fdi, numbering))
  if (arr.length === 1) return `tooth #${labels[0]}`
  return `${arr.length} teeth (${labels.join(', ')})`
}

function hasAnySurface(map: Record<string, unknown> | null | undefined): boolean {
  if (!map) return false
  return CARIES_SURFACES.some((s) => map[s] != null)
}

function maxPdFor(rec: PerioToothRecord | null | undefined): number {
  if (!rec) return 0
  const all = [...(rec.facial ?? []), ...(rec.lingual ?? [])]
  let max = 0
  for (const p of all) {
    const pd = p?.pd
    if (typeof pd === 'number' && pd > max) max = pd
  }
  return max
}

function bopCountFor(rec: PerioToothRecord | null | undefined): number {
  if (!rec) return 0
  const all = [...(rec.facial ?? []), ...(rec.lingual ?? [])]
  return all.filter((p) => p?.bop).length
}

export function suggestDentalDiagnoses(
  odontogram: StampedOdontogram | null | undefined,
  perio: PerioChart | null | undefined,
  psr: PerioPSR | null | undefined = null,
  numbering: ToothNumbering = 'fdi',
): DiagnosisSuggestion[] {
  const suggestions: DiagnosisSuggestion[] = []
  const teethByCategory: Record<string, number[]> = {
    caries: [],
    cariesSevere: [],
    pulpitis: [],
    apicalContained: [],
    apicalFistula: [],
    fracture: [],
    missing: [],
    mobility: [],
    implant: [],
    bruxismOcclusal: [],
    bruxismCervical: [],
  }

  for (const [rawFdi, t] of Object.entries(odontogram ?? {})) {
    if (!t) continue
    const fdi = Number(rawFdi.startsWith('t') ? rawFdi.slice(1) : rawFdi)
    if (!Number.isFinite(fdi)) continue
    const tooth = t as StampedToothState

    if (hasAnySurface(tooth.caries as Record<string, unknown> | null | undefined)) {
      teethByCategory.caries!.push(fdi)
      // Escalate to a deeper code (penetrating dentin) when any surface is
      // marked severe — matches what the dentist already recorded on chart.
      const cariesMap = tooth.caries as Record<string, { severity?: string } | undefined> | undefined
      if (cariesMap && Object.values(cariesMap).some((c) => c?.severity === 'severe')) {
        teethByCategory.cariesSevere!.push(fdi)
      }
    }
    if (tooth.pulpitis) teethByCategory.pulpitis!.push(fdi)
    if (tooth.fracture) teethByCategory.fracture!.push(fdi)
    if (tooth.missing) teethByCategory.missing!.push(fdi)
    if (tooth.base === 'implant') teethByCategory.implant!.push(fdi)

    const brux = tooth.bruxism?.variant
    if (brux === 'wear' || brux === 'both') teethByCategory.bruxismOcclusal!.push(fdi)
    if (brux === 'neck-wear' || brux === 'both') teethByCategory.bruxismCervical!.push(fdi)

    for (const m of tooth.mods ?? []) {
      if (m?.kind === 'inflammation-inside') teethByCategory.apicalContained!.push(fdi)
      if (m?.kind === 'inflammation-outside') teethByCategory.apicalFistula!.push(fdi)
      if (m?.kind === 'mobility') teethByCategory.mobility!.push(fdi)
    }
  }

  if (teethByCategory.caries!.length > 0) {
    const t = teethByCategory.caries!.sort((a, b) => a - b)
    const severeTeeth = teethByCategory.cariesSevere!.sort((a, b) => a - b)
    if (severeTeeth.length > 0) {
      // K02.61 = caries on smooth surface penetrating into dentin (Phil
      // dentists rarely split anterior/posterior at this level — the
      // chart's surface mix already implies that distinction).
      suggestions.push({
        id: 'k02-61',
        code: 'K02.61',
        description: `Caries penetrating into dentin — ${teethList(severeTeeth, numbering)}`,
        teeth: severeTeeth,
      })
    }
    // Show the general K02.9 for any non-severe affected teeth so a mix of
    // severities still surfaces both codes (matches how perio splits gingivitis
    // vs periodontitis when both are clinically present).
    const nonSevere = t.filter((fdi) => !severeTeeth.includes(fdi))
    if (nonSevere.length > 0) {
      suggestions.push({
        id: 'k02',
        code: 'K02.9',
        description: `Dental caries — ${teethList(nonSevere, numbering)}`,
        teeth: nonSevere,
      })
    }
  }
  if (teethByCategory.pulpitis!.length > 0) {
    const t = teethByCategory.pulpitis!.sort((a, b) => a - b)
    suggestions.push({
      id: 'k04-0',
      code: 'K04.0',
      description: `Pulpitis — ${teethList(t, numbering)}`,
      teeth: t,
    })
  }
  if (teethByCategory.apicalContained!.length > 0) {
    const t = teethByCategory.apicalContained!.sort((a, b) => a - b)
    suggestions.push({
      id: 'k04-5',
      code: 'K04.5',
      description: `Chronic apical periodontitis — ${teethList(t, numbering)}`,
      teeth: t,
    })
  }
  if (teethByCategory.apicalFistula!.length > 0) {
    const t = teethByCategory.apicalFistula!.sort((a, b) => a - b)
    suggestions.push({
      id: 'k04-6',
      code: 'K04.6',
      description: `Periapical abscess with sinus — ${teethList(t, numbering)}`,
      teeth: t,
    })
  }
  if (teethByCategory.fracture!.length > 0) {
    const t = teethByCategory.fracture!.sort((a, b) => a - b)
    suggestions.push({
      id: 'k03-81',
      code: 'K03.81',
      description: `Cracked tooth — ${teethList(t, numbering)}`,
      teeth: t,
    })
  }
  if (teethByCategory.missing!.length > 0) {
    const t = teethByCategory.missing!.sort((a, b) => a - b)
    // K08.401 = partial loss of teeth, unspecified cause; the count drives
    // localised vs generalised wording but the code stays the same.
    suggestions.push({
      id: 'k08',
      code: 'K08.401',
      description: `Loss of teeth — ${teethList(t, numbering)}`,
      teeth: t,
    })
  }
  if (teethByCategory.mobility!.length > 0) {
    const t = teethByCategory.mobility!.sort((a, b) => a - b)
    // Look up the max mobility grade across affected teeth. perio chart
    // keys may be `t`-prefixed; check both shapes.
    let maxGrade = 0
    for (const fdi of t) {
      const rec = perio?.[String(fdi)] ?? perio?.[`t${fdi}`]
      const g = rec?.mobility ?? 0
      if (g > maxGrade) maxGrade = g
    }
    const roman: Record<number, string> = { 1: 'I', 2: 'II', 3: 'III' }
    const gradePart = maxGrade > 0 ? `Grade ${roman[maxGrade] ?? maxGrade} ` : ''
    suggestions.push({
      id: 'k08-81',
      code: 'K08.81',
      description: `Primary occlusal trauma — ${gradePart}mobility on ${teethList(t, numbering)}`,
      teeth: t,
    })
  }
  if (teethByCategory.bruxismOcclusal!.length > 0) {
    const t = teethByCategory.bruxismOcclusal!.sort((a, b) => a - b)
    suggestions.push({
      id: 'k03-0',
      code: 'K03.0',
      description: `Excessive attrition of teeth — ${teethList(t, numbering)}`,
      teeth: t,
    })
  }
  if (teethByCategory.bruxismCervical!.length > 0) {
    const t = teethByCategory.bruxismCervical!.sort((a, b) => a - b)
    suggestions.push({
      id: 'k03-1',
      code: 'K03.1',
      description: `Abrasion of teeth — ${teethList(t, numbering)}`,
      teeth: t,
    })
  }
  if (teethByCategory.implant!.length > 0) {
    const t = teethByCategory.implant!.sort((a, b) => a - b)
    suggestions.push({
      id: 'z96-5',
      code: 'Z96.5',
      description: `Presence of dental implant — ${teethList(t, numbering)}`,
      teeth: t,
    })
  }

  // ── Periodontal ──────────────────────────────────────────────────────
  let perioMaxPd = 0
  let perioBopTotal = 0
  const perioInvolvedTeeth: number[] = []
  for (const [rawFdi, rec] of Object.entries(perio ?? {})) {
    if (!rec) continue
    const fdi = Number(rawFdi.startsWith('t') ? rawFdi.slice(1) : rawFdi)
    if (!Number.isFinite(fdi)) continue
    const max = maxPdFor(rec)
    const bop = bopCountFor(rec)
    if (max >= 4 || bop > 0) perioInvolvedTeeth.push(fdi)
    if (max > perioMaxPd) perioMaxPd = max
    perioBopTotal += bop
  }
  perioInvolvedTeeth.sort((a, b) => a - b)
  const involvedQual = perioInvolvedTeeth.length >= 8 ? 'generalised' : 'localised'

  if (perioMaxPd >= 6) {
    suggestions.push({
      id: 'k05-33',
      code: 'K05.33',
      description: `Chronic periodontitis, severe (${involvedQual}) — max PD ${perioMaxPd}mm`,
      teeth: perioInvolvedTeeth,
    })
  } else if (perioMaxPd >= 4) {
    suggestions.push({
      id: 'k05-32',
      code: 'K05.32',
      description: `Chronic periodontitis, moderate (${involvedQual}) — max PD ${perioMaxPd}mm`,
      teeth: perioInvolvedTeeth,
    })
  } else if (perioBopTotal > 0) {
    suggestions.push({
      id: 'k05-10',
      code: 'K05.10',
      description: `Chronic gingivitis, plaque-induced — ${perioBopTotal} bleeding site${perioBopTotal === 1 ? '' : 's'}`,
      teeth: perioInvolvedTeeth,
    })
  } else if (psr) {
    // PSR-only fallback: when the dentist hasn't done a full 6-point chart
    // but has scored sextants, the PSR codes drive the suggestion. PSR ≥3
    // implies subgingival calculus + likely BOP; PSR 4 implies clinical
    // attachment loss = periodontitis. Deduplicate by always choosing the
    // most severe code present across all six sextants.
    const sextantValues = [
      psr.sextant_1, psr.sextant_2, psr.sextant_3,
      psr.sextant_4, psr.sextant_5, psr.sextant_6,
    ].filter((v): v is number => typeof v === 'number')
    const maxSextant = sextantValues.length ? Math.max(...sextantValues) : 0
    if (maxSextant >= 4) {
      suggestions.push({
        id: 'k05-32-psr',
        code: 'K05.32',
        description: `Chronic periodontitis, moderate — PSR ${maxSextant} (no full chart recorded)`,
      })
    } else if (maxSextant === 3) {
      suggestions.push({
        id: 'k05-10-psr',
        code: 'K05.10',
        description: `Chronic gingivitis with calculus — PSR 3`,
      })
    }
  }

  return suggestions
}

/**
 * Reactive wrapper: feed it the rendered odontogram, perio chart, and PSR
 * refs and get a `computed` of suggestions that re-derives whenever
 * findings — or the active numbering preference — change.
 */
export function useDentalDiagnosisSuggestions(
  odontogram: Ref<StampedOdontogram | null | undefined>,
  perio: Ref<PerioChart | null | undefined>,
  psr?: Ref<PerioPSR | null | undefined>,
) {
  const { numbering } = useToothNumbering()
  return computed(() => suggestDentalDiagnoses(
    odontogram.value,
    perio.value,
    psr?.value,
    numbering.value,
  ))
}
