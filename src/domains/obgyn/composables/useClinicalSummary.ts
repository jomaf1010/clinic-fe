import { computed, type Ref } from 'vue'
import { contraceptionLabel } from '../types/obgyn.types'
import type { GynProfile, Pregnancy, ContraceptiveEntry } from '../types/obgyn.types'

function b(text: string | number) { return `<b>${text}</b>` }

function formatDate(d: string | null): string {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function useClinicalSummary(
  gynProfile: Ref<GynProfile | null>,
  activePregnancy: Ref<Pregnancy | null>,
  gpalString: Ref<string | null>,
) {
  const summary = computed(() => {
    const lines: string[] = []
    const p = gynProfile.value
    if (!p) return null

    // Menstrual cycle
    if (p.cycle_length || p.regularity) {
      const parts: string[] = []
      if (p.cycle_length) parts.push(`${b(p.cycle_length + '-day')} cycle`)
      if (p.regularity) parts.push(b(p.regularity))
      if (p.flow) parts.push(`${b(p.flow)} flow`)
      if (p.dysmenorrhea && p.dysmenorrhea !== 'none') parts.push(`${b(p.dysmenorrhea)} dysmenorrhea`)
      lines.push(`Menstrual: ${parts.join(', ')}.`)
    }

    // GPAL
    if (gpalString.value) {
      lines.push(`Obstetric history: ${b(gpalString.value)}.`)
    }

    // Active pregnancy
    const preg = activePregnancy.value
    if (preg?.current_ga) {
      const parts: string[] = []
      parts.push(`${b(preg.current_ga.weeks + 'w' + preg.current_ga.days + 'd')}`)
      if (preg.edd) parts.push(`EDD ${b(formatDate(preg.edd))}`)
      if (preg.risk_level && preg.risk_level !== 'low') parts.push(`${b(preg.risk_level + ' risk')}`)
      lines.push(`Currently pregnant: ${parts.join(', ')}.`)
    }

    // Contraception
    const entries = p.contraception
    if (entries?.length) {
      const current = entries.filter((e: ContraceptiveEntry) => !e.end_date)
      if (current.length > 0) {
        const methods = current.flatMap((e: ContraceptiveEntry) => e.method.map((m) => b(contraceptionLabel(m))))
        lines.push(`Contraception: ${methods.join(', ')}.`)
      }
    }

    // Latest screening
    const screenings = p.screenings
    if (screenings?.length) {
      const latest = screenings[0]
      const typeLabel = latest.type.replace(/_/g, ' ')
      lines.push(`Last screening: ${b(typeLabel)} on ${b(formatDate(latest.date))}${latest.result ? ` — ${b(latest.result)}` : ''}.`)
    }

    return lines.length ? lines.join(' ') : null
  })

  return { clinicalSummary: summary }
}
