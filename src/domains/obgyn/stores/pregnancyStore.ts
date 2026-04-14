import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import { obgynApi } from '../api/obgynApi'
import type { CreatePregnancyPayload, CreateVisitPayload } from '../api/obgynApi'
import type { Pregnancy, PrenatalVisit } from '../types/obgyn.types'

export const usePregnancyStore = defineStore('pregnancy', () => {
  const pregnancies = ref<Pregnancy[]>([])
  const currentPregnancy = ref<Pregnancy | null>(null)
  const visits = ref<PrenatalVisit[]>([])
  const currentVisit = ref<PrenatalVisit | null>(null)
  const isLoading = ref(false)
  const isSaving = ref(false)

  const activePregnancy = computed(() =>
    pregnancies.value.find((p) => p.status === 'active') ?? null,
  )

  async function loadPregnancies(patientId: string): Promise<void> {
    isLoading.value = true
    try {
      const res = await obgynApi.listPregnancies(patientId)
      pregnancies.value = res.data
    } finally {
      isLoading.value = false
    }
  }

  async function loadPregnancy(patientId: string, pregnancyId: string): Promise<void> {
    isLoading.value = true
    try {
      const res = await obgynApi.getPregnancy(patientId, pregnancyId)
      currentPregnancy.value = res.data
    } finally {
      isLoading.value = false
    }
  }

  async function createPregnancy(patientId: string, payload: CreatePregnancyPayload): Promise<Pregnancy> {
    isSaving.value = true
    try {
      const res = await obgynApi.createPregnancy(patientId, payload)
      pregnancies.value.unshift(res.data)
      currentPregnancy.value = res.data
      toast.success('Pregnancy record created')
      return res.data
    } catch {
      toast.error('Failed to create pregnancy record')
      throw new Error('Failed to create pregnancy record')
    } finally {
      isSaving.value = false
    }
  }

  async function updatePregnancy(
    patientId: string,
    pregnancyId: string,
    payload: Partial<CreatePregnancyPayload>,
  ): Promise<Pregnancy> {
    isSaving.value = true
    try {
      const res = await obgynApi.updatePregnancy(patientId, pregnancyId, payload)
      currentPregnancy.value = res.data
      const idx = pregnancies.value.findIndex((p) => p.uuid === pregnancyId)
      if (idx !== -1) pregnancies.value[idx] = res.data
      toast.success('Pregnancy record updated')
      return res.data
    } catch {
      toast.error('Failed to update pregnancy record')
      throw new Error('Failed to update pregnancy record')
    } finally {
      isSaving.value = false
    }
  }

  async function loadVisits(patientId: string, pregnancyId: string): Promise<void> {
    isLoading.value = true
    try {
      const res = await obgynApi.listVisits(patientId, pregnancyId)
      visits.value = res.data
    } finally {
      isLoading.value = false
    }
  }

  async function createVisit(
    patientId: string,
    pregnancyId: string,
    payload: CreateVisitPayload,
  ): Promise<PrenatalVisit> {
    isSaving.value = true
    try {
      const res = await obgynApi.createVisit(patientId, pregnancyId, payload)
      visits.value.push(res.data)
      currentVisit.value = res.data
      toast.success('Prenatal visit saved')
      return res.data
    } catch {
      toast.error('Failed to save prenatal visit')
      throw new Error('Failed to save prenatal visit')
    } finally {
      isSaving.value = false
    }
  }

  async function updateVisit(
    patientId: string,
    pregnancyId: string,
    visitId: string,
    payload: Partial<CreateVisitPayload>,
  ): Promise<PrenatalVisit> {
    isSaving.value = true
    try {
      const res = await obgynApi.updateVisit(patientId, pregnancyId, visitId, payload)
      currentVisit.value = res.data
      const idx = visits.value.findIndex((v) => v.uuid === visitId)
      if (idx !== -1) visits.value[idx] = res.data
      toast.success('Prenatal visit updated')
      return res.data
    } catch {
      toast.error('Failed to update prenatal visit')
      throw new Error('Failed to update prenatal visit')
    } finally {
      isSaving.value = false
    }
  }

  function $reset(): void {
    pregnancies.value = []
    currentPregnancy.value = null
    visits.value = []
    currentVisit.value = null
    isLoading.value = false
    isSaving.value = false
  }

  return {
    pregnancies,
    currentPregnancy,
    visits,
    currentVisit,
    activePregnancy,
    isLoading,
    isSaving,
    loadPregnancies,
    loadPregnancy,
    createPregnancy,
    updatePregnancy,
    loadVisits,
    createVisit,
    updateVisit,
    $reset,
  }
})
