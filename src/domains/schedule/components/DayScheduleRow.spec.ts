import { describe, expect, it } from 'vitest'
import { mountWithDeps } from '@/__tests__/helpers/mountWithDeps'
import DayScheduleRow from './DayScheduleRow.vue'
import type { DaySchedule } from '../types/schedule.types'

const STUBS = {
  BreakEditor: {
    props: ['breaks', 'dayStart', 'dayEnd'],
    emits: ['update:breaks'],
    template: '<button type="button" data-testid="break-editor" @click="$emit(`update:breaks`, [{ label: `Lunch`, start_time: `12:00`, end_time: `13:00` }])">Break editor</button>',
  },
  Checkbox: {
    props: ['modelValue', 'id'],
    emits: ['update:modelValue'],
    template: '<input :id="id" type="checkbox" :checked="modelValue" @change="$emit(`update:modelValue`, ($event.target).checked)" />',
  },
  Input: {
    props: ['modelValue', 'type'],
    emits: ['update:modelValue'],
    template: '<input :type="type" :value="modelValue" @input="$emit(`update:modelValue`, ($event.target).value)" />',
  },
  Label: { template: '<label><slot /></label>' },
}

function makeDay(overrides: Partial<DaySchedule> = {}): DaySchedule {
  return {
    day: 1,
    enabled: true,
    start_time: '09:00',
    end_time: '17:00',
    breaks: [],
    ...overrides,
  }
}

function mountRow(day = makeDay()) {
  return mountWithDeps(DayScheduleRow, {
    props: { day },
    global: { stubs: STUBS },
  })
}

describe('DayScheduleRow', () => {
  it('renders the day name and enabled time inputs', () => {
    const wrapper = mountRow()

    expect(wrapper.text()).toContain('Monday')
    expect(wrapper.findAll('input[type="time"]')).toHaveLength(2)
    expect(wrapper.text()).not.toContain('Day off')
  })

  it('renders day off state when disabled', () => {
    const wrapper = mountRow(makeDay({ enabled: false }))

    expect(wrapper.text()).toContain('Day off')
    expect(wrapper.findAll('input[type="time"]')).toHaveLength(0)
  })

  it('emits enabled changes', async () => {
    const wrapper = mountRow(makeDay({ enabled: false }))

    await wrapper.find('input[type="checkbox"]').setValue(true)

    expect(wrapper.emitted('update:day')?.[0]?.[0]).toEqual(makeDay({ enabled: true }))
  })

  it('emits time field changes without dropping other fields', async () => {
    const wrapper = mountRow()

    await wrapper.findAll('input[type="time"]')[0]?.setValue('08:30')

    expect(wrapper.emitted('update:day')?.[0]?.[0]).toEqual(makeDay({ start_time: '08:30' }))
  })

  it('emits break changes from the nested editor', async () => {
    const wrapper = mountRow()

    await wrapper.find('[data-testid="break-editor"]').trigger('click')

    expect(wrapper.emitted('update:day')?.[0]?.[0]).toEqual(makeDay({
      breaks: [{ label: 'Lunch', start_time: '12:00', end_time: '13:00' }],
    }))
  })
})
