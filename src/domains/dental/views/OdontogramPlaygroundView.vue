<script setup lang="ts">
/**
 * Odontogram playground — 1:1 port of ZoliQua's React Odontogram Modul to Vue.
 * Public, no auth. Lives at /odontogram. Used to iterate on the dental chart UX
 * before wiring it into the real dentist flow (DentalVisitView).
 *
 * SVG assets + the group-id contract ship under MIT from ZoliQua — see
 * ../assets/teeth-svgs/ATTRIBUTION.md.
 */
import { computed, onMounted, ref, watch } from 'vue'
import {
  Flame,
  Zap,
  X,
  Scissors,
  Crown,
  Stethoscope,
  MoreHorizontal,
  Circle,
  Activity,
} from 'lucide-vue-next'

import type { TreatmentStatus } from '../types/dental.types'
import tooth11Raw from '../assets/teeth-svgs/11.svg?raw'
import tooth11OcclRaw from '../assets/teeth-svgs/11_occl.svg?raw'
import tooth13Raw from '../assets/teeth-svgs/13.svg?raw'
import tooth13OcclRaw from '../assets/teeth-svgs/13_occl.svg?raw'
import tooth14Raw from '../assets/teeth-svgs/14.svg?raw'
import tooth14OcclRaw from '../assets/teeth-svgs/14_occl.svg?raw'
import tooth16Raw from '../assets/teeth-svgs/16.svg?raw'
import tooth16OcclRaw from '../assets/teeth-svgs/16_occl.svg?raw'

// ---------- FDI template mapping (ported from ZoliQua odontogram.ts:30-51) ----------
type TemplateKey = 11 | 13 | 14 | 16
type ToothTemplate = { tpl: TemplateKey; rot: 0 | 180; mirror: boolean }

const TOOTH_TEMPLATE: Record<number, ToothTemplate> = {
  11: { tpl: 11, rot: 0, mirror: false }, 12: { tpl: 11, rot: 0, mirror: false },
  21: { tpl: 11, rot: 0, mirror: true }, 22: { tpl: 11, rot: 0, mirror: true },
  31: { tpl: 11, rot: 180, mirror: false }, 32: { tpl: 11, rot: 180, mirror: false },
  41: { tpl: 11, rot: 180, mirror: true }, 42: { tpl: 11, rot: 180, mirror: true },
  13: { tpl: 13, rot: 0, mirror: false }, 23: { tpl: 13, rot: 0, mirror: true },
  33: { tpl: 13, rot: 180, mirror: false }, 43: { tpl: 13, rot: 180, mirror: true },
  14: { tpl: 14, rot: 0, mirror: false }, 15: { tpl: 14, rot: 0, mirror: false },
  24: { tpl: 14, rot: 0, mirror: true }, 25: { tpl: 14, rot: 0, mirror: true },
  34: { tpl: 14, rot: 180, mirror: false }, 35: { tpl: 14, rot: 180, mirror: false },
  44: { tpl: 14, rot: 180, mirror: true }, 45: { tpl: 14, rot: 180, mirror: true },
  16: { tpl: 16, rot: 0, mirror: false }, 17: { tpl: 16, rot: 0, mirror: false }, 18: { tpl: 16, rot: 0, mirror: false },
  26: { tpl: 16, rot: 0, mirror: true }, 27: { tpl: 16, rot: 0, mirror: true }, 28: { tpl: 16, rot: 0, mirror: true },
  36: { tpl: 16, rot: 180, mirror: false }, 37: { tpl: 16, rot: 180, mirror: false }, 38: { tpl: 16, rot: 180, mirror: false },
  46: { tpl: 16, rot: 180, mirror: true }, 47: { tpl: 16, rot: 180, mirror: true }, 48: { tpl: 16, rot: 180, mirror: true },
}

const TEMPLATE_BUCCAL: Record<TemplateKey, string> = { 11: tooth11Raw, 13: tooth13Raw, 14: tooth14Raw, 16: tooth16Raw }
const TEMPLATE_OCCL: Partial<Record<TemplateKey, string>> = { 11: tooth11OcclRaw, 13: tooth13OcclRaw, 14: tooth14OcclRaw, 16: tooth16OcclRaw }

const UPPER = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28]
const LOWER = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38]

// ---------- State ----------
type Surface = 'mesial' | 'distal' | 'occlusal' | 'buccal' | 'lingual'
type FillingMaterial = 'amalgam' | 'composite' | 'gic' | 'temporary'
type ToothBase = 'tooth' | 'milktooth' | 'missing' | 'implant'

type CrownMat = 'zircon' | 'metal' | 'emax' | 'temporary' | 'telescope'
type EndoState = 'endo-filling' | 'endo-filling-incomplete' | 'endo-resection'
type FractureVariant =
  | 'mesial'
  | 'distal'
  | 'inicisal'
  | 'mesial-distal'
  | 'mesial-inicisal'
  | 'distal-inicisal'
  | 'mesial-distal-inicisal'
type BruxismVariant = 'wear' | 'neck-wear' | 'both'
type PostVariant = 'glass' | 'metal'
type ImplantStage = 'base' | 'healing-abutment' | 'bar' | 'locator-screw'
type BridgeMat = 'zircon' | 'metal' | 'telescope' | 'temporary' | 'prosthesis'
type BridgeRole = 'abutment' | 'pontic'

type ToothState = {
  treatment: TreatmentStatus
  base: ToothBase
  caries: Set<Surface>
  cariesSubcrown: boolean
  fillings: Map<Surface, FillingMaterial>
  sealant: boolean // fissure sealing on occlusal
  crown: CrownMat | null
  endo: EndoState | null
  post: PostVariant | null
  parapulpalPin: boolean
  pulpitis: boolean
  fracture: FractureVariant | null
  bruxism: BruxismVariant | null
  crownPrep: boolean
  underGum: boolean
  radix: boolean
  extractionSocket: boolean // no-tooth-after-extraction
  noContact: { mesial: boolean; distal: boolean }
  implantStage: ImplantStage | null // only meaningful when base === 'implant'
  bridge: { material: BridgeMat; role: BridgeRole } | null
  mods: Set<'inflammation' | 'inflammation-inside' | 'inflammation-outside' | 'mobility'>
  specials: Set<'missing-closed' | 'extraction-plan' | 'crown-needed' | 'crown-replace'>
  notes: string
}

function makeDefault(): ToothState {
  return {
    treatment: 'existing',
    base: 'tooth',
    caries: new Set(),
    cariesSubcrown: false,
    fillings: new Map(),
    sealant: false,
    crown: null,
    endo: null,
    post: null,
    parapulpalPin: false,
    pulpitis: false,
    fracture: null,
    bruxism: null,
    crownPrep: false,
    underGum: false,
    radix: false,
    extractionSocket: false,
    noContact: { mesial: false, distal: false },
    implantStage: null,
    bridge: null,
    mods: new Set(),
    specials: new Set(),
    notes: '',
  }
}

const toothState = ref<Map<number, ToothState>>(new Map())
const activeTooth = ref<number | null>(null)
const selected = ref<Set<number>>(new Set())
const hoveredTooth = ref<number | null>(null) // syncs hover across chart + perio

// Playground tri-state is fixed at `existing` — real app derives status from
// DentalProfile (existing) + DentalTreatmentPlan (proposed) + current
// DentalVisit (completed). The manual mode dial is gone.
const treatmentMode = ref<TreatmentStatus>('existing')

// ---------- Quick actions (floating panel: always-on caries wheel + context bar) ----------
type ContextExpansion = 'fracture' | 'crown' | null

const wheelOpen = ref(false)
const expansion = ref<ContextExpansion>(null)
const wheelPos = ref<{ x: number; y: number }>({ x: 0, y: 0 })
const hoveredSlot = ref<string | null>(null)
const anchoredCell = ref<HTMLElement | null>(null)

type WheelSlot = {
  key: string
  label: string
  full: string
  angle: number // degrees, clockwise from 12 o'clock
  action: () => void
  isPressed: () => boolean
}

function computePanelPos(cellRect: DOMRect) {
  const panelW = 248
  const panelH = 320
  const gap = 8
  // Vertical center aligned to the cell — no top clamp so panel truly follows tooth.
  let x = cellRect.right + gap
  const y = cellRect.top + cellRect.height / 2 - panelH / 2
  if (x + panelW > window.innerWidth - 16) {
    x = cellRect.left - panelW - gap
  }
  return { x, y }
}

function isCellInView(cellRect: DOMRect): boolean {
  // Consider cell "in view" if any vertical part of it overlaps the viewport.
  return cellRect.bottom > 0 && cellRect.top < window.innerHeight
}

function openWheelAt(cell: HTMLElement) {
  anchoredCell.value = cell
  wheelPos.value = computePanelPos(cell.getBoundingClientRect())
  wheelOpen.value = true
  expansion.value = null
}

function reanchor() {
  if (!wheelOpen.value || !anchoredCell.value) return
  if (!document.body.contains(anchoredCell.value)) return
  const rect = anchoredCell.value.getBoundingClientRect()
  if (!isCellInView(rect)) {
    closeWheel()
    return
  }
  wheelPos.value = computePanelPos(rect)
}

function closeWheel() {
  wheelOpen.value = false
  expansion.value = null
  hoveredSlot.value = null
  anchoredCell.value = null
}

function toggleExpansion(which: ContextExpansion) {
  expansion.value = expansion.value === which ? null : which
}

// SVG wedge path (ring segment) from start to end angle, in the wheel's local coords
function polarXY(r: number, angleDeg: number) {
  // 0° = top (12 o'clock), growing clockwise
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: r * Math.cos(rad), y: r * Math.sin(rad) }
}

function wedgePath(startDeg: number, endDeg: number, rOut: number, rIn: number): string {
  const p1 = polarXY(rOut, startDeg)
  const p2 = polarXY(rOut, endDeg)
  const p3 = polarXY(rIn, endDeg)
  const p4 = polarXY(rIn, startDeg)
  return `M ${p1.x} ${p1.y} A ${rOut} ${rOut} 0 0 1 ${p2.x} ${p2.y} L ${p3.x} ${p3.y} A ${rIn} ${rIn} 0 0 0 ${p4.x} ${p4.y} Z`
}

