import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppointmentResponse } from '@/domains/appointment/types/appointment.types'
import type {
  AvailabilityResponse,
  CalendarBlock,
  Slot,
  WorkingSchedule,
} from '../types/schedule.types'

class FakeHttpError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

interface MockScheduleApi {
  getSchedule: ReturnType<typeof vi.fn>
  upsertSchedule: ReturnType<typeof vi.fn>
  createBlock: ReturnType<typeof vi.fn>
  updateBlock: ReturnType<typeof vi.fn>
  getAvailability: ReturnType<typeof vi.fn>
  listAllBlocks: ReturnType<typeof vi.fn>
}

interface MockAppointmentApi {
  list: ReturnType<typeof vi.fn>
}

function makeSchedule(overrides: Partial<WorkingSchedule> = {}): WorkingSchedule {
  return {
    id: 'schedule-1',
    clinic_id: 'clinic-1',
    user_id: 'doctor-1',
    timezone: 'Asia/Manila',
    slot_duration: 30,
    days: [
      { day: 1, enabled: true, start_time: '09:00', end_time: '17:00', breaks: [] },
    ],
    created_at: '2026-05-01T00:00:00.000Z',
    updated_at: '2026-05-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeAppointment(overrides: Partial<AppointmentResponse> = {}): AppointmentResponse {
  return {
    id: 'appt-1',
    clinic_id: 'clinic-1',
    patient_id: 'patient-1',
    patient_name: 'Patient One',
    patient_avatar_url: null,
    doctor_id: 'doctor-1',
    doctor_name: 'Doctor One',
    doctor_avatar_url: null,
    created_by: 'user-1',
    status: 'scheduled',
    scheduled_at: '2026-05-06T01:00:00.000Z',
    duration: 30,
    reason: null,
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

function makeSlot(overrides: Partial<Slot> = {}): Slot {
  return {
    start: '2026-05-06T01:00:00.000Z',
    end: '2026-05-06T01:30:00.000Z',
    available: true,
    ...overrides,
  }
}

function makeBlock(overrides: Partial<CalendarBlock> = {}): CalendarBlock {
  return {
    id: 'block-1',
    clinic_id: 'clinic-1',
    user_id: 'doctor-1',
    user_name: 'Doctor One',
    user_avatar_url: null,
    title: 'Clinic meeting',
    type: 'meeting',
    all_day: false,
    recurring: false,
    start: '2026-05-06T04:00:00.000Z',
    end: '2026-05-06T05:00:00.000Z',
    notes: null,
    created_at: '2026-05-01T00:00:00.000Z',
    updated_at: '2026-05-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeScheduleApi(overrides: Partial<MockScheduleApi> = {}): MockScheduleApi {
  const availability: AvailabilityResponse = {
    data: {
      slots: [makeSlot()],
      blocks: [makeBlock()],
      schedule: makeSchedule(),
    },
  }

  return {
    getSchedule: vi.fn().mockResolvedValue({ data: makeSchedule() }),
    upsertSchedule: vi.fn().mockResolvedValue({ data: makeSchedule({ slot_duration: 15 }) }),
    createBlock: vi.fn().mockResolvedValue({ data: makeBlock() }),
    updateBlock: vi.fn().mockResolvedValue({ data: makeBlock({ title: 'Updated' }) }),
    getAvailability: vi.fn().mockResolvedValue(availability),
    listAllBlocks: vi.fn().mockResolvedValue({ data: [makeBlock({ id: 'upcoming-1' })] }),
    ...overrides,
  }
}

function makeAppointmentApi(overrides: Partial<MockAppointmentApi> = {}): MockAppointmentApi {
  return {
    list: vi.fn().mockResolvedValue({
      data: [makeAppointment(), makeAppointment({ id: 'appt-other-day', scheduled_at: '2026-05-07T01:00:00.000Z' })],
      meta: { pagination: { page: 1, per_page: 300, total: 2, last_page: 1 } },
    }),
    ...overrides,
  }
}

async function loadStore(scheduleApi: MockScheduleApi, appointmentApi: MockAppointmentApi = makeAppointmentApi()) {
  vi.doMock('@/lib/http', () => ({ HttpError: FakeHttpError }))
  vi.doMock('../api/scheduleApi', () => ({ scheduleApi }))
  vi.doMock('@/domains/appointment/api/appointmentApi', () => ({ appointmentApi }))
  return await import('./scheduleStore')
}

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.doUnmock('@/lib/http')
  vi.doUnmock('../api/scheduleApi')
  vi.doUnmock('@/domains/appointment/api/appointmentApi')
})

describe('scheduleStore - schedule lifecycle', () => {
  it('fetchSchedule stores the schedule response', async () => {
    const scheduleApi = makeScheduleApi({
      getSchedule: vi.fn().mockResolvedValue({ data: makeSchedule({ id: 'schedule-77' }) }),
    })
    const { useScheduleStore } = await loadStore(scheduleApi)
    const store = useScheduleStore()

    await store.fetchSchedule('doctor-1')

    expect(scheduleApi.getSchedule).toHaveBeenCalledWith('doctor-1')
    expect(store.schedule?.id).toBe('schedule-77')
    expect(store.isLoadingSchedule).toBe(false)
  })

  it('fetchSchedule treats 404 as an empty schedule', async () => {
    const scheduleApi = makeScheduleApi({
      getSchedule: vi.fn().mockRejectedValue(new FakeHttpError(404, 'not found')),
    })
    const { useScheduleStore } = await loadStore(scheduleApi)
    const store = useScheduleStore()
    store.schedule = makeSchedule()

    await store.fetchSchedule('doctor-1')

    expect(store.schedule).toBeNull()
    expect(store.isLoadingSchedule).toBe(false)
  })

  it('fetchSchedule rethrows non-404 errors and still clears loading', async () => {
    const scheduleApi = makeScheduleApi({
      getSchedule: vi.fn().mockRejectedValue(new FakeHttpError(500, 'server error')),
    })
    const { useScheduleStore } = await loadStore(scheduleApi)
    const store = useScheduleStore()

    await expect(store.fetchSchedule('doctor-1')).rejects.toThrow('server error')
    expect(store.isLoadingSchedule).toBe(false)
  })

  it('saveSchedule updates the current schedule and clears saving state', async () => {
    const saved = makeSchedule({ slot_duration: 15 })
    const scheduleApi = makeScheduleApi({
      upsertSchedule: vi.fn().mockResolvedValue({ data: saved }),
    })
    const { useScheduleStore } = await loadStore(scheduleApi)
    const store = useScheduleStore()

    await store.saveSchedule('doctor-1', {
      timezone: 'Asia/Manila',
      slot_duration: 15,
      days: saved.days,
    })

    expect(store.schedule?.slot_duration).toBe(15)
    expect(store.isSavingSchedule).toBe(false)
  })

  it('createBlock and updateBlock delegate to the API', async () => {
    const scheduleApi = makeScheduleApi()
    const { useScheduleStore } = await loadStore(scheduleApi)
    const store = useScheduleStore()

    await store.createBlock({
      user_id: 'doctor-1',
      title: 'Out',
      type: 'unavailable',
      all_day: false,
      recurring: false,
      start: '2026-05-06T01:00:00.000Z',
      end: '2026-05-06T02:00:00.000Z',
    })
    await store.updateBlock('block-1', { title: 'Updated' })

    expect(scheduleApi.createBlock).toHaveBeenCalledOnce()
    expect(scheduleApi.updateBlock).toHaveBeenCalledWith('block-1', { title: 'Updated' })
  })
})

describe('scheduleStore - studio data', () => {
  it('loads month appointments, selected-day appointments, slots, day blocks, and upcoming blocks', async () => {
    const scheduleApi = makeScheduleApi({
      getAvailability: vi.fn().mockResolvedValue({
        data: {
          slots: [makeSlot({ start: '2026-05-06T02:00:00.000Z' })],
          blocks: [makeBlock({ id: 'day-block' })],
          schedule: makeSchedule(),
        },
      }),
      listAllBlocks: vi.fn().mockResolvedValue({ data: [makeBlock({ id: 'future-block' })] }),
    })
    const appointmentApi = makeAppointmentApi()
    const { useScheduleStore } = await loadStore(scheduleApi, appointmentApi)
    const store = useScheduleStore()

    await store.fetchStudioData({
      userId: 'doctor-1',
      date: '2026-05-06',
      start: '2026-05-01',
      end: '2026-05-31',
      blockRangeEnd: '2026-06-30',
    })

    expect(appointmentApi.list).toHaveBeenCalledWith(1, 300, {
      doctor_id: 'doctor-1',
      start_date: '2026-05-01',
      end_date: '2026-05-31',
    })
    expect(store.studioMonthAppointments.map((appointment) => appointment.id)).toEqual(['appt-1', 'appt-other-day'])
    expect(store.studioAppointments.map((appointment) => appointment.id)).toEqual(['appt-1'])
    expect(store.studioSlots[0]?.start).toBe('2026-05-06T02:00:00.000Z')
    expect(store.studioDayBlocks[0]?.id).toBe('day-block')
    expect(store.studioUpcomingBlocks[0]?.id).toBe('future-block')
    expect(store.studioError).toBeNull()
    expect(store.isLoadingStudio).toBe(false)
  })

  it('sets studioError when studio loading fails', async () => {
    const scheduleApi = makeScheduleApi()
    const appointmentApi = makeAppointmentApi({
      list: vi.fn().mockRejectedValue(new Error('boom')),
    })
    const { useScheduleStore } = await loadStore(scheduleApi, appointmentApi)
    const store = useScheduleStore()

    await store.fetchStudioData({
      userId: 'doctor-1',
      date: '2026-05-06',
      start: '2026-05-01',
      end: '2026-05-31',
      blockRangeEnd: '2026-06-30',
    })

    expect(store.studioError).toBe('Failed to load schedule view.')
    expect(store.isLoadingStudio).toBe(false)
  })

  it('ignores duplicate in-flight studio requests for the same parameters', async () => {
    let resolveList: (value: Awaited<ReturnType<MockAppointmentApi['list']>>) => void = () => {}
    const scheduleApi = makeScheduleApi()
    const appointmentApi = makeAppointmentApi({
      list: vi.fn().mockImplementation(() => new Promise((resolve) => {
        resolveList = resolve
      })),
    })
    const { useScheduleStore } = await loadStore(scheduleApi, appointmentApi)
    const store = useScheduleStore()
    const params = {
      userId: 'doctor-1',
      date: '2026-05-06',
      start: '2026-05-01',
      end: '2026-05-31',
      blockRangeEnd: '2026-06-30',
      refreshKey: 1,
    }

    const first = store.fetchStudioData(params)
    const second = store.fetchStudioData(params)

    await expect(second).resolves.toBeUndefined()
    expect(appointmentApi.list).toHaveBeenCalledOnce()
    resolveList({
      data: [makeAppointment()],
      meta: { pagination: { page: 1, per_page: 300, total: 1, last_page: 1 } },
    })
    await first
    expect(store.isLoadingStudio).toBe(false)
  })
})
