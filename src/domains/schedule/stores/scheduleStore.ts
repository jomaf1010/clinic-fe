import { defineStore } from 'pinia'
import { ref } from 'vue'
import { HttpError } from '@/lib/http'
import { appointmentApi } from '@/domains/appointment/api/appointmentApi'
import type { AppointmentResponse } from '@/domains/appointment/types/appointment.types'
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
  const schedule = ref<WorkingSchedule | null>(null)
  const studioAppointments = ref<AppointmentResponse[]>([])
  const studioMonthAppointments = ref<AppointmentResponse[]>([])
  const studioSlots = ref<Slot[]>([])
  const studioDayBlocks = ref<CalendarBlock[]>([])
  const studioUpcomingBlocks = ref<CalendarBlock[]>([])

  const isLoadingSchedule = ref(false)
  const isLoadingStudio = ref(false)
  const isSavingSchedule = ref(false)
  const studioError = ref<string | null>(null)
  let latestStudioLoadKey = ''
  let inFlightStudioLoadKey = ''

  function toLocalDate(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  function isSameDay(iso: string, date: string): boolean {
    return toLocalDate(new Date(iso)) === date
  }

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

  async function createBlock(payload: StoreCalendarBlockPayload): Promise<void> {
    await scheduleApi.createBlock(payload)
  }

  async function updateBlock(uuid: string, payload: UpdateCalendarBlockPayload): Promise<void> {
    await scheduleApi.updateBlock(uuid, payload)
  }

  async function fetchStudioData(params: {
    userId: string
    date: string
    start: string
    end: string
    blockRangeEnd: string
    refreshKey?: number
  }): Promise<void> {
    const loadKey = `${params.userId}:${params.date}:${params.start}:${params.end}:${params.blockRangeEnd}:${params.refreshKey ?? 0}`
    if (inFlightStudioLoadKey === loadKey) return
    latestStudioLoadKey = loadKey
    inFlightStudioLoadKey = loadKey
    isLoadingStudio.value = true
    studioError.value = null

    try {
      const [monthAppointmentList, availability, upcomingBlockList] = await Promise.all([
        appointmentApi.list(1, 300, { doctor_id: params.userId, start_date: params.start, end_date: params.end }),
        scheduleApi.getAvailability(params.userId, params.date),
        scheduleApi.listAllBlocks(params.date, params.blockRangeEnd),
      ])

      if (latestStudioLoadKey !== loadKey) return

      studioMonthAppointments.value = monthAppointmentList.data
      studioAppointments.value = monthAppointmentList.data.filter((appointment) => isSameDay(appointment.scheduled_at, params.date))
      studioSlots.value = availability.data.slots
      studioDayBlocks.value = availability.data.blocks
      studioUpcomingBlocks.value = upcomingBlockList.data
    } catch {
      if (latestStudioLoadKey !== loadKey) return
      studioError.value = 'Failed to load schedule view.'
    } finally {
      if (inFlightStudioLoadKey === loadKey) {
        inFlightStudioLoadKey = ''
      }
      if (latestStudioLoadKey === loadKey) {
        isLoadingStudio.value = false
      }
    }
  }

  return {
    schedule,
    studioAppointments,
    studioMonthAppointments,
    studioSlots,
    studioDayBlocks,
    studioUpcomingBlocks,
    isLoadingSchedule,
    isLoadingStudio,
    isSavingSchedule,
    studioError,
    fetchSchedule,
    saveSchedule,
    createBlock,
    updateBlock,
    fetchStudioData,
  }
})