const WHEEL_SLOTS_FACE = 30 // half-width of a slot in degrees (so each slot spans 60°)

const cariesSlots = computed<WheelSlot[]>(() => {
  const anterior = isAnterior(activeTooth.value)
  const edgeLabel = anterior ? 'I' : 'O'
  const edgeFull = anterior ? 'Incisal' : 'Occlusal'
  const surfaces: Array<{ key: Surface | 'close'; label: string; full: string; angle: number }> = [
    { key: 'mesial', label: 'M', full: 'Mesial', angle: 0 },
    { key: 'occlusal', label: edgeLabel, full: edgeFull, angle: 60 },
    { key: 'distal', label: 'D', full: 'Distal', angle: 120 },
    { key: 'buccal', label: 'B', full: anterior ? 'Labial' : 'Buccal', angle: 180 },
    { key: 'lingual', label: 'L', full: 'Lingual', angle: 240 },
    { key: 'close', label: '×', full: 'Close', angle: 300 },
  ]
  return surfaces.map((s) => ({
    key: s.key,
    label: s.label,
    full: s.full,
    angle: s.angle,
    action: s.key === 'close' ? () => closeWheel() : () => toggleCaries(s.key as Surface),
    isPressed: s.key === 'close' ? () => false : () => activeState.value?.caries.has(s.key as Surface) ?? false,
  }))
})

// Context bar below the wheel — single-click toggles + expandable items
type ContextItem = {
  key: string
  label: string
  iconName: 'Zap' | 'X' | 'Scissors' | 'Crown' | 'Circle' | 'Activity' | 'Flame'
  gradient: string // Tailwind gradient classes, e.g. 'from-red-500 to-orange-500'
  expands: ContextExpansion // null = instant toggle
  isPressed: () => boolean
  run: () => void
}

const contextItems = computed<ContextItem[]>(() => [
  {
    key: 'fracture',
    label: 'Broken',
    iconName: 'Zap',
    gradient: 'from-red-500 to-orange-500',
    expands: 'fracture',
    isPressed: () => activeState.value?.fracture != null,
    run: () => toggleExpansion('fracture'),
  },
  {
    key: 'crown',
    label: 'Crown',
    iconName: 'Crown',
    gradient: 'from-amber-400 to-yellow-500',
    expands: 'crown',
    isPressed: () => activeState.value?.crown != null,
    run: () => toggleExpansion('crown'),
  },
  {
    key: 'missing',
    label: 'Miss',
    iconName: 'X',
    gradient: 'from-slate-500 to-slate-600',
    expands: null,
    isPressed: () => activeState.value?.specials.has('missing-closed') ?? false,
    run: () => toggleSpecial('missing-closed'),
  },
  {
    key: 'extract',
    label: 'Extract',
    iconName: 'Scissors',
    gradient: 'from-violet-500 to-purple-500',
    expands: null,
    isPressed: () => activeState.value?.specials.has('extraction-plan') ?? false,
    run: () => toggleSpecial('extraction-plan'),
  },
  {
    key: 'pulpitis',
    label: 'Pulp',
    iconName: 'Flame',
    gradient: 'from-pink-500 to-rose-500',
    expands: null,
    isPressed: () => activeState.value?.pulpitis ?? false,
    run: () => togglePulpitis(),
  },
])

const iconMap = { Flame, Zap, X, Scissors, Crown, Stethoscope, Circle, MoreHorizontal, Activity }
function iconFor(name: ContextItem['iconName']) {
  return iconMap[name]
}

const isCariesSlotHovered = computed(
  () => hoveredSlot.value != null && !hoveredSlot.value.startsWith('ctx-'),
)

// Anterior FDI positions 1-3 have an incisal edge (biting edge); 4-8 are posterior with an occlusal surface.
function isAnterior(fdi: number | null): boolean {
  if (fdi == null) return false
  const pos = fdi % 10
  return pos >= 1 && pos <= 3
}

// Sub-option lists (shown when an expandable context item is active).
// Labels adapt to the active tooth: anteriors show "I" (Incisal), posteriors show "O" (Occlusal).
const fractureVariants = computed<Array<{ key: FractureVariant; label: string }>>(() => {
  const edge = isAnterior(activeTooth.value) ? 'I' : 'O'
  return [
    { key: 'mesial', label: 'M' },
    { key: 'mesial-inicisal', label: `M+${edge}` },
    { key: 'inicisal', label: edge },
    { key: 'distal-inicisal', label: `${edge}+D` },
    { key: 'distal', label: 'D' },
    { key: 'mesial-distal', label: 'M+D' },
    { key: 'mesial-distal-inicisal', label: 'ALL' },
  ]
})
const crownMaterials: Array<{ key: CrownMat; label: string }> = [
  { key: 'zircon', label: 'Zircon' },
  { key: 'metal', label: 'Metal' },
  { key: 'emax', label: 'e.max' },
  { key: 'temporary', label: 'Temp' },
  { key: 'telescope', label: 'Tele' },
]

// ---------- Perio (6-point pocket chart) ----------
type PerioPoint = { pd: number | null; bop: boolean }
type PerioFace = [PerioPoint, PerioPoint, PerioPoint] // M, mid, D
type PerioState = {
  facial: PerioFace  // MB, B, DB for upper; MB, B, DB for lower (buccal side)
  lingual: PerioFace // ML, L/P, DL
  mobilityGrade: 0 | 1 | 2 | 3
}
function makePerioDefault(): PerioState {
  return {
    facial: [{ pd: null, bop: false }, { pd: null, bop: false }, { pd: null, bop: false }],
    lingual: [{ pd: null, bop: false }, { pd: null, bop: false }, { pd: null, bop: false }],
    mobilityGrade: 0,
  }
}
const perioState = ref<Map<number, PerioState>>(new Map())
function getPerio(fdi: number): PerioState {
  let p = perioState.value.get(fdi)
  if (!p) {
    p = makePerioDefault()
    perioState.value.set(fdi, p)
  }
  return p
}

// Pre-rendered SVG markup per (fdi, view) — built lazily on first access, never changes.
const svgCache = new Map<string, string>()

function cacheKey(fdi: number, view: 'buccal' | 'occlusal') {
  return `${fdi}:${view}`
}

function getState(fdi: number): ToothState {
  let s = toothState.value.get(fdi)
  if (!s) {
    s = makeDefault()
    toothState.value.set(fdi, s)
  }
  return s
}

// ---------- SVG parsing ----------
const parser = typeof DOMParser !== 'undefined' ? new DOMParser() : null

function parseSvg(raw: string): SVGSVGElement {
  if (!parser) throw new Error('DOMParser unavailable')
  const doc = parser.parseFromString(raw, 'image/svg+xml')
  return doc.documentElement as unknown as SVGSVGElement
}

/**
 * ZoliQua's normalisation (odontogram.ts:171-204): convert inline
 * `style="display:none"` to `data-active="0"` so toggling is uniform.
 */
function normaliseSvg(root: SVGSVGElement) {
  root.querySelectorAll<SVGElement>('[id]').forEach((n) => {
    const style = n.getAttribute('style')
    if (style && /display\s*:\s*none/i.test(style)) {
      n.setAttribute('data-active', '0')
      const cleaned = style.replace(/display\s*:\s*none\s*;?/gi, '').replace(/;;+/g, ';').trim()
      if (cleaned) n.setAttribute('style', cleaned)
      else n.removeAttribute('style')
    }
  })
  const switchables = ['mods', 'tooth-variants', 'endos', 'surfaces', 'restorations', 'specials']
  for (const gId of switchables) {
    const g = root.querySelector(`#${gId}`)
    if (!g) continue
    g.querySelectorAll('[id]').forEach((n) => {
      if (!n.hasAttribute('data-active')) n.setAttribute('data-active', '0')
    })
  }
}

function wrapWithTransform(root: SVGSVGElement, rot: 0 | 180, mirror: boolean) {
  const vb = (root.getAttribute('viewBox') ?? '0 0 40.6 64').trim().split(/\s+/).map(Number)
  const cx = (vb[0] ?? 0) + (vb[2] ?? 0) / 2
  const cy = (vb[1] ?? 0) + (vb[3] ?? 0) / 2
  const transforms: string[] = []
  if (rot === 180) transforms.push(`rotate(180 ${cx} ${cy})`)
  if (mirror) transforms.push(`scale(-1 1) translate(${-2 * cx} 0)`)
  if (transforms.length === 0) return
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g')
  while (root.firstChild) g.appendChild(root.firstChild)
  g.setAttribute('transform', transforms.join(' '))
  root.appendChild(g)
}

function buildToothSvg(fdi: number, view: 'buccal' | 'occlusal'): string {
  const key = cacheKey(fdi, view)
  const cached = svgCache.get(key)
  if (cached !== undefined) return cached

  const tpl = TOOTH_TEMPLATE[fdi]
  if (!tpl) { svgCache.set(key, ''); return '' }
  const raw = view === 'occlusal' ? TEMPLATE_OCCL[tpl.tpl] : TEMPLATE_BUCCAL[tpl.tpl]
  if (!raw) { svgCache.set(key, ''); return '' }

  const svg = parseSvg(raw)
  normaliseSvg(svg)
  wrapWithTransform(svg, tpl.rot, tpl.mirror)
  svg.setAttribute('data-tooth', String(fdi))
  svg.setAttribute('data-view', view)
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet')
  svg.removeAttribute('width')
  svg.removeAttribute('height')
  const markup = new XMLSerializer().serializeToString(svg)
  svgCache.set(key, markup)
  return markup
}

// ---------- DOM refs ----------
const chartRoot = ref<HTMLElement | null>(null)

function setActiveAttr(el: Element | null, on: boolean) {
  if (!el) return
  el.setAttribute('data-active', on ? '1' : '0')
}

function findTooth(fdi: number, view: 'buccal' | 'occlusal'): SVGSVGElement | null {
  if (!chartRoot.value) return null
  return chartRoot.value.querySelector(`svg[data-tooth="${fdi}"][data-view="${view}"]`) as SVGSVGElement | null
}

