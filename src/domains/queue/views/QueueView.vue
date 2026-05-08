<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useCentrifugo } from '@/composables/useCentrifugo'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import {
  AlertTriangle,
  Columns3,
  Copy,
  ExternalLink,
  List,
  ListOrdered,
  LoaderCircle,
  Monitor,
  RefreshCw,
  Search,
  Stethoscope,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-vue-next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { RouteNames } from '@/router/routeNames'
import { useAuthStore } from '@/domains/auth/stores/authStore'
import { useQueueStore } from '../stores/queueStore'
import { queueApi } from '../api/queueApi'
import type { QueueDisplayTokenStatus } from '../types/queue.types'
import { buildQueueDisplayUrl, storeQueueDisplayToken } from '../utils/displayTokenLaunch'
import { hasActiveDisplayToken, hasLaunchableDisplayToken } from '../utils/displayTokenStatus'
import QueueCard from '../components/QueueCard.vue'
import QueueKanban from '../components/QueueKanban.vue'
import WalkInDialog from '../components/WalkInDialog.vue'

const router = useRouter()
const authStore = useAuthStore()
const store = useQueueStore()
const { isConnected, connect, subscribe, unsubscribe } = useCentrifugo()

const clinicId = computed(() => authStore.currentClinic?.id ?? '')
const queueChannel = computed(() => `clinic:${clinicId.value}:queue`)
const canManageQueue = computed(() => authStore.hasPermission('queue.manage'))
const canCallQueue = computed(() => authStore.hasPermission('queue.call') || canManageQueue.value)
const showWalkIn = ref(false)
const showCompleteWarning = ref(false)
const completeTargetId = ref<string | null>(null)
const isCompleting = ref(false)
const error = ref<string | null>(null)
const statusFilter = ref<string>('all')
const viewMode = ref<'list' | 'kanban'>(window.innerWidth < 1024 ? 'list' : 'kanban')

const displayToken = ref<QueueDisplayTokenStatus>({ active: false, token: null, created_at: null, expires_at: null })
const isLoadingDisplayToken = ref(false)
const isGeneratingDisplayToken = ref(false)
const isRevokingDisplayToken = ref(false)
const showDisplayPopover = ref(false)

// Doctor filter: doctors only see their own queue; non-doctors (owner, secretary, etc.) can toggle
const isDoctor = computed(() => authStore.currentClinic?.role === 'doctor')
const canSeeAllDoctors = computed(() => !isDoctor.value)
const doctorFilter = ref<string>(isDoctor.value ? 'mine' : 'all_doctors')

const currentUserId = computed(() => authStore.user?.id ?? '')

function buildApiFilters() {
  const filters: { doctor_id?: string; status?: string } = {}
  if (doctorFilter.value === 'mine' && currentUserId.value) {
    filters.doctor_id = currentUserId.value
  }
  return filters
}

const searchQuery = ref('')

const searchedVisits = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return store.visits
  return store.visits.filter((v) =>
    (v.patient_name ?? '').toLowerCase().includes(q),
  )
})

const waitingCount = computed(() => searchedVisits.value.filter((v) => v.status === 'waiting').length)
const inProgressCount = computed(() => searchedVisits.value.filter((v) => v.status === 'in_progress').length)

const filteredVisits = computed(() => {
  if (!statusFilter.value || statusFilter.value === 'all') return searchedVisits.value
  return searchedVisits.value.filter((v) => v.status === statusFilter.value)
})

async function loadQueue() {
  error.value = null
  try {
    await store.fetchQueue(buildApiFilters())
  } catch {
    error.value = 'Failed to load queue.'
  }
}

async function handleCall(id: string) {
  try {
    const visit = store.visits.find((v) => v.id === id)
    await store.callPatient(id)
    toast.success('Patient called')

    if (visit?.encounter_id && visit?.patient_id) {
      router.push({
        name: RouteNames.ENCOUNTER_DETAIL,
        params: {
          patientId: visit.patient_id,
          id: visit.encounter_id,
        },
      })
    }
  } catch {
    toast.error('Failed to call patient')
  }
}

function handleComplete(id: string) {
  completeTargetId.value = id
  showCompleteWarning.value = true
}

async function confirmComplete() {
  if (!completeTargetId.value) return
  isCompleting.value = true
  try {
    await store.completeVisit(completeTargetId.value)
    toast.success('Visit completed')
    showCompleteWarning.value = false
  } catch {
    toast.error('Failed to complete visit')
  } finally {
    isCompleting.value = false
  }
}

const showCancelDialog = ref(false)
const cancelTargetId = ref<string | null>(null)
const isCancelling = ref(false)

