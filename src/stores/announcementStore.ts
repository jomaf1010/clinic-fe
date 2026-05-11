import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { http } from '@/lib/http'

export interface Announcement {
  uuid: string
  title: string
  message: string
  type: 'info' | 'warning' | 'maintenance' | 'update'
  starts_at: string
  ends_at: string
}

const DISMISSED_KEY = 'dismissed_announcements'

function getDismissedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY)
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch {
    return new Set()
  }
}

function saveDismissedIds(ids: Set<string>): void {
  localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids]))
}

export const useAnnouncementStore = defineStore('announcements', () => {
  const all = ref<Announcement[]>([])
  const dismissedIds = ref<Set<string>>(getDismissedIds())

  const visible = computed(() =>
    all.value.filter(a => !dismissedIds.value.has(a.uuid)),
  )

  async function fetchActive(): Promise<void> {
    try {
      const response = await http.get<{ data: Announcement[] }>('/announcements/active')
      all.value = response.data

      // Clean up stale dismissed IDs
      const activeIds = new Set(response.data.map(a => a.uuid))
      const cleaned = new Set([...dismissedIds.value].filter(id => activeIds.has(id)))
      if (cleaned.size !== dismissedIds.value.size) {
        dismissedIds.value = cleaned
        saveDismissedIds(cleaned)
      }
    } catch {
      // non-critical — silently fail
    }
  }

  function dismiss(uuid: string): void {
    dismissedIds.value = new Set([...dismissedIds.value, uuid])
    saveDismissedIds(dismissedIds.value)
  }

  return { all, visible, fetchActive, dismiss }
})
