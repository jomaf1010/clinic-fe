<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import FeatureGate from '@/components/shared/FeatureGate.vue'
import { toast } from 'vue-sonner'
import { AlertTriangle, LoaderCircle, RefreshCw } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuthStore } from '@/domains/auth/stores/authStore'
import { useAppointmentStore } from '@/domains/appointment/stores/appointmentStore'
import { useScheduleStore } from '../stores/scheduleStore'
import ScheduleAvailabilityStudio from '../components/ScheduleAvailabilityStudio.vue'
import WeeklyScheduleEditor from '../components/WeeklyScheduleEditor.vue'
import CalendarBlockForm from '../components/CalendarBlockForm.vue'
import type { CalendarBlock, StoreCalendarBlockPayload, UpsertWorkingSchedulePayload, UpdateCalendarBlockPayload } from '../types/schedule.types'
import AppointmentDetailSheet from '@/domains/appointment/components/AppointmentDetailSheet.vue'
import type { AppointmentResponse } from '@/domains/appointment/types/appointment.types'

const authStore = useAuthStore()
const store = useScheduleStore()
const appointmentStore = useAppointmentStore()

const scheduleTimezone = computed(() => store.schedule?.timezone ?? 'Asia/Manila')

const userId = computed(() => authStore.user?.id ?? '')

// Working hours tab
const scheduleError = ref<string | null>(null)
const showWorkingHoursDialog = ref(false)
const studioRefreshKey = ref(0)

// Calendar blocks tab
const showBlockForm = ref(false)
const editingBlock = ref<CalendarBlock | null>(null)
const isSavingBlock = ref(false)

// --- Appointment interactions from calendar ---
const prefillDateTime = ref<string | null>(null)
const showDetailSheet = ref(false)
const selectedAppointment = ref<AppointmentResponse | null>(null)
const cancelTargetId = ref<string | null>(null)
const showCancelDialog = ref(false)
const isCancelling = ref(false)
const scheduleShellRef = ref<HTMLElement | null>(null)
let savedContainerScroll = 0
let savedWindowScroll = 0

function scrollParent(element: HTMLElement | null): HTMLElement | null {
  let parent = element?.parentElement ?? null
  while (parent) {
    const overflowY = window.getComputedStyle(parent).overflowY
    if ((overflowY === 'auto' || overflowY === 'scroll') && parent.scrollHeight > parent.clientHeight) {
      return parent
    }
    parent = parent.parentElement
  }
  return null
}

function saveScroll() {
  savedContainerScroll = scrollParent(scheduleShellRef.value)?.scrollTop ?? 0
  savedWindowScroll = window.scrollY
}

function restoreScroll() {
  // Delay to ensure dialog fully unmounts and body scroll lock is released
  setTimeout(() => {
    const container = scrollParent(scheduleShellRef.value)
    if (container) {
      container.scrollTop = savedContainerScroll
    }
    window.scrollTo(0, savedWindowScroll)
  }, 50)
}

function handleStudioAddBlock(dateTime: string | null) {
  saveScroll()
  prefillDateTime.value = dateTime
  editingBlock.value = null
  showBlockForm.value = true
}

// Restore scroll position after dialog closes
watch(showDetailSheet, (open) => { if (!open) restoreScroll() })
watch(showBlockForm, (open) => { if (!open) restoreScroll() })

async function handleAppointmentClick(id: string) {
  saveScroll()
  try {
    await appointmentStore.fetchAppointment(id)
    selectedAppointment.value = appointmentStore.current
    showDetailSheet.value = true
  } catch {
    toast.error('Failed to load appointment')
  }
}

async function handleCheckIn(id: string) {
  try {
    await appointmentStore.checkInAppointment(id)
    toast.success('Patient checked in')
    if (selectedAppointment.value?.id === id) {
      selectedAppointment.value = appointmentStore.current
    }
    studioRefreshKey.value += 1
  } catch {
    toast.error('Failed to check in')
  }
}

async function handleNoShow(id: string) {
  try {
    await appointmentStore.markNoShow(id)
    toast.success('Appointment marked as no-show')
    if (selectedAppointment.value?.id === id) {
      selectedAppointment.value = appointmentStore.current
    }
    studioRefreshKey.value += 1
  } catch {
    toast.error('Failed to mark no-show')
  }
}

function requestCancel(id: string) {
  cancelTargetId.value = id
  showCancelDialog.value = true
}

async function confirmCancel() {
  if (!cancelTargetId.value) return
  isCancelling.value = true
  try {
    await appointmentStore.cancelAppointment(cancelTargetId.value)
    toast.success('Appointment cancelled')
    if (selectedAppointment.value?.id === cancelTargetId.value) {
      selectedAppointment.value = appointmentStore.current
    }
    showCancelDialog.value = false
    studioRefreshKey.value += 1
  } catch {
    toast.error('Failed to cancel appointment')
  } finally {
    isCancelling.value = false
    cancelTargetId.value = null
  }
}

