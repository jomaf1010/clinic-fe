/**
 * Builds casual, human-friendly narrative summaries for consultations.
 * Uses deterministic randomization based on consultation ID so phrases
 * stay consistent across re-renders.
 */

import DOMPurify from 'dompurify'
import { FREQUENCY_HUMAN } from '@/domains/medicine/constants'
import type { ConsultationTriage } from '@/domains/consultation/types/consultation.types'
import { parseBp, compareBp, classifyBp, isBpConcerning, DEFAULT_VITALS_CONFIG, type VitalsConfig } from '@/lib/vitals'

// -- Stable hash --------------------------------------------------------

export function stableIndex(id: string, max: number): number {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0
  }
  return Math.abs(hash) % max
}

// -- Phrase pools -------------------------------------------------------

const complaintPhrases = [
  (c: string) => `Patient came in for <strong>${c}</strong>`,
  (c: string) => `Patient was complaining about <strong>${c}</strong>`,
  (c: string) => `Visited the clinic due to <strong>${c}</strong>`,
  (c: string) => `Came in reporting <strong>${c}</strong>`,
  (c: string) => `Sought consultation for <strong>${c}</strong>`,
  (c: string) => `Patient presented with <strong>${c}</strong>`,
  (c: string) => `Checked in with concerns about <strong>${c}</strong>`,
  (c: string) => `Patient was experiencing <strong>${c}</strong>`,
  (c: string) => `Walked in complaining of <strong>${c}</strong>`,
  (c: string) => `Came to the clinic for <strong>${c}</strong>`,
]

const diagnosisPhrases = [
  (d: string) => `diagnosed with ${d}`,
  (d: string) => `found to have ${d}`,
  (d: string) => `assessment revealed ${d}`,
  (d: string) => `turned out to be ${d}`,
  (d: string) => `condition identified as ${d}`,
]

const advicePhrases = [
  (a: string) => `advised to <strong>${a}</strong>`,
  (a: string) => `recommended to <strong>${a}</strong>`,
  (a: string) => `told to <strong>${a}</strong>`,
  (a: string) => `instructed to <strong>${a}</strong>`,
  (a: string) => `suggested to <strong>${a}</strong>`,
]

const prescriptionIntroPhrases = [
  (rx: string) => `prescribed with ${rx}`,
  (rx: string) => `given a prescription for ${rx}`,
  (rx: string) => `put on ${rx}`,
  (rx: string) => `started on ${rx}`,
  (rx: string) => `medication includes ${rx}`,
  (rx: string) => `prescribed ${rx}`,
]

// -- Helpers ------------------------------------------------------------

function humanizeFrequency(freq: string): string {
  return FREQUENCY_HUMAN[freq] ?? freq.toLowerCase()
}

function joinList(items: string[]): string {
  if (items.length === 1) return items[0]!
  return items.slice(0, -1).join(', ') + ` and ${items[items.length - 1]}`
}

function buildRxNarrative(items: { drug_name: string; dose: string; frequency: string; duration: string }[]): string {
  const parts = items.map((item) => {
    let text = `<strong>${item.drug_name}</strong>`
    if (item.dose) text += ` ${item.dose}`
    text += `, ${humanizeFrequency(item.frequency)}`
    if (item.duration) text += ` for ${item.duration}`
    return text
  })
  return joinList(parts)
}

// -- Main builder -------------------------------------------------------

export interface NarrativeInput {
  id: string
  complaint?: string | null
  diagnoses?: string[]
  advice?: string | null
  prescriptionItems?: { drug_name: string; dose: string; frequency: string; duration: string }[]
}

/**
 * Build a casual narrative summary for a consultation.
 * Returns an HTML string with `<strong>` tags for emphasis.
 */
export function buildNarrative(input: NarrativeInput): string {
  const { id } = input
  const parts: string[] = []

  // Complaint
  if (input.complaint) {
    const fn = complaintPhrases[stableIndex(id, complaintPhrases.length)]!
    parts.push(fn(input.complaint.toLowerCase()))
  }

  // Diagnoses
  const diagnoses = (input.diagnoses ?? []).filter(Boolean)
  if (diagnoses.length) {
    const joined = joinList(diagnoses.map(d => `<strong>${d}</strong>`))
    const fn = diagnosisPhrases[stableIndex(id + 'd', diagnosisPhrases.length)]!
    parts.push(fn(joined))
  }

  // Advice
  if (input.advice) {
    const fn = advicePhrases[stableIndex(id + 'a', advicePhrases.length)]!
    parts.push(fn(input.advice.toLowerCase()))
  }

  // Prescription
  const rxItems = input.prescriptionItems ?? []
  if (rxItems.length) {
    const rxText = buildRxNarrative(rxItems)
    const fn = prescriptionIntroPhrases[stableIndex(id + 'rx', prescriptionIntroPhrases.length)]!
    parts.push(fn(rxText))
  }

  if (!parts.length) return ''
  return DOMPurify.sanitize(parts.join(', ') + '.', { ALLOWED_TAGS: ['strong'], ALLOWED_ATTR: [] })
}

