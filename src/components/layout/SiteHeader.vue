<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { MessageSquare, SearchIcon, LoaderCircle, MapPin, UserPlus, Wifi, WifiOff, Bell } from 'lucide-vue-next'
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar'
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
const route = useRoute()
const messageSheetOpen = ref(false)
const hasMessagesPermission = ref(false)
const { isMobile } = useSidebar()
const isEncounterRoute = computed(() =>
  route.name === RouteNames.ENCOUNTER_NEW || route.name === RouteNames.ENCOUNTER_DETAIL,
)
const canSearchPatients = computed(() => authStore.hasPermission('patients.view'))
const canCreatePatient = computed(() => authStore.hasPermission('patients.create'))

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
  if (!canSearchPatients.value) return

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
  if (!canCreatePatient.value) return

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
    class="glass-topbar-shell sticky top-2 z-50 mx-2 mb-2 flex w-[calc(100%-1rem)] items-center rounded-2xl"
    style="height: calc(var(--header-height) + 0.5rem)"
  >
    <div class="flex h-full w-full items-center gap-3 p-3">
      <SidebarTrigger v-if="isMobile" class="glass-topbar-icon -ml-1" />

      <div v-if="!isEncounterRoute && canSearchPatients" class="relative min-w-0 flex-1 sm:max-w-xl">
        <SearchIcon class="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          v-model="query"
          type="text"
          placeholder="Search patients..."
          aria-label="Search patients"
          class="h-10 w-full rounded-2xl border border-white/55 bg-white/[0.58] pl-10 pr-10 text-sm shadow-[0_10px_26px_rgba(15,23,42,0.07)] outline-none backdrop-blur-xl placeholder:text-muted-foreground transition-[border-color,box-shadow,background] focus-visible:border-white/70 focus-visible:bg-white/[0.72] focus-visible:ring-2 focus-visible:ring-blue-500/20 dark:border-white/[0.12] dark:bg-slate-950/48 dark:focus-visible:bg-slate-950/62"
          @blur="onBlur"
          @focus="onFocus"
          @keydown="onKeydown"
        />
        <LoaderCircle
          v-if="isSearching"
          class="absolute right-3.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
        />

        <div
          v-if="showDropdown && query.trim().length >= 2"
          class="surface-floating absolute left-0 top-full z-50 mt-2 w-full rounded-2xl border border-white/50 p-1.5 text-popover-foreground dark:border-white/10"
        >
          <template v-if="results.length > 0">
            <button
              v-for="(patient, index) in results"
              :key="patient.id"
              type="button"
              class="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-white/55 hover:text-accent-foreground dark:hover:bg-white/10"
              :class="{ 'bg-white/62 text-blue-600 shadow-[0_10px_24px_rgba(37,99,235,0.1)] dark:bg-white/10 dark:text-blue-300': index === activeIndex }"
              @mousedown.prevent="selectPatient(patient)"
            >
              <div class="flex size-8 shrink-0 items-center justify-center rounded-full border border-white/50 bg-white/62 text-xs font-semibold text-blue-600 shadow-[0_8px_20px_rgba(37,99,235,0.1)] dark:border-white/10 dark:bg-white/10 dark:text-blue-300">
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
              v-if="canCreatePatient"
              type="button"
              class="mt-2 inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-semibold text-blue-600 hover:bg-white/55 dark:text-blue-300 dark:hover:bg-white/10"
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
              class="glass-topbar-icon relative"
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
              class="glass-topbar-icon relative"
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
              class="flex h-9 cursor-default items-center gap-1.5 rounded-full border px-2.5 shadow-[0_10px_24px_rgba(15,23,42,0.06)] backdrop-blur-md"
              :class="isConnected
                ? 'border-emerald-300/70 bg-emerald-50/70 dark:border-emerald-700/60 dark:bg-emerald-950/70'
                : 'border-red-300/70 bg-red-50/70 dark:border-red-700/60 dark:bg-red-950/70'"
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

<style scoped>
.glass-topbar-shell {
  background:
    linear-gradient(135deg, rgb(255 255 255 / 0.32), rgb(255 255 255 / 0.1) 52%, rgb(255 255 255 / 0.2)),
    rgb(255 255 255 / 0.04);
  box-shadow: 0 22px 65px -36px rgb(15 23 42 / 0.55), 0 18px 45px rgb(15 23 42 / 0.1);
  backdrop-filter: blur(30px) saturate(1.35);
  -webkit-backdrop-filter: blur(30px) saturate(1.35);
}

.glass-topbar-shell::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  border-radius: inherit;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.4);
}

.glass-topbar-icon {
  display: inline-flex;
  height: 2.25rem;
  width: 2.25rem;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  border: 1px solid rgb(255 255 255 / 0.46);
  background: rgb(255 255 255 / 0.42);
  box-shadow: 0 10px 24px rgb(15 23 42 / 0.06);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  transition: transform 120ms ease, background 120ms ease, box-shadow 120ms ease;
}

.glass-topbar-icon:hover {
  transform: translateY(-1px);
  background: rgb(255 255 255 / 0.58);
  box-shadow: 0 14px 30px rgb(15 23 42 / 0.1);
}

.glass-topbar-icon:active {
  transform: translateY(0);
}

.dark .glass-topbar-icon {
  border-color: rgb(255 255 255 / 0.1);
  background: rgb(255 255 255 / 0.08);
  box-shadow: 0 12px 28px rgb(0 0 0 / 0.24);
}

.dark .glass-topbar-icon:hover {
  background: rgb(255 255 255 / 0.12);
}

.dark .glass-topbar-shell {
  background:
    linear-gradient(135deg, rgb(15 23 42 / 0.38), rgb(15 23 42 / 0.16) 52%, rgb(15 23 42 / 0.28)),
    rgb(15 23 42 / 0.08);
  box-shadow: 0 18px 50px -30px rgb(0 0 0 / 0.72), 0 18px 45px rgb(0 0 0 / 0.28);
}
</style>