// --- Working Hours ---
async function loadSchedule() {
  if (!userId.value) return
  scheduleError.value = null
  try {
    await store.fetchSchedule(userId.value)
  } catch {
    scheduleError.value = 'Failed to load working schedule.'
  }
}

async function handleSaveSchedule(payload: UpsertWorkingSchedulePayload) {
  if (!userId.value) return
  try {
    await store.saveSchedule(userId.value, payload)
    toast.success('Working schedule saved')
    studioRefreshKey.value += 1
  } catch {
    toast.error('Failed to save schedule')
  }
}

function openWorkingHours() {
  showWorkingHoursDialog.value = true
  loadSchedule()
}

async function handleBlockSave(payload: StoreCalendarBlockPayload | UpdateCalendarBlockPayload) {
  isSavingBlock.value = true
  try {
    if (editingBlock.value) {
      await store.updateBlock(editingBlock.value.id, payload as UpdateCalendarBlockPayload)
      toast.success('Block updated')
    } else {
      await store.createBlock(payload as StoreCalendarBlockPayload)
      toast.success('Block added')
    }
    showBlockForm.value = false
    studioRefreshKey.value += 1
  } catch {
    toast.error(editingBlock.value ? 'Failed to update block' : 'Failed to add block')
  } finally {
    isSavingBlock.value = false
  }
}
</script>

<template>
  <FeatureGate feature="schedule" label="Schedule">
    <div ref="scheduleShellRef" class="schedule-view-shell -mx-4 -mb-4 flex flex-1 flex-col px-4 pb-4 pt-6 md:px-6 md:pb-6 md:pt-8">
      <ScheduleAvailabilityStudio
        :user-id="userId"
        :refresh-key="studioRefreshKey"
        @appointment-click="handleAppointmentClick"
        @add-block="handleStudioAddBlock"
        @check-in="handleCheckIn"
        @cancel="requestCancel"
        @no-show="handleNoShow"
        @working-hours="openWorkingHours"
      />
    </div>

  <Dialog v-model:open="showWorkingHoursDialog">
    <DialogContent class="max-h-[85vh] overflow-y-auto sm:max-w-4xl">
      <DialogHeader>
        <DialogTitle>Working hours</DialogTitle>
        <DialogDescription>
          Manage regular clinic hours and breaks for this schedule.
        </DialogDescription>
      </DialogHeader>
      <div v-if="store.isLoadingSchedule" class="flex items-center justify-center py-12">
        <LoaderCircle class="size-6 animate-spin text-muted-foreground" />
      </div>
      <div
        v-else-if="scheduleError"
        role="alert"
        class="surface-card rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive"
      >
        {{ scheduleError }}
        <Button variant="outline" size="sm" class="mt-2" @click="loadSchedule">
          <RefreshCw class="size-3.5" />
          Try again
        </Button>
      </div>
      <WeeklyScheduleEditor
        v-else
        :schedule="store.schedule"
        :is-saving="store.isSavingSchedule"
        @save="handleSaveSchedule"
      />
    </DialogContent>
  </Dialog>

  <!-- Calendar Block Form dialog -->
  <CalendarBlockForm
    :open="showBlockForm"
    :block="editingBlock"
    :is-saving="isSavingBlock"
    :user-id="userId"
    :timezone="scheduleTimezone"
    :prefill-date-time="prefillDateTime"
    @update:open="(val) => { showBlockForm = val; if (!val) prefillDateTime = null }"
    @save="handleBlockSave"
  />

  <!-- Appointment detail sheet -->
  <AppointmentDetailSheet
    :open="showDetailSheet"
    :appointment="selectedAppointment"
    :can-manage="true"
    @update:open="showDetailSheet = $event"
    @check-in="handleCheckIn"
    @cancel="requestCancel"
    @no-show="handleNoShow"
  />

  <Dialog v-model:open="showCancelDialog">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <AlertTriangle class="size-5 text-destructive" />
          Cancel Appointment
        </DialogTitle>
        <DialogDescription>
          Are you sure you want to cancel this appointment? This action cannot be undone.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter class="gap-2 sm:gap-0">
        <Button variant="outline" :disabled="isCancelling" @click="showCancelDialog = false">
          Keep Appointment
        </Button>
        <Button variant="destructive" :disabled="isCancelling" @click="confirmCancel">
          <LoaderCircle v-if="isCancelling" class="size-3.5 animate-spin" />
          {{ isCancelling ? 'Cancelling...' : 'Cancel Appointment' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
  </FeatureGate>
</template>