// -- Vitals comparison narrative ----------------------------------------

interface VitalChange {
  label: string
  prev: string
  curr: string
  direction: 'up' | 'down' | 'worsened' | 'improved'
  concern: boolean
  extra?: string
}

const increasePhrases = [
  (l: string, p: string, c: string) => `${l} went up from <strong>${p}</strong> to <strong>${c}</strong>`,
  (l: string, p: string, c: string) => `${l} increased from <strong>${p}</strong> to <strong>${c}</strong>`,
  (l: string, p: string, c: string) => `${l} rose from <strong>${p}</strong> to <strong>${c}</strong>`,
  (l: string, p: string, c: string) => `${l} climbed from <strong>${p}</strong> to <strong>${c}</strong>`,
  (l: string, p: string, c: string) => `${l} jumped from <strong>${p}</strong> to <strong>${c}</strong>`,
  (l: string, p: string, c: string) => `${l} is higher now at <strong>${c}</strong>, was <strong>${p}</strong>`,
  (l: string, p: string, c: string) => `${l} spiked from <strong>${p}</strong> to <strong>${c}</strong>`,
  (l: string, p: string, c: string) => `${l} moved up from <strong>${p}</strong> to <strong>${c}</strong>`,
]

const decreasePhrases = [
  (l: string, p: string, c: string) => `${l} went down from <strong>${p}</strong> to <strong>${c}</strong>`,
  (l: string, p: string, c: string) => `${l} dropped from <strong>${p}</strong> to <strong>${c}</strong>`,
  (l: string, p: string, c: string) => `${l} decreased from <strong>${p}</strong> to <strong>${c}</strong>`,
  (l: string, p: string, c: string) => `${l} fell from <strong>${p}</strong> to <strong>${c}</strong>`,
  (l: string, p: string, c: string) => `${l} dipped from <strong>${p}</strong> to <strong>${c}</strong>`,
  (l: string, p: string, c: string) => `${l} is lower now at <strong>${c}</strong>, was <strong>${p}</strong>`,
  (l: string, p: string, c: string) => `${l} came down from <strong>${p}</strong> to <strong>${c}</strong>`,
  (l: string, p: string, c: string) => `${l} slid from <strong>${p}</strong> to <strong>${c}</strong>`,
]

const worsenedPhrases = [
  (l: string, p: string, c: string) => `${l} worsened from <strong>${p}</strong> to <strong>${c}</strong>`,
  (l: string, p: string, c: string) => `${l} moved to a higher risk level, from <strong>${p}</strong> to <strong>${c}</strong>`,
  (l: string, p: string, c: string) => `${l} escalated from <strong>${p}</strong> to <strong>${c}</strong>`,
  (l: string, p: string, c: string) => `${l} got worse, going from <strong>${p}</strong> to <strong>${c}</strong>`,
  (l: string, p: string, c: string) => `${l} is now at <strong>${c}</strong>, up from <strong>${p}</strong> — a higher category`,
  (l: string, p: string, c: string) => `${l} shifted to a more concerning level, <strong>${p}</strong> to <strong>${c}</strong>`,
]

const improvedPhrases = [
  (l: string, p: string, c: string) => `${l} improved from <strong>${p}</strong> to <strong>${c}</strong>`,
  (l: string, p: string, c: string) => `${l} moved to a lower risk level, from <strong>${p}</strong> to <strong>${c}</strong>`,
  (l: string, p: string, c: string) => `${l} got better, going from <strong>${p}</strong> to <strong>${c}</strong>`,
  (l: string, p: string, c: string) => `${l} is now at <strong>${c}</strong>, down from <strong>${p}</strong> — a better category`,
  (l: string, p: string, c: string) => `${l} dropped to a healthier level, <strong>${p}</strong> to <strong>${c}</strong>`,
  (l: string, p: string, c: string) => `${l} settled down from <strong>${p}</strong> to <strong>${c}</strong>`,
]

