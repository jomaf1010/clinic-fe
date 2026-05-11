<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import SiteHeader from '@/components/layout/SiteHeader.vue'
import AnnouncementBanners from '@/components/layout/AnnouncementBanners.vue'
import TrialBanner from '@/components/layout/TrialBanner.vue'
import GracePeriodBanner from '@/components/layout/GracePeriodBanner.vue'
import SpecialtySetupDialog from '@/domains/auth/components/SpecialtySetupDialog.vue'
import { useAuthStore } from '@/domains/auth/stores/authStore'
import { useDmRealtime } from '@/domains/message/composables/useDmRealtime'
import { useMessageStore } from '@/domains/message/stores/messageStore'
import { useNotificationRealtime } from '@/domains/notification/composables/useNotificationRealtime'
import { useNotificationStore } from '@/domains/notification/stores/notificationStore'
import { useOnlineStatus } from '@/composables/useOnlineStatus'
import { useAnnouncementStore } from '@/stores/announcementStore'
import { RouteNames } from '@/router/routeNames'

const route = useRoute()
const authStore = useAuthStore()
const messageStore = useMessageStore()
const notificationStore = useNotificationStore()
const { start: startDmRealtime, stop: stopDmRealtime } = useDmRealtime()
const { start: startNotificationRealtime, stop: stopNotificationRealtime } = useNotificationRealtime()
useOnlineStatus()
const announcementStore = useAnnouncementStore()
const isEncounterRoute = computed(() =>
  route.name === RouteNames.ENCOUNTER_NEW || route.name === RouteNames.ENCOUNTER_DETAIL,
)
const usesCustomTopbar = computed(() => isEncounterRoute.value || route.meta.usesCustomTopbar === true)

let notificationPollTimer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  if (authStore.hasPermission('messages.view') && authStore.hasFeature('messages')) {
    startDmRealtime()
    messageStore.fetchConversations()
    messageStore.fetchUnreadCounts()
  }

  announcementStore.fetchActive()

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
  <SidebarProvider class="app-shell" style="--header-height: 3.5rem">
    <AppSidebar />
    <SidebarInset>
      <SiteHeader v-if="!usesCustomTopbar" />
      <AnnouncementBanners />
      <TrialBanner />
      <GracePeriodBanner />
      <div
        class="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto px-4 pb-4"
        :class="usesCustomTopbar
          ? 'pt-0'
          : '-mt-[calc(var(--header-height)+1rem)] pt-[calc(var(--header-height)+1.75rem)]'"
      >
        <RouterView />
      </div>
    </SidebarInset>
    <SpecialtySetupDialog />
  </SidebarProvider>
</template>
