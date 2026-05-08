import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  AppointmentListResponse,
  AppointmentResponse,
  ClinicDoctor,
} from '../types/appointment.types'
import type { CalendarBlock, Slot } from '@/domains/schedule/types/schedule.types'

interface MockAppointmentApi {
  list: ReturnType<typeof vi.fn>
  get: ReturnType<typeof vi.fn>
  create: ReturnType<typeof vi.fn>
  cancel: ReturnType<typeof vi.fn>
  checkIn: ReturnType<typeof vi.fn>
  noShow: ReturnType<typeof vi.fn>
  getDoctors: ReturnType<typeof vi.fn>
}

interface MockScheduleApi {
  getAvailability: ReturnType<typeof vi.fn>
}

function makeAppointment(overrides: Partial<AppointmentResponse> = {}): AppointmentResponse {
  return {
    id: 'appt-1',
    clinic_id: 'clinic-1',
    patient_id: 'patient-1',
    patient_name: 'Juan Dela Cruz',
    patient_avatar_url: null,
    doctor_id: 'doctor-1',
    doctor_name: 'Maria Santos',
    doctor_avatar_url: null,
    created_by: 'user-1',
    status: 'scheduled',
    scheduled_at: '2026-05-06T01:00:00.000Z',
    duration: 30,
    reason: 'Consultation',
    cancellation_reason: null,
    cancelled_by: null,
    checked_in_at: null,
    completed_at: null,
    notes: null,
    created_at: '2026-05-01T00:00:00.000Z',
    updated_at: '2026-05-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeDoctor(overrides: Partial<ClinicDoctor> = {}): ClinicDoctor {
  return {
    id: 'doctor-1',
    name: 'Maria Santos',
    email: 'doctor@example.com',
    role: 'doctor',
    avatar_url: null,
    ...overrides,
  }
}

function makeListResponse(data: AppointmentResponse[] = []): AppointmentListResponse {
  return {
    data,
    meta: { pagination: { page: 1, per_page: 15, total: data.length, last_page: 1 } },
  }
}

function makeSlot(overrides: Partial<Slot> = {}): Slot {
  return {
    start_at: '2026-05-06T01:00:00.000Z',
    end_at: '2026-05-06T01:30:00.000Z',
    is_available: true,
    ...overrides,
  } as Slot
}

function makeBlock(overrides: Partial<CalendarBlock> = {}): CalendarBlock {
  return {
    id: 'block-1',
    doctor_id: 'doctor-1',
    start_at: '2026-05-06T04:00:00.000Z',
    end_at: '2026-05-06T05:00:00.000Z',
    type: 'break',
    reason: 'Lunch',
    ...overrides,
  } as CalendarBlock
}

function makeAppointmentApi(overrides: Partial<MockAppointmentApi> = {}): MockAppointmentApi {
  return {
    list: vi.fn().mockResolvedValue(makeListResponse()),
    get: vi.fn().mockResolvedValue({ data: makeAppointment() }),
    create: vi.fn().mockResolvedValue({ data: makeAppointment() }),
    cancel: vi.fn().mockResolvedValue({ data: makeAppointment({ status: 'cancelled' }) }),
    checkIn: vi.fn().mockResolvedValue({ data: { appointment: makeAppointment({ status: 'checked_in' }) } }),
    noShow: vi.fn().mockResolvedValue({ data: makeAppointment({ status: 'no_show' }) }),
    getDoctors: vi.fn().mockResolvedValue({ data: [makeDoctor()] }),
    ...overrides,
  }
}

function makeScheduleApi(overrides: Partial<MockScheduleApi> = {}): MockScheduleApi {
  return {
    getAvailability: vi.fn().mockResolvedValue({
      data: { slots: [makeSlot()], blocks: [makeBlock()] },
    }),
    ...overrides,
  }
}

async function loadStore(appointmentApi: MockAppointmentApi, scheduleApi: MockScheduleApi = makeScheduleApi()) {
  vi.doMock('../api/appointmentApi', () => ({ appointmentApi }))
  vi.doMock('@/domains/schedule/api/scheduleApi', () => ({ scheduleApi }))
  return await import('./appointmentStore')
}

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.doUnmock('../api/appointmentApi')
  vi.doUnmock('@/domains/schedule/api/scheduleApi')
})

