<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import FeatureGate from '@/components/shared/FeatureGate.vue'
import { toast } from 'vue-sonner'
import { CalendarDate, getLocalTimeZone, today, type DateValue } from '@internationalized/date'
import { AlertTriangle, CalendarCheck, CalendarIcon, ClipboardPlus, LayoutDashboard, List, LoaderCircle, Plus, UserRound, X } from 'lucide-vue-next'
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
import AppointmentBoard from '../components/AppointmentBoard.vue'
import AppointmentCalendar from '../components/AppointmentCalendar.vue'
import AppointmentCard from '../components/AppointmentCard.vue'
import AppointmentDetailSheet from '../components/AppointmentDetailSheet.vue'
import type { AppointmentListFilters, AppointmentResponse, ClinicDoctor } from '../types/appointment.types'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const store = useAppointmentStore()
const { connect, subscribe, getSubscription } = useCentrifugo()

const viewMode = ref<'board' | 'list' | 'calendar'>('board')
const showBookingWizard = ref(false)
const bookingMode = ref<'create' | 'reschedule'>('create')
const rescheduleAppointmentId = ref<string | null>(null)
const prefillDateTime = ref<string | null>(null)
const prefillDoctorId = ref<string | null>(null)
const prefillDoctorName = ref<string | null>(null)
const prefillPatientId = ref<string | null>(null)
const prefillPatientName = ref<string | null>(null)
const showDetailSheet = ref(false)
const selectedAppointment = ref<AppointmentResponse | null>(null)
const currentPage = ref(Number(route.query.page) || 1)
const error = ref<string | null>(null)
const boardTotal = ref(0)
const doctors = ref<ClinicDoctor[]>([])
const isLoadingDoctors = ref(false)

const calendarRef = ref<InstanceType<typeof AppointmentCalendar> | null>(null)
const boardRef = ref<InstanceType<typeof AppointmentBoard> | null>(null)

let savedScrollY = 0

function onCalendarSlotSelect(dateTime: string) {
  savedScrollY = window.scrollY
  openBookingWizard({ dateTime })
}

function openBookingWizard(options?: {
  dateTime?: string | null
  doctorId?: string | null
  doctorName?: string | null
  patientId?: string | null
  patientName?: string | null
}) {
  bookingMode.value = 'create'
  rescheduleAppointmentId.value = null
  prefillDateTime.value = options?.dateTime ?? null
  prefillDoctorId.value = options?.doctorId ?? null
  prefillDoctorName.value = options?.doctorName ?? null
  prefillPatientId.value = options?.patientId ?? null
  prefillPatientName.value = options?.patientName ?? null
  showBookingWizard.value = true
}

function openRescheduleWizard(appointment: AppointmentResponse) {
  savedScrollY = window.scrollY
  bookingMode.value = 'reschedule'
  rescheduleAppointmentId.value = appointment.id
  prefillDateTime.value = appointment.scheduled_at
  prefillDoctorId.value = appointment.doctor_id
  prefillDoctorName.value = appointment.doctor_name ?? null
  prefillPatientId.value = appointment.patient_id
  prefillPatientName.value = appointment.patient_name ?? null
  showBookingWizard.value = true
}

