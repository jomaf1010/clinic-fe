import { http } from '@/lib/http'
import type {
  CreateWalkInPayload,
  QueueDisplayCentrifugoTokens,
  QueueDisplayData,
  QueueDisplayTokenStatus,
  QueueListResponse,
  SingleQueueVisitResponse,
} from '../types/queue.types'

const API_URL = import.meta.env.VITE_API_URL as string

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

  // Public display endpoints (no JWT needed)
  async getDisplay(token: string): Promise<QueueDisplayData> {
    const response = await fetch(`${API_URL}/queue-display/${token}`, {
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) {
      throw new Error(response.status === 404 ? 'INVALID_TOKEN' : 'NETWORK_ERROR')
    }
    return response.json()
  },

  async refreshDisplayTokens(token: string): Promise<QueueDisplayCentrifugoTokens> {
    const response = await fetch(`${API_URL}/queue-display/${token}/centrifugo-tokens`, {
      method: 'POST',
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) {
      throw new Error(response.status === 404 ? 'INVALID_TOKEN' : 'NETWORK_ERROR')
    }
    return response.json()
  },

  // Authenticated display token management
  getDisplayTokenStatus(): Promise<QueueDisplayTokenStatus> {
    return http.get<QueueDisplayTokenStatus>('/clinic/queue-display-token')
  },

  generateDisplayToken(): Promise<QueueDisplayTokenStatus> {
    return http.post<QueueDisplayTokenStatus>('/clinic/queue-display-token')
  },

  revokeDisplayToken(): Promise<void> {
    return http.delete<void>('/clinic/queue-display-token')
  },
}
