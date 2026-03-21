import { defineStore } from 'pinia'
import { ref } from 'vue'
import { toast } from 'vue-sonner'
import { notificationApi } from '../api/notificationApi'
import type { NotificationResponse, NotificationRealtimeEvent } from '../types/notification.types'

export const useNotificationStore = defineStore('notification', () => {
  const notifications = ref<NotificationResponse[]>([])
  const unreadCount = ref(0)
  const isLoading = ref(false)

  async function fetchNotifications(page = 1) {
    isLoading.value = true
    try {
      const res = await notificationApi.list(page)
      notifications.value = page === 1 ? res.data : [...notifications.value, ...res.data]
    } catch {
      // ignore
    } finally {
      isLoading.value = false
    }
  }

  async function fetchUnreadCount() {
    try {
      const res = await notificationApi.unreadCount()
      unreadCount.value = res.data.count
    } catch {
      // ignore
    }
  }

  async function markRead(id: string) {
    const notification = notifications.value.find((n) => n.id === id)
    if (notification && !notification.read_at) {
      notification.read_at = new Date().toISOString()
      unreadCount.value = Math.max(0, unreadCount.value - 1)
      try {
        await notificationApi.markRead(id)
      } catch {
        // revert
        notification.read_at = null
        unreadCount.value += 1
      }
    }
  }

  async function markAllRead() {
    const prevNotifications = notifications.value.map((n) => ({ ...n }))
    const prevCount = unreadCount.value

    notifications.value.forEach((n) => {
      if (!n.read_at) n.read_at = new Date().toISOString()
    })
    unreadCount.value = 0

    try {
      await notificationApi.markAllRead()
    } catch {
      // revert
      notifications.value = prevNotifications
      unreadCount.value = prevCount
    }
  }

  function handleRealtimeEvent(event: NotificationRealtimeEvent) {
    if (event.type === 'notification.new') {
      notifications.value.unshift(event.data)
      unreadCount.value += 1
      toast(event.data.title, {
        description: event.data.body,
        duration: 5000,
        position: 'top-right',
      })
    }
  }

  return {
    notifications,
    unreadCount,
    isLoading,
    fetchNotifications,
    fetchUnreadCount,
    markRead,
    markAllRead,
    handleRealtimeEvent,
  }
})
