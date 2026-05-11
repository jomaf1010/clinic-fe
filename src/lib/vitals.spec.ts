/**
 * Tests for `lib/vitals.ts`.
 *
 * These thresholds drive the coloured-state pills on every consultation
 * vitals card and feed `narrative.ts` for "since last visit" sentences.
 * Wrong colour = wrong clinical signal. Boundaries are explicitly tested
 * because BP/BMI/glucose categories are off-by-one heaven.
 */

import { describe, expect, it } from 'vitest'
import {
  parseBp,
  classifyBp,
  classifyBpString,
  classifyBpAsStatus,
  compareBp,
  isBpAbnormal,
  isBpConcerning,
  classifyHr,
  classifyTemp,
  classifySpo2,
  classifyRr,
  classifyBloodSugar,
  classifyPain,
  classifyBmi,
  DEFAULT_VITALS_CONFIG,
} from './vitals'

describe('parseBp', () => {
  it('parses a well-formed string', () => {
    expect(parseBp('130/80')).toEqual({ systolic: 130, diastolic: 80 })
  })

  it('returns null for empty/null/undefined', () => {
    expect(parseBp(null)).toBeNull()
    expect(parseBp(undefined)).toBeNull()
    expect(parseBp('')).toBeNull()
  })

  it('returns null when missing the slash', () => {
    expect(parseBp('130-80')).toBeNull()
  })

  it('returns null when either value is non-numeric', () => {
    expect(parseBp('abc/80')).toBeNull()
    expect(parseBp('130/xyz')).toBeNull()
  })

  it('returns null on non-positive values', () => {
    expect(parseBp('0/80')).toBeNull()
    expect(parseBp('130/0')).toBeNull()
    expect(parseBp('-10/80')).toBeNull()
  })
})

describe('classifyBp — AHA categories', () => {
  it('classifies normal (<120 AND <80)', () => {
    expect(classifyBp({ systolic: 110, diastolic: 70 }).category).toBe('normal')
  })

  it('classifies elevated (120-129 AND <80)', () => {
    expect(classifyBp({ systolic: 125, diastolic: 75 }).category).toBe('elevated')
  })

  it('classifies stage 1 by systolic 130', () => {
    expect(classifyBp({ systolic: 130, diastolic: 75 }).category).toBe('stage1')
  })

  it('classifies stage 1 by diastolic 80 even if systolic normal', () => {
    expect(classifyBp({ systolic: 115, diastolic: 80 }).category).toBe('stage1')
  })

  it('classifies stage 2 by systolic 140', () => {
    expect(classifyBp({ systolic: 140, diastolic: 85 }).category).toBe('stage2')
  })

  it('classifies stage 2 by diastolic 90 even when systolic is in stage 1 range', () => {
    expect(classifyBp({ systolic: 135, diastolic: 90 }).category).toBe('stage2')
  })

  it('classifies hypertensive crisis when systolic > 180', () => {
    expect(classifyBp({ systolic: 181, diastolic: 100 }).category).toBe('crisis')
  })

  it('classifies hypertensive crisis when diastolic > 120', () => {
    expect(classifyBp({ systolic: 150, diastolic: 121 }).category).toBe('crisis')
  })

  it('uses the higher category when sys/dia disagree', () => {
    // sys=140 (stage2) + dia=70 → stage2 wins
    expect(classifyBp({ systolic: 140, diastolic: 70 }).category).toBe('stage2')
  })

  it('label and severity are wired together', () => {
    const r = classifyBp({ systolic: 200, diastolic: 130 })
    expect(r.severity).toBe(4)
    expect(r.label).toBe('Hypertensive Crisis')
  })
})

describe('classifyBpString', () => {
  it('returns null for invalid strings', () => {
    expect(classifyBpString('garbage')).toBeNull()
    expect(classifyBpString(null)).toBeNull()
  })

  it('round-trips through parseBp', () => {
    expect(classifyBpString('130/80')?.category).toBe('stage1')
  })
})

describe('compareBp', () => {
  it('detects worsening across categories', () => {
    expect(compareBp({ systolic: 145, diastolic: 90 }, { systolic: 110, diastolic: 70 })).toBe('worsened')
  })

  it('detects improvement across categories', () => {
    expect(compareBp({ systolic: 110, diastolic: 70 }, { systolic: 145, diastolic: 90 })).toBe('improved')
  })

  it('returns "same" within the same category', () => {
    expect(compareBp({ systolic: 110, diastolic: 70 }, { systolic: 115, diastolic: 75 })).toBe('same')
  })
})

describe('isBpAbnormal / isBpConcerning', () => {
  it('isBpAbnormal trips at elevated', () => {
    expect(isBpAbnormal({ systolic: 110, diastolic: 70 })).toBe(false)
    expect(isBpAbnormal({ systolic: 125, diastolic: 75 })).toBe(true)
  })

  it('isBpConcerning trips at stage 1', () => {
    expect(isBpConcerning({ systolic: 125, diastolic: 75 })).toBe(false)
    expect(isBpConcerning({ systolic: 130, diastolic: 80 })).toBe(true)
  })
})

describe('classifyBpAsStatus', () => {
  it('returns null on invalid input', () => {
    expect(classifyBpAsStatus(null)).toBeNull()
  })

  it('maps normal → severity normal', () => {
    expect(classifyBpAsStatus('110/70')?.severity).toBe('normal')
  })

  it('maps elevated → severity elevated', () => {
    expect(classifyBpAsStatus('125/75')?.severity).toBe('elevated')
  })

  it('maps crisis → severity critical', () => {
    expect(classifyBpAsStatus('200/130')?.severity).toBe('critical')
  })

  it('maps stage 1/2 → severity high', () => {
    expect(classifyBpAsStatus('140/90')?.severity).toBe('high')
  })
})

