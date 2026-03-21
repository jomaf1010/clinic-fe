<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { MessageSquare, SearchIcon, LoaderCircle, MapPin, UserPlus, Wifi, WifiOff, Bell } from 'lucide-vue-next'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useCentrifugo } from '@/composables/useCentrifugo'
import { useAuthStore } from '@/domains/auth/stores/authStore'
import { useMessageStore } from '@/domains/message/stores/messageStore'
import { useNotificationStore } from '@/domains/notification/stores/notificationStore'
import MessagePanel from '@/domains/message/components/MessagePanel.vue'
import NotificationPanel from '@/components/layout/NotificationPanel.vue'
import { patientApi } from '@/domains/patient/api/patientApi'
import type { PatientSearchResult } from '@/domains/patient/types/patient.types'
import { RouteNames } from '@/router/routeNames'

const { isConnected } = useCentrifugo()
const authStore = useAuthStore()
const messageStore = useMessageStore()
const notificationStore = useNotificationStore()
const notificationSheetOpen = ref(false)

const router = useRouter()
const messageSheetOpen = ref(false)
const hasMessagesPermission = ref(false)

watch(() => authStore.user, () => {
  hasMessagesPermission.value = authStore.hasPermission('messages.view')
}, { immediate: true })

const query = ref('')
const results = ref<PatientSearchResult[]>([])
const showDropdown = ref(false)
const isSearching = ref(false)
const activeIndex = ref(-1)
let debounceTimer: ReturnType<typeof setTimeout> | null = null

watch(query, (val) => {
  if (debounceTimer) clearTimeout(debounceTimer)

  const trimmed = val.trim()
  if (trimmed.length < 2) {
    results.value = []
    showDropdown.value = false
    activeIndex.value = -1
    return
  }

  debounceTimer = setTimeout(async () => {
    isSearching.value = true
    try {
      const response = await patientApi.search(trimmed)
      results.value = response.data
      showDropdown.value = true
      activeIndex.value = -1
    } catch {
      results.value = []
    } finally {
      isSearching.value = false
    }
  }, 300)
})

function selectPatient(patient: PatientSearchResult) {
  query.value = ''
  results.value = []
  showDropdown.value = false
  activeIndex.value = -1
  router.push({ name: RouteNames.PATIENT_DETAIL, params: { id: patient.id } })
}

function goToCreatePatient() {
  query.value = ''
  results.value = []
  showDropdown.value = false
  activeIndex.value = -1
  router.push({ name: RouteNames.PATIENT_LIST, query: { create: '1' } })
}

function onKeydown(e: KeyboardEvent) {
  if (!showDropdown.value) return

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (results.value.length > 0) {
      activeIndex.value = (activeIndex.value + 1) % results.value.length
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (results.value.length > 0) {
      activeIndex.value = activeIndex.value <= 0 ? results.value.length - 1 : activeIndex.value - 1
    }
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const selected = results.value[activeIndex.value]
    if (selected) {
      selectPatient(selected)
    }
  } else if (e.key === 'Escape') {
    showDropdown.value = false
    activeIndex.value = -1
  }
}

function onBlur() {
  setTimeout(() => {
    showDropdown.value = false
    activeIndex.value = -1
  }, 200)
}

function onFocus() {
  if (query.value.trim().length >= 2 && results.value.length > 0) {
    showDropdown.value = true
  }
}
</script>