describe('appointmentStore - list fetching', () => {
  it('populates appointments and pagination from the API response', async () => {
    const appointmentApi = makeAppointmentApi({
      list: vi.fn().mockResolvedValue({
        data: [makeAppointment({ id: 'appt-A' })],
        meta: { pagination: { page: 2, per_page: 25, total: 40, last_page: 2 } },
      }),
    })
    const { useAppointmentStore } = await loadStore(appointmentApi)
    const store = useAppointmentStore()

    await store.fetchAppointments(2, 25, { status: 'scheduled', doctor_id: 'doctor-1' })

    expect(appointmentApi.list).toHaveBeenCalledWith(2, 25, { status: 'scheduled', doctor_id: 'doctor-1' })
    expect(store.appointments).toHaveLength(1)
    expect(store.pagination).toEqual({ page: 2, per_page: 25, total: 40, last_page: 2 })
    expect(store.isLoading).toBe(false)
  })

  it('clears isLoading when the list request fails', async () => {
    const appointmentApi = makeAppointmentApi({
      list: vi.fn().mockRejectedValue(new Error('network down')),
    })
    const { useAppointmentStore } = await loadStore(appointmentApi)
    const store = useAppointmentStore()

    await expect(store.fetchAppointments()).rejects.toThrow('network down')
    expect(store.isLoading).toBe(false)
  })

  it('fetchAllForRange includes date range and optional status', async () => {
    const appointmentApi = makeAppointmentApi({
      list: vi.fn().mockResolvedValue(makeListResponse([makeAppointment({ id: 'appt-range' })])),
    })
    const { useAppointmentStore } = await loadStore(appointmentApi)
    const store = useAppointmentStore()

    const result = await store.fetchAllForRange('2026-05-01', '2026-05-31', 'checked_in')

    expect(result[0]?.id).toBe('appt-range')
    expect(appointmentApi.list).toHaveBeenCalledWith(1, 500, {
      start_date: '2026-05-01',
      end_date: '2026-05-31',
      status: 'checked_in',
    })
  })

  it('fetchAllForRange omits status when no status filter is provided', async () => {
    const appointmentApi = makeAppointmentApi()
    const { useAppointmentStore } = await loadStore(appointmentApi)
    const store = useAppointmentStore()

    await store.fetchAllForRange('2026-05-01', '2026-05-31')

    expect(appointmentApi.list).toHaveBeenCalledWith(1, 500, {
      start_date: '2026-05-01',
      end_date: '2026-05-31',
    })
  })
})

