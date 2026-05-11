/**
 * Tests for VitalFieldRenderer.
 *
 * Coverage focus:
 *   - Label composition (label + unit suffix).
 *   - Number-input emit shape: empty/non-numeric → null, valid → number.
 *   - Blur clamps out-of-range values to min/max bounds.
 *   - Age-range hint renders + Low/Normal/High status pill matches the value.
 *   - Visibility gate via `show_if.patient_age_days_max`.
 *
 * shadcn `Input` and `Label` are stubbed to a plain native input so we can
 * trigger update:modelValue without going through Reka UI's internals.
 */

import { describe, expect, it } from 'vitest'
import { mountWithDeps } from '@/__tests__/helpers/mountWithDeps'
import VitalFieldRenderer from './VitalFieldRenderer.vue'
import type { VitalFieldConfig } from '@/domains/specialty/types/specialty.types'

const InputStub = {
  name: 'Input',
  props: ['modelValue', 'type'],
  emits: ['update:modelValue', 'blur'],
  template: `<input
    :type="type"
    :value="modelValue ?? ''"
    @input="$emit('update:modelValue', ($event.target).value)"
    @blur="$emit('blur', $event)"
  />`,
}
const LabelStub = { name: 'Label', template: '<label><slot /></label>' }
const SelectStub = { name: 'Select', template: '<div class="select"><slot /></div>' }
const SelectContent = { name: 'SelectContent', template: '<div><slot /></div>' }
const SelectItem = { name: 'SelectItem', template: '<div><slot /></div>' }
const SelectTrigger = { name: 'SelectTrigger', template: '<div><slot /></div>' }
const SelectValue = { name: 'SelectValue', template: '<div />' }

const COMMON_STUBS = {
  Input: InputStub,
  Label: LabelStub,
  Select: SelectStub,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
}

function makeNumberFieldConfig(over: Partial<VitalFieldConfig> = {}): VitalFieldConfig {
  return {
    key: 'systolic_bp',
    label: 'Heart Rate',
    unit: 'bpm',
    type: 'integer',
    input_type: 'number',
    min: 30,
    max: 250,
    required: false,
    order: 1,
    age_ranges: null,
    show_if: null,
    options: null,
    ...over,
  }
}

function mount(props: {
  fieldConfig: VitalFieldConfig
  modelValue: string | number | null
  patientAgeDays?: number
}) {
  return mountWithDeps(VitalFieldRenderer, {
    props,
    global: { stubs: COMMON_STUBS },
  })
}

describe('VitalFieldRenderer — number input', () => {
  it('renders the label with the unit suffix', () => {
    const wrapper = mount({ fieldConfig: makeNumberFieldConfig(), modelValue: null })
    expect(wrapper.text()).toContain('Heart Rate (bpm)')
  })

  it('emits a numeric value on input', async () => {
    const wrapper = mount({ fieldConfig: makeNumberFieldConfig(), modelValue: null })
    const input = wrapper.find('input')
    await input.setValue('72')
    const emitted = wrapper.emitted('update:modelValue')?.at(-1)
    expect(emitted).toEqual([72])
  })

  it('emits null when the input is cleared', async () => {
    const wrapper = mount({ fieldConfig: makeNumberFieldConfig(), modelValue: 80 })
    const input = wrapper.find('input')
    await input.setValue('')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([null])
  })

  it('clamps an above-max value to the configured max on blur', async () => {
    const wrapper = mount({
      fieldConfig: makeNumberFieldConfig({ min: 30, max: 250 }),
      modelValue: 999,
    })
    await wrapper.find('input').trigger('blur')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([250])
    expect(wrapper.emitted('blur')).toHaveLength(1)
  })

  it('does not emit a clamp when the value is already in range', async () => {
    const wrapper = mount({
      fieldConfig: makeNumberFieldConfig(),
      modelValue: 80,
    })
    await wrapper.find('input').trigger('blur')
    // Blur event fires; modelValue should NOT be re-emitted (already in range).
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(wrapper.emitted('blur')).toHaveLength(1)
  })
})

describe('VitalFieldRenderer — age-range hint and status', () => {
  const ageConfig = makeNumberFieldConfig({
    age_ranges: [
      { band: 'adult', days_min: 6570, days_max: null, min: 60, max: 100 },
      { band: 'child', days_min: 0, days_max: 6569, min: 70, max: 110 },
    ],
  })

  it('renders the resolved age range as a hint', () => {
    const wrapper = mount({
      fieldConfig: ageConfig,
      modelValue: null,
      patientAgeDays: 12000,
    })
    expect(wrapper.text()).toContain('Normal: 60–100 bpm')
  })

  it('shows the High status when the value exceeds the upper bound', () => {
    const wrapper = mount({
      fieldConfig: ageConfig,
      modelValue: 150,
      patientAgeDays: 12000,
    })
    expect(wrapper.text()).toContain('High')
  })

  it('shows Low for under-range and Normal for in-range', async () => {
    const low = mount({
      fieldConfig: ageConfig,
      modelValue: 50,
      patientAgeDays: 12000,
    })
    expect(low.text()).toContain('Low')

    const normal = mount({
      fieldConfig: ageConfig,
      modelValue: 80,
      patientAgeDays: 12000,
    })
    expect(normal.text()).toContain('Normal')
  })
})

describe('VitalFieldRenderer — visibility gate', () => {
  it('hides when patient is older than the show_if age max', () => {
    const wrapper = mount({
      fieldConfig: makeNumberFieldConfig({
        show_if: { patient_age_days_max: 365 },
      }),
      modelValue: null,
      patientAgeDays: 1000,
    })
    expect(wrapper.find('input').exists()).toBe(false)
    expect(wrapper.text()).toBe('')
  })

  it('renders when the patient is within the age cutoff', () => {
    const wrapper = mount({
      fieldConfig: makeNumberFieldConfig({
        show_if: { patient_age_days_max: 365 },
      }),
      modelValue: null,
      patientAgeDays: 200,
    })
    expect(wrapper.find('input').exists()).toBe(true)
  })
})
