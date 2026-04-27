import { computed, type Ref } from 'vue'
import type {
  StampedToothState,
  PerioChart,
  PerioToothRecord,
} from '../types/dental.types'

/**
 * Single source of truth for "does this tooth have any meaningful finding
 * recorded in THIS visit?". Used by both the sidebar Session findings
 * summary and the Plan-tab teeth picker so the two views never disagree.
 *
 * A tooth qualifies when its delta carries at least one non-trivial leaf,
 * OR its perio_chart entry has any populated field. `__remove` sentinels
 * and the default `base: 'tooth'` value don't count — they're either the
 * absence of a finding or the absence of a change.
 */

const SURFACE_FIELDS = ['mesial', 'distal', 'occlusal', 'buccal', 'lingual', 'incisal'] as const

function isRemoval(v: unknown): boolean {
  return !!(v && typeof v === 'object' && (v as { __remove?: boolean }).__remove === true)
}

function hasAnyLiveSurface(map: unknown): boolean {
  if (!map || typeof map !== 'object') return false
  for (const k of SURFACE_FIELDS) {
    const leaf = (map as Record<string, unknown>)[k]
    if (leaf == null) continue
    if (isRemoval(leaf)) continue
    return true
  }
  return false
}

function hasLiveListEntry(list: unknown): boolean {
  if (!Array.isArray(list)) return false
  // Collapse by kind so a `__remove` later in the list cancels an earlier
  // real entry (matches OdontogramMergeService semantics on the backend).
  const map = new Map<string, boolean>()
  for (const e of list) {
    if (!e || typeof e !== 'object') continue
    const kind = (e as { kind?: string }).kind
    if (!kind) continue
    map.set(kind, !((e as { __remove?: boolean }).__remove === true))
  }
  for (const live of map.values()) if (live) return true
  return false
}

export function hasMeaningfulDelta(delta: Partial<StampedToothState> | null | undefined): boolean {
  if (!delta) return false

  // Surface maps
  if (hasAnyLiveSurface(delta.caries)) return true
  if (hasAnyLiveSurface(delta.fillings)) return true
  if (hasAnyLiveSurface(delta.sealants)) return true

  // Scalar leaves
  for (const f of ['crown', 'endo', 'post', 'fracture', 'pulpitis', 'bruxism', 'implant', 'bridge', 'missing'] as const) {
    const v = (delta as Record<string, unknown>)[f]
    if (v == null) continue
    if (isRemoval(v)) continue
    return true
  }

  // Lists
  if (hasLiveListEntry(delta.mods)) return true
  if (hasLiveListEntry(delta.specials)) return true

  // Notes
  if (delta.notes != null && String(delta.notes).trim() !== '') return true

  // Base — only counts as a finding when it's not the default tooth type.
  // Switching to milktooth or implant is real signal; `tooth` isn't.
  if (delta.base === 'milktooth' || delta.base === 'implant') return true

  return false
}

export function hasMeaningfulPerio(rec: PerioToothRecord | null | undefined): boolean {
  if (!rec) return false
  for (const face of [rec.facial, rec.lingual]) {
    if (!Array.isArray(face)) continue
    for (const p of face) {
      if (p?.pd != null) return true
      if (p?.bop) return true
    }
  }
  return (rec.mobility ?? 0) > 0
}

/**
 * Reactive set of FDIs whose deltas (or perio chart entries) carry real
 * content this visit. Iterates both maps so a tooth probed only on the
 * full perio chart still surfaces.
 */
export function useDentalSessionFindings(
  delta: Ref<Record<string, Partial<StampedToothState>> | null | undefined>,
  perio: Ref<PerioChart | null | undefined>,
) {
  const findingFdis = computed<Set<number>>(() => {
    const s = new Set<number>()
    const deltaMap = delta.value ?? {}
    const perioMap = perio.value ?? {}

    // Helper: strip the `t` prefix BSON-encoded keys carry on the wire.
    const toFdi = (raw: string): number | null => {
      const stripped = raw.startsWith('t') ? raw.slice(1) : raw
      const n = Number(stripped)
      return Number.isFinite(n) ? n : null
    }

    for (const [k, v] of Object.entries(deltaMap)) {
      if (!hasMeaningfulDelta(v)) continue
      const fdi = toFdi(k)
      if (fdi != null) s.add(fdi)
    }
    for (const [k, v] of Object.entries(perioMap)) {
      if (!hasMeaningfulPerio(v)) continue
      const fdi = toFdi(k)
      if (fdi != null) s.add(fdi)
    }
    return s
  })

  return { findingFdis }
}