function handleCancel(id: string) {
  cancelTargetId.value = id
  showCancelDialog.value = true
}

async function confirmCancel() {
  if (!cancelTargetId.value) return
  isCancelling.value = true
  try {
    await store.cancelVisit(cancelTargetId.value)
    toast.success('Visit cancelled')
    showCancelDialog.value = false
  } catch {
    toast.error('Failed to cancel visit')
  } finally {
    isCancelling.value = false
  }
}

const displayUrl = computed(() => {
  if (!displayToken.value.token) return null
  return buildQueueDisplayUrl(window.location.origin, displayToken.value.token)
})

async function loadDisplayToken() {
  isLoadingDisplayToken.value = true
  try {
    displayToken.value = await queueApi.getDisplayTokenStatus()
  } catch {
    // silently fail
  } finally {
    isLoadingDisplayToken.value = false
  }
}

async function generateDisplayToken() {
  isGeneratingDisplayToken.value = true
  try {
    displayToken.value = await queueApi.generateDisplayToken()
    toast.success('Display link generated')
  } catch {
    toast.error('Failed to generate display link')
  } finally {
    isGeneratingDisplayToken.value = false
  }
}

async function revokeDisplayToken() {
  isRevokingDisplayToken.value = true
  try {
    await queueApi.revokeDisplayToken()
    displayToken.value = { active: false, token: null, created_at: null, expires_at: null }
    toast.success('Display link revoked')
  } catch {
    toast.error('Failed to revoke display link')
  } finally {
    isRevokingDisplayToken.value = false
  }
}

function copyDisplayUrl() {
  if (displayUrl.value) {
    navigator.clipboard.writeText(displayUrl.value)
    toast.success('Display URL copied without access token')
  }
}

function openDisplayInNewTab() {
  if (displayUrl.value && displayToken.value.token) {
    storeQueueDisplayToken(displayToken.value.token)
    window.open(displayUrl.value, '_blank')
  }
}

watch(doctorFilter, () => {
  loadQueue()
  if (!isConnected.value) {
    store.stopPolling()
    store.startPolling(30000, buildApiFilters())
  }
})

onMounted(async () => {
  await loadQueue()
  if (canManageQueue.value) loadDisplayToken()

  // Try WebSocket connection
  try {
    connect()
    subscribe(queueChannel.value, (ctx) => {
      store.handleRealtimeEvent(ctx.data)
    })
  } catch {
    // Fallback to polling
    store.startPolling(30000, buildApiFilters())
  }
})

watch(isConnected, (connected, wasConnected) => {
  if (!connected && wasConnected !== undefined) {
    // Lost connection, start polling as fallback
    store.startPolling(30000, buildApiFilters())
  } else if (connected) {
    // Reconnected, stop polling and refresh
    store.stopPolling()
    loadQueue()
  }
})

onUnmounted(() => {
  unsubscribe(queueChannel.value)
  store.stopPolling()
})
</script>

