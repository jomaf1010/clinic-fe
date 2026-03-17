<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import SiteHeader from '@/components/layout/SiteHeader.vue'
import { useAuthStore } from '@/domains/auth/stores/authStore'
import { useDmRealtime } from '@/domains/message/composables/useDmRealtime'
import { useMessageStore } from '@/domains/message/stores/messageStore'

const authStore = useAuthStore()
const messageStore = useMessageStore()
const { start: startDmRealtime, stop: stopDmRealtime } = useDmRealtime()

onMounted(() => {
  if (authStore.hasPermission('messages.view')) {
    startDmRealtime()
    messageStore.fetchConversations()
    messageStore.fetchUnreadCounts()
  }
})

onUnmounted(() => {
  stopDmRealtime()
})
</script>

<template>
  <SidebarProvider style="--header-height: 3.5rem">
    <AppSidebar />
    <SidebarInset>
      <SiteHeader />
      <div class="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto px-4 pb-4">
        <RouterView />
      </div>
    </SidebarInset>
  </SidebarProvider>
</template>