/** Apply toothState[fdi] to both SVG views. */
function paint(fdi: number) {
  const s = getState(fdi)
  const toothIsHidden = s.base === 'missing' || s.specials.has('missing-closed') || s.extractionSocket
  // A "variant" visually replaces the normal tooth silhouette — ZoliQua treats these as mutually exclusive.
  const hasSilhouetteVariant = !!(s.fracture || s.crownPrep || s.underGum || s.radix)

  for (const view of ['buccal', 'occlusal'] as const) {
    const svg = findTooth(fdi, view)
    if (!svg) continue

    svg.setAttribute('data-treatment', s.treatment)

    // ---- Base dentition variant ----
    // When a silhouette variant is active (broken crown, crownprep, under-gum, radix),
    // hide the full tooth outline so only the variant shows.
    setActiveAttr(svg.querySelector('#tooth'), s.base === 'tooth' && !toothIsHidden && !hasSilhouetteVariant)
    setActiveAttr(svg.querySelector('#milktooth'), s.base === 'milktooth' && !toothIsHidden && !hasSilhouetteVariant)
    setActiveAttr(svg.querySelector('#missing-closed'), s.specials.has('missing-closed') || s.base === 'missing')
    setActiveAttr(svg.querySelector('#no-tooth-after-extraction'), s.extractionSocket)
    setActiveAttr(svg.querySelector('#implant'), s.base === 'implant')

    // Implant stages (only when implant base)
    if (s.base === 'implant') {
      setActiveAttr(svg.querySelector('#implant-base'), s.implantStage !== null)
      setActiveAttr(svg.querySelector('#implant-healing-abutment'), s.implantStage === 'healing-abutment')
      setActiveAttr(svg.querySelector('#implant-bar'), s.implantStage === 'bar')
      setActiveAttr(svg.querySelector('#implant-locator-screw'), s.implantStage === 'locator-screw')
    }

    // ---- Tooth variants (broken, crownprep, under-gum, radix) ----
    // Only one "variant" is active at a time per ZoliQua's model.
    const variantMap: Record<string, boolean> = {
      'tooth-broken-mesial': s.fracture === 'mesial',
      'tooth-broken-distal': s.fracture === 'distal',
      'tooth-broken-inicisal': s.fracture === 'inicisal',
      'tooth-broken-mesial-distal': s.fracture === 'mesial-distal',
      'tooth-broken-mesial-inicisal': s.fracture === 'mesial-inicisal',
      'tooth-broken-distal-inicisal': s.fracture === 'distal-inicisal',
      'tooth-broken-mesial-distal-inicisal': s.fracture === 'mesial-distal-inicisal',
      'tooth-crownprep': s.crownPrep,
      'tooth-under-gum': s.underGum,
      'tooth-radix': s.radix,
    }
    for (const [id, on] of Object.entries(variantMap)) {
      setActiveAttr(svg.querySelector(`#${id}`), on)
    }

    // Bruxism (mods group)
    setActiveAttr(svg.querySelector('#tooth-bruxism-wear'), s.bruxism === 'wear' || s.bruxism === 'both')
    setActiveAttr(svg.querySelector('#tooth-bruxism-neck-wear'), s.bruxism === 'neck-wear' || s.bruxism === 'both')

    // ---- Pulp (healthy vs inflamed) ----
    const inflamPulp = s.base === 'milktooth'
      ? svg.querySelector('#milktooth-inflam-pulp')
      : svg.querySelector('#tooth-inflam-pulp')
    const healthyPulp = s.base === 'milktooth'
      ? svg.querySelector('#milktooth-healthy-pulp')
      : svg.querySelector('#tooth-healthy-pulp')
    setActiveAttr(inflamPulp, s.pulpitis && !toothIsHidden)
    setActiveAttr(healthyPulp, !s.pulpitis && !toothIsHidden)

    // ---- Surfaces: caries + fillings ----
    const surfaces = ['mesial', 'distal', 'occlusal', 'buccal', 'lingual'] as const
    const materials = ['amalgam', 'composite', 'gic', 'temporary'] as const
    for (const surf of surfaces) {
      setActiveAttr(svg.querySelector(`#caries-${surf}`), s.caries.has(surf))
      const activeMat = s.fillings.get(surf)
      for (const mat of materials) {
        setActiveAttr(svg.querySelector(`#filling-${mat}-${surf}`), activeMat === mat)
      }
    }
    setActiveAttr(svg.querySelector('#caries-subcrown'), s.cariesSubcrown)

    // Sealant (occlusal)
    setActiveAttr(svg.querySelector('#fissure-sealing'), s.sealant)
    setActiveAttr(svg.querySelector('#fissure-sealing-occlusal'), s.sealant)

    // Open contacts
    setActiveAttr(svg.querySelector('#mesial-no-contact-point'), s.noContact.mesial)
    setActiveAttr(svg.querySelector('#distal-no-contact-point'), s.noContact.distal)

    // ---- Crown / restoration ----
    const crowns: CrownMat[] = ['zircon', 'metal', 'emax', 'temporary', 'telescope']
    for (const c of crowns) setActiveAttr(svg.querySelector(`#restorations #${c}`), s.crown === c)

    // Prosthesis (bridge root group)
    setActiveAttr(svg.querySelector('#prosthesis'), !!s.bridge && s.bridge.material === 'prosthesis')
    setActiveAttr(svg.querySelector('#telescope'), s.bridge?.material === 'telescope' || s.crown === 'telescope')

    // Bridge connector — activates when this tooth is part of a bridge and has bridge material
    if (s.bridge) {
      const conn = `#${s.bridge.material}-bridge-connector`
      setActiveAttr(svg.querySelector(conn), true)
    } else {
      for (const mat of ['zircon', 'metal', 'telescope', 'temporary'] as const) {
        setActiveAttr(svg.querySelector(`#${mat}-bridge-connector`), false)
      }
    }

    // ---- Endo ----
    const endos: EndoState[] = ['endo-filling', 'endo-filling-incomplete', 'endo-resection']
    for (const e of endos) setActiveAttr(svg.querySelector(`#endos #${e}`), s.endo === e)
    setActiveAttr(svg.querySelector('#endos #endo-glass-pin'), s.post === 'glass')
    setActiveAttr(svg.querySelector('#endos #endo-metal-pin'), s.post === 'metal')
    setActiveAttr(svg.querySelector('#parapulpal-pin'), s.parapulpalPin)

    // ---- Mods ----
    // 'inflammation' is the umbrella group; inside/outside are sub-groups for location
    setActiveAttr(
      svg.querySelector('#inflammation'),
      s.mods.has('inflammation') || s.mods.has('inflammation-inside') || s.mods.has('inflammation-outside'),
    )
    setActiveAttr(svg.querySelector('#inflammation-inside'), s.mods.has('inflammation-inside'))
    setActiveAttr(svg.querySelector('#inflammation-outside'), s.mods.has('inflammation-outside'))
    // Mobility is sourced from the perio chart (richer Miller Class 0-III).
    // Dental chart #mobility overlay shows whenever grade > 0.
    setActiveAttr(svg.querySelector('#mobility'), (perioState.value.get(fdi)?.mobilityGrade ?? 0) > 0)

    // ---- Plan specials ----
    setActiveAttr(svg.querySelector('#extraction-plan'), s.specials.has('extraction-plan'))
    setActiveAttr(svg.querySelector('#crown-needed'), s.specials.has('crown-needed'))
    setActiveAttr(svg.querySelector('#crown-replace'), s.specials.has('crown-replace'))
  }
}

function paintAll() {
  ;[...UPPER, ...LOWER].forEach(paint)
}

// ---------- Click handling ----------
function onCellClick(fdi: number, ev: MouseEvent) {
  const isMultiSelect = ev.metaKey || ev.ctrlKey
  if (isMultiSelect) {
    if (selected.value.has(fdi)) selected.value.delete(fdi)
    else selected.value.add(fdi)
    selected.value = new Set(selected.value)
    activeTooth.value = fdi
    // In multi-select mode, use the sidebar for batch edits — no floating panel.
    closeWheel()
    return
  }
  selected.value = new Set([fdi])
  activeTooth.value = fdi
  const cell = ev.currentTarget as HTMLElement | null
  if (cell) openWheelAt(cell)
}

function clearSelection() {
  selected.value = new Set()
  activeTooth.value = null
}

function resetAll() {
  toothState.value = new Map()
  clearSelection()
  paintAll()
}

function applyToSelected(mutate: (s: ToothState) => void) {
  const targets = selected.value.size > 0 ? [...selected.value] : activeTooth.value != null ? [activeTooth.value] : []
  for (const fdi of targets) {
    const st = getState(fdi)
    mutate(st)
    st.treatment = treatmentMode.value
    paint(fdi)
  }
}

// ---------- Panel actions ----------
function toggleCaries(surf: Surface) {
  applyToSelected((s) => {
    if (s.caries.has(surf)) s.caries.delete(surf)
    else s.caries.add(surf)
  })
}

function toggleFilling(surf: Surface, mat: FillingMaterial) {
  applyToSelected((s) => {
    if (s.fillings.get(surf) === mat) s.fillings.delete(surf)
    else s.fillings.set(surf, mat)
  })
}

function setBase(base: ToothBase) {
  applyToSelected((s) => { s.base = base })
}

function setCrown(crown: ToothState['crown']) {
  applyToSelected((s) => { s.crown = s.crown === crown ? null : crown })
}

function setEndo(endo: ToothState['endo']) {
  applyToSelected((s) => { s.endo = s.endo === endo ? null : endo })
}

function togglePulpitis() {
  applyToSelected((s) => { s.pulpitis = !s.pulpitis })
}

function toggleMod(m: 'inflammation' | 'mobility') {
  if (m === 'mobility') {
    // Mobility is tracked in perio state (Miller Class 0-III). Sidebar button toggles 0 ↔ 1.
    const targets = selected.value.size > 0 ? [...selected.value] : activeTooth.value != null ? [activeTooth.value] : []
    for (const fdi of targets) {
      const cur = getPerio(fdi).mobilityGrade
      setMobilityGrade(fdi, cur > 0 ? 0 : 1)
    }
    return
  }
  applyToSelected((s) => {
    if (s.mods.has(m)) s.mods.delete(m)
    else s.mods.add(m)
  })
}

function toggleSpecial(sp: 'missing-closed' | 'extraction-plan' | 'crown-needed' | 'crown-replace') {
  applyToSelected((s) => {
    if (s.specials.has(sp)) s.specials.delete(sp)
    else s.specials.add(sp)
  })
}

