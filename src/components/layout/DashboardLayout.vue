<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import SiteHeader from '@/components/layout/SiteHeader.vue'
import TrialBanner from '@/components/layout/TrialBanner.vue'
import { useAuthStore } from '@/domains/auth/stores/authStore'
import { useDmRealtime } from '@/domains/message/composables/useDmRealtime'
import { useMessageStore } from '@/domains/message/stores/messageStore'
import { useNotificationRealtime } from '@/domains/notification/composables/useNotificationRealtime'
import { useNotificationStore } from '@/domains/notification/stores/notificationStore'
import { useOnlineStatus } from '@/composables/useOnlineStatus'

const authStore = useAuthStore()
const messageStore = useMessageStore()
const notificationStore = useNotificationStore()
const { start: startDmRealtime, stop: stopDmRealtime } = useDmRealtime()
const { start: startNotificationRealtime, stop: stopNotificationRealtime } = useNotificationRealtime()
useOnlineStatus()

let notificationPollTimer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  if (authStore.hasPermission('messages.view') && authStore.hasFeature('messages')) {
    startDmRealtime()
    messageStore.fetchConversations()
    messageStore.fetchUnreadCounts()
  }

  // Notifications — always enabled for all users
  startNotificationRealtime()
  notificationStore.fetchUnreadCount()
  notificationPollTimer = setInterval(() => {
    notificationStore.fetchUnreadCount()
  }, 60000)
})

onUnmounted(() => {
  stopDmRealtime()
  stopNotificationRealtime()
  if (notificationPollTimer) {
    clearInterval(notificationPollTimer)
  }
})
</script>

<template>
  <SidebarProvider style="--header-height: 3.5rem">
    <AppSidebar />
    <SidebarInset>
      <SiteHeader />
      <TrialBanner />
      <div class="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto px-4 pb-4">
        <RouterView />
      </div>
    </SidebarInset>
  </SidebarProvider>
</template>
