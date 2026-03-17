import { defineStore } from 'pinia'
import { ref } from 'vue'
import { HttpError } from '@/lib/http'
import { scheduleApi } from '../api/scheduleApi'
import type {
  CalendarBlock,
  Slot,
  StoreCalendarBlockPayload,
  UpdateCalendarBlockPayload,
  UpsertWorkingSchedulePayload,
  WorkingSchedule,
} from '../types/schedule.types'

export const useScheduleStore = defineStore('schedule', () => {
  const selectedDoctorId = ref<string | null>(null)
  const schedule = ref<WorkingSchedule | null>(null)
  const blocks = ref<CalendarBlock[]>([])
  const availability = ref<{ slots: Slot[]; blocks: CalendarBlock[] } | null>(null)

  const isLoadingSchedule = ref(false)
  const isLoadingBlocks = ref(false)
  const isLoadingAvailability = ref(false)
  const isSavingSchedule = ref(false)

  // Track current block range to allow refreshing
  let currentBlockUserId = ''
  let currentBlockStart = ''
  let currentBlockEnd = ''

  async function fetchSchedule(userId: string): Promise<void> {
    isLoadingSchedule.value = true
    try {
      const response = await scheduleApi.getSchedule(userId)
      schedule.value = response.data
    } catch (err) {
      if (err instanceof HttpError && err.status === 404) {
        schedule.value = null
        return
      }
      throw err
    } finally {
      isLoadingSchedule.value = false
    }
  }

  async function saveSchedule(userId: string, payload: UpsertWorkingSchedulePayload): Promise<void> {
    isSavingSchedule.value = true
    try {
      const response = await scheduleApi.upsertSchedule(userId, payload)
      schedule.value = response.data
    } finally {
      isSavingSchedule.value = false
    }
  }

  async function fetchBlocks(userId: string, start: string, end: string): Promise<void> {
    isLoadingBlocks.value = true
    currentBlockUserId = userId
    currentBlockStart = start
    currentBlockEnd = end
    try {
      const response = await scheduleApi.listBlocks(userId, start, end)
      blocks.value = response.data
    } finally {
      isLoadingBlocks.value = false
    }
  }

  async function createBlock(payload: StoreCalendarBlockPayload): Promise<void> {
    await scheduleApi.createBlock(payload)
    if (currentBlockUserId) {
      await fetchBlocks(currentBlockUserId, currentBlockStart, currentBlockEnd)
    }
  }

  async function updateBlock(uuid: string, payload: UpdateCalendarBlockPayload): Promise<void> {
    await scheduleApi.updateBlock(uuid, payload)
    if (currentBlockUserId) {
      await fetchBlocks(currentBlockUserId, currentBlockStart, currentBlockEnd)
    }
  }

  async function deleteBlock(uuid: string): Promise<void> {
    await scheduleApi.deleteBlock(uuid)
    if (currentBlockUserId) {
      await fetchBlocks(currentBlockUserId, currentBlockStart, currentBlockEnd)
    }
  }

  async function fetchAvailability(userId: string, date: string): Promise<void> {
    isLoadingAvailability.value = true
    try {
      const response = await scheduleApi.getAvailability(userId, date)
      availability.value = {
        slots: response.data.slots,
        blocks: response.data.blocks,
      }
    } finally {
      isLoadingAvailability.value = false
    }
  }

  return {
    selectedDoctorId,
    schedule,
    blocks,
    availability,
    isLoadingSchedule,
    isLoadingBlocks,
    isLoadingAvailability,
    isSavingSchedule,
    fetchSchedule,
    saveSchedule,
    fetchBlocks,
    createBlock,
    updateBlock,
    deleteBlock,
    fetchAvailability,
  }
})
