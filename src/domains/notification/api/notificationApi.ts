import { http } from '@/lib/http'
import type { NotificationResponse } from '../types/notification.types'

export const notificationApi = {
  list(page = 1): Promise<{ data: NotificationResponse[] }> {
    return http.get<{ data: NotificationResponse[] }>(`/notifications?page=${page}`)
  },

  unreadCount(): Promise<{ data: { count: number } }> {
    return http.get<{ data: { count: number } }>('/notifications/unread-count')
  },

  markRead(id: string): Promise<{ data: NotificationResponse }> {
    return http.patch<{ data: NotificationResponse }>(`/notifications/${id}/read`)
  },

  markAllRead(): Promise<void> {
    return http.post('/notifications/mark-all-read')
  },
}