const sameCategoryPhrases = [
  (l: string, p: string, c: string, e: string) => `${l} changed from <strong>${p}</strong> to <strong>${c}</strong>, ${e}`,
  (l: string, p: string, c: string, e: string) => `${l} shifted slightly from <strong>${p}</strong> to <strong>${c}</strong>, ${e}`,
  (l: string, p: string, c: string, e: string) => `${l} moved from <strong>${p}</strong> to <strong>${c}</strong> but ${e}`,
]

const vitalsConnectors = [
  ', and also ',
  '. Meanwhile, ',
  '. On top of that, ',
  ', plus ',
  '. Additionally, ',
  ', and ',
  '. Also, ',
]

const unchangedPhrases = [
  (items: string) => `${items} remained the same since last visit`,
  (items: string) => `${items} stayed steady compared to before`,
  (items: string) => `No change in ${items} from last time`,
  (items: string) => `${items} held steady since the previous visit`,
  (items: string) => `${items} unchanged from last check`,
]

const vitalsIntroPhrases = [
  'Since the last visit, ',
  'Compared to before, ',
  'From the previous check-up, ',
  'Looking at the last visit, ',
  'Since last time, ',
  'Versus the previous visit, ',
]

function toNum(v: string | number | null | undefined): number | null {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}
function toStr(v: string | number | null | undefined): string | null {
  if (v == null || v === '') return null
  return String(v)
}

function normalizeVitals(v: ConsultationTriage['vitals']) {
  return {
    bp: toStr(v.bp),
    hr: toNum(v.hr),
    temp: toNum(v.temp),
    spo2: toNum(v.spo2),
    rr: toNum(v.rr),
    blood_sugar: toNum(v.blood_sugar),
    weight: toNum(v.weight),
    height: toNum(v.height),
    pain_score: toNum(v.pain_score),
  }
}

function collectChanges(current: ConsultationTriage, previous: ConsultationTriage, config: VitalsConfig): VitalChange[] {
  const result: VitalChange[] = []
  const curr = normalizeVitals(current.vitals)
  const prev = normalizeVitals(previous.vitals)

  // BP — AHA category comparison
  const currBp = parseBp(curr.bp)
  const prevBp = parseBp(prev.bp)
  if (currBp && prevBp && curr.bp !== prev.bp) {
    const comparison = compareBp(currBp, prevBp, config)
    const currClass = classifyBp(currBp, config)
    const prevClass = classifyBp(prevBp, config)
    if (comparison !== 'same') {
      result.push({ label: 'Blood Pressure', prev: `${prev.bp} (${prevClass.label})`, curr: `${curr.bp} (${currClass.label})`, direction: comparison, concern: isBpConcerning(currBp, config) })
    } else {
      result.push({ label: 'Blood Pressure', prev: prev.bp!, curr: curr.bp!, direction: 'up', concern: isBpConcerning(currBp, config), extra: `still classified as ${currClass.label}` })
    }
  }

  if (curr.hr != null && prev.hr != null && curr.hr !== prev.hr)
    result.push({ label: 'Heart Rate', prev: `${prev.hr} bpm`, curr: `${curr.hr} bpm`, direction: curr.hr > prev.hr ? 'up' : 'down', concern: curr.hr > config.hr_high || curr.hr < config.hr_low })

  if (curr.temp != null && prev.temp != null && Math.abs(curr.temp - prev.temp) >= 0.1)
    result.push({ label: 'Temperature', prev: `${prev.temp}°C`, curr: `${curr.temp}°C`, direction: curr.temp > prev.temp ? 'up' : 'down', concern: curr.temp > config.temp_normal_max || curr.temp < config.temp_hypothermia })

  if (curr.spo2 != null && prev.spo2 != null && curr.spo2 !== prev.spo2)
    result.push({ label: 'Oxygen Level', prev: `${prev.spo2}%`, curr: `${curr.spo2}%`, direction: curr.spo2 > prev.spo2 ? 'up' : 'down', concern: curr.spo2 < config.spo2_normal })

  if (curr.rr != null && prev.rr != null && curr.rr !== prev.rr)
    result.push({ label: 'Breathing Rate', prev: `${prev.rr}/min`, curr: `${curr.rr}/min`, direction: curr.rr > prev.rr ? 'up' : 'down', concern: curr.rr > config.rr_high || curr.rr < config.rr_low })

  if (curr.blood_sugar != null && prev.blood_sugar != null && curr.blood_sugar !== prev.blood_sugar)
    result.push({ label: 'Blood Sugar', prev: `${prev.blood_sugar} mg/dL`, curr: `${curr.blood_sugar} mg/dL`, direction: curr.blood_sugar > prev.blood_sugar ? 'up' : 'down', concern: curr.blood_sugar > config.bs_prediabetic || curr.blood_sugar < config.bs_hypoglycemia })

  if (curr.weight != null && prev.weight != null && curr.weight !== prev.weight)
    result.push({ label: 'Weight', prev: `${prev.weight} kg`, curr: `${curr.weight} kg`, direction: curr.weight > prev.weight ? 'up' : 'down', concern: false })

  if (curr.height != null && prev.height != null && curr.height !== prev.height)
    result.push({ label: 'Height', prev: `${prev.height} cm`, curr: `${curr.height} cm`, direction: curr.height > prev.height ? 'up' : 'down', concern: false })

  if (curr.pain_score != null && prev.pain_score != null && curr.pain_score !== prev.pain_score)
    result.push({ label: 'Pain Level', prev: `${prev.pain_score}/10`, curr: `${curr.pain_score}/10`, direction: curr.pain_score > prev.pain_score ? 'up' : 'down', concern: curr.pain_score >= config.pain_high })

  return result
}

