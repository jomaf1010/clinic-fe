import { defineStore } from 'pinia'
import { ref } from 'vue'
import { queueApi } from '../api/queueApi'
import type { CreateWalkInPayload, QueueVisitResponse } from '../types/queue.types'
import { mergeQueueRealtimeEvent } from '../utils/realtimeEvents'

type QueueFilters = { doctor_id?: string; status?: string }

export const useQueueStore = defineStore('queue', () => {
  const visits = ref<QueueVisitResponse[]>([])
  const isLoading = ref(false)
  const isCreating = ref(false)

  let pollTimer: ReturnType<typeof setInterval> | null = null
  let currentFilters: QueueFilters = {}

  async function fetchQueue(filters?: QueueFilters): Promise<void> {
    if (filters !== undefined) currentFilters = filters
    isLoading.value = true
    try {
      const response = await queueApi.list(currentFilters)
      visits.value = response.data
    } finally {
      isLoading.value = false
    }
  }

  async function createWalkIn(payload: CreateWalkInPayload): Promise<QueueVisitResponse> {
    isCreating.value = true
    try {
      const response = await queueApi.walkIn(payload)
      await fetchQueue()
      return response.data
    } finally {
      isCreating.value = false
    }
  }

  async function callPatient(uuid: string): Promise<void> {
    await queueApi.call(uuid)
    await fetchQueue()
  }

  async function completeVisit(uuid: string): Promise<void> {
    await queueApi.complete(uuid)
    await fetchQueue()
  }

  async function cancelVisit(uuid: string): Promise<void> {
    await queueApi.cancel(uuid)
    await fetchQueue()
  }

  function startPolling(intervalMs = 30000, filters?: QueueFilters) {
    stopPolling()
    if (filters !== undefined) currentFilters = filters
    pollTimer = setInterval(() => {
      fetchQueue().catch(() => {})
    }, intervalMs)
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  function handleRealtimeEvent(event: { type: string; data: QueueVisitResponse }): void {
    visits.value = mergeQueueRealtimeEvent(visits.value, event)
  }

  return {
    visits,
    isLoading,
    isCreating,
    fetchQueue,
    createWalkIn,
    callPatient,
    completeVisit,
    cancelVisit,
    startPolling,
    stopPolling,
    handleRealtimeEvent,
  }
})