<template>
  <div class="flex min-w-0 flex-1 flex-col gap-4 pt-4">
    <!-- Header -->
    <div class="flex flex-col gap-3">
      <!-- Row 1: Title + Walk-in -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <h1 class="text-lg font-semibold">Queue</h1>
          <Badge variant="secondary" class="text-xs">
            {{ waitingCount }} waiting
          </Badge>
          <Badge
            v-if="inProgressCount > 0"
            variant="outline"
            class="border-blue-300 bg-blue-100 text-xs text-blue-700 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-400"
          >
            {{ inProgressCount }} in progress
          </Badge>
        </div>
        <div class="flex items-center gap-2">
          <Popover v-if="canManageQueue" v-model:open="showDisplayPopover">
            <PopoverTrigger as-child>
              <Button variant="outline" size="sm" class="h-8">
                <Monitor class="size-3.5" />
                <span class="hidden sm:inline">Display</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent class="w-80" align="end">
              <div class="flex flex-col gap-3">
                <div>
                  <h4 class="text-sm font-medium">Queue Display Screen</h4>
                  <p class="text-xs text-muted-foreground">
                    Generate a link to show the queue on a TV or tablet in your waiting room.
                  </p>
                </div>

                <!-- Loading state -->
                <div v-if="isLoadingDisplayToken" class="flex items-center justify-center py-4">
                  <LoaderCircle class="size-4 animate-spin text-muted-foreground" />
                </div>

                <!-- Newly generated token: launchable once in this browser -->
                <template v-else-if="hasLaunchableDisplayToken(displayToken)">
                  <div class="rounded-md border bg-muted/50 p-2">
                    <p class="break-all text-xs font-mono text-muted-foreground">
                      {{ displayUrl }}
                    </p>
                    <p class="mt-1 text-[11px] text-muted-foreground">
                      Open from this browser to keep the access token out of the URL and clipboard.
                    </p>
                  </div>
                  <div class="flex gap-2">
                    <Button variant="outline" size="sm" class="flex-1 h-8" @click="copyDisplayUrl">
                      <Copy class="size-3.5" />
                      Copy App URL
                    </Button>
                    <Button variant="outline" size="sm" class="flex-1 h-8" @click="openDisplayInNewTab">
                      <ExternalLink class="size-3.5" />
                      Open
                    </Button>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    class="h-8 w-full"
                    :disabled="isRevokingDisplayToken"
                    @click="revokeDisplayToken"
                  >
                    <LoaderCircle v-if="isRevokingDisplayToken" class="size-3.5 animate-spin" />
                    <Trash2 v-else class="size-3.5" />
                    Revoke Link
                  </Button>
                </template>

                <!-- Existing active token: raw token is intentionally not returned again -->
                <template v-else-if="hasActiveDisplayToken(displayToken)">
                  <div class="rounded-md border bg-muted/50 p-3">
                    <p class="text-sm font-medium">Display link is active</p>
                    <p class="mt-1 text-xs text-muted-foreground">
                      For security, existing display links cannot be shown again. Generate a new link if you need to copy or open it from this browser.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    class="h-8 w-full"
                    :disabled="isGeneratingDisplayToken"
                    @click="generateDisplayToken"
                  >
                    <LoaderCircle v-if="isGeneratingDisplayToken" class="size-3.5 animate-spin" />
                    <Monitor v-else class="size-3.5" />
                    Generate New Link
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    class="h-8 w-full"
                    :disabled="isRevokingDisplayToken"
                    @click="revokeDisplayToken"
                  >
                    <LoaderCircle v-if="isRevokingDisplayToken" class="size-3.5 animate-spin" />
                    <Trash2 v-else class="size-3.5" />
                    Revoke Link
                  </Button>
                </template>

                <!-- No active token -->
                <template v-else>
                  <Button
                    size="sm"
                    class="h-8 w-full"
                    :disabled="isGeneratingDisplayToken"
                    @click="generateDisplayToken"
                  >
                    <LoaderCircle v-if="isGeneratingDisplayToken" class="size-3.5 animate-spin" />
                    <Monitor v-else class="size-3.5" />
                    Generate Display Link
                  </Button>
                </template>
              </div>
            </PopoverContent>
          </Popover>

          <Button v-if="canManageQueue" size="sm" class="h-8" @click="showWalkIn = true">
            <UserPlus class="size-3.5" />
            <span class="hidden sm:inline">Walk-in</span>
          </Button>
        </div>
      </div>

      <!-- Row 2: Search + filters -->
      <div class="flex flex-wrap items-center gap-2">
        <!-- Patient search -->
        <div class="relative flex-1 sm:flex-none">
          <Search class="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            v-model="searchQuery"
            placeholder="Search patient..."
            class="h-8 w-full pl-8 pr-7 text-xs sm:w-[180px]"
          />
          <button
            v-if="searchQuery"
            class="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            @click="searchQuery = ''"
          >
            <X class="size-3" />
          </button>
        </div>

        <!-- Doctor filter (only non-doctors can toggle between my/all) -->
        <Select v-if="canSeeAllDoctors" v-model="doctorFilter">
          <SelectTrigger class="h-8 w-[140px]">
            <SelectValue placeholder="All Doctors" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all_doctors">
              <span class="flex items-center gap-1.5">
                <Users class="size-3" />
                All Doctors
              </span>
            </SelectItem>
            <SelectItem value="mine">
              <span class="flex items-center gap-1.5">
                <Stethoscope class="size-3" />
                My Queue
              </span>
            </SelectItem>
          </SelectContent>
        </Select>

        <!-- Status filter (list view only) -->
        <Select v-if="viewMode === 'list'" v-model="statusFilter">
          <SelectTrigger class="h-8 w-[130px]">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="waiting">Waiting</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>

        <!-- View toggle -->
        <div class="flex h-8 items-center rounded-md border">
          <button
            :class="[
              'flex h-full items-center gap-1 rounded-l-md px-2 text-xs font-medium transition-colors',
              viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
            ]"
            @click="viewMode = 'list'"
          >
            <List class="size-3.5" />
            <span class="hidden sm:inline">List</span>
          </button>
          <button
            :class="[
              'flex h-full items-center gap-1 rounded-r-md px-2 text-xs font-medium transition-colors',
              viewMode === 'kanban' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
            ]"
            @click="viewMode = 'kanban'"
          >
            <Columns3 class="size-3.5" />
            <span class="hidden sm:inline">Board</span>
          </button>
        </div>

        <Button variant="outline" size="icon" class="size-8 shrink-0" @click="loadQueue">
          <RefreshCw class="size-3.5" />
        </Button>
      </div>
    </div>

    <!-- Loading -->
    <div
      v-if="store.isLoading && store.visits.length === 0"
      class="flex items-center justify-center py-12"
    >
      <LoaderCircle class="size-6 animate-spin text-muted-foreground" />
    </div>

    <!-- Error -->
    <div
      v-else-if="error"
      role="alert"
      class="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
    >
      {{ error }}
      <Button variant="outline" size="sm" class="mt-2" @click="loadQueue">
        <RefreshCw class="size-3.5" />
        Try again
      </Button>
    </div>

    <!-- Empty -->
    <div
      v-else-if="searchedVisits.length === 0"
      class="flex flex-col items-center justify-center py-16 text-center"
    >
      <div class="mb-3 flex size-12 items-center justify-center rounded-full bg-primary/10">
        <ListOrdered class="size-6 text-primary" />
      </div>
      <p class="text-sm font-medium">{{ searchQuery ? 'No matches' : 'Queue is empty' }}</p>
      <p class="mt-1 text-xs text-muted-foreground">
        {{ searchQuery ? `No patients matching "${searchQuery}"` : doctorFilter === 'mine' ? 'No patients in your queue today' : 'No patients in the queue today' }}
      </p>
      <Button v-if="canManageQueue" size="sm" class="mt-4" @click="showWalkIn = true">
        <UserPlus class="size-3.5" />
        Add Walk-in
      </Button>
    </div>

    <!-- Kanban view -->
    <QueueKanban
      v-else-if="viewMode === 'kanban'"
      :visits="searchedVisits"
      :can-manage="canManageQueue"
      :can-call="canCallQueue"
      :current-user-id="currentUserId"
      @call="handleCall"
      @complete="handleComplete"
      @cancel="handleCancel"
    />

    <!-- List view -->
    <template v-else>
      <div v-if="filteredVisits.length === 0" class="py-8 text-center text-sm text-muted-foreground">
        No visits with this status
      </div>
      <div v-else class="flex flex-col gap-2">
        <QueueCard
          v-for="visit in filteredVisits"
          :key="visit.id"
          :visit="visit"
          :can-manage="canManageQueue"
          :can-call="canCallQueue"
          :current-user-id="currentUserId"
          @call="handleCall"
          @complete="handleComplete"
          @cancel="handleCancel"
        />
      </div>
    </template>


    <!-- Walk-in dialog -->
    <WalkInDialog
      :open="showWalkIn"
      @update:open="showWalkIn = $event"
      @created="loadQueue"
    />

    <!-- Complete warning dialog -->
    <Dialog v-model:open="showCompleteWarning">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <AlertTriangle class="size-5 text-amber-500" />
            Complete Visit
          </DialogTitle>
          <DialogDescription>
            The consultation linked to this visit may not be finalized yet. Completing the visit will not finalize the consultation — any unfinished notes, assessment, or treatment plan will remain as a draft.
          </DialogDescription>
        </DialogHeader>
        <p class="text-sm text-muted-foreground">
          To properly complete a visit, finalize the consultation first. The queue visit will be automatically completed when the consultation is finalized.
        </p>
        <DialogFooter class="gap-2 sm:gap-0">
          <Button variant="outline" @click="showCompleteWarning = false">Cancel</Button>
          <Button variant="destructive" :disabled="isCompleting" @click="confirmComplete">
            <LoaderCircle v-if="isCompleting" class="size-4 animate-spin" />
            Complete Anyway
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Cancel confirmation dialog -->
    <Dialog v-model:open="showCancelDialog">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <AlertTriangle class="size-5 text-destructive" />
            Cancel Visit
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to cancel this queue visit? The patient will be removed from the queue.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter class="gap-2 sm:gap-0">
          <Button variant="outline" :disabled="isCancelling" @click="showCancelDialog = false">
            Keep in Queue
          </Button>
          <Button variant="destructive" :disabled="isCancelling" @click="confirmCancel">
            <LoaderCircle v-if="isCancelling" class="size-4 animate-spin" />
            {{ isCancelling ? 'Cancelling...' : 'Cancel Visit' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
