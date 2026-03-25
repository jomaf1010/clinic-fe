<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import FeatureGate from '@/components/shared/FeatureGate.vue'
import { toast } from 'vue-sonner'
import { CalendarDate, getLocalTimeZone, today } from '@internationalized/date'
import { AlertTriangle, CalendarCheck, CalendarIcon, ClipboardPlus, List, LoaderCircle, Plus, X } from 'lucide-vue-next'
import { RouteNames } from '@/router/routeNames'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuthStore } from '@/domains/auth/stores/authStore'
import { useCentrifugo } from '@/composables/useCentrifugo'
import { appointmentApi } from '../api/appointmentApi'
import { useAppointmentStore } from '../stores/appointmentStore'
import AppointmentBookingWizard from '../components/AppointmentBookingWizard.vue'
import AppointmentCalendar from '../components/AppointmentCalendar.vue'
import AppointmentCard from '../components/AppointmentCard.vue'
import AppointmentDetailSheet from '../components/AppointmentDetailSheet.vue'
import type { AppointmentResponse } from '../types/appointment.types'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const store = useAppointmentStore()
const { connect, subscribe, getSubscription } = useCentrifugo()

const viewMode = ref<'list' | 'calendar'>('calendar')
const showBookingWizard = ref(false)
const prefillDateTime = ref<string | null>(null)
const showDetailSheet = ref(false)
const selectedAppointment = ref<AppointmentResponse | null>(null)
const currentPage = ref(Number(route.query.page) || 1)
const error = ref<string | null>(null)

const calendarRef = ref<InstanceType<typeof AppointmentCalendar> | null>(null)

let savedScrollY = 0

function onCalendarSlotSelect(dateTime: string) {
  savedScrollY = window.scrollY
  prefillDateTime.value = dateTime
  showBookingWizard.value = true
}

async function onCalendarAppointmentClick(id: string) {
  savedScrollY = window.scrollY
  try {
    const res = await appointmentApi.get(id)
    selectedAppointment.value = res.data
    showDetailSheet.value = true
  } catch {
    // Fallback to cached data
    const appt = calendarRef.value?.getAppointment(id)
    if (appt) {
      selectedAppointment.value = appt
      showDetailSheet.value = true
    }
  }
}

// Filters
const statusFilter = ref<string>((route.query.status as string) || 'all')
const rangeFilter = ref<string>((route.query.range as string) || 'upcoming')
const dateFilter = ref<string>((route.query.date as string) || '')

// When a specific date is picked, override range to 'date'
const activeRange = computed(() => dateFilter.value ? 'date' : rangeFilter.value)

function todayIso(): string {
  const t = today(getLocalTimeZone())
  return `${t.year}-${String(t.month).padStart(2, '0')}-${String(t.day).padStart(2, '0')}`
}

function endOfWeekIso(): string {
  const now = new Date()
  const daysUntilSunday = 7 - now.getDay()
  const end = new Date(now)
  end.setDate(end.getDate() + daysUntilSunday)
  return end.toISOString().slice(0, 10)
}

function endOfMonthIso(): string {
  const now = new Date()
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return end.toISOString().slice(0, 10)
}

const dateCalendarValue = computed(() => {
  if (!dateFilter.value) return undefined
  const d = new Date(dateFilter.value)
  return new CalendarDate(d.getFullYear(), d.getMonth() + 1, d.getDate())
})

