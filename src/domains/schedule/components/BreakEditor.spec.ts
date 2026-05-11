import { describe, expect, it } from 'vitest'
import { mountWithDeps } from '@/__tests__/helpers/mountWithDeps'
import BreakEditor from './BreakEditor.vue'
import type { Break } from '../types/schedule.types'

const STUBS = {
  Button: {
    emits: ['click'],
    template: '<button type="button" @click="$emit(`click`, $event)"><slot /></button>',
  },
  Input: {
    props: ['modelValue', 'type', 'placeholder'],
    emits: ['update:modelValue'],
    template: '<input :type="type" :placeholder="placeholder" :value="modelValue" @input="$emit(`update:modelValue`, ($event.target).value)" />',
  },
  Label: { template: '<label><slot /></label>' },
}

function mountEditor(breaks: Break[] = []) {
  return mountWithDeps(BreakEditor, {
    props: { breaks, dayStart: '09:00', dayEnd: '17:00' },
    global: { stubs: STUBS },
  })
}

describe('BreakEditor', () => {
  it('adds a default break at the day start', async () => {
    const wrapper = mountEditor()

    await wrapper.find('button').trigger('click')

    expect(wrapper.emitted('update:breaks')).toEqual([[[
      { label: 'Break', start_time: '09:00', end_time: '09:00' },
    ]]])
  })

  it('updates a break field without mutating sibling breaks', async () => {
    const wrapper = mountEditor([
      { label: 'Lunch', start_time: '12:00', end_time: '13:00' },
      { label: 'Admin', start_time: '15:00', end_time: '15:30' },
    ])

    await wrapper.find('input[placeholder="e.g. Lunch"]').setValue('Meal')

    expect(wrapper.emitted('update:breaks')?.[0]?.[0]).toEqual([
      { label: 'Meal', start_time: '12:00', end_time: '13:00' },
      { label: 'Admin', start_time: '15:00', end_time: '15:30' },
    ])
  })

  it('updates break start and end times independently', async () => {
    const wrapper = mountEditor([
      { label: 'Lunch', start_time: '12:00', end_time: '13:00' },
    ])
    const timeInputs = wrapper.findAll('input[type="time"]')

    await timeInputs[0].setValue('12:15')
    await timeInputs[1].setValue('13:15')

    expect(wrapper.emitted('update:breaks')?.[0]?.[0]).toEqual([
      { label: 'Lunch', start_time: '12:15', end_time: '13:00' },
    ])
    expect(wrapper.emitted('update:breaks')?.[1]?.[0]).toEqual([
      { label: 'Lunch', start_time: '12:00', end_time: '13:15' },
    ])
  })

  it('removes the selected break', async () => {
    const wrapper = mountEditor([
      { label: 'Lunch', start_time: '12:00', end_time: '13:00' },
      { label: 'Admin', start_time: '15:00', end_time: '15:30' },
    ])

    await wrapper.find('button[aria-label="Remove break"]').trigger('click')

    expect(wrapper.emitted('update:breaks')?.[0]?.[0]).toEqual([
      { label: 'Admin', start_time: '15:00', end_time: '15:30' },
    ])
  })
})
