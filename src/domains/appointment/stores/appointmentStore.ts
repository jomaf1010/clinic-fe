import { defineStore } from 'pinia'
import { ref } from 'vue'
import { appointmentApi } from '../api/appointmentApi'
import type {
  AppointmentListFilters,
  AppointmentResponse,
  CreateAppointmentPayload,
} from '../types/appointment.types'

export const useAppointmentStore = defineStore('appointment', () => {
  const appointments = ref<AppointmentResponse[]>([])
  const current = ref<AppointmentResponse | null>(null)
  const pagination = ref({ page: 1, per_page: 15, total: 0, last_page: 1 })

  const isLoading = ref(false)
  const isCreating = ref(false)

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

  async function checkInAppointment(uuid: string): Promise<void> {
    const response = await appointmentApi.checkIn(uuid)
    const idx = appointments.value.findIndex((a) => a.id === uuid)
    if (idx !== -1) appointments.value[idx] = response.data.appointment
    if (current.value?.id === uuid) current.value = response.data.appointment
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
    isLoading,
    isCreating,
    fetchAppointments,
    fetchAllForRange,
    fetchAppointment,
    createAppointment,
    cancelAppointment,
    checkInAppointment,
    markNoShow,
  }
})
