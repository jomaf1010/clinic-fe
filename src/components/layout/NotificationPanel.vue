<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Bell, CheckCheck, FileText, FileCheck, UserRound, CalendarDays, Download, Printer } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { useNotificationStore } from '@/domains/notification/stores/notificationStore'
import { RouteNames } from '@/router/routeNames'
import { openNewTab, printPdf } from '@/lib/utils'
import { documentApi } from '@/domains/consultation/api/documentApi'

const emit = defineEmits<{
  close: []
}>()

const router = useRouter()
const store = useNotificationStore()

onMounted(() => {
  store.fetchNotifications()
})

function getIcon(type: string) {
  switch (type) {
    case 'document.generated': return FileText
    case 'queue.patient_assigned': return UserRound
    case 'appointment.created': return CalendarDays
    case 'appointment.rescheduled': return CalendarDays
    case 'medcert.requested': return FileCheck
    case 'medcert.completed': return FileText
    default: return Bell
  }
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function handleClick(notification: typeof store.notifications[number]) {
  store.markRead(notification.id)

  // Navigate based on type
  const data = notification.data
  if (notification.type === 'document.generated' && data.encounter_id) {
    if (data.patient_id) {
      router.push({
        name: RouteNames.ENCOUNTER_DETAIL,
        params: { patientId: data.patient_id as string, id: data.encounter_id as string },
      })
    }
  } else if (notification.type === 'queue.patient_assigned' && data.patient_id) {
    router.push({
      name: RouteNames.PATIENT_DETAIL,
      params: { id: data.patient_id as string },
    })
  } else if ((notification.type === 'appointment.created' || notification.type === 'appointment.rescheduled') && data.patient_id) {
    router.push({
      name: RouteNames.PATIENT_DETAIL,
      params: { id: data.patient_id as string },
    })
  } else if (notification.type === 'medcert.requested' && data.encounter_id && data.patient_id) {
    router.push({
      name: RouteNames.ENCOUNTER_DETAIL,
      params: { patientId: data.patient_id as string, id: data.encounter_id as string },
      query: { openMedCert: '1' },
    })
  } else if (notification.type === 'medcert.completed' && data.patient_id) {
    router.push({
      name: RouteNames.PATIENT_DETAIL,
      params: { id: data.patient_id as string },
    })
  }

  emit('close')
}

function hasDocumentId(notification: typeof store.notifications[number]): boolean {
  return (notification.type === 'medcert.completed' || notification.type === 'document.generated')
    && !!notification.data?.document_id
}

async function handleDownload(documentId: string) {
  const tab = openNewTab()
  try {
    const url = await documentApi.getSignedUrl(documentId)
    tab.navigate(url)
  } catch {
    tab.close()
  }
}

async function handlePrint(documentId: string) {
  try {
    const url = await documentApi.getSignedUrl(documentId)
    printPdf(url)
  } catch {
    // silent
  }
}

</script>

<template>
  <div class="flex h-full flex-col">
    <!-- Header -->
    <div class="flex items-center justify-between border-b pl-4 pr-12 py-3">
      <h3 class="text-sm font-semibold">Notifications</h3>
      <Button
        v-if="store.unreadCount > 0"
        variant="ghost"
        size="sm"
        class="h-7 gap-1.5 text-xs"
        @click="store.markAllRead()"
      >
        <CheckCheck class="size-3" />
        Mark all read
      </Button>
    </div>

    <!-- List -->
    <div class="flex-1 overflow-y-auto">
      <div v-if="store.isLoading && store.notifications.length === 0" class="flex items-center justify-center py-12">
        <div class="size-5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
      </div>

      <div
        v-else-if="store.notifications.length === 0"
        class="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground"
      >
        <Bell class="size-8 opacity-50" />
        <p class="text-sm">No notifications yet</p>
      </div>

      <div v-else>
        <button
          v-for="notification in store.notifications"
          :key="notification.id"
          type="button"
          class="flex w-full items-start gap-3 border-b px-4 py-3 text-left transition-colors hover:bg-accent/50"
          :class="notification.read_at ? 'opacity-60' : 'bg-primary/5'"
          @click="handleClick(notification)"
        >
          <div
            class="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full"
            :class="notification.read_at ? 'bg-muted' : 'bg-primary/10'"
          >
            <component
              :is="getIcon(notification.type)"
              class="size-4"
              :class="notification.read_at ? 'text-muted-foreground' : 'text-primary'"
            />
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <p class="truncate text-sm font-medium">{{ notification.title }}</p>
              <div v-if="!notification.read_at" class="size-1.5 shrink-0 rounded-full bg-primary" />
            </div>
            <p class="mt-0.5 text-xs text-muted-foreground line-clamp-2">{{ notification.body }}</p>
            <div v-if="hasDocumentId(notification)" class="mt-1.5 flex items-center gap-1.5" @click.stop>
              <button
                type="button"
                class="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-0.5 text-[11px] font-medium text-foreground transition-colors hover:bg-accent"
                @click="handleDownload(notification.data.document_id as string)"
              >
                <Download class="size-3" />
                Download
              </button>
              <button
                type="button"
                class="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-0.5 text-[11px] font-medium text-foreground transition-colors hover:bg-accent"
                @click="handlePrint(notification.data.document_id as string)"
              >
                <Printer class="size-3" />
                Print
              </button>
              <span class="ml-auto text-[10px] text-muted-foreground">{{ timeAgo(notification.created_at) }}</span>
            </div>
            <p v-else class="mt-1 text-[10px] text-muted-foreground">{{ timeAgo(notification.created_at) }}</p>
          </div>
        </button>
      </div>
    </div>
  </div>
</template>