describe('appointmentStore - board data', () => {
  it('loads doctors once and reuses cached doctors on later calls', async () => {
    const appointmentApi = makeAppointmentApi()
    const { useAppointmentStore } = await loadStore(appointmentApi)
    const store = useAppointmentStore()

    await store.fetchDoctors()
    await store.fetchDoctors()

    expect(appointmentApi.getDoctors).toHaveBeenCalledOnce()
    expect(store.boardDoctors[0]?.id).toBe('doctor-1')
  })

  it('loads board appointments, visible doctors, availability, and de-duplicated blocks', async () => {
    const doctorOne = makeDoctor({ id: 'doctor-1' })
    const doctorTwo = makeDoctor({ id: 'doctor-2' })
    const sameDay = makeAppointment({ id: 'appt-today', doctor_id: 'doctor-1', scheduled_at: '2026-05-06T01:00:00.000Z' })
    const otherDay = makeAppointment({ id: 'appt-other', doctor_id: 'doctor-2', scheduled_at: '2026-05-07T01:00:00.000Z' })
    const appointmentApi = makeAppointmentApi({
      list: vi.fn().mockResolvedValue(makeListResponse([sameDay, otherDay])),
      getDoctors: vi.fn().mockResolvedValue({ data: [doctorOne, doctorTwo] }),
    })
    const scheduleApi = makeScheduleApi({
      getAvailability: vi.fn()
        .mockResolvedValueOnce({ data: { slots: [makeSlot({ start_at: '2026-05-06T01:00:00.000Z' })], blocks: [makeBlock({ id: 'block-shared' })] } })
        .mockResolvedValueOnce({ data: { slots: [makeSlot({ start_at: '2026-05-06T02:00:00.000Z' })], blocks: [makeBlock({ id: 'block-shared' })] } }),
    })
    const { useAppointmentStore } = await loadStore(appointmentApi, scheduleApi)
    const store = useAppointmentStore()

    await store.fetchBoardData({
      date: '2026-05-06',
      start: '2026-05-01',
      end: '2026-05-31',
      doctorFilter: 'all',
      statusFilter: 'all',
    })

    expect(store.boardMonthAppointments.map((appointment) => appointment.id)).toEqual(['appt-today', 'appt-other'])
    expect(store.boardAppointments.map((appointment) => appointment.id)).toEqual(['appt-today'])
    expect(scheduleApi.getAvailability).toHaveBeenCalledTimes(2)
    expect(store.boardAvailabilityByDoctor['doctor-1']).toHaveLength(1)
    expect(store.boardAvailabilityByDoctor['doctor-2']).toHaveLength(1)
    expect(store.boardCalendarBlocks).toHaveLength(1)
    expect(store.boardError).toBeNull()
    expect(store.isLoadingBoard).toBe(false)
  })

  it('sets boardError when the board list request fails', async () => {
    const appointmentApi = makeAppointmentApi({
      list: vi.fn().mockRejectedValue(new Error('boom')),
    })
    const { useAppointmentStore } = await loadStore(appointmentApi)
    const store = useAppointmentStore()

    await store.fetchBoardData({
      date: '2026-05-06',
      start: '2026-05-01',
      end: '2026-05-31',
      doctorFilter: 'all',
      statusFilter: 'all',
    })

    expect(store.boardError).toBe('Failed to load appointment board.')
    expect(store.isLoadingBoard).toBe(false)
  })

  it('applies doctor and status filters and tolerates availability failures', async () => {
    const doctorOne = makeDoctor({ id: 'doctor-1' })
    const doctorTwo = makeDoctor({ id: 'doctor-2' })
    const appointmentApi = makeAppointmentApi({
      list: vi.fn().mockResolvedValue(makeListResponse([
        makeAppointment({ id: 'appt-filtered', doctor_id: 'doctor-2', status: 'checked_in' }),
      ])),
      getDoctors: vi.fn().mockResolvedValue({ data: [doctorOne, doctorTwo] }),
    })
    const scheduleApi = makeScheduleApi({
      getAvailability: vi.fn().mockRejectedValue(new Error('availability down')),
    })
    const { useAppointmentStore } = await loadStore(appointmentApi, scheduleApi)
    const store = useAppointmentStore()

    await store.fetchBoardData({
      date: '2026-05-06',
      start: '2026-05-01',
      end: '2026-05-31',
      doctorFilter: 'doctor-2',
      statusFilter: 'checked_in',
    })

    expect(appointmentApi.list).toHaveBeenCalledWith(1, 500, {
      start_date: '2026-05-01',
      end_date: '2026-05-31',
      doctor_id: 'doctor-2',
      status: 'checked_in',
    })
    expect(scheduleApi.getAvailability).toHaveBeenCalledWith('doctor-2', '2026-05-06')
    expect(store.boardAppointments.map((appointment) => appointment.id)).toEqual(['appt-filtered'])
    expect(store.boardAvailabilityByDoctor).toEqual({ 'doctor-2': [] })
    expect(store.boardCalendarBlocks).toEqual([])
  })

  it('ignores duplicate in-flight board requests for the same parameters', async () => {
    let resolveList: (value: ReturnType<typeof makeListResponse>) => void = () => {}
    const appointmentApi = makeAppointmentApi({
      list: vi.fn().mockImplementation(() => new Promise((resolve) => {
        resolveList = resolve
      })),
    })
    const { useAppointmentStore } = await loadStore(appointmentApi)
    const store = useAppointmentStore()
    const params = {
      date: '2026-05-06',
      start: '2026-05-01',
      end: '2026-05-31',
      doctorFilter: 'all',
      statusFilter: 'all',
    }

    const first = store.fetchBoardData(params)
    const second = store.fetchBoardData(params)

    await expect(second).resolves.toBeUndefined()
    expect(appointmentApi.list).toHaveBeenCalledOnce()
    resolveList(makeListResponse())
    await first
    await second
    expect(store.isLoadingBoard).toBe(false)
  })
})

