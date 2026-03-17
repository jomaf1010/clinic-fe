import { http } from '@/lib/http'
import type {
  CreateWalkInPayload,
  QueueListResponse,
  SingleQueueVisitResponse,
} from '../types/queue.types'

export const queueApi = {
  list(filters?: { doctor_id?: string; status?: string }): Promise<QueueListResponse> {
    const params = new URLSearchParams()
    if (filters?.doctor_id) params.set('doctor_id', filters.doctor_id)
    if (filters?.status) params.set('status', filters.status)
    const qs = params.toString()
    return http.get<QueueListResponse>(`/queue${qs ? `?${qs}` : ''}`)
  },

  walkIn(payload: CreateWalkInPayload): Promise<SingleQueueVisitResponse> {
    return http.post<SingleQueueVisitResponse>('/queue/walk-in', payload)
  },

  call(uuid: string): Promise<SingleQueueVisitResponse> {
    return http.patch<SingleQueueVisitResponse>(`/queue/${uuid}/call`)
  },

  complete(uuid: string): Promise<SingleQueueVisitResponse> {
    return http.patch<SingleQueueVisitResponse>(`/queue/${uuid}/complete`)
  },

  cancel(uuid: string): Promise<SingleQueueVisitResponse> {
    return http.patch<SingleQueueVisitResponse>(`/queue/${uuid}/cancel`)
  },
}
