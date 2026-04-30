import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import { HttpError } from '@/lib/http'
import { encounterApi } from '../api/encounterApi'
import type { EncounterResponse, EncounterTimelineItem, EncounterType, SoapDraftResponse, UpdateEncounterPayload } from '../types/encounter.types'
import { useAuthStore } from '@/domains/auth/stores/authStore'
import type { EncounterRealtimeEvent } from '../types/realtime.types'
import {
  cacheEncounter,
  getCachedEncounter,
  queueAction,
} from '@/lib/offlineDb'

export const useEncounterStore = defineStore('encounter', () => {
  const current = ref<EncounterResponse | null>(null)
  const patientEncounters = ref<EncounterTimelineItem[]>([])
  const isLoading = ref(false)
  const isLoadingEncounters = ref(false)
  const isLoadingMore = ref(false)
  const isSaving = ref(false)
  const isGeneratingSoapDraft = ref(false)
  const saveError = ref<string | null>(null)
  const soapDraftError = ref<string | null>(null)
  const currentPage = ref(1)
  const lastPage = ref(1)
  const hasMore = computed(() => currentPage.value < lastPage.value)
  const activeFilters = ref<{ month?: number; year?: number }>({})
  const isOfflineCached = ref(false)
  const _requestId = ref(0)

  const isFinalized = computed(() => current.value?.status === 'finalized')
  const isDraft = computed(() => current.value?.status === 'draft')

  async function createForPatient(
    patientId: string,
    type: 'default' | 'follow_up' = 'default',
    options?: { encounterType?: EncounterType; pregnancyId?: string },
  ): Promise<EncounterResponse> {
    isLoading.value = true
    saveError.value = null
    try {
      const authStore = useAuthStore()
      const response = await encounterApi.create(patientId, {
        patient_id: patientId,
        type: options?.encounterType ?? 'consultation',
        consultation_type: type,
        specialty: authStore.user?.specialty ?? undefined,
        pregnancy_id: options?.pregnancyId,
      })
      current.value = response.data
      isOfflineCached.value = false
      await cacheEncounter(response.data as unknown as Record<string, unknown>)
      return response.data
    } finally {
      isLoading.value = false
    }
  }

  async function loadEncounter(id: string): Promise<void> {
    isLoading.value = true
    saveError.value = null
    isOfflineCached.value = false
    try {
      const response = await encounterApi.get(id)
      current.value = response.data
      await cacheEncounter(response.data as unknown as Record<string, unknown>)
    } catch (err) {
      if (err instanceof HttpError && (err.status === 403 || err.status === 404)) {
        throw err
      }

      const cached = await getCachedEncounter(id)
      if (cached) {
        current.value = cached as unknown as EncounterResponse
        isOfflineCached.value = true
        toast.info('Loaded from offline cache')
      } else {
        throw new Error('Failed to load encounter')
      }
    } finally {
      isLoading.value = false
    }
  }

  async function loadForPatient(patientId: string, filters?: { month?: number; year?: number; pregnancy_id?: string }): Promise<void> {
    const requestId = ++_requestId.value
    isLoading.value = true
    isLoadingEncounters.value = true
    saveError.value = null
    currentPage.value = 1
    activeFilters.value = filters ?? {}
    try {
      const response = await encounterApi.list(patientId, 1, 10, activeFilters.value)
      if (requestId !== _requestId.value) return
      patientEncounters.value = response.data
      lastPage.value = response.meta.pagination.last_page
    } finally {
      if (requestId === _requestId.value) {
        isLoading.value = false
        isLoadingEncounters.value = false
      }
    }
  }

  async function loadMoreForPatient(patientId: string): Promise<void> {
    if (!hasMore.value || isLoadingMore.value) return
    const requestId = _requestId.value
    isLoadingMore.value = true
    try {
      const nextPage = currentPage.value + 1
      const response = await encounterApi.list(patientId, nextPage, 10, activeFilters.value)
      if (requestId !== _requestId.value) return
      patientEncounters.value.push(...response.data)
      currentPage.value = nextPage
      lastPage.value = response.meta.pagination.last_page
    } finally {
      if (requestId === _requestId.value) {
        isLoadingMore.value = false
      }
    }
  }

  function clearPatientEncounters(): void {
    _requestId.value++
    patientEncounters.value = []
    currentPage.value = 1
    lastPage.value = 1
    activeFilters.value = {}
    isLoadingEncounters.value = false
    isLoadingMore.value = false
  }

  async function saveSection(payload: UpdateEncounterPayload): Promise<void> {
    if (!current.value) return
    isSaving.value = true
    saveError.value = null

    // Optimistically update the nested type-specific data
    const updated = { ...current.value }

    if (updated.type === 'consultation' && updated.consultation) {
      const c = { ...updated.consultation }
      if (payload.triage) c.triage = { ...c.triage, ...payload.triage } as typeof c.triage
      if (payload.assessment) c.assessment = { ...c.assessment, ...payload.assessment } as typeof c.assessment
      if (payload.specialty_assessment) {
        c.specialty_assessment = { ...(c.specialty_assessment ?? {}), ...payload.specialty_assessment }
      }
      if (payload.treatment_plan) c.treatment_plan = { ...c.treatment_plan, ...payload.treatment_plan }
      if (payload.soap_note) c.soap_note = payload.soap_note
      updated.consultation = c
    } else if (updated.type === 'prenatal' && updated.prenatal_visit) {
      const v = { ...updated.prenatal_visit }
      if (payload.triage) v.triage = { ...v.triage, ...payload.triage } as typeof v.triage
      if (payload.assessment) v.assessment = { ...v.assessment, ...payload.assessment } as typeof v.assessment
      if (payload.plan) v.plan = { ...v.plan, ...payload.plan } as typeof v.plan
      if (payload.soap_note) v.soap_note = payload.soap_note
      updated.prenatal_visit = v
    } else if (updated.type === 'delivery' && updated.delivery_record) {
      const d = { ...updated.delivery_record }
      if (payload.labor) d.labor = { ...d.labor, ...payload.labor }
      if (payload.delivery) d.delivery = { ...d.delivery, ...payload.delivery }
      if (payload.maternal) d.maternal = { ...d.maternal, ...payload.maternal }
      if (payload.neonatal) d.neonatal = { ...d.neonatal, ...payload.neonatal }
      if (payload.notes !== undefined) d.notes = payload.notes ?? null
      if (payload.soap_note) d.soap_note = payload.soap_note
      updated.delivery_record = d
    } else if (updated.type === 'postpartum' && updated.postpartum_visit) {
      const p = { ...updated.postpartum_visit }
      if (payload.triage) p.triage = { ...p.triage, ...payload.triage } as typeof p.triage
      if (payload.assessment) p.assessment = { ...p.assessment, ...payload.assessment } as typeof p.assessment
      if (payload.plan) p.plan = { ...p.plan, ...payload.plan } as typeof p.plan
      if (payload.soap_note) p.soap_note = payload.soap_note
      updated.postpartum_visit = p
    } else if (updated.type === 'dental' && updated.dental_visit) {
      const d = { ...updated.dental_visit }
      if (payload.triage) d.triage = { ...(d.triage ?? {}), ...payload.triage } as typeof d.triage
      if (payload.assessment) d.assessment = { ...(d.assessment ?? {}), ...payload.assessment } as typeof d.assessment
      if (payload.plan) d.plan = { ...(d.plan ?? {}), ...payload.plan } as typeof d.plan
      if (payload.treatment_plan_id !== undefined) d.treatment_plan_id = payload.treatment_plan_id
      if (payload.soap_note) d.soap_note = payload.soap_note
      updated.dental_visit = d
    }

    current.value = updated

    await cacheEncounter(updated as unknown as Record<string, unknown>)

    try {
      const response = await encounterApi.update(current.value.id, payload)
      current.value = response.data
      isOfflineCached.value = false
      await cacheEncounter(response.data as unknown as Record<string, unknown>)
    } catch {
      if (!navigator.onLine) {
        await queueAction({
          type: 'update-encounter',
          url: `/encounters/${current.value.id}`,
          method: 'PATCH',
          body: payload,
          createdAt: Date.now(),
        })
        isOfflineCached.value = true
        saveError.value = null
        toast.info('Saved offline — will sync when back online')
      } else {
        saveError.value = 'Failed to save. Please try again.'
      }
    } finally {
      isSaving.value = false
    }
  }

  async function finalize(): Promise<void> {
    if (!current.value) return
    if (!navigator.onLine) {
      saveError.value = 'Cannot finalize while offline.'
      return
    }
    isSaving.value = true
    saveError.value = null
    try {
      const response = await encounterApi.finalize(current.value.id)
      current.value = response.data
      await cacheEncounter(response.data as unknown as Record<string, unknown>)
    } catch {
      saveError.value = 'Failed to finalize. Please try again.'
    } finally {
      isSaving.value = false
    }
  }

  async function generateSoapDraft(): Promise<SoapDraftResponse | null> {
    if (!current.value) return null
    if (!navigator.onLine) {
      soapDraftError.value = 'Cannot generate SOAP note while offline.'
      return null
    }

    isGeneratingSoapDraft.value = true
    soapDraftError.value = null
    try {
      const response = await encounterApi.generateSoapDraft(current.value.id)
      return response.data
    } catch (error) {
      if (error instanceof HttpError && error.status === 422) {
        const data = error.data
        const validationMessage = typeof data === 'object' && data !== null && 'message' in data
          ? (data as { message?: unknown }).message
          : null
        soapDraftError.value = typeof validationMessage === 'string'
          ? validationMessage
          : 'Add clinical details before generating a SOAP note.'
      } else {
        soapDraftError.value = 'Failed to generate SOAP note. Please try again.'
      }
      return null
    } finally {
      isGeneratingSoapDraft.value = false
    }
  }

  function handleRealtimeEvent(event: EncounterRealtimeEvent): void {
    if (!current.value) return
    if (current.value.id !== event.encounter_id) return

    if (event.type === 'encounter.updated') {
      const { data } = event
      const updated = { ...current.value, updated_at: data.updated_at }

      if (updated.type === 'consultation' && updated.consultation) {
        const c = { ...updated.consultation }
        if (data.triage) c.triage = { ...c.triage, ...data.triage }
        if (data.assessment) c.assessment = data.assessment
        if (data.treatment_plan) c.treatment_plan = { ...c.treatment_plan, ...data.treatment_plan }
        if (data.soap_note) c.soap_note = data.soap_note
        updated.consultation = c
      } else if (updated.type === 'prenatal' && updated.prenatal_visit) {
        const v = { ...updated.prenatal_visit }
        if (data.triage) v.triage = { ...v.triage, ...data.triage } as typeof v.triage
        if (data.assessment) v.assessment = { ...v.assessment, ...data.assessment } as typeof v.assessment
        if ('plan' in data && data.plan) v.plan = { ...v.plan, ...data.plan } as typeof v.plan
        if (data.soap_note) v.soap_note = data.soap_note
        updated.prenatal_visit = v
      } else if (updated.type === 'delivery' && updated.delivery_record) {
        const d = { ...updated.delivery_record }
        if (data.labor) d.labor = { ...d.labor, ...data.labor }
        if (data.delivery) d.delivery = { ...d.delivery, ...data.delivery }
        if (data.maternal) d.maternal = { ...d.maternal, ...data.maternal }
        if (data.neonatal) d.neonatal = { ...d.neonatal, ...data.neonatal }
        if (data.soap_note) d.soap_note = data.soap_note
        updated.delivery_record = d
      } else if (updated.type === 'postpartum' && updated.postpartum_visit) {
        const p = { ...updated.postpartum_visit }
        if (data.triage) p.triage = { ...p.triage, ...data.triage } as typeof p.triage
        if (data.assessment) p.assessment = { ...p.assessment, ...data.assessment } as typeof p.assessment
        if ('plan' in data && data.plan) p.plan = { ...p.plan, ...data.plan } as typeof p.plan
        if (data.soap_note) p.soap_note = data.soap_note
        updated.postpartum_visit = p
      } else if (updated.type === 'dental' && updated.dental_visit) {
        const d = { ...updated.dental_visit }
        if (data.triage) d.triage = { ...(d.triage ?? {}), ...data.triage }
        if (data.assessment) d.assessment = { ...(d.assessment ?? {}), ...data.assessment }
        if (data.plan) d.plan = { ...(d.plan ?? {}), ...data.plan }
        if (data.soap_note) d.soap_note = data.soap_note
        updated.dental_visit = d
      }

      current.value = updated
    } else if (event.type === 'encounter.finalized') {
      current.value = {
        ...current.value,
        status: 'finalized',
        finalized_at: event.data.finalized_at,
        updated_at: event.data.updated_at,
      }
    }
  }

  function clearCurrent(): void {
    current.value = null
    saveError.value = null
    isOfflineCached.value = false
  }

  async function deleteEncounter(id: string): Promise<void> {
    await encounterApi.delete(id)
    patientEncounters.value = patientEncounters.value.filter(e => e.id !== id)
    if (current.value?.id === id) clearCurrent()
    toast.success('Draft encounter deleted')
  }

  return {
    current,
    patientEncounters,
    isLoading,
    isLoadingEncounters,
    isLoadingMore,
    isSaving,
    isGeneratingSoapDraft,
    saveError,
    soapDraftError,
    hasMore,
    isFinalized,
    isDraft,
    isOfflineCached,
    createForPatient,
    loadEncounter,
    loadForPatient,
    loadMoreForPatient,
    saveSection,
    generateSoapDraft,
    finalize,
    handleRealtimeEvent,
    clearCurrent,
    clearPatientEncounters,
    deleteEncounter,
  }
})