describe('appointmentStore - mutations', () => {
  it('fetchAppointment stores the current appointment', async () => {
    const appointmentApi = makeAppointmentApi({
      get: vi.fn().mockResolvedValue({ data: makeAppointment({ id: 'appt-current' }) }),
    })
    const { useAppointmentStore } = await loadStore(appointmentApi)
    const store = useAppointmentStore()

    await store.fetchAppointment('appt-current')

    expect(store.current?.id).toBe('appt-current')
    expect(store.isLoading).toBe(false)
  })

  it('createAppointment returns created data and clears isCreating', async () => {
    const appointmentApi = makeAppointmentApi({
      create: vi.fn().mockResolvedValue({ data: makeAppointment({ id: 'appt-created' }) }),
    })
    const { useAppointmentStore } = await loadStore(appointmentApi)
    const store = useAppointmentStore()

    const result = await store.createAppointment({
      patient_id: 'patient-1',
      doctor_id: 'doctor-1',
      scheduled_at: '2026-05-06T01:00:00.000Z',
    })

    expect(result.id).toBe('appt-created')
    expect(store.isCreating).toBe(false)
  })

  it('cancelAppointment updates the matching list item and current appointment', async () => {
    const cancelled = makeAppointment({ id: 'appt-1', status: 'cancelled', cancellation_reason: 'Patient request' })
    const appointmentApi = makeAppointmentApi({
      cancel: vi.fn().mockResolvedValue({ data: cancelled }),
    })
    const { useAppointmentStore } = await loadStore(appointmentApi)
    const store = useAppointmentStore()
    store.appointments = [makeAppointment({ id: 'appt-1' }), makeAppointment({ id: 'appt-2' })]
    store.current = makeAppointment({ id: 'appt-1' })

    await store.cancelAppointment('appt-1', 'Patient request')

    expect(appointmentApi.cancel).toHaveBeenCalledWith('appt-1', { reason: 'Patient request' })
    expect(store.appointments[0]?.status).toBe('cancelled')
    expect(store.appointments[1]?.id).toBe('appt-2')
    expect(store.current?.status).toBe('cancelled')
  })

  it('cancelAppointment omits the reason payload and leaves unrelated state unchanged', async () => {
    const appointmentApi = makeAppointmentApi({
      cancel: vi.fn().mockResolvedValue({ data: makeAppointment({ id: 'appt-missing', status: 'cancelled' }) }),
    })
    const { useAppointmentStore } = await loadStore(appointmentApi)
    const store = useAppointmentStore()
    store.appointments = [makeAppointment({ id: 'appt-1' })]
    store.current = makeAppointment({ id: 'appt-1' })

    await store.cancelAppointment('appt-missing')

    expect(appointmentApi.cancel).toHaveBeenCalledWith('appt-missing', undefined)
    expect(store.appointments[0]?.id).toBe('appt-1')
    expect(store.current?.id).toBe('appt-1')
  })

  it('checkInAppointment uses the nested appointment payload', async () => {
    const appointmentApi = makeAppointmentApi({
      checkIn: vi.fn().mockResolvedValue({ data: { appointment: makeAppointment({ id: 'appt-1', status: 'checked_in' }) } }),
    })
    const { useAppointmentStore } = await loadStore(appointmentApi)
    const store = useAppointmentStore()
    store.appointments = [makeAppointment({ id: 'appt-1' })]
    store.current = makeAppointment({ id: 'appt-1' })

    await store.checkInAppointment('appt-1')

    expect(store.appointments[0]?.status).toBe('checked_in')
    expect(store.current?.status).toBe('checked_in')
  })

  it('markNoShow updates the matching list item and current appointment', async () => {
    const appointmentApi = makeAppointmentApi({
      noShow: vi.fn().mockResolvedValue({ data: makeAppointment({ id: 'appt-1', status: 'no_show' }) }),
    })
    const { useAppointmentStore } = await loadStore(appointmentApi)
    const store = useAppointmentStore()
    store.appointments = [makeAppointment({ id: 'appt-1' })]
    store.current = makeAppointment({ id: 'appt-1' })

    await store.markNoShow('appt-1')

    expect(store.appointments[0]?.status).toBe('no_show')
    expect(store.current?.status).toBe('no_show')
  })
})