const dateDisplay = computed(() => {
  if (!dateFilter.value) return null
  return new Date(dateFilter.value + 'T00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
})

function onDateSelect(date: CalendarDate) {
  dateFilter.value = `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`
  rangeFilter.value = 'date'
  onFilterChange()
}

function clearDate() {
  dateFilter.value = ''
  rangeFilter.value = 'upcoming'
  onFilterChange()
}

function onRangeChange(value: string) {
  rangeFilter.value = value
  dateFilter.value = ''
  onFilterChange()
}

function buildFilters(): AppointmentListFilters {
  const f: AppointmentListFilters = {}
  if (statusFilter.value && statusFilter.value !== 'all') f.status = statusFilter.value as AppointmentListFilters['status']

  if (dateFilter.value) {
    f.date = dateFilter.value
  } else {
    const todayStr = todayIso()
    switch (rangeFilter.value) {
      case 'today':
        f.date = todayStr
        break
      case 'this-week':
        f.start_date = todayStr
        f.end_date = endOfWeekIso()
        break
      case 'this-month':
        f.start_date = todayStr
        f.end_date = endOfMonthIso()
        break
      case 'upcoming':
        f.start_date = todayStr
        break
      case 'past':
        f.end_date = todayStr
        break
      // 'all' — no date filters
    }
  }

  return f
}

async function fetchData() {
  error.value = null
  try {
    await store.fetchAppointments(currentPage.value, 15, buildFilters())
  } catch {
    error.value = 'Failed to load appointments.'
  }
}

function goToPage(page: number) {
  if (page < 1 || page > store.pagination.last_page) return
  currentPage.value = page
  syncQuery()
}

function syncQuery() {
  const q: Record<string, string> = { page: String(currentPage.value) }
  if (statusFilter.value && statusFilter.value !== 'all') q.status = statusFilter.value
  if (dateFilter.value) q.date = dateFilter.value
  if (rangeFilter.value !== 'upcoming') q.range = rangeFilter.value
  router.replace({ query: q })
}

function onFilterChange() {
  currentPage.value = 1
  syncQuery()
  fetchData()
}

function openDetail(id: string) {
  selectedAppointment.value = store.appointments.find((a) => a.id === id) ?? null
  showDetailSheet.value = true
}

// Triage prompt after check-in
const showTriageDialog = ref(false)
const triagePatientId = ref<string | null>(null)
const triagePatientName = ref<string | null>(null)

async function handleCheckIn(id: string) {
  try {
    await store.checkInAppointment(id)
    toast.success('Patient checked in')
    showDetailSheet.value = false
    fetchData()

    // Find the appointment to get patient info for triage prompt
    const appointment = store.appointments.find((a) => a.id === id)
    if (appointment) {
      triagePatientId.value = appointment.patient_id
      triagePatientName.value = appointment.patient_name
      showTriageDialog.value = true
    }
  } catch {
    toast.error('Failed to check in')
  }
}

function goToTriage() {
  if (!triagePatientId.value) return
  showTriageDialog.value = false
  router.push({
    name: RouteNames.CONSULTATION_NEW,
    params: { patientId: triagePatientId.value },
  })
}

// Cancel confirmation
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
    await store.cancelAppointment(cancelTargetId.value)
    toast.success('Appointment cancelled')
    showCancelDialog.value = false
    showDetailSheet.value = false
    fetchData()
  } catch {
    toast.error('Failed to cancel appointment')
  } finally {
    isCancelling.value = false
  }
}

// No-show confirmation
const showNoShowDialog = ref(false)
const noShowTargetId = ref<string | null>(null)
const isMarkingNoShow = ref(false)

function handleNoShow(id: string) {
  noShowTargetId.value = id
  showNoShowDialog.value = true
}

async function confirmNoShow() {
  if (!noShowTargetId.value) return
  isMarkingNoShow.value = true
  try {
    await store.markNoShow(noShowTargetId.value)
    toast.success('Marked as no-show')
    showNoShowDialog.value = false
    showDetailSheet.value = false
    fetchData()
  } catch {
    toast.error('Failed to mark no-show')
  } finally {
    isMarkingNoShow.value = false
  }
}

function onCreated() {
  currentPage.value = 1
  fetchData()
}

watch(currentPage, () => fetchData())

// Restore scroll position after dialogs close
watch(showBookingWizard, (open) => {
  if (!open) nextTick(() => window.scrollTo(0, savedScrollY))
})
watch(showDetailSheet, (open) => {
  if (!open) nextTick(() => window.scrollTo(0, savedScrollY))
})

const appointmentChannel = computed(() => {
  const clinicId = authStore.currentClinic?.id
  return clinicId ? `clinic:${clinicId}:appointments` : null
})

function onAppointmentEvent() {
  // Refresh both list and calendar
  fetchData()
  calendarRef.value?.refetch()
}