function collectUnchanged(current: ConsultationTriage, previous: ConsultationTriage): string[] {
  const curr = current.vitals
  const prev = previous.vitals
  const result: string[] = []

  if (curr.bp && prev.bp && curr.bp === prev.bp) result.push('Blood Pressure')
  if (curr.hr != null && prev.hr != null && curr.hr === prev.hr) result.push('Heart Rate')
  if (curr.temp != null && prev.temp != null && curr.temp === prev.temp) result.push('Temperature')
  if (curr.spo2 != null && prev.spo2 != null && curr.spo2 === prev.spo2) result.push('Oxygen Level')
  if (curr.rr != null && prev.rr != null && curr.rr === prev.rr) result.push('Breathing Rate')
  if (curr.blood_sugar != null && prev.blood_sugar != null && curr.blood_sugar === prev.blood_sugar) result.push('Blood Sugar')
  if (curr.weight != null && prev.weight != null && curr.weight === prev.weight) result.push('Weight')
  if (curr.height != null && prev.height != null && curr.height === prev.height) result.push('Height')
  if (curr.pain_score != null && prev.pain_score != null && curr.pain_score === prev.pain_score) result.push('Pain Level')

  return result
}

/**
 * Build a verbal narrative comparing vitals between two triage records.
 * Returns an HTML string, or empty string if nothing to compare.
 */
export function buildVitalsNarrative(id: string, current: ConsultationTriage, previous: ConsultationTriage, config: VitalsConfig = DEFAULT_VITALS_CONFIG): string {
  const changes = collectChanges(current, previous, config)
  const unchanged = collectUnchanged(current, previous)

  if (!changes.length && !unchanged.length) return ''

  const sentences: string[] = []

  changes.forEach((change, i) => {
    let sentence: string

    if (change.extra) {
      const fn = sameCategoryPhrases[stableIndex(id + change.label, sameCategoryPhrases.length)]!
      sentence = fn(change.label, change.prev, change.curr, change.extra)
    } else if (change.direction === 'worsened') {
      const fn = worsenedPhrases[stableIndex(id + change.label, worsenedPhrases.length)]!
      sentence = fn(change.label, change.prev, change.curr)
    } else if (change.direction === 'improved') {
      const fn = improvedPhrases[stableIndex(id + change.label, improvedPhrases.length)]!
      sentence = fn(change.label, change.prev, change.curr)
    } else {
      const phrases = change.direction === 'up' ? increasePhrases : decreasePhrases
      const fn = phrases[stableIndex(id + change.label, phrases.length)]!
      sentence = fn(change.label, change.prev, change.curr)
    }

    if (i === 0) {
      const intro = vitalsIntroPhrases[stableIndex(id, vitalsIntroPhrases.length)]
      sentence = intro + sentence.charAt(0).toLowerCase() + sentence.slice(1)
    }

    sentences.push(sentence)
  })

  let result = ''
  sentences.forEach((part, i) => {
    if (i === 0) {
      result = part
    } else {
      const conn = vitalsConnectors[stableIndex(id + String(i), vitalsConnectors.length)]
      result += conn + part.charAt(0).toLowerCase() + part.slice(1)
    }
  })

  if (result) result += '.'

  if (unchanged.length) {
    const joined = joinList(unchanged)
    const fn = unchangedPhrases[stableIndex(id + 'u', unchangedPhrases.length)]!
    result += (result ? ' ' : '') + fn(joined) + '.'
  }

  return result ? DOMPurify.sanitize(result, { ALLOWED_TAGS: ['strong'], ALLOWED_ATTR: [] }) : result
}
