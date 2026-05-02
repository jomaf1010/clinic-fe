import { http } from '@/lib/http'
import type {
  AvailabilityResponse,
  CalendarBlockListResponse,
  CalendarBlockResponse,
  StoreCalendarBlockPayload,
  UpdateCalendarBlockPayload,
  UpsertWorkingSchedulePayload,
  WorkingScheduleResponse,
} from '../types/schedule.types'

export const scheduleApi = {
  getSchedule(userUuid: string): Promise<WorkingScheduleResponse> {
    return http.get<WorkingScheduleResponse>(`/schedules/${userUuid}`)
  },

  upsertSchedule(userUuid: string, payload: UpsertWorkingSchedulePayload): Promise<WorkingScheduleResponse> {
    return http.put<WorkingScheduleResponse>(`/schedules/${userUuid}`, payload)
  },

  listAllBlocks(start: string, end: string): Promise<CalendarBlockListResponse> {
    const params = new URLSearchParams({ start, end })
    return http.get<CalendarBlockListResponse>(`/calendar-blocks?${params}`)
  },

  createBlock(payload: StoreCalendarBlockPayload): Promise<CalendarBlockResponse> {
    return http.post<CalendarBlockResponse>('/calendar-blocks', payload)
  },

  updateBlock(uuid: string, payload: UpdateCalendarBlockPayload): Promise<CalendarBlockResponse> {
    return http.patch<CalendarBlockResponse>(`/calendar-blocks/${uuid}`, payload)
  },

  getAvailability(userId: string, date: string): Promise<AvailabilityResponse> {
    const params = new URLSearchParams({ user_id: userId, date })
    return http.get<AvailabilityResponse>(`/availability?${params}`)
  },
}
