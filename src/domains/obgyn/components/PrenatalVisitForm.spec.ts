import { shallowMount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, type ComponentPublicInstance } from 'vue'
import PrenatalVisitForm from './PrenatalVisitForm.vue'
import { usePregnancyStore } from '../stores/pregnancyStore'
import type { Pregnancy, PrenatalVisit } from '../types/obgyn.types'

interface PrenatalVisitFormVm extends ComponentPublicInstance {
  form: {
    fetal_movement: 'present' | 'decreased' | 'absent' | ''
    bp_systolic: number | null
    bp_diastolic: number | null
    heart_rate: number | null
    respiratory_rate: number | null
    temperature: number | null
  }
  handleSubmit: () => Promise<void>
}

const pregnancy = {
  id: 'pregnancy-1',
  edd: null,
  pre_pregnancy_weight: null,
} as unknown as Pregnancy

const savedVisit = {
  id: 'visit-1',
} as unknown as PrenatalVisit

describe('PrenatalVisitForm', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('submits backend-valid fetal movement and vital field names', async () => {
    const wrapper = shallowMount(PrenatalVisitForm, {
      props: {
        patientId: 'patient-1',
        pregnancyId: 'pregnancy-1',
        pregnancy,
      },
    })
    const store = usePregnancyStore()
    const createVisit = vi.fn().mockResolvedValue(savedVisit)
    store.createVisit = createVisit

    const vm = wrapper.vm as unknown as PrenatalVisitFormVm
    vm.form.fetal_movement = 'present'
    vm.form.bp_systolic = 120
    vm.form.bp_diastolic = 80
    vm.form.heart_rate = 72
    vm.form.respiratory_rate = 16
    vm.form.temperature = 36.8

    await vm.handleSubmit()
    await nextTick()

    expect(createVisit).toHaveBeenCalledWith(
      'patient-1',
      'pregnancy-1',
      expect.objectContaining({
        fetal_movement: 'present',
        systolic_bp: 120,
        diastolic_bp: 80,
        heart_rate: 72,
        respiratory_rate: 16,
        temperature: 36.8,
      }),
    )
    const payload = createVisit.mock.calls[0]?.[2]
    expect(payload).not.toHaveProperty('bp_systolic')
    expect(payload).not.toHaveProperty('bp_diastolic')
  })
})
