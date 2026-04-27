/**
 * Shared tooth-SVG loader. Ported from the playground so `<ToothCell>` and
 * the playground can render the exact same SVG per FDI with the same
 * cached markup.
 *
 * The raw SVGs are the ZoliQua templates (+ in-house anterior occlusal
 * views) with every clinical group normalised to `data-active="0"`.
 * Consumers then flip `data-active="1"` on the groups they want to show.
 */
import tooth11Raw from '../assets/teeth-svgs/11.svg?raw'
import tooth11OcclRaw from '../assets/teeth-svgs/11_occl.svg?raw'
import tooth13Raw from '../assets/teeth-svgs/13.svg?raw'
import tooth13OcclRaw from '../assets/teeth-svgs/13_occl.svg?raw'
import tooth14Raw from '../assets/teeth-svgs/14.svg?raw'
import tooth14OcclRaw from '../assets/teeth-svgs/14_occl.svg?raw'
import tooth16Raw from '../assets/teeth-svgs/16.svg?raw'
import tooth16OcclRaw from '../assets/teeth-svgs/16_occl.svg?raw'

export type ToothView = 'buccal' | 'occlusal'
type TemplateKey = 11 | 13 | 14 | 16

interface ToothTemplate {
  tpl: TemplateKey
  rot: 0 | 180
  mirror: boolean
}

/** FDI → ZoliQua template + rotation + horizontal mirror. */
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

const TEMPLATE_BUCCAL: Record<TemplateKey, string> = {
  11: tooth11Raw, 13: tooth13Raw, 14: tooth14Raw, 16: tooth16Raw,
}
const TEMPLATE_OCCL: Partial<Record<TemplateKey, string>> = {
  11: tooth11OcclRaw, 13: tooth13OcclRaw, 14: tooth14OcclRaw, 16: tooth16OcclRaw,
}

export const UPPER_FDI = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28]
export const LOWER_FDI = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38]

export function hasOcclusalView(fdi: number): boolean {
  const tpl = TOOTH_TEMPLATE[fdi]
  return !!tpl && tpl.tpl in TEMPLATE_OCCL && !!TEMPLATE_OCCL[tpl.tpl]
}

export function isAnteriorFdi(fdi: number): boolean {
  const pos = fdi % 10
  return pos >= 1 && pos <= 3
}

export function isPrimaryFdi(fdi: number): boolean {
  const first = Math.floor(fdi / 10)
  return first >= 5 && first <= 8
}

function parseSvg(raw: string): SVGSVGElement {
  const doc = new DOMParser().parseFromString(raw, 'image/svg+xml')
  return doc.documentElement as unknown as SVGSVGElement
}

/**
 * Every clinical group starts hidden — groups with `style="display: none"`
 * get lowered to `data-active="0"` for uniform toggling and the inline
 * style stripped (an inline `display: none` would beat the CSS rule
 * `[data-active='1'] { display: '' }` and the group would never reappear).
 *
 * Whitespace-tolerant regex — the source SVGs use `display: none` with a
 * space; an exact `[style*="display:none"]` selector would match nothing.
 */
function normaliseSvg(root: SVGSVGElement): void {
  root.querySelectorAll<SVGElement>('[id]').forEach((n) => {
    const style = n.getAttribute('style')
    if (style && /display\s*:\s*none/i.test(style)) {
      n.setAttribute('data-active', '0')
      const cleaned = style.replace(/display\s*:\s*none\s*;?/gi, '').replace(/;;+/g, ';').trim()
      if (cleaned) n.setAttribute('style', cleaned)
      else n.removeAttribute('style')
    }
  })
  // Defensive: groups inside the known "switchable" containers default to
  // hidden if not explicitly stamped — matches playground behaviour.
  const switchables = ['mods', 'tooth-variants', 'endos', 'surfaces', 'restorations', 'specials']
  for (const gId of switchables) {
    const g = root.querySelector(`#${gId}`)
    if (!g) continue
    g.querySelectorAll<SVGElement>('[id]').forEach((n) => {
      if (!n.hasAttribute('data-active')) n.setAttribute('data-active', '0')
    })
  }
}

function wrapWithTransform(root: SVGSVGElement, rot: 0 | 180, mirror: boolean): void {
  if (rot === 0 && !mirror) return
  const vb = (root.getAttribute('viewBox') ?? '0 0 40.6 64').trim().split(/\s+/).map(Number)
  const cx = (vb[0] ?? 0) + (vb[2] ?? 0) / 2
  const cy = (vb[1] ?? 0) + (vb[3] ?? 0) / 2
  const transforms: string[] = []
  if (rot === 180) transforms.push(`rotate(180 ${cx} ${cy})`)
  if (mirror) transforms.push(`scale(-1 1) translate(${-2 * cx} 0)`)
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g')
  while (root.firstChild) g.appendChild(root.firstChild)
  g.setAttribute('transform', transforms.join(' '))
  root.appendChild(g)
}

const svgCache = new Map<string, string>()

/**
 * Returns the ready-to-mount SVG markup for the given FDI + view.
 * Empty string if no template is registered (e.g. occlusal view isn't
 * supplied for every anterior tooth).
 */
export function buildToothSvg(fdi: number, view: ToothView): string {
  const key = `${fdi}:${view}`
  const cached = svgCache.get(key)
  if (cached !== undefined) return cached

  const tpl = TOOTH_TEMPLATE[fdi]
  if (!tpl) {
    svgCache.set(key, '')
    return ''
  }
  const raw = view === 'occlusal' ? TEMPLATE_OCCL[tpl.tpl] : TEMPLATE_BUCCAL[tpl.tpl]
  if (!raw) {
    svgCache.set(key, '')
    return ''
  }

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