// New toggle helpers
function toggleSealant() {
  applyToSelected((s) => { s.sealant = !s.sealant })
}

function toggleCariesSubcrown() {
  applyToSelected((s) => { s.cariesSubcrown = !s.cariesSubcrown })
}

function setFracture(v: FractureVariant | null) {
  applyToSelected((s) => { s.fracture = s.fracture === v ? null : v })
}

function setBruxism(v: BruxismVariant | null) {
  applyToSelected((s) => { s.bruxism = s.bruxism === v ? null : v })
}

function toggleCrownPrep() {
  applyToSelected((s) => { s.crownPrep = !s.crownPrep })
}

function toggleUnderGum() {
  applyToSelected((s) => { s.underGum = !s.underGum })
}

function toggleRadix() {
  applyToSelected((s) => { s.radix = !s.radix })
}

function toggleExtractionSocket() {
  applyToSelected((s) => { s.extractionSocket = !s.extractionSocket })
}

function setPost(p: PostVariant | null) {
  applyToSelected((s) => { s.post = s.post === p ? null : p })
}

function toggleParapulpalPin() {
  applyToSelected((s) => { s.parapulpalPin = !s.parapulpalPin })
}

function toggleNoContact(side: 'mesial' | 'distal') {
  applyToSelected((s) => { s.noContact[side] = !s.noContact[side] })
}

function setImplantStage(stage: ImplantStage | null) {
  applyToSelected((s) => {
    s.base = 'implant'
    s.implantStage = s.implantStage === stage ? null : stage
  })
}

function setBridge(material: BridgeMat | null, role: BridgeRole = 'abutment') {
  applyToSelected((s) => {
    if (!material || (s.bridge?.material === material && s.bridge?.role === role)) {
      s.bridge = null
    } else {
      s.bridge = { material, role }
    }
  })
}

function toggleBridgeRole() {
  applyToSelected((s) => {
    if (!s.bridge) return
    s.bridge = { ...s.bridge, role: s.bridge.role === 'abutment' ? 'pontic' : 'abutment' }
  })
}

function toggleInflammation(kind: 'inside' | 'outside') {
  applyToSelected((s) => {
    const key = `inflammation-${kind}` as const
    if (s.mods.has(key)) s.mods.delete(key)
    else s.mods.add(key)
  })
}

function updateNotes(text: string) {
  applyToSelected((s) => { s.notes = text })
}

// Presets
function presetPrimary() {
  toothState.value = new Map()
  for (const fdi of [...UPPER, ...LOWER]) {
    if (fdi % 10 <= 5 && (fdi < 16 || (fdi >= 21 && fdi < 26) || (fdi >= 31 && fdi < 36) || (fdi >= 41 && fdi < 46))) {
      const s = getState(fdi)
      s.base = 'milktooth'
    }
  }
  paintAll()
}
function presetEdentulous() {
  toothState.value = new Map()
  for (const fdi of [...UPPER, ...LOWER]) {
    const s = getState(fdi)
    s.base = 'missing'
    s.specials.add('missing-closed')
  }
  paintAll()
}

// ---------- Layer visibility (top-bar toggles) ----------
const showBase = ref(true)
const showOcclusal = ref(true)
const showPulp = ref(true)
const showWisdom = ref(true)

// Active tooth view-model for right panel
const activeState = computed(() => (activeTooth.value != null ? getState(activeTooth.value) : null))

function cellTxClass(fdi: number): string {
  const s = toothState.value.get(fdi)
  if (!s || s.treatment === 'existing') return ''
  return `tx-${s.treatment}`
}

// Perio summary stats
const perioSummary = computed(() => {
  const pds: number[] = []
  let bopCount = 0
  let pointCount = 0
  for (const fdi of [...UPPER, ...LOWER]) {
    const p = perioState.value.get(fdi)
    if (!p) continue
    for (const face of [p.facial, p.lingual]) {
      for (const pt of face) {
        pointCount++
        if (pt.pd != null) pds.push(pt.pd)
        if (pt.bop) bopCount++
      }
    }
  }
  const sum = pds.reduce((a, b) => a + b, 0)
  return {
    meanPD: pds.length ? +(sum / pds.length).toFixed(1) : null,
    maxPD: pds.length ? Math.max(...pds) : null,
    bopPct: pointCount > 0 ? +(((bopCount / pointCount) * 100).toFixed(0)) : 0,
    pockets4: pds.filter((d) => d >= 4 && d < 6).length,
    pockets6: pds.filter((d) => d >= 6).length,
    pointsRecorded: pds.length,
  }
})

function pdClass(pd: number | null): string {
  if (pd == null) return ''
  if (pd <= 3) return 'pd-healthy'
  if (pd <= 5) return 'pd-warning'
  return 'pd-severe'
}

function onPdInput(fdi: number, face: 'facial' | 'lingual', idx: 0 | 1 | 2, raw: string) {
  const n = raw === '' ? null : parseInt(raw, 10)
  const p = getPerio(fdi)
  p[face][idx].pd = n != null && Number.isFinite(n) && n >= 0 && n <= 15 ? n : null
}

function toggleBop(fdi: number, face: 'facial' | 'lingual', idx: 0 | 1 | 2) {
  const p = getPerio(fdi)
  p[face][idx].bop = !p[face][idx].bop
  // force reactive update
  perioState.value = new Map(perioState.value)
}

function setMobilityGrade(fdi: number, g: 0 | 1 | 2 | 3) {
  getPerio(fdi).mobilityGrade = g
  perioState.value = new Map(perioState.value)
  // Mobility visual lives on the odontogram SVG too — repaint it.
  paint(fdi)
}

function resetPerio() {
  perioState.value = new Map()
}

function onPerioHover(ev: MouseEvent) {
  const target = ev.target as HTMLElement | null
  if (!target) return
  const el = target.closest('[data-fdi]') as HTMLElement | null
  const fdi = el?.dataset.fdi
  hoveredTooth.value = fdi ? Number(fdi) : null
}

/**
 * Upper teeth: facial row shows [M|B|D], lingual row shows [M|L|D].
 * For upper teeth (quadrants 1-2), when reading chart left-to-right we see:
 *   - For quadrant 1 (18-11): distal is closer to 18 end, mesial to midline → reverse.
 *   - For quadrant 2 (21-28): mesial is at midline (21), distal at 28 → keep order.
 * For simplicity we present each tooth's 3 points as "mesial | mid | distal"
 * based on the tooth's own anatomy, using the `mirror` flag in TOOTH_TEMPLATE
 * to decide if we need to flip the visual order.
 */
function pointOrder(fdi: number): [0, 1, 2] | [2, 1, 0] {
  const tpl = TOOTH_TEMPLATE[fdi]
  // Mirrored quadrants (2, 4) have mesial on the right anatomically, so flip.
  return tpl?.mirror ? [2, 1, 0] : [0, 1, 2]
}

watch(activeTooth, () => {
  // trigger reactive re-render of panel
})

// ---------- Mount ----------
onMounted(() => {
  paintAll()
  document.addEventListener('keydown', onKeydown)
  document.addEventListener('mousedown', onDocMouseDown, true)
  // Capture phase catches scroll on any ancestor (body, document, nested scrollers).
  window.addEventListener('scroll', reanchor, true)
  window.addEventListener('resize', reanchor)
})

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') closeWheel()
}

function onDocMouseDown(e: MouseEvent) {
  if (!wheelOpen.value) return
  const target = e.target as HTMLElement | null
  if (!target) return
  // Don't close when clicking inside the quick panel or a tooth cell (re-anchors)
  if (target.closest('.quick-panel')) return
  if (target.closest('.cell')) return
  closeWheel()
}
</script>

