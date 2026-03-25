import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import { HttpError } from '@/lib/http'
import { consultationApi } from '../api/consultationApi'
import type { ConsultationResponse, UpdateConsultationPayload } from '../types/consultation.types'
import type { ConsultationRealtimeEvent } from '../types/realtime.types'
import {
  cacheConsultation,
  getCachedConsultation,
  queueAction,
} from '@/lib/offlineDb'

export const useConsultationStore = defineStore('consultation', () => {
  const current = ref<ConsultationResponse | null>(null)
  const patientConsultations = ref<ConsultationResponse[]>([])
  const isLoading = ref(false)
  const isLoadingConsultations = ref(false)
  const isLoadingMore = ref(false)
  const isSaving = ref(false)
  const saveError = ref<string | null>(null)
  const currentPage = ref(1)
  const lastPage = ref(1)
  const hasMore = computed(() => currentPage.value < lastPage.value)
  const activeFilters = ref<{ month?: number; year?: number }>({})
  const isOfflineCached = ref(false)
  const _requestId = ref(0)

  const isFinalized = computed(() => current.value?.status === 'finalized')
  const isDraft = computed(() => current.value?.status === 'draft')

  async function createForPatient(patientId: string, type: 'default' | 'follow_up' = 'default'): Promise<ConsultationResponse> {
    isLoading.value = true
    saveError.value = null
    try {
      const response = await consultationApi.create(patientId, { patient_id: patientId, type })
      current.value = response.data
      isOfflineCached.value = false
      await cacheConsultation(response.data as unknown as Record<string, unknown>)
      return response.data
    } finally {
      isLoading.value = false
    }
  }

  async function loadConsultation(id: string): Promise<void> {
    isLoading.value = true
    saveError.value = null
    isOfflineCached.value = false
    try {
      const response = await consultationApi.get(id)
      current.value = response.data
      await cacheConsultation(response.data as unknown as Record<string, unknown>)
    } catch (err) {
      // Don't fall back to cache for permission errors
      if (err instanceof HttpError && (err.status === 403 || err.status === 404)) {
        throw err
      }

      const cached = await getCachedConsultation(id)
      if (cached) {
        current.value = cached as unknown as ConsultationResponse
        isOfflineCached.value = true
        toast.info('Loaded from offline cache')
      } else {
        throw new Error('Failed to load consultation')
      }
    } finally {
      isLoading.value = false
    }
  }

  async function loadForPatient(patientId: string, filters?: { month?: number; year?: number }): Promise<void> {
    const requestId = ++_requestId.value
    isLoading.value = true
    isLoadingConsultations.value = true
    saveError.value = null
    currentPage.value = 1
    activeFilters.value = filters ?? {}
    try {
      const response = await consultationApi.list(patientId, 1, 10, activeFilters.value)
      if (requestId !== _requestId.value) return // stale request, discard
      patientConsultations.value = response.data
      lastPage.value = response.meta.pagination.last_page
    } finally {
      if (requestId === _requestId.value) {
        isLoading.value = false
        isLoadingConsultations.value = false
      }
    }
  }

  async function loadMoreForPatient(patientId: string): Promise<void> {
    if (!hasMore.value || isLoadingMore.value) return
    const requestId = _requestId.value
    isLoadingMore.value = true
    try {
      const nextPage = currentPage.value + 1
      const response = await consultationApi.list(patientId, nextPage, 10, activeFilters.value)
      if (requestId !== _requestId.value) return // stale request, discard
      patientConsultations.value.push(...response.data)
      currentPage.value = nextPage
      lastPage.value = response.meta.pagination.last_page
    } finally {
      if (requestId === _requestId.value) {
        isLoadingMore.value = false
      }
    }
  }

  function clearPatientConsultations(): void {
    _requestId.value++
    patientConsultations.value = []
    currentPage.value = 1
    lastPage.value = 1
    activeFilters.value = {}
    isLoadingConsultations.value = false
    isLoadingMore.value = false
  }

  async function saveSection(payload: UpdateConsultationPayload): Promise<void> {
    if (!current.value) return
    isSaving.value = true
    saveError.value = null

    // Optimistically update local state
    const updated = { ...current.value }
    if (payload.triage) updated.triage = { ...updated.triage, ...payload.triage }
    if (payload.assessment) updated.assessment = { ...updated.assessment, ...payload.assessment }
    if (payload.treatment_plan) updated.treatment_plan = { ...updated.treatment_plan, ...payload.treatment_plan }
    current.value = updated

    // Always cache locally
    await cacheConsultation(updated as unknown as Record<string, unknown>)

    try {
      const response = await consultationApi.update(current.value.id, payload)
      current.value = response.data
      isOfflineCached.value = false
      await cacheConsultation(response.data as unknown as Record<string, unknown>)
    } catch {
      if (!navigator.onLine) {
        // Queue for later sync
        await queueAction({
          type: 'update-consultation',
          url: `/consultations/${current.value.id}`,
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
      const response = await consultationApi.finalize(current.value.id)
      current.value = response.data
      await cacheConsultation(response.data as unknown as Record<string, unknown>)
    } catch {
      saveError.value = 'Failed to finalize. Please try again.'
    } finally {
      isSaving.value = false
    }
  }

  function handleRealtimeEvent(event: ConsultationRealtimeEvent): void {
    if (!current.value) return
    if (current.value.id !== event.consultation_id) return

    if (event.type === 'consultation.updated') {
      const { data } = event
      const updated = { ...current.value, updated_at: data.updated_at }

      if (data.triage) {
        updated.triage = { ...updated.triage, ...data.triage }
      }
      if (data.assessment) {
        updated.assessment = data.assessment
      }
      if (data.treatment_plan) {
        updated.treatment_plan = { ...updated.treatment_plan, ...data.treatment_plan }
      }

      current.value = updated
    } else if (event.type === 'consultation.finalized') {
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

  return {
    current,
    patientConsultations,
    isLoading,
    isLoadingConsultations,
    isLoadingMore,
    isSaving,
    saveError,
    hasMore,
    isFinalized,
    isDraft,
    isOfflineCached,
    createForPatient,
    loadConsultation,
    loadForPatient,
    loadMoreForPatient,
    saveSection,
    finalize,
    handleRealtimeEvent,
    clearCurrent,
    clearPatientConsultations,
  }
})