function clearBookingPrefill() {
  bookingMode.value = 'create'
  rescheduleAppointmentId.value = null
  prefillDateTime.value = null
  prefillDoctorId.value = null
  prefillDoctorName.value = null
  prefillPatientId.value = null
  prefillPatientName.value = null
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
function queryString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

const doctorFilter = ref<string>(queryString(route.query.doctor_id) || 'all')
const statusFilter = ref<string>(queryString(route.query.status) || 'all')
const rangeFilter = ref<string>(queryString(route.query.range) || 'upcoming')
const dateFilter = ref<string>(queryString(route.query.date))

// When a specific date is picked, override range to 'date'
const activeRange = computed(() => dateFilter.value ? 'date' : rangeFilter.value)
const appointmentTotal = computed(() => viewMode.value === 'board' ? boardTotal.value : store.pagination.total)

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

function onDateSelect(date: DateValue | undefined) {
  if (!date) return
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
  if (doctorFilter.value && doctorFilter.value !== 'all') f.doctor_id = doctorFilter.value
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

async function loadDoctors() {
  if (doctors.value.length > 0 || isLoadingDoctors.value) return

  isLoadingDoctors.value = true
  try {
    const response = await appointmentApi.getDoctors()
    doctors.value = response.data
  } catch {
    toast.error('Failed to load doctors')
  } finally {
    isLoadingDoctors.value = false
  }
}

function goToPage(page: number) {
  if (page < 1 || page > store.pagination.last_page) return
  currentPage.value = page
  syncQuery()
}

function syncQuery() {
  const q: Record<string, string> = { page: String(currentPage.value) }
  if (doctorFilter.value && doctorFilter.value !== 'all') q.doctor_id = doctorFilter.value
  if (statusFilter.value && statusFilter.value !== 'all') q.status = statusFilter.value
  if (dateFilter.value) q.date = dateFilter.value
  if (rangeFilter.value !== 'upcoming') q.range = rangeFilter.value
  router.replace({ query: q })
}

function onFilterChange() {
  currentPage.value = 1
  syncQuery()
  if (viewMode.value === 'list') fetchData()
}

async function openDetail(id: string) {
  savedScrollY = window.scrollY
  const cached = store.appointments.find((a) => a.id === id)
  if (cached) {
    selectedAppointment.value = cached
    showDetailSheet.value = true
    return
  }

  try {
    const res = await appointmentApi.get(id)
    selectedAppointment.value = res.data
    showDetailSheet.value = true
  } catch {
    toast.error('Failed to load appointment')
  }
}

function refreshVisibleView() {
  if (viewMode.value === 'board') {
    boardRef.value?.refetch()
    return
  }

  if (viewMode.value === 'calendar') {
    calendarRef.value?.refetch()
    return
  }

  fetchData()
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
    refreshVisibleView()

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
    name: RouteNames.ENCOUNTER_NEW,
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
    refreshVisibleView()
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
    refreshVisibleView()
  } catch {
    toast.error('Failed to mark no-show')
  } finally {
    isMarkingNoShow.value = false
  }
}

function onCreated() {
  currentPage.value = 1
  refreshVisibleView()
}

watch(currentPage, () => {
  if (viewMode.value === 'list') fetchData()
})

watch(viewMode, (mode) => {
  if (mode === 'list') fetchData()
})

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
  refreshVisibleView()
}