describe('classifyHr', () => {
  it('returns null for null/undefined', () => {
    expect(classifyHr(null)).toBeNull()
    expect(classifyHr(undefined)).toBeNull()
  })

  it('flags bradycardia below 60', () => {
    expect(classifyHr(55)?.label).toBe('Bradycardia')
  })

  it('reports normal in 60–100', () => {
    expect(classifyHr(60)?.label).toBe('Normal')
    expect(classifyHr(100)?.label).toBe('Normal')
  })

  it('flags tachycardia over 100', () => {
    expect(classifyHr(110)?.label).toBe('Tachycardia')
  })

  it('respects age-based override ranges', () => {
    const ranges = [{ days_min: 0, days_max: 365, min: 100, max: 160 }]
    // 80 bpm is normal in adults, but bradycardic for an infant per the override
    expect(classifyHr(80, DEFAULT_VITALS_CONFIG, 30, ranges)?.severity).toBe('low')
    expect(classifyHr(120, DEFAULT_VITALS_CONFIG, 30, ranges)?.label).toBe('Normal')
  })
})

describe('classifyTemp', () => {
  it('returns null for missing values', () => {
    expect(classifyTemp(null)).toBeNull()
  })

  it('flags hypothermia below 36', () => {
    expect(classifyTemp(35.5)?.label).toBe('Hypothermia')
  })

  it('reports normal up to 37.5', () => {
    expect(classifyTemp(37.5)?.label).toBe('Normal')
  })

  it('flags low-grade fever 37.6–38.5', () => {
    expect(classifyTemp(38)?.label).toBe('Low-grade fever')
  })

  it('flags high fever above 38.5', () => {
    expect(classifyTemp(39)?.label).toBe('High fever')
  })

  it('uses age-based simple low/high range when provided', () => {
    const ranges = [{ days_min: 0, days_max: 365, min: 36.5, max: 37.5 }]
    // Within the override range
    expect(classifyTemp(37, DEFAULT_VITALS_CONFIG, 30, ranges)?.label).toBe('Normal')
    expect(classifyTemp(36, DEFAULT_VITALS_CONFIG, 30, ranges)?.label).toBe('Hypothermia')
    expect(classifyTemp(38, DEFAULT_VITALS_CONFIG, 30, ranges)?.label).toBe('Fever')
  })
})

describe('classifySpo2', () => {
  it('reports normal at 95+', () => {
    expect(classifySpo2(96)?.label).toBe('Normal')
  })

  it('flags low between 90–94', () => {
    expect(classifySpo2(92)?.label).toBe('Low')
  })

  it('flags critical below 90', () => {
    expect(classifySpo2(85)?.label).toBe('Critical')
  })

  it('returns null for null', () => {
    expect(classifySpo2(null)).toBeNull()
  })
})

describe('classifyRr', () => {
  it('reports normal between 12 and 20', () => {
    expect(classifyRr(16)?.label).toBe('Normal')
  })

  it('flags low <12', () => {
    expect(classifyRr(10)?.label).toBe('Low')
  })

  it('flags elevated >20', () => {
    expect(classifyRr(25)?.label).toBe('Elevated')
  })
})

describe('classifyBloodSugar', () => {
  it('flags hypoglycemia below 70', () => {
    expect(classifyBloodSugar(65)?.label).toContain('Low')
  })

  it('reports normal fasting 70–100', () => {
    expect(classifyBloodSugar(95, DEFAULT_VITALS_CONFIG, 'fasting')?.label).toBe('Normal')
  })

  it('flags pre-diabetic fasting 101–125', () => {
    expect(classifyBloodSugar(115, DEFAULT_VITALS_CONFIG, 'fasting')?.label).toBe('Pre-diabetic')
  })

  it('flags diabetic fasting >125', () => {
    expect(classifyBloodSugar(150, DEFAULT_VITALS_CONFIG, 'fasting')?.label).toContain('Diabetic')
  })

  it('uses random thresholds (140 / 200) when timing is random', () => {
    expect(classifyBloodSugar(135, DEFAULT_VITALS_CONFIG, 'random')?.label).toBe('Normal')
    expect(classifyBloodSugar(160, DEFAULT_VITALS_CONFIG, 'random')?.label).toBe('Pre-diabetic')
    expect(classifyBloodSugar(220, DEFAULT_VITALS_CONFIG, 'random')?.label).toContain('Diabetic')
  })

  it('returns null for null', () => {
    expect(classifyBloodSugar(null)).toBeNull()
  })
})

describe('classifyPain', () => {
  it('returns null when pain is below threshold', () => {
    expect(classifyPain(3)).toBeNull()
  })

  it('flags high when >= 7', () => {
    expect(classifyPain(7)?.label).toBe('High')
    expect(classifyPain(10)?.label).toBe('High')
  })
})

describe('classifyBmi', () => {
  it('flags underweight under 18.5', () => {
    expect(classifyBmi(17)?.label).toBe('Underweight')
  })

  it('reports normal in 18.5–24.9', () => {
    expect(classifyBmi(18.5)?.label).toBe('Normal')
    expect(classifyBmi(24.9)?.label).toBe('Normal')
  })

  it('flags overweight in 25–29.9', () => {
    expect(classifyBmi(25)?.label).toBe('Overweight')
    expect(classifyBmi(29.9)?.label).toBe('Overweight')
  })

  it('flags obese at 30+', () => {
    expect(classifyBmi(30)?.label).toBe('Obese')
    expect(classifyBmi(45)?.label).toBe('Obese')
  })

  it('returns null for null', () => {
    expect(classifyBmi(null)).toBeNull()
  })
})