<template>
  <div class="min-h-screen bg-[radial-gradient(1200px_600px_at_15%_0%,#ffffff_0%,#f3f6fb_60%)] text-slate-900">
    <!-- Top bar -->
    <header class="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/85 px-4 py-3 backdrop-blur">
      <div class="flex items-center gap-3">
        <span class="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20" />
        <div>
          <div class="font-bold tracking-tight">Odontogram Playground</div>
          <div class="text-xs text-slate-500">ZoliQua-style reference UI · FDI notation</div>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <button class="layer-btn" :aria-pressed="showBase" @click="showBase = !showBase" title="Base gum">Base</button>
        <button class="layer-btn" :aria-pressed="showOcclusal" @click="showOcclusal = !showOcclusal" title="Occlusal row">Occl</button>
        <button class="layer-btn" :aria-pressed="showPulp" @click="showPulp = !showPulp" title="Healthy pulp">Pulp</button>
        <button class="layer-btn" :aria-pressed="showWisdom" @click="showWisdom = !showWisdom" title="Wisdom teeth">8</button>
        <button class="btn-danger ml-2" @click="clearSelection">Clear selection</button>
      </div>
    </header>

    <div class="layout-grid gap-6 p-6">
      <!-- LEFT COLUMN: Odontogram + Perio -->
      <div class="left-col space-y-6">
      <!-- CHART -->
      <section class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div class="mb-3 flex items-center justify-between">
          <div>
            <h2 class="text-lg font-bold">Dental chart</h2>
            <p class="text-xs text-slate-500">Click a tooth. Hold ⌘/Ctrl for multi-select.</p>
          </div>
        </div>

        <div
          ref="chartRoot"
          class="odontogram-chart"
          :class="{
            'hide-base': !showBase,
            'hide-pulp': !showPulp,
            'hide-wisdom': !showWisdom,
            'hide-occl-row': !showOcclusal,
          }"
        >
          <!-- Row 1: Upper buccal -->
          <div class="row">
            <button
              v-for="fdi in UPPER"
              :key="`ub-${fdi}`"
              class="cell cell-upper"
              :class="[cellTxClass(fdi), { active: activeTooth === fdi, selected: selected.has(fdi), hovered: hoveredTooth === fdi, wisdom: fdi % 10 === 8 }]"
              @click="(ev) => onCellClick(fdi, ev)"
              @mouseenter="hoveredTooth = fdi"
              @mouseleave="hoveredTooth = null"
            >
              <span class="label">{{ fdi }}</span>
              <span class="tooth-svg" v-html="buildToothSvg(fdi, 'buccal')" />
              <span v-if="toothState.get(fdi)?.notes" class="note-dot" title="Has notes" />
            </button>
          </div>

          <!-- Row 2: Upper occlusal -->
          <div class="row occl-row">
            <div
              v-for="fdi in UPPER"
              :key="`uo-${fdi}`"
              class="cell cell-occl"
              :class="[cellTxClass(fdi), { active: activeTooth === fdi, selected: selected.has(fdi), hovered: hoveredTooth === fdi, wisdom: fdi % 10 === 8, empty: !TOOTH_TEMPLATE[fdi] || !TEMPLATE_OCCL[TOOTH_TEMPLATE[fdi].tpl] }]"
              @click="(ev) => onCellClick(fdi, ev)"
              @mouseenter="hoveredTooth = fdi"
              @mouseleave="hoveredTooth = null"
            >
              <span class="tooth-svg" v-html="buildToothSvg(fdi, 'occlusal')" />
            </div>
          </div>

          <!-- Row 3: Lower occlusal -->
          <div class="row occl-row">
            <div
              v-for="fdi in LOWER"
              :key="`lo-${fdi}`"
              class="cell cell-occl"
              :class="[cellTxClass(fdi), { active: activeTooth === fdi, selected: selected.has(fdi), hovered: hoveredTooth === fdi, wisdom: fdi % 10 === 8, empty: !TOOTH_TEMPLATE[fdi] || !TEMPLATE_OCCL[TOOTH_TEMPLATE[fdi].tpl] }]"
              @click="(ev) => onCellClick(fdi, ev)"
              @mouseenter="hoveredTooth = fdi"
              @mouseleave="hoveredTooth = null"
            >
              <span class="tooth-svg" v-html="buildToothSvg(fdi, 'occlusal')" />
            </div>
          </div>

          <!-- Row 4: Lower buccal -->
          <div class="row">
            <button
              v-for="fdi in LOWER"
              :key="`lb-${fdi}`"
              class="cell cell-lower"
              :class="[cellTxClass(fdi), { active: activeTooth === fdi, selected: selected.has(fdi), hovered: hoveredTooth === fdi, wisdom: fdi % 10 === 8 }]"
              @click="(ev) => onCellClick(fdi, ev)"
              @mouseenter="hoveredTooth = fdi"
              @mouseleave="hoveredTooth = null"
            >
              <span class="tooth-svg" v-html="buildToothSvg(fdi, 'buccal')" />
              <span class="label">{{ fdi }}</span>
              <span v-if="toothState.get(fdi)?.notes" class="note-dot" title="Has notes" />
            </button>
          </div>
        </div>
      </section>

      <!-- PERIO CHART -->
      <section class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div class="mb-3 flex items-start justify-between">
          <div>
            <h2 class="text-lg font-bold">Periodontal chart</h2>
            <p class="text-xs text-slate-500">
              6-point pocket depth (MB/B/DB · ML/L/DL). Type 1–12 mm. Click the bleeding dot to toggle BOP.
            </p>
          </div>
          <div class="flex items-center gap-3 text-xs">
            <div class="text-slate-500">
              Mean PD: <b class="text-slate-900">{{ perioSummary.meanPD ?? '—' }}</b>
              · Max: <b class="text-slate-900">{{ perioSummary.maxPD ?? '—' }}</b>
              · BOP: <b class="text-slate-900">{{ perioSummary.bopPct }}%</b>
              · Pockets ≥4: <b class="text-amber-600">{{ perioSummary.pockets4 }}</b>
              · ≥6: <b class="text-red-600">{{ perioSummary.pockets6 }}</b>
            </div>
            <button class="layer-btn" @click="resetPerio">Clear</button>
          </div>
        </div>

        <div
          class="perio-chart"
          :data-hovered-fdi="hoveredTooth ?? ''"
          @mouseover="onPerioHover"
          @mouseleave="hoveredTooth = null"
        >
          <!-- Upper arch -->
          <div class="perio-arch">
            <!-- Tooth numbers -->
            <div class="perio-label-col">&nbsp;</div>
            <div v-for="fdi in UPPER" :key="`pn-u-${fdi}`" :class="['perio-num', { 'perio-hovered': hoveredTooth === fdi, 'perio-active': activeTooth === fdi, 'perio-selected': selected.has(fdi) }]" :data-fdi="fdi">{{ fdi }}</div>

            <!-- Upper Facial (buccal) BOP row -->
            <div class="perio-label-col">BOP</div>
            <div v-for="fdi in UPPER" :key="`pbopu-${fdi}`" :class="['perio-tooth-col', { 'perio-hovered': hoveredTooth === fdi, 'perio-active': activeTooth === fdi, 'perio-selected': selected.has(fdi) }]" :data-fdi="fdi">
              <button
                v-for="idx in pointOrder(fdi)"
                :key="`bopuf-${fdi}-${idx}`"
                class="bop-dot"
                :class="{ 'bop-on': getPerio(fdi).facial[idx].bop }"
                @click="toggleBop(fdi, 'facial', idx)"
                :title="`BOP facial point ${idx+1}`"
              />
            </div>

            <!-- Upper Facial PD row -->
            <div class="perio-label-col">Facial</div>
            <div v-for="fdi in UPPER" :key="`pduf-${fdi}`" :class="['perio-tooth-col', { 'perio-hovered': hoveredTooth === fdi, 'perio-active': activeTooth === fdi, 'perio-selected': selected.has(fdi) }]" :data-fdi="fdi">
              <input
                v-for="idx in pointOrder(fdi)"
                :key="`uf-${fdi}-${idx}`"
                type="number"
                min="0"
                max="15"
                class="pd-input"
                :class="pdClass(getPerio(fdi).facial[idx].pd)"
                :value="getPerio(fdi).facial[idx].pd ?? ''"
                @input="(ev) => onPdInput(fdi, 'facial', idx as 0|1|2, (ev.target as HTMLInputElement).value)"
              />
            </div>

            <!-- Upper Lingual PD row -->
            <div class="perio-label-col">Palatal</div>
            <div v-for="fdi in UPPER" :key="`pdul-${fdi}`" :class="['perio-tooth-col', { 'perio-hovered': hoveredTooth === fdi, 'perio-active': activeTooth === fdi, 'perio-selected': selected.has(fdi) }]" :data-fdi="fdi">
              <input
                v-for="idx in pointOrder(fdi)"
                :key="`ul-${fdi}-${idx}`"
                type="number"
                min="0"
                max="15"
                class="pd-input"
                :class="pdClass(getPerio(fdi).lingual[idx].pd)"
                :value="getPerio(fdi).lingual[idx].pd ?? ''"
                @input="(ev) => onPdInput(fdi, 'lingual', idx as 0|1|2, (ev.target as HTMLInputElement).value)"
              />
            </div>

            <!-- Upper Lingual BOP row -->
            <div class="perio-label-col">BOP</div>
            <div v-for="fdi in UPPER" :key="`pbopul-${fdi}`" :class="['perio-tooth-col', { 'perio-hovered': hoveredTooth === fdi, 'perio-active': activeTooth === fdi, 'perio-selected': selected.has(fdi) }]" :data-fdi="fdi">
              <button
                v-for="idx in pointOrder(fdi)"
                :key="`bopul-${fdi}-${idx}`"
                class="bop-dot"
                :class="{ 'bop-on': getPerio(fdi).lingual[idx].bop }"
                @click="toggleBop(fdi, 'lingual', idx)"
              />
            </div>

            <!-- Mobility per tooth -->
            <div class="perio-label-col">Mobility</div>
            <div v-for="fdi in UPPER" :key="`mobu-${fdi}`" :class="['perio-mobility', { 'perio-hovered': hoveredTooth === fdi, 'perio-active': activeTooth === fdi, 'perio-selected': selected.has(fdi) }]" :data-fdi="fdi">
              <select
                class="mobility-select"
                :value="getPerio(fdi).mobilityGrade"
                @change="(ev) => setMobilityGrade(fdi, parseInt((ev.target as HTMLSelectElement).value) as 0|1|2|3)"
              >
                <option :value="0">—</option>
                <option :value="1">I</option>
                <option :value="2">II</option>
                <option :value="3">III</option>
              </select>
            </div>
          </div>

          <div class="perio-divider" />

          <!-- Lower arch (mirrored reading direction — lingual first, facial last) -->
          <div class="perio-arch">
            <div class="perio-label-col">Mobility</div>
            <div v-for="fdi in LOWER" :key="`mobl-${fdi}`" :class="['perio-mobility', { 'perio-hovered': hoveredTooth === fdi, 'perio-active': activeTooth === fdi, 'perio-selected': selected.has(fdi) }]" :data-fdi="fdi">
              <select
                class="mobility-select"
                :value="getPerio(fdi).mobilityGrade"
                @change="(ev) => setMobilityGrade(fdi, parseInt((ev.target as HTMLSelectElement).value) as 0|1|2|3)"
              >
                <option :value="0">—</option>
                <option :value="1">I</option>
                <option :value="2">II</option>
                <option :value="3">III</option>
              </select>
            </div>

            <div class="perio-label-col">BOP</div>
            <div v-for="fdi in LOWER" :key="`pbopll-${fdi}`" :class="['perio-tooth-col', { 'perio-hovered': hoveredTooth === fdi, 'perio-active': activeTooth === fdi, 'perio-selected': selected.has(fdi) }]" :data-fdi="fdi">
              <button
                v-for="idx in pointOrder(fdi)"
                :key="`bopll-${fdi}-${idx}`"
                class="bop-dot"
                :class="{ 'bop-on': getPerio(fdi).lingual[idx].bop }"
                @click="toggleBop(fdi, 'lingual', idx)"
              />
            </div>

            <div class="perio-label-col">Lingual</div>
            <div v-for="fdi in LOWER" :key="`pdll-${fdi}`" :class="['perio-tooth-col', { 'perio-hovered': hoveredTooth === fdi, 'perio-active': activeTooth === fdi, 'perio-selected': selected.has(fdi) }]" :data-fdi="fdi">
              <input
                v-for="idx in pointOrder(fdi)"
                :key="`ll-${fdi}-${idx}`"
                type="number"
                min="0"
                max="15"
                class="pd-input"
                :class="pdClass(getPerio(fdi).lingual[idx].pd)"
                :value="getPerio(fdi).lingual[idx].pd ?? ''"
                @input="(ev) => onPdInput(fdi, 'lingual', idx as 0|1|2, (ev.target as HTMLInputElement).value)"
              />
            </div>

            <div class="perio-label-col">Facial</div>
            <div v-for="fdi in LOWER" :key="`pdlf-${fdi}`" :class="['perio-tooth-col', { 'perio-hovered': hoveredTooth === fdi, 'perio-active': activeTooth === fdi, 'perio-selected': selected.has(fdi) }]" :data-fdi="fdi">
              <input
                v-for="idx in pointOrder(fdi)"
                :key="`lf-${fdi}-${idx}`"
                type="number"
                min="0"
                max="15"
                class="pd-input"
                :class="pdClass(getPerio(fdi).facial[idx].pd)"
                :value="getPerio(fdi).facial[idx].pd ?? ''"
                @input="(ev) => onPdInput(fdi, 'facial', idx as 0|1|2, (ev.target as HTMLInputElement).value)"
              />
            </div>

            <div class="perio-label-col">BOP</div>
            <div v-for="fdi in LOWER" :key="`pbopl-${fdi}`" :class="['perio-tooth-col', { 'perio-hovered': hoveredTooth === fdi, 'perio-active': activeTooth === fdi, 'perio-selected': selected.has(fdi) }]" :data-fdi="fdi">
              <button
                v-for="idx in pointOrder(fdi)"
                :key="`bopl-${fdi}-${idx}`"
                class="bop-dot"
                :class="{ 'bop-on': getPerio(fdi).facial[idx].bop }"
                @click="toggleBop(fdi, 'facial', idx)"
              />
            </div>

            <div class="perio-label-col">&nbsp;</div>
            <div v-for="fdi in LOWER" :key="`pn-l-${fdi}`" :class="['perio-num', { 'perio-hovered': hoveredTooth === fdi, 'perio-active': activeTooth === fdi, 'perio-selected': selected.has(fdi) }]" :data-fdi="fdi">{{ fdi }}</div>
          </div>
        </div>
      </section>
      </div>

      <!-- RIGHT PANEL -->
      <aside class="space-y-4">
        <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="font-bold">Controls</h3>
              <p class="text-xs text-slate-500">
                Active: <span v-if="activeTooth" class="font-mono text-emerald-600">{{ activeTooth }}</span>
                <span v-else class="text-slate-400">—</span>
                · {{ selected.size }} selected
              </p>
            </div>
          </div>
        </div>

        <!-- Presets -->
        <section class="panel">
          <h4 class="panel-title">Statuses</h4>
          <div class="grid grid-cols-2 gap-2">
            <button class="btn-soft" @click="resetAll">Reset mouth</button>
            <button class="btn-soft" @click="presetPrimary">Primary dentition</button>
            <button class="btn-soft" @click="presetEdentulous">Edentulous</button>
          </div>
        </section>

        <!-- Base -->
        <section class="panel" :class="{ disabled: !activeState }">
          <h4 class="panel-title">Tooth base</h4>
          <div class="grid grid-cols-2 gap-2">
            <button class="chip" :aria-pressed="activeState?.base === 'tooth'" @click="setBase('tooth')">Permanent</button>
            <button class="chip" :aria-pressed="activeState?.base === 'milktooth'" @click="setBase('milktooth')">Primary</button>
            <button class="chip" :aria-pressed="activeState?.base === 'implant'" @click="setBase('implant')">Implant</button>
            <button class="chip" :aria-pressed="activeState?.base === 'missing'" @click="setBase('missing')">Missing</button>
          </div>
        </section>

        <!-- Caries -->
        <section class="panel" :class="{ disabled: !activeState }">
          <h4 class="panel-title">Caries</h4>
          <p class="mb-2 text-xs text-slate-500">Select affected surfaces</p>
          <div class="grid grid-cols-3 gap-2">
            <button class="chip chip-caries" :aria-pressed="activeState?.caries.has('mesial')" @click="toggleCaries('mesial')">M</button>
            <button class="chip chip-caries" :aria-pressed="activeState?.caries.has('occlusal')" @click="toggleCaries('occlusal')">{{ isAnterior(activeTooth) ? 'I' : 'O' }}</button>
            <button class="chip chip-caries" :aria-pressed="activeState?.caries.has('distal')" @click="toggleCaries('distal')">D</button>
            <button class="chip chip-caries" :aria-pressed="activeState?.caries.has('buccal')" @click="toggleCaries('buccal')">B</button>
            <button class="chip chip-caries col-span-2" :aria-pressed="activeState?.caries.has('lingual')" @click="toggleCaries('lingual')">L / Palatal</button>
          </div>
        </section>

        <!-- Fillings -->
        <section class="panel" :class="{ disabled: !activeState }">
          <h4 class="panel-title">Filling</h4>
          <div class="space-y-2">
            <div v-for="surf in (['mesial','occlusal','distal','buccal','lingual'] as const)" :key="surf" class="flex items-center gap-2">
              <span class="w-16 text-xs uppercase text-slate-500">{{ surf === 'occlusal' && isAnterior(activeTooth) ? 'incisal' : surf }}</span>
              <div class="flex flex-1 gap-1">
                <button
                  v-for="mat in (['amalgam','composite','gic','temporary'] as const)"
                  :key="mat"
                  class="chip chip-sm flex-1"
                  :aria-pressed="activeState?.fillings.get(surf) === mat"
                  @click="toggleFilling(surf, mat)"
                >{{ mat[0]?.toUpperCase() }}</button>
              </div>
            </div>
            <p class="pt-1 text-[10px] text-slate-400">A=Amalgam · C=Composite · G=GIC · T=Temporary</p>
          </div>
        </section>

        <!-- Sealant / Caries under crown / Open contacts -->
        <section class="panel" :class="{ disabled: !activeState }">
          <h4 class="panel-title">Preventive / Contact</h4>
          <div class="grid grid-cols-2 gap-2">
            <button class="chip" :aria-pressed="activeState?.sealant" @click="toggleSealant">Fissure sealant</button>
            <button class="chip" :aria-pressed="activeState?.cariesSubcrown" @click="toggleCariesSubcrown">Caries u/ crown</button>
            <button class="chip" :aria-pressed="activeState?.noContact.mesial" @click="toggleNoContact('mesial')">Open M contact</button>
            <button class="chip" :aria-pressed="activeState?.noContact.distal" @click="toggleNoContact('distal')">Open D contact</button>
          </div>
        </section>

        <!-- Fracture -->
        <section class="panel" :class="{ disabled: !activeState }">
          <h4 class="panel-title">Fracture / Wear</h4>
          <p class="mb-2 text-xs text-slate-500">Which surface(s) broken?</p>
          <div class="grid grid-cols-3 gap-2">
            <button class="chip" :aria-pressed="activeState?.fracture === 'mesial'" @click="setFracture('mesial')">M</button>
            <button class="chip" :aria-pressed="activeState?.fracture === 'inicisal'" @click="setFracture('inicisal')">Incisal</button>
            <button class="chip" :aria-pressed="activeState?.fracture === 'distal'" @click="setFracture('distal')">D</button>
            <button class="chip" :aria-pressed="activeState?.fracture === 'mesial-inicisal'" @click="setFracture('mesial-inicisal')">M+I</button>
            <button class="chip" :aria-pressed="activeState?.fracture === 'mesial-distal'" @click="setFracture('mesial-distal')">M+D</button>
            <button class="chip" :aria-pressed="activeState?.fracture === 'distal-inicisal'" @click="setFracture('distal-inicisal')">D+I</button>
            <button class="chip col-span-3" :aria-pressed="activeState?.fracture === 'mesial-distal-inicisal'" @click="setFracture('mesial-distal-inicisal')">M+D+I (multi-surface)</button>
          </div>
          <hr class="my-3 border-slate-200" />
          <p class="mb-2 text-xs text-slate-500">Bruxism wear</p>
          <div class="grid grid-cols-3 gap-2">
            <button class="chip" :aria-pressed="activeState?.bruxism === 'wear'" @click="setBruxism('wear')">Occl wear</button>
            <button class="chip" :aria-pressed="activeState?.bruxism === 'neck-wear'" @click="setBruxism('neck-wear')">Neck wear</button>
            <button class="chip" :aria-pressed="activeState?.bruxism === 'both'" @click="setBruxism('both')">Both</button>
          </div>
        </section>

        <!-- Tooth variants: crown prep / under gum / radix / extraction socket -->
        <section class="panel" :class="{ disabled: !activeState }">
          <h4 class="panel-title">Tooth condition</h4>
          <div class="grid grid-cols-2 gap-2">
            <button class="chip" :aria-pressed="activeState?.crownPrep" @click="toggleCrownPrep">Crown prep</button>
            <button class="chip" :aria-pressed="activeState?.underGum" @click="toggleUnderGum">Unerupted</button>
            <button class="chip" :aria-pressed="activeState?.radix" @click="toggleRadix">Retained root</button>
            <button class="chip" :aria-pressed="activeState?.extractionSocket" @click="toggleExtractionSocket">Recent extraction</button>
          </div>
        </section>

        <!-- Crown -->
        <section class="panel" :class="{ disabled: !activeState }">
          <h4 class="panel-title">Crown / Restoration</h4>
          <div class="grid grid-cols-3 gap-2">
            <button class="chip" :aria-pressed="activeState?.crown === 'zircon'" @click="setCrown('zircon')">Zircon</button>
            <button class="chip" :aria-pressed="activeState?.crown === 'metal'" @click="setCrown('metal')">Metal</button>
            <button class="chip" :aria-pressed="activeState?.crown === 'emax'" @click="setCrown('emax')">e.max</button>
            <button class="chip" :aria-pressed="activeState?.crown === 'temporary'" @click="setCrown('temporary')">Temp</button>
            <button class="chip" :aria-pressed="activeState?.crown === 'telescope'" @click="setCrown('telescope')">Telescope</button>
          </div>
        </section>

        <!-- Bridge -->
        <section class="panel" :class="{ disabled: !activeState }">
          <h4 class="panel-title">Bridge</h4>
          <p class="mb-2 text-xs text-slate-500">Material (toggles bridge connector)</p>
          <div class="grid grid-cols-3 gap-2">
            <button class="chip" :aria-pressed="activeState?.bridge?.material === 'zircon'" @click="setBridge('zircon')">Zircon</button>
            <button class="chip" :aria-pressed="activeState?.bridge?.material === 'metal'" @click="setBridge('metal')">Metal</button>
            <button class="chip" :aria-pressed="activeState?.bridge?.material === 'temporary'" @click="setBridge('temporary')">Temp</button>
            <button class="chip" :aria-pressed="activeState?.bridge?.material === 'telescope'" @click="setBridge('telescope')">Telescope</button>
            <button class="chip col-span-2" :aria-pressed="activeState?.bridge?.material === 'prosthesis'" @click="setBridge('prosthesis')">Prosthesis</button>
          </div>
          <div v-if="activeState?.bridge" class="mt-2 grid grid-cols-2 gap-2">
            <button class="chip" :aria-pressed="activeState?.bridge?.role === 'abutment'" @click="toggleBridgeRole">Abutment</button>
            <button class="chip" :aria-pressed="activeState?.bridge?.role === 'pontic'" @click="toggleBridgeRole">Pontic</button>
          </div>
        </section>

        <!-- Implant -->
        <section class="panel" :class="{ disabled: !activeState }">
          <h4 class="panel-title">Implant stage</h4>
          <div class="grid grid-cols-2 gap-2">
            <button class="chip" :aria-pressed="activeState?.implantStage === 'base'" @click="setImplantStage('base')">Base placed</button>
            <button class="chip" :aria-pressed="activeState?.implantStage === 'healing-abutment'" @click="setImplantStage('healing-abutment')">Healing abut.</button>
            <button class="chip" :aria-pressed="activeState?.implantStage === 'bar'" @click="setImplantStage('bar')">Bar</button>
            <button class="chip" :aria-pressed="activeState?.implantStage === 'locator-screw'" @click="setImplantStage('locator-screw')">Locator</button>
          </div>
        </section>

        <!-- Endo / Pulp -->
        <section class="panel" :class="{ disabled: !activeState }">
          <h4 class="panel-title">Pulp &amp; Endo</h4>
          <div class="mb-2">
            <button class="chip w-full" :aria-pressed="activeState?.pulpitis" @click="togglePulpitis">Pulpitis (inflamed pulp)</button>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <button class="chip" :aria-pressed="activeState?.endo === 'endo-filling'" @click="setEndo('endo-filling')">RCT complete</button>
            <button class="chip" :aria-pressed="activeState?.endo === 'endo-filling-incomplete'" @click="setEndo('endo-filling-incomplete')">RCT partial</button>
            <button class="chip" :aria-pressed="activeState?.endo === 'endo-resection'" @click="setEndo('endo-resection')">Resection</button>
            <button class="chip" :aria-pressed="activeState?.parapulpalPin" @click="toggleParapulpalPin">Parapulpal pin</button>
          </div>
          <hr class="my-3 border-slate-200" />
          <p class="mb-2 text-xs text-slate-500">Endo post</p>
          <div class="grid grid-cols-2 gap-2">
            <button class="chip" :aria-pressed="activeState?.post === 'glass'" @click="setPost('glass')">Glass fiber post</button>
            <button class="chip" :aria-pressed="activeState?.post === 'metal'" @click="setPost('metal')">Metal post</button>
          </div>
        </section>

        <!-- Inflammation / Mobility -->
        <section class="panel" :class="{ disabled: !activeState }">
          <h4 class="panel-title">Modifiers</h4>
          <p class="mb-2 text-xs text-slate-500">Periapical inflammation</p>
          <div class="grid grid-cols-2 gap-2">
            <button class="chip" :aria-pressed="activeState?.mods.has('inflammation-inside')" @click="toggleInflammation('inside')">Apical (contained)</button>
            <button class="chip" :aria-pressed="activeState?.mods.has('inflammation-outside')" @click="toggleInflammation('outside')">Apical (fistula)</button>
          </div>
          <hr class="my-3 border-slate-200" />
          <div class="grid grid-cols-2 gap-2">
            <button class="chip" :aria-pressed="activeTooth != null && (perioState.get(activeTooth)?.mobilityGrade ?? 0) > 0" @click="toggleMod('mobility')">Mobility</button>
            <button class="chip" :aria-pressed="activeState?.specials.has('extraction-plan')" @click="toggleSpecial('extraction-plan')">Extraction plan</button>
            <button class="chip" :aria-pressed="activeState?.specials.has('crown-needed')" @click="toggleSpecial('crown-needed')">Crown needed</button>
            <button class="chip" :aria-pressed="activeState?.specials.has('crown-replace')" @click="toggleSpecial('crown-replace')">Crown replace</button>
          </div>
        </section>

        <!-- Per-tooth notes -->
        <section class="panel" :class="{ disabled: !activeState }">
          <h4 class="panel-title">Notes</h4>
          <textarea
            class="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm"
            rows="3"
            placeholder="Free-text notes for this tooth…"
            :value="activeState?.notes ?? ''"
            @input="(ev) => updateNotes((ev.target as HTMLTextAreaElement).value)"
          />
        </section>
      </aside>
    </div>

    <!-- Quick actions (floating beside clicked tooth): caries wheel + context bar -->
    <div
      v-if="wheelOpen && activeTooth != null"
      class="quick-panel"
      :style="{ left: wheelPos.x + 'px', top: wheelPos.y + 'px' }"
      @click.stop
    >
      <!-- Caries wheel (always-on primary tool) -->
      <svg viewBox="-80 -80 160 160" width="180" height="180" aria-label="Caries surface wheel">
        <circle cx="0" cy="0" r="74" fill="white" stroke="#cbd5e1" stroke-width="1" />
        <g v-for="slot in cariesSlots" :key="slot.key">
          <path
            :d="wedgePath(slot.angle - WHEEL_SLOTS_FACE, slot.angle + WHEEL_SLOTS_FACE, 70, 34)"
            :class="[
              'wheel-slot',
              {
                'wheel-slot-pressed': slot.isPressed(),
                'wheel-slot-hover': hoveredSlot === slot.key,
                'wheel-slot-more': slot.key === 'close',
              },
            ]"
            @mouseenter="hoveredSlot = slot.key"
            @mouseleave="hoveredSlot = null"
            @click="slot.action()"
          />
          <text
            :x="polarXY(52, slot.angle).x"
            :y="polarXY(52, slot.angle).y + 5"
            text-anchor="middle"
            class="wheel-label"
          >{{ slot.label }}</text>
        </g>
        <circle cx="0" cy="0" r="30" fill="#f8fafc" stroke="#e2e8f0" />
        <text x="0" y="-3" text-anchor="middle" class="wheel-center-action">
          {{ isCariesSlotHovered ? cariesSlots.find((s) => s.key === hoveredSlot)?.full : activeTooth }}
        </text>
        <text x="0" y="13" text-anchor="middle" class="wheel-center-sub">
          {{
            isCariesSlotHovered && hoveredSlot !== 'close'
              ? (cariesSlots.find((s) => s.key === hoveredSlot)?.isPressed() ? 'remove' : 'caries')
              : `#${activeTooth}`
          }}
        </text>
      </svg>

      <!-- Context label preview (shows which icon is hovered) -->
      <div class="context-hint">
        <span v-if="hoveredSlot?.startsWith('ctx-')">
          {{ contextItems.find((i) => `ctx-${i.key}` === hoveredSlot)?.label }}
        </span>
        <span v-else class="context-hint-muted">Tools</span>
      </div>

      <!-- Context bar -->
      <div class="context-bar">
        <button
          v-for="item in contextItems"
          :key="item.key"
          class="context-item bg-gradient-to-br text-white shadow-sm"
          :class="[
            item.gradient,
            {
              'context-item-pressed': item.isPressed(),
              'context-item-expanded': expansion === item.expands && expansion != null,
              'context-item-idle': !item.isPressed() && !(expansion === item.expands && expansion != null),
            },
          ]"
          :title="item.label"
          :aria-label="item.label"
          @mouseenter="hoveredSlot = `ctx-${item.key}`"
          @mouseleave="hoveredSlot = null"
          @click="item.run()"
        >
          <component :is="iconFor(item.iconName)" :size="18" />
        </button>
      </div>

      <!-- Sub-selection (only when an expandable item is open) -->
      <div v-if="expansion === 'fracture'" class="sub-panel">
        <div class="sub-panel-title">Fracture</div>
        <div class="sub-panel-grid">
          <button
            v-for="v in fractureVariants"
            :key="v.key"
            class="sub-chip"
            :aria-pressed="activeState?.fracture === v.key"
            @click="setFracture(v.key)"
          >{{ v.label }}</button>
        </div>
      </div>
      <div v-else-if="expansion === 'crown'" class="sub-panel">
        <div class="sub-panel-title">Crown material</div>
        <div class="sub-panel-grid">
          <button
            v-for="c in crownMaterials"
            :key="c.key"
            class="sub-chip"
            :aria-pressed="activeState?.crown === c.key"
            @click="setCrown(c.key)"
          >{{ c.label }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.layout-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
}
@media (max-width: 1024px) {
  .layout-grid { grid-template-columns: 1fr; }
}
.odontogram-chart {
  --cell-w: 56px;
  --cell-h: 96px;
  --cell-h-occl: 64px;
  user-select: none;
}
.row {
  display: grid;
  grid-template-columns: repeat(16, minmax(0, 1fr));
  gap: 2px;
}
.row + .row { margin-top: 2px; }
.cell {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  padding: 4px 2px;
  background: #fffbea;
  border: 1px solid transparent;
  border-radius: 10px;
  cursor: pointer;
  min-height: var(--cell-h);
  transition: background 120ms, border-color 120ms;
}
.cell-upper { justify-content: flex-end; }
.cell-lower { justify-content: flex-start; }
.cell-occl {
  min-height: var(--cell-h-occl);
  background: #ffffff;
  justify-content: center;
}
.cell:hover { background: #fff4cc; border-color: rgba(59, 123, 255, 0.25); }
.cell.hovered { background: #fff4cc; border-color: rgba(59, 123, 255, 0.45); }
.cell.selected { background: #e6f0ff; border-color: rgba(59, 123, 255, 0.6); }
.cell.active { outline: 2px solid rgb(59, 123, 255); outline-offset: -2px; }
.cell.empty { background: transparent; cursor: default; }
.cell.empty:hover { background: transparent; border-color: transparent; }
.cell.wisdom { /* hookable by layer toggles */ }
.label {
  font-size: 10px;
  color: #64748b;
  line-height: 1;
}
.tooth-svg {
  display: block;
  width: 100%;
}
.tooth-svg :deep(svg) {
  display: block;
  width: 100%;
  height: auto;
  max-height: 84px;
}
.cell-occl .tooth-svg :deep(svg) { max-height: 54px; }

/* Layer toggles */
.hide-base :deep(#base) { display: none; }
.hide-pulp :deep(#tooth-healthy-pulp) { display: none; }
.hide-wisdom .cell.wisdom { visibility: hidden; }
.hide-occl-row .occl-row { display: none; }

/* Controls */
.layer-btn {
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid #d7e0ec;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.04);
  color: #1e2a3a;
  cursor: pointer;
}
.layer-btn[aria-pressed='true'] {
  background: rgb(100 15 235 / 12%);
  border-color: rgba(18, 185, 129, 0.5);
}
.btn-danger {
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 600;
  color: #b83a3a;
  border: 1px solid rgba(217, 69, 69, 0.4);
  background: rgba(217, 69, 69, 0.12);
  border-radius: 10px;
  cursor: pointer;
}
.btn-soft {
  padding: 8px 10px;
  font-size: 12px;
  font-weight: 600;
  color: #1e2a3a;
  border: 1px solid #d7e0ec;
  background: #f8fafc;
  border-radius: 10px;
  cursor: pointer;
}
.btn-soft:hover { background: #eef2f7; }

.panel {
  padding: 14px;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}
.panel.disabled { opacity: 0.5; pointer-events: none; }
.panel-title {
  margin: 0 0 8px 0;
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #475569;
}

.chip {
  padding: 8px 6px;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  border-radius: 10px;
  cursor: pointer;
  text-align: center;
}
.chip:hover { background: #eef2f7; }
.chip[aria-pressed='true'] {
  background: rgba(59, 123, 255, 0.15);
  border-color: rgba(59, 123, 255, 0.5);
  color: #1d4ed8;
}
.chip-sm { padding: 4px 2px; font-size: 11px; }
.chip-caries { font-family: ui-monospace, monospace; }
.chip-caries[aria-pressed='true'] {
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.5);
  color: #b91c1c;
}

.note-dot {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: rgb(251, 146, 60);
  box-shadow: 0 0 0 2px rgba(251, 146, 60, 0.25);
}

/* Treatment status — visual differentiation on the tooth SVG */
.tooth-svg :deep(svg[data-treatment='proposed']) {
  filter: saturate(0.35) opacity(0.65);
}
.tooth-svg :deep(svg[data-treatment='proposed']) :deep(g[data-active='1']) path,
.tooth-svg :deep(svg[data-treatment='proposed']) g[data-active='1'] path {
  stroke-dasharray: 1.4 1.2;
}
.tooth-svg :deep(svg[data-treatment='completed']) {
  filter: hue-rotate(80deg) saturate(1.2);
}

/* Cell-level treatment badge — still consumed by proposed/completed layers
 * once the derivation composable (Phase 4) stamps them onto the tooth. */
.cell.tx-proposed { box-shadow: inset 0 0 0 2px rgba(245, 158, 11, 0.6); }
.cell.tx-completed { box-shadow: inset 0 0 0 2px rgba(22, 163, 74, 0.6); }

/* Quick-actions panel: caries wheel + context bar + sub-panel */
.quick-panel {
  position: fixed;
  z-index: 40;
  width: 248px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 10px;
  filter: drop-shadow(0 10px 24px rgba(15, 23, 42, 0.22));
  user-select: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  box-sizing: border-box;
}
.quick-panel > svg {
  display: block;
}
.context-bar {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 4px;
  width: 100%;
}
.context-item {
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 1 / 1;
  border-radius: 10px;
  cursor: pointer;
  min-width: 0;
  overflow: hidden;
  transition: opacity 120ms, box-shadow 120ms, transform 120ms, filter 120ms;
  border: none;
}
.context-item-idle {
  opacity: 0.55;
  filter: saturate(0.9);
}
.context-item-idle:hover {
  opacity: 0.85;
  transform: scale(1.05);
}
.context-item-pressed {
  opacity: 1;
  box-shadow: 0 0 0 2px white, 0 0 0 4px rgba(15, 23, 42, 0.55), 0 2px 6px rgba(0, 0, 0, 0.15);
  transform: scale(1.02);
}
.context-item-expanded {
  opacity: 1;
  box-shadow: 0 0 0 2px white, 0 0 0 4px rgba(59, 123, 255, 0.55), 0 2px 6px rgba(0, 0, 0, 0.15);
}
.context-hint {
  width: 100%;
  text-align: center;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #0f172a;
  min-height: 14px;
}
.context-hint-muted { color: #94a3b8; }
.sub-panel {
  width: 100%;
  padding: 8px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}
.sub-panel-title {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #64748b;
  margin-bottom: 6px;
}
.sub-panel-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
}
.sub-chip {
  padding: 6px 4px;
  border: 1px solid #e2e8f0;
  background: white;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  color: #334155;
  cursor: pointer;
}
.sub-chip:hover { background: #eef2f7; }
.sub-chip[aria-pressed='true'] {
  background: rgba(59, 123, 255, 0.15);
  border-color: rgba(59, 123, 255, 0.5);
  color: #1d4ed8;
}
.wheel-slot {
  fill: white;
  stroke: #e2e8f0;
  stroke-width: 1;
  cursor: pointer;
  transition: fill 120ms;
}
.wheel-slot:hover, .wheel-slot.wheel-slot-hover {
  fill: #f1f5f9;
}
.wheel-slot.wheel-slot-pressed {
  fill: rgba(239, 68, 68, 0.2);
  stroke: rgba(239, 68, 68, 0.55);
}
.wheel-slot.wheel-slot-pressed.wheel-slot-hover {
  fill: rgba(239, 68, 68, 0.35);
}
.wheel-slot.wheel-slot-more {
  fill: #f8fafc;
}
.wheel-slot.wheel-slot-more.wheel-slot-hover {
  fill: #e2e8f0;
}
.wheel-label {
  font-family: ui-monospace, monospace;
  font-size: 14px;
  font-weight: 700;
  fill: #334155;
  pointer-events: none;
}
.wheel-center-action {
  font-family: ui-sans-serif, system-ui, sans-serif;
  font-size: 13px;
  font-weight: 700;
  fill: #0f172a;
  pointer-events: none;
}
.wheel-center-sub {
  font-family: ui-sans-serif, system-ui, sans-serif;
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  fill: #64748b;
  pointer-events: none;
}

/* ---------- Perio chart ---------- */
.perio-chart {
  --cols: 16;
  font-family: ui-monospace, 'SF Mono', monospace;
  font-size: 11px;
}
.perio-arch {
  display: grid;
  grid-template-columns: 70px repeat(16, minmax(0, 1fr));
  gap: 2px 2px;
  align-items: center;
}
.perio-label-col {
  font-size: 10px;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  text-align: right;
  padding-right: 6px;
}
.perio-num {
  text-align: center;
  font-weight: 700;
  color: #0f172a;
  font-size: 11px;
  padding: 3px 0;
  background: #f8fafc;
  border-radius: 4px;
}
.perio-tooth-col {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1px;
}
.perio-mobility {
  display: flex;
  justify-content: center;
}
.pd-input {
  width: 100%;
  height: 22px;
  padding: 0;
  text-align: center;
  font-size: 11px;
  font-weight: 700;
  border: 1px solid #e2e8f0;
  border-radius: 3px;
  background: #fff;
  color: #1e293b;
  outline: none;
  -moz-appearance: textfield;
}
.pd-input::-webkit-inner-spin-button,
.pd-input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
.pd-input:focus {
  border-color: rgb(59, 123, 255);
  box-shadow: 0 0 0 2px rgba(59, 123, 255, 0.2);
}
.pd-healthy { background: rgba(34, 197, 94, 0.1); color: #15803d; }
.pd-warning { background: rgba(245, 158, 11, 0.18); color: #b45309; border-color: rgba(245, 158, 11, 0.4); }
.pd-severe {
  background: rgba(239, 68, 68, 0.2);
  color: #b91c1c;
  border-color: rgba(239, 68, 68, 0.5);
  font-weight: 800;
}
.bop-dot {
  width: 100%;
  height: 12px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 50%;
  background: transparent;
  cursor: pointer;
  aspect-ratio: 1/1;
  max-width: 12px;
  justify-self: center;
}
.bop-dot:hover { background: rgba(148, 163, 184, 0.2); }
.bop-dot.bop-on {
  background: rgb(239, 68, 68);
  border-color: #b91c1c;
  box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.25);
}
.mobility-select {
  width: 100%;
  font-size: 11px;
  font-weight: 700;
  border: 1px solid #e2e8f0;
  border-radius: 3px;
  background: #fff;
  padding: 1px 2px;
  text-align: center;
}
.perio-divider {
  height: 1px;
  background: linear-gradient(90deg, transparent, #cbd5e1, transparent);
  margin: 10px 0;
}

/* Highlight perio cells that match the currently hovered tooth (from either chart or perio). */
.perio-num, .perio-tooth-col, .perio-mobility {
  transition: background 120ms, box-shadow 120ms;
  border-radius: 4px;
}
.perio-num.perio-hovered,
.perio-num.perio-selected,
.perio-num.perio-active {
  background: rgb(59, 123, 255);
  color: white;
}
.perio-tooth-col.perio-hovered,
.perio-mobility.perio-hovered {
  background: rgba(59, 123, 255, 0.12);
  box-shadow: inset 0 0 0 1px rgba(59, 123, 255, 0.3);
}
.perio-tooth-col.perio-selected,
.perio-mobility.perio-selected {
  background: rgba(59, 123, 255, 0.14);
  box-shadow: inset 0 0 0 1px rgba(59, 123, 255, 0.45);
}
.perio-tooth-col.perio-active,
.perio-mobility.perio-active {
  background: rgba(59, 123, 255, 0.22);
  box-shadow: inset 0 0 0 1.5px rgba(59, 123, 255, 0.65);
}
</style>
