import { defineStore } from 'pinia'
import { ref } from 'vue'
import { appointmentApi } from '../api/appointmentApi'
import { scheduleApi } from '@/domains/schedule/api/scheduleApi'
import type {
  AppointmentListFilters,
  AppointmentResponse,
  CheckInResponse,
  ClinicDoctor,
  CreateAppointmentPayload,
} from '../types/appointment.types'
import type { CalendarBlock, Slot } from '@/domains/schedule/types/schedule.types'

export const useAppointmentStore = defineStore('appointment', () => {
  const appointments = ref<AppointmentResponse[]>([])
  const current = ref<AppointmentResponse | null>(null)
  const pagination = ref({ page: 1, per_page: 15, total: 0, last_page: 1 })
  const boardAppointments = ref<AppointmentResponse[]>([])
  const boardMonthAppointments = ref<AppointmentResponse[]>([])
  const boardDoctors = ref<ClinicDoctor[]>([])
  const boardAvailabilityByDoctor = ref<Record<string, Slot[]>>({})
  const boardCalendarBlocks = ref<CalendarBlock[]>([])

  const isLoading = ref(false)
  const isLoadingBoard = ref(false)
  const isCreating = ref(false)
  const boardError = ref<string | null>(null)
  let latestBoardFetchKey = ''
  let inFlightBoardFetchKey = ''

  function toLocalDate(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  function isSameDay(iso: string, date: string): boolean {
    return toLocalDate(new Date(iso)) === date
  }

  async function fetchAppointments(
    page = 1,
    perPage = 15,
    filters?: AppointmentListFilters,
  ): Promise<void> {
    isLoading.value = true
    try {
      const response = await appointmentApi.list(page, perPage, filters)
      appointments.value = response.data
      pagination.value = response.meta.pagination
    } finally {
      isLoading.value = false
    }
  }

  async function fetchAllForRange(startDate: string, endDate: string, status?: AppointmentListFilters['status']): Promise<AppointmentResponse[]> {
    const filters: AppointmentListFilters = { start_date: startDate, end_date: endDate }
    if (status) filters.status = status
    const response = await appointmentApi.list(1, 500, filters)
    return response.data
  }

  async function fetchDoctors(): Promise<void> {
    if (boardDoctors.value.length > 0) return
    const response = await appointmentApi.getDoctors()
    boardDoctors.value = response.data
  }

  async function fetchBoardData(params: {
    date: string
    start: string
    end: string
    doctorFilter: string
    statusFilter: string
  }): Promise<void> {
    const doctorId = params.doctorFilter !== 'all' ? params.doctorFilter : undefined
    const status = params.statusFilter !== 'all' ? params.statusFilter as AppointmentListFilters['status'] : undefined
    const fetchKey = `${params.date}:${params.start}:${params.end}:${doctorId ?? 'all'}:${status ?? 'all'}`
    if (inFlightBoardFetchKey === fetchKey) return

    latestBoardFetchKey = fetchKey
    inFlightBoardFetchKey = fetchKey
    isLoadingBoard.value = true
    boardError.value = null

    try {
      const [appointmentResult, doctorsResult] = await Promise.all([
        appointmentApi.list(1, 500, {
          start_date: params.start,
          end_date: params.end,
          ...(doctorId ? { doctor_id: doctorId } : {}),
          ...(status ? { status } : {}),
        }),
        boardDoctors.value.length > 0 ? Promise.resolve(null) : appointmentApi.getDoctors(),
      ])

      if (latestBoardFetchKey !== fetchKey) return

      boardMonthAppointments.value = appointmentResult.data
      boardAppointments.value = appointmentResult.data.filter((appointment) => isSameDay(appointment.scheduled_at, params.date))
      if (doctorsResult) boardDoctors.value = doctorsResult.data

      const visibleDoctors = doctorId
        ? boardDoctors.value.filter((doctor) => doctor.id === doctorId)
        : boardDoctors.value

      const availabilityEntries = await Promise.all(visibleDoctors.map(async (doctor) => {
        try {
          const response = await scheduleApi.getAvailability(doctor.id, params.date)
          return [doctor.id, response.data.slots, response.data.blocks] as const
        } catch {
          return [doctor.id, [] as Slot[], [] as CalendarBlock[]] as const
        }
      }))

      if (latestBoardFetchKey !== fetchKey) return

      boardAvailabilityByDoctor.value = Object.fromEntries(availabilityEntries.map(([id, slots]) => [id, slots]))
      boardCalendarBlocks.value = Array.from(new Map(availabilityEntries
        .flatMap(([, , blocks]) => blocks)
        .map((block) => [block.id, block])).values())
    } catch {
      if (latestBoardFetchKey !== fetchKey) return
      boardError.value = 'Failed to load appointment board.'
    } finally {
      if (inFlightBoardFetchKey === fetchKey) {
        inFlightBoardFetchKey = ''
      }
      if (latestBoardFetchKey === fetchKey) {
        isLoadingBoard.value = false
      }
    }
  }

  async function fetchAppointment(uuid: string): Promise<void> {
    isLoading.value = true
    try {
      const response = await appointmentApi.get(uuid)
      current.value = response.data
    } finally {
      isLoading.value = false
    }
  }

  async function createAppointment(payload: CreateAppointmentPayload): Promise<AppointmentResponse> {
    isCreating.value = true
    try {
      const response = await appointmentApi.create(payload)
      return response.data
    } finally {
      isCreating.value = false
    }
  }

  async function cancelAppointment(uuid: string, reason?: string): Promise<void> {
    const response = await appointmentApi.cancel(uuid, reason ? { reason } : undefined)
    const idx = appointments.value.findIndex((a) => a.id === uuid)
    if (idx !== -1) appointments.value[idx] = response.data
    if (current.value?.id === uuid) current.value = response.data
  }

  async function checkInAppointment(uuid: string): Promise<CheckInResponse['data']> {
    const response = await appointmentApi.checkIn(uuid)
    const idx = appointments.value.findIndex((a) => a.id === uuid)
    if (idx !== -1) appointments.value[idx] = response.data.appointment
    if (current.value?.id === uuid) current.value = response.data.appointment
    return response.data
  }

  async function markNoShow(uuid: string): Promise<void> {
    const response = await appointmentApi.noShow(uuid)
    const idx = appointments.value.findIndex((a) => a.id === uuid)
    if (idx !== -1) appointments.value[idx] = response.data
    if (current.value?.id === uuid) current.value = response.data
  }

  return {
    appointments,
    current,
    pagination,
    boardAppointments,
    boardMonthAppointments,
    boardDoctors,
    boardAvailabilityByDoctor,
    boardCalendarBlocks,
    isLoading,
    isLoadingBoard,
    isCreating,
    boardError,
    fetchAppointments,
    fetchAllForRange,
    fetchDoctors,
    fetchBoardData,
    fetchAppointment,
    createAppointment,
    cancelAppointment,
    checkInAppointment,
    markNoShow,
  }
})