<template>
  <header
    class="bg-background sticky top-0 z-50 flex w-full items-center border-b"
    style="height: var(--header-height)"
  >
    <div class="flex h-full w-full items-center gap-2 px-4">
      <SidebarTrigger class="-ml-1" />
      <Separator orientation="vertical" class="mr-2 h-4" />
      <div class="relative w-full max-w-sm min-w-0">
        <SearchIcon class="text-muted-foreground absolute left-2.5 top-1/2 size-4 -translate-y-1/2" />
        <input
          v-model="query"
          type="text"
          placeholder="Search patients..."
          aria-label="Search patients"
          class="bg-muted/50 border-input placeholder:text-muted-foreground h-9 w-full rounded-md border pl-8 pr-8 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          @blur="onBlur"
          @focus="onFocus"
          @keydown="onKeydown"
        />
        <LoaderCircle
          v-if="isSearching"
          class="text-muted-foreground absolute right-2.5 top-1/2 size-4 -translate-y-1/2 animate-spin"
        />

        <div
          v-if="showDropdown && query.trim().length >= 2"
          class="absolute left-0 top-full z-50 mt-1 w-full rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
        >
          <template v-if="results.length > 0">
            <button
              v-for="(patient, index) in results"
              :key="patient.id"
              type="button"
              class="flex w-full items-center gap-2.5 rounded-sm px-2 py-1.5 text-left hover:bg-accent hover:text-accent-foreground"
              :class="{ 'bg-primary/10': index === activeIndex }"
              @mousedown.prevent="selectPatient(patient)"
            >
              <div class="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {{ patient.full_name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() }}
              </div>
              <div class="min-w-0">
                <p class="truncate text-sm font-medium">{{ patient.full_name }}</p>
                <p class="flex items-center gap-1 truncate text-xs text-muted-foreground">
                  <MapPin class="size-3 shrink-0" />
                  {{ patient.address }}
                </p>
              </div>
            </button>
          </template>

          <div v-else-if="!isSearching" class="px-2 py-3 text-center">
            <p class="text-sm text-muted-foreground">No patients found.</p>
            <button
              type="button"
              class="mt-1.5 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              @mousedown.prevent="goToCreatePatient"
            >
              <UserPlus class="size-3.5" />
              Add Patient
            </button>
          </div>
        </div>
      </div>

      <!-- Messages button -->
      <div v-if="hasMessagesPermission" class="ml-auto shrink-0">
        <Tooltip>
          <TooltipTrigger as-child>
            <button
              type="button"
              class="relative flex items-center justify-center rounded-md p-1.5 hover:bg-accent"
              @click="messageSheetOpen = true"
            >
              <MessageSquare class="size-4 text-muted-foreground" />
              <Badge
                v-if="messageStore.totalUnread > 0"
                class="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full p-0 text-[9px]"
              >
                {{ messageStore.totalUnread > 9 ? '9+' : messageStore.totalUnread }}
              </Badge>
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Messages</TooltipContent>
        </Tooltip>
      </div>

      <!-- Notifications button -->
      <div class="shrink-0" :class="!hasMessagesPermission ? 'ml-auto' : ''">
        <Tooltip>
          <TooltipTrigger as-child>
            <button
              type="button"
              class="relative flex items-center justify-center rounded-md p-1.5 hover:bg-accent"
              @click="notificationSheetOpen = true"
            >
              <Bell class="size-4 text-muted-foreground" />
              <Badge
                v-if="notificationStore.unreadCount > 0"
                class="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full p-0 text-[9px]"
              >
                {{ notificationStore.unreadCount > 9 ? '9+' : notificationStore.unreadCount }}
              </Badge>
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Notifications</TooltipContent>
        </Tooltip>
      </div>

      <!-- WebSocket status indicator -->
      <div class="shrink-0">
        <Tooltip>
          <TooltipTrigger as-child>
            <div
              class="flex items-center gap-1.5 rounded-full border px-2 py-1 cursor-default"
              :class="isConnected
                ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950'
                : 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950'"
            >
              <span
                class="size-2 rounded-full"
                :class="isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'"
              />
              <component
                :is="isConnected ? Wifi : WifiOff"
                class="size-3.5"
                :class="isConnected
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-600 dark:text-red-400'"
              />
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {{ isConnected ? 'Live — real-time updates active' : 'Offline — using polling fallback' }}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  </header>

  <!-- Messages Sheet -->
  <Sheet v-model:open="messageSheetOpen" @update:open="(open: boolean) => { if (!open) messageStore.setActiveConversation(null) }">
    <SheetContent side="right" class="flex w-full flex-col p-0 sm:max-w-md">
      <SheetHeader class="sr-only">
        <SheetTitle>Messages</SheetTitle>
      </SheetHeader>
      <MessagePanel mode="panel" class="flex-1" />
    </SheetContent>
  </Sheet>

  <!-- Notifications Sheet -->
  <Sheet v-model:open="notificationSheetOpen">
    <SheetContent side="right" class="flex w-full flex-col p-0 sm:max-w-sm">
      <SheetHeader class="sr-only">
        <SheetTitle>Notifications</SheetTitle>
      </SheetHeader>
      <NotificationPanel @close="notificationSheetOpen = false" />
    </SheetContent>
  </Sheet>
</template>