onMounted(() => {
  fetchData()
  if (appointmentChannel.value) {
    connect()
    subscribe(appointmentChannel.value, onAppointmentEvent)
  }
})

onUnmounted(() => {
  if (appointmentChannel.value) {
    const sub = getSubscription(appointmentChannel.value)
    sub?.removeListener('publication', onAppointmentEvent)
  }
})
</script>

<template>
  <FeatureGate feature="appointments" label="Appointments">
  <div class="flex flex-1 flex-col gap-4 pt-4">
    <!-- Header -->
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div class="flex items-center gap-3">
        <h1 class="text-lg font-semibold">Appointments</h1>
        <Badge variant="secondary" class="text-xs">{{ store.pagination.total }}</Badge>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <!-- Range quick filters (list view only) -->
        <div v-if="viewMode === 'list'" class="flex h-8 items-center rounded-md border text-xs">
          <button
            v-for="opt in [
              { value: 'today', label: 'Today' },
              { value: 'this-week', label: 'Week' },
              { value: 'this-month', label: 'Month' },
              { value: 'upcoming', label: 'Upcoming' },
              { value: 'past', label: 'Past' },
              { value: 'all', label: 'All' },
            ]"
            :key="opt.value"
            :class="[
              'h-full px-2.5 font-medium transition-colors first:rounded-l-md last:rounded-r-md',
              activeRange === opt.value
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground',
            ]"
            @click="onRangeChange(opt.value)"
          >
            {{ opt.label }}
          </button>
        </div>

        <!-- Date picker (list view only) -->
        <div v-if="viewMode === 'list'" class="flex items-center gap-1">
          <Popover>
            <PopoverTrigger as-child>
              <Button
                variant="outline"
                size="sm"
                class="h-8 w-[160px] justify-start text-left font-normal"
                :class="{ 'text-muted-foreground': !dateFilter }"
              >
                <CalendarIcon class="mr-1.5 size-3.5" />
                {{ dateDisplay ?? 'Pick a date' }}
              </Button>
            </PopoverTrigger>
            <PopoverContent class="w-auto p-0" align="start">
              <Calendar
                :model-value="dateCalendarValue"
                @update:model-value="onDateSelect"
              />
            </PopoverContent>
          </Popover>
          <Button
            v-if="dateFilter"
            variant="ghost"
            size="icon"
            class="size-7"
            @click="clearDate"
          >
            <X class="size-3.5" />
          </Button>
        </div>

        <!-- Status filter -->
        <Select v-model="statusFilter" @update:model-value="onFilterChange">
          <SelectTrigger class="h-8 w-[140px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="checked_in">Checked In</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="no_show">No Show</SelectItem>
          </SelectContent>
        </Select>

        <!-- View toggle -->
        <div class="flex h-8 items-center rounded-md border">
          <button
            :class="['flex h-full items-center gap-1 rounded-l-md px-2.5 text-xs font-medium transition-colors', viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground']"
            @click="viewMode = 'list'"
          >
            <List class="size-3.5" />
            List
          </button>
          <button
            :class="['flex h-full items-center gap-1 rounded-r-md px-2.5 text-xs font-medium transition-colors', viewMode === 'calendar' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground']"
            @click="viewMode = 'calendar'"
          >
            <CalendarCheck class="size-3.5" />
            Calendar
          </button>
        </div>

        <Button size="sm" class="h-8" @click="prefillDateTime = null; showBookingWizard = true">
          <Plus class="size-3.5" />
          <span class="hidden sm:inline">Book</span>
        </Button>
      </div>
    </div>

    <!-- Calendar View -->
    <template v-if="viewMode === 'calendar'">
      <AppointmentCalendar
        ref="calendarRef"
        :status-filter="statusFilter"
        @appointment-click="onCalendarAppointmentClick"
        @slot-select="onCalendarSlotSelect"
      />
    </template>

    <!-- List View -->
    <template v-else>
      <!-- Loading -->
      <div v-if="store.isLoading" class="flex items-center justify-center py-12">
        <LoaderCircle class="size-6 animate-spin text-muted-foreground" />
      </div>

      <!-- Error -->
      <div
        v-else-if="error"
        role="alert"
        class="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
      >
        {{ error }}
        <Button variant="outline" size="sm" class="mt-2" @click="fetchData">
          Try again
        </Button>
      </div>

      <!-- Empty state -->
      <div
        v-else-if="store.appointments.length === 0"
        class="flex flex-col items-center justify-center py-16 text-center"
      >
        <div class="mb-3 flex size-12 items-center justify-center rounded-full bg-primary/10">
          <CalendarCheck class="size-6 text-primary" />
        </div>
        <p class="text-sm font-medium">No appointments found</p>
        <p class="mt-1 text-xs text-muted-foreground">
          {{ activeRange === 'upcoming' ? 'No upcoming appointments' : 'No appointments match your filters' }}
        </p>
        <Button size="sm" class="mt-4" @click="prefillDateTime = null; showBookingWizard = true">
          <Plus class="size-3.5" />
          Book Appointment
        </Button>
      </div>

      <!-- List -->
      <div v-else class="flex flex-col gap-2">
        <AppointmentCard
          v-for="appt in store.appointments"
          :key="appt.id"
          :appointment="appt"
          :can-manage="authStore.hasPermission('appointments.manage')"
          @click="openDetail"
          @check-in="handleCheckIn"
          @cancel="handleCancel"
          @no-show="handleNoShow"
        />
      </div>

      <!-- Pagination -->
      <div v-if="store.pagination.last_page > 1" class="flex justify-center">
        <Pagination
          :total="store.pagination.total"
          :items-per-page="store.pagination.per_page"
          :page="currentPage"
          :sibling-count="1"
          :show-edges="true"
          @update:page="goToPage"
        >
          <PaginationContent v-slot="{ items }">
            <PaginationPrevious />
            <template v-for="(item, index) in items" :key="item.type === 'page' ? item.value : `ellipsis-${index}`">
              <PaginationItem
                v-if="item.type === 'page'"
                :value="item.value"
                :is-active="item.value === currentPage"
              >
                {{ item.value }}
              </PaginationItem>
              <PaginationEllipsis v-else :index="index" />
            </template>
            <PaginationNext />
          </PaginationContent>
        </Pagination>
      </div>
    </template>

    <!-- Detail modal -->
    <AppointmentDetailSheet
      :open="showDetailSheet"
      :appointment="selectedAppointment"
      :can-manage="authStore.hasPermission('appointments.manage')"
      @update:open="showDetailSheet = $event"
      @check-in="handleCheckIn"
      @cancel="handleCancel"
      @no-show="handleNoShow"
    />

    <!-- Booking wizard -->
    <AppointmentBookingWizard
      :open="showBookingWizard"
      :prefill-date-time="prefillDateTime"
      @update:open="(val) => { showBookingWizard = val; if (!val) prefillDateTime = null }"
      @created="onCreated"
    />

    <!-- Cancel confirmation -->
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

    <!-- Triage prompt after check-in -->
    <Dialog v-model:open="showTriageDialog">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <ClipboardPlus class="size-5 text-primary" />
            Start Triage
          </DialogTitle>
          <DialogDescription>
            <span class="font-medium text-foreground">{{ triagePatientName }}</span> has been checked in. Would you like to start the triage assessment now?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter class="gap-2 sm:gap-0">
          <Button variant="outline" @click="showTriageDialog = false">
            Maybe Later
          </Button>
          <Button @click="goToTriage">
            <ClipboardPlus class="size-3.5" />
            Start Triage
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- No-show confirmation -->
    <Dialog v-model:open="showNoShowDialog">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <AlertTriangle class="size-5 text-amber-500" />
            Mark as No-Show
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to mark this appointment as no-show? The patient did not attend their scheduled visit.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter class="gap-2 sm:gap-0">
          <Button variant="outline" :disabled="isMarkingNoShow" @click="showNoShowDialog = false">
            Go Back
          </Button>
          <Button variant="destructive" :disabled="isMarkingNoShow" @click="confirmNoShow">
            <LoaderCircle v-if="isMarkingNoShow" class="size-3.5 animate-spin" />
            {{ isMarkingNoShow ? 'Marking...' : 'Mark No-Show' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
  </FeatureGate>
</template>