onMounted(() => {
  void loadDoctors()
  if (viewMode.value === 'list') fetchData()
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
  <div class="appointment-list-shell flex flex-1 flex-col gap-4 pt-6 md:pt-8">
    <!-- Header -->
    <div class="flex flex-col gap-3">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div class="flex min-w-0 flex-1 items-center gap-3">
          <h1 class="text-2xl font-semibold tracking-normal">Appointments</h1>
          <Badge variant="secondary" class="rounded-full px-2.5 text-sm tabular-nums">{{ appointmentTotal }}</Badge>
        </div>

        <Button class="h-10 w-full gap-2 px-5 text-sm sm:w-auto" @click="openBookingWizard()">
          <Plus class="size-4" />
          <span>Book appointment</span>
        </Button>
      </div>

      <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <!-- View toggle -->
        <div class="appointment-view-tabs surface-muted flex h-10 w-full items-center rounded-full p-1 sm:w-fit">
          <button
            :class="['appointment-view-tab flex h-full flex-1 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium transition-all sm:flex-none', viewMode === 'board' ? 'is-active' : 'text-muted-foreground hover:text-foreground']"
            @click="viewMode = 'board'"
          >
            <LayoutDashboard class="size-4" />
            <span><span class="hidden sm:inline">Today </span>Board</span>
          </button>
          <button
            :class="['appointment-view-tab flex h-full flex-1 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium transition-all sm:flex-none', viewMode === 'calendar' ? 'is-active' : 'text-muted-foreground hover:text-foreground']"
            @click="viewMode = 'calendar'"
          >
            <CalendarCheck class="size-4" />
            Calendar
          </button>
          <button
            :class="['appointment-view-tab flex h-full flex-1 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium transition-all sm:flex-none', viewMode === 'list' ? 'is-active' : 'text-muted-foreground hover:text-foreground']"
            @click="viewMode = 'list'"
          >
            <List class="size-4" />
            List
          </button>
        </div>

        <div class="flex flex-wrap items-center gap-2 lg:justify-end">
          <Select v-model="doctorFilter" @update:model-value="onFilterChange">
            <SelectTrigger class="appointment-select-trigger h-10 w-full sm:w-[170px]">
              <span class="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
                <UserRound class="size-4 shrink-0" />
                <SelectValue class="min-w-0 flex-1 truncate" placeholder="All doctors" />
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All doctors</SelectItem>
              <SelectItem
                v-for="doctor in doctors"
                :key="doctor.id"
                :value="doctor.id"
              >
                Dr. {{ doctor.name }}
              </SelectItem>
            </SelectContent>
          </Select>

          <!-- Status filter -->
          <Select v-model="statusFilter" @update:model-value="onFilterChange">
            <SelectTrigger class="appointment-select-trigger h-10 w-full sm:w-[170px]">
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
        </div>
      </div>

      <div v-if="viewMode === 'list'" class="flex flex-wrap items-center gap-2">
        <!-- Range quick filters (list view only) -->
        <div class="appointment-range-tabs surface-muted flex h-9 w-full items-center overflow-x-auto rounded-full p-1 text-xs sm:w-fit">
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
              'h-full shrink-0 rounded-full px-3 font-medium transition-all',
              activeRange === opt.value
                ? 'is-active'
                : 'text-muted-foreground hover:text-foreground',
            ]"
            @click="onRangeChange(opt.value)"
          >
            {{ opt.label }}
          </button>
        </div>

        <!-- Date picker (list view only) -->
        <div class="flex items-center gap-1">
          <Popover>
            <PopoverTrigger as-child>
              <Button
                variant="outline"
                size="sm"
                class="appointment-date-trigger h-9 w-[160px] justify-start text-left font-normal"
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

      </div>
    </div>

    <!-- Board View -->
    <template v-if="viewMode === 'board'">
      <AppointmentBoard
        ref="boardRef"
        :doctor-filter="doctorFilter"
        :status-filter="statusFilter"
        :can-manage="authStore.hasPermission('appointments.manage')"
        @appointment-click="openDetail"
        @slot-select="(dateTime, options) => openBookingWizard({ dateTime, ...options })"
        @reschedule="openRescheduleWizard"
        @check-in="handleCheckIn"
        @cancel="handleCancel"
        @no-show="handleNoShow"
        @summary-change="boardTotal = $event"
      />
    </template>

    <!-- Calendar View -->
    <template v-else-if="viewMode === 'calendar'">
      <AppointmentCalendar
        ref="calendarRef"
        :doctor-filter="doctorFilter"
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
        class="surface-card rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive"
      >
        {{ error }}
        <Button variant="outline" size="sm" class="mt-2" @click="fetchData">
          Try again
        </Button>
      </div>

      <!-- Empty state -->
      <div
        v-else-if="store.appointments.length === 0"
        class="surface-card flex flex-col items-center justify-center rounded-2xl py-16 text-center"
      >
        <div class="appointment-empty-icon mb-3 flex size-12 items-center justify-center rounded-2xl bg-primary/10">
          <CalendarCheck class="size-6 text-primary" />
        </div>
        <p class="text-sm font-medium">No appointments found</p>
        <p class="mt-1 text-xs text-muted-foreground">
          {{ activeRange === 'upcoming' ? 'No upcoming appointments' : 'No appointments match your filters' }}
        </p>
        <Button size="sm" class="mt-4" @click="openBookingWizard()">
          <Plus class="size-3.5" />
          Book Appointment
        </Button>
      </div>

      <!-- List -->
      <div v-else class="appointment-list-stack flex flex-col gap-3">
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
      :mode="bookingMode"
      :appointment-id="rescheduleAppointmentId"
      :prefill-date-time="prefillDateTime"
      :prefill-doctor-id="prefillDoctorId"
      :prefill-doctor-name="prefillDoctorName"
      :prefill-patient-id="prefillPatientId"
      :prefill-patient-name="prefillPatientName"
      @update:open="(val) => { showBookingWizard = val; if (!val) clearBookingPrefill() }"
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

<style scoped>
.appointment-view-tabs,
.appointment-range-tabs {
  border: 0;
  box-shadow: 0 12px 28px rgb(15 23 42 / 0.06);
}

.appointment-view-tab.is-active,
.appointment-range-tabs .is-active {
  color: white;
  background: linear-gradient(135deg, rgb(37 99 235), rgb(20 184 166));
  box-shadow:
    0 12px 26px rgb(37 99 235 / 0.16),
    inset 0 1px 0 rgb(255 255 255 / 0.26);
}

.appointment-select-trigger,
.appointment-date-trigger {
  box-shadow: 0 12px 28px rgb(15 23 42 / 0.06);
}

.appointment-empty-icon {
  box-shadow: 0 14px 34px rgb(37 99 235 / 0.12);
}

:global(.dark .appointment-view-tabs),
:global(.dark .appointment-range-tabs) {
  border: 1px solid rgb(255 255 255 / 0.1) !important;
  background:
    linear-gradient(135deg, rgb(15 23 42 / 0.62), rgb(15 23 42 / 0.28)),
    rgb(15 23 42 / 0.2);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.05),
    0 16px 38px rgb(0 0 0 / 0.26);
}

:global(.dark .appointment-view-tab.is-active),
:global(.dark .appointment-range-tabs .is-active) {
  box-shadow:
    0 0 0 1px rgb(125 211 252 / 0.14),
    0 14px 34px rgb(56 189 248 / 0.16),
    inset 0 1px 0 rgb(255 255 255 / 0.2);
}
</style>
