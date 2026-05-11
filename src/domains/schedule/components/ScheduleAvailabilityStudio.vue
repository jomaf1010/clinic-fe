<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { CalendarDate, type DateValue } from '@internationalized/date'
import {
  Activity,
  AlertTriangle,
  Ban,
  CalendarCheck,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coffee,
  LogIn,
  Moon,
  MoreVertical,
  RefreshCw,
  Sun,
  Sunrise,
  UserRound,
  UserX,
  X,
} from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Calendar as ShadcnCalendar } from '@/components/ui/calendar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { AppointmentResponse, AppointmentStatus } from '@/domains/appointment/types/appointment.types'
import type { CalendarBlock, Slot } from '../types/schedule.types'
import { useScheduleStore } from '../stores/scheduleStore'

const props = defineProps<{
  userId: string
  refreshKey?: number
}>()

const emit = defineEmits<{
  'appointment-click': [id: string]
  'add-block': [dateTime: string | null]
  'check-in': [id: string]
  cancel: [id: string]
  'no-show': [id: string]
  'working-hours': []
}>()

type Period = 'morning' | 'afternoon' | 'evening'
type StatusFilter = 'all' | AppointmentStatus
const periods: Period[] = ['morning', 'afternoon', 'evening']

const scheduleStore = useScheduleStore()
const {
  studioAppointments: appointments,
  studioMonthAppointments: monthAppointments,
  studioSlots: slots,
  studioDayBlocks: dayBlocks,
  studioUpcomingBlocks: upcomingBlocks,
  isLoadingStudio: isLoading,
  studioError: error,
} = storeToRefs(scheduleStore)
const selectedDate = ref(toLocalDate(new Date()))
const currentTime = ref(new Date())
const monthRailRef = ref<HTMLElement | null>(null)
const isMonthPickerOpen = ref(false)
const statusFilter = ref<StatusFilter>('all')
let currentTimeTimer: ReturnType<typeof setInterval> | null = null

function toLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseLocalDate(value: string): Date {
  return new Date(`${value}T00:00:00`)
}

function isoToCalendarDate(value: string): CalendarDate {
  const [year, month, day] = value.split('-').map(Number)
  return new CalendarDate(year!, month!, day!)
}

function calendarDateToIso(value: DateValue): string {
  return `${value.year}-${String(value.month).padStart(2, '0')}-${String(value.day).padStart(2, '0')}`
}

function addDays(value: string, amount: number): string {
  const date = parseLocalDate(value)
  date.setDate(date.getDate() + amount)
  return toLocalDate(date)
}

function addMonths(value: string, amount: number): string {
  const date = parseLocalDate(value)
  const originalDay = date.getDate()
  date.setDate(1)
  date.setMonth(date.getMonth() + amount)
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  date.setDate(Math.min(originalDay, lastDay))
  return toLocalDate(date)
}

function startOfMonth(value: string): string {
  const date = parseLocalDate(value)
  date.setDate(1)
  return toLocalDate(date)
}

function endOfMonth(value: string): string {
  return addDays(startOfMonth(value), daysInMonth(value) - 1)
}

function daysInMonth(value: string): number {
  const date = parseLocalDate(value)
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
}

function formatDate(value: string): string {
  return parseLocalDate(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatMonthLabel(value: string): string {
  return parseLocalDate(value).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function formatShortDate(value: string): string {
  return parseLocalDate(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatDayNumber(value: string): string {
  return parseLocalDate(value).toLocaleDateString('en-US', { day: 'numeric' })
}

function formatWeekday(value: string): string {
  return parseLocalDate(value).toLocaleDateString('en-US', { weekday: 'short' })
}

function formatFullWeekday(value: string): string {
  return parseLocalDate(value).toLocaleDateString('en-US', { weekday: 'long' })
}

function formatTime(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function timeMinutes(value: string): number {
  const date = new Date(value)
  return date.getHours() * 60 + date.getMinutes()
}

function blockStartMinutes(block: CalendarBlock): number {
  return timeMinutes(block.start)
}

function periodForIso(value: string): Period {
  const hour = new Date(value).getHours()
  if (hour < 12) return 'morning'
  if (hour < 17) return 'afternoon'
  return 'evening'
}

function isSameDay(iso: string, date: string): boolean {
  return toLocalDate(new Date(iso)) === date
}

function patientInitials(name: string | null): string {
  if (!name) return 'PT'
  const parts = name.split(' ').filter(Boolean)
  const first = parts[0]?.[0]
  const last = parts[parts.length - 1]?.[0]
  return [first, last].filter(Boolean).join('').toUpperCase()
}

function statusLabel(status: AppointmentStatus): string {
  if (status === 'checked_in') return 'Checked in'
  if (status === 'no_show') return 'No show'
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function statusClass(status: AppointmentStatus): string {
  if (status === 'checked_in') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (status === 'completed') return 'border-teal-200 bg-teal-50 text-teal-700'
  if (status === 'cancelled') return 'border-muted bg-muted/60 text-muted-foreground'
  if (status === 'no_show') return 'border-red-200 bg-red-50 text-red-700'
  return 'border-blue-200 bg-blue-50 text-blue-700'
}

function statusDotClass(status: AppointmentStatus): string {
  if (status === 'checked_in') return 'bg-emerald-500 ring-emerald-100'
  if (status === 'completed') return 'bg-teal-500 ring-teal-100'
  if (status === 'cancelled') return 'bg-muted-foreground/50 ring-muted'
  if (status === 'no_show') return 'bg-red-500 ring-red-100'
  return 'bg-blue-500 ring-blue-100'
}

const statusFilterOptions: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'checked_in', label: 'Checked in' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'no_show', label: 'No show' },
]

function setStatusFilter(value: StatusFilter) {
  statusFilter.value = value
}

function blockClass(type: CalendarBlock['type']): string {
  if (type === 'meeting') return 'schedule-block-card--meeting'
  if (type === 'holiday') return 'schedule-block-card--holiday'
  if (type === 'personal') return 'schedule-block-card--personal'
  if (type === 'unavailable') return 'schedule-block-card--unavailable'
  return 'schedule-block-card--break'
}

const todayDate = computed(() => toLocalDate(currentTime.value))
const isSelectedToday = computed(() => selectedDate.value === todayDate.value)
const selectedDateValue = computed<DateValue>({
  get: () => isoToCalendarDate(selectedDate.value),
  set: (value) => {
    selectedDate.value = calendarDateToIso(value)
    isMonthPickerOpen.value = false
  },
})
const monthDays = computed(() => Array.from({ length: daysInMonth(selectedDate.value) }, (_, index) => addDays(startOfMonth(selectedDate.value), index)))
const selectedMonthLabel = computed(() => formatMonthLabel(selectedDate.value))
const scheduleTitle = computed(() => {
  if (isSelectedToday.value) return 'Today\'s Schedule'
  return `${formatShortDate(selectedDate.value)}, ${formatFullWeekday(selectedDate.value)}'s Schedule`
})

const visibleAppointments = computed(() => appointments.value
  .filter((appointment) => statusFilter.value === 'all' || appointment.status === statusFilter.value)
  .slice()
  .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()))

const scheduledAppointments = computed(() => visibleAppointments.value
  .filter((appointment) => appointment.status === 'scheduled'))

const upcomingScheduledAppointments = computed(() => scheduledAppointments.value
  .filter((appointment) => new Date(appointment.scheduled_at).getTime() >= currentTime.value.getTime()))

const nextUp = computed(() => upcomingScheduledAppointments.value[0] ?? scheduledAppointments.value[0] ?? null)
const availableSlots = computed(() => slots.value.filter((slot) => slot.available))
const selectedDayBlocks = computed(() => dayBlocks.value
  .filter((block) => isSameDay(block.start, selectedDate.value) || isSameDay(block.end, selectedDate.value))
  .sort((a, b) => blockStartMinutes(a) - blockStartMinutes(b)))

const upcomingBlockRangeLabel = computed(() => `${formatShortDate(selectedDate.value)} - ${formatShortDate(addDays(selectedDate.value, 30))}`)

const monthScheduledCounts = computed(() => {
  const counts: Record<string, number> = {}
  for (const day of monthDays.value) counts[day] = 0
  for (const appointment of monthAppointments.value) {
    if (appointment.status !== 'scheduled') continue

    const key = toLocalDate(new Date(appointment.scheduled_at))
    if (key in counts) counts[key] = (counts[key] ?? 0) + 1
  }
  return counts
})

const slotStats = computed(() => {
  const total = slots.value.length
  const available = availableSlots.value.length
  const booked = appointments.value.filter((appointment) => appointment.status !== 'cancelled').length
  const utilization = total > 0 ? Math.round((booked / total) * 100) : 0
  return { total, available, booked, utilization: Math.min(100, utilization) }
})

const currentTimeLabel = computed(() => formatTime(currentTime.value))

function periodSlots(period: Period): Slot[] {
  return availableSlots.value.filter((slot) => periodForIso(slot.start) === period)
}

function periodAppointments(period: Period): AppointmentResponse[] {
  return visibleAppointments.value.filter((appointment) => periodForIso(appointment.scheduled_at) === period)
}

function periodBlocks(period: Period): CalendarBlock[] {
  return selectedDayBlocks.value.filter((block) => periodForIso(block.start) === period)
}

function periodHasContent(period: Period): boolean {
  return periodSlots(period).length > 0 || periodAppointments(period).length > 0 || periodBlocks(period).length > 0
}

function periodLabel(period: Period): string {
  if (period === 'morning') return 'Morning availability'
  if (period === 'afternoon') return 'Afternoon availability'
  return 'Evening availability'
}

function periodIcon(period: Period) {
  if (period === 'morning') return Sunrise
  if (period === 'afternoon') return Sun
  return Moon
}

function periodIconClass(period: Period): string {
  if (period === 'morning') return 'schedule-period-icon--morning'
  if (period === 'afternoon') return 'schedule-period-icon--afternoon'
  return 'schedule-period-icon--evening'
}

function appointmentEnd(appointment: AppointmentResponse): string {
  const start = new Date(appointment.scheduled_at)
  return new Date(start.getTime() + appointment.duration * 60_000).toISOString()
}

function dayLoadCount(day: string): number {
  return monthScheduledCounts.value[day] ?? 0
}

function dayLoadDotStyle(day: string): Record<string, string> {
  const count = monthScheduledCounts.value[day] ?? 0
  if (count <= 0) {
    return {
      background: 'rgb(148 163 184 / 0.46)',
      boxShadow: 'inset 0 0 0 1px rgb(255 255 255 / 0.24)',
    }
  }

  return {
    background: 'rgb(57 255 20)',
    boxShadow: '0 0 8px rgb(57 255 20 / 0.7), 0 0 18px rgb(57 255 20 / 0.34), inset 0 0 0 1px rgb(255 255 255 / 0.42)',
  }
}

function selectDate(date: string) {
  selectedDate.value = date
}

function scrollMonthRail(direction: -1 | 1) {
  const rail = monthRailRef.value
  if (!rail) return

  rail.scrollBy({
    left: direction * Math.max(160, rail.clientWidth * 0.72),
    behavior: 'smooth',
  })
}

function scrollSelectedMonthDay() {
  void nextTick(() => {
    monthRailRef.value?.querySelector('.schedule-month-day.is-selected')?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    })
  })
}

function goToPreviousMonth() {
  selectedDate.value = addMonths(selectedDate.value, -1)
}

function goToNextMonth() {
  selectedDate.value = addMonths(selectedDate.value, 1)
}

async function loadStudioData() {
  if (!props.userId) return
  const start = startOfMonth(selectedDate.value)
  const end = endOfMonth(selectedDate.value)
  const blockRangeEnd = addDays(selectedDate.value, 30)
  await scheduleStore.fetchStudioData({
    userId: props.userId,
    date: selectedDate.value,
    start,
    end,
    blockRangeEnd,
    refreshKey: props.refreshKey,
  })
}

watch(() => [props.userId, selectedDate.value, props.refreshKey], () => {
  scrollSelectedMonthDay()
  loadStudioData()
}, { immediate: true })

onMounted(() => {
  currentTimeTimer = setInterval(() => {
    currentTime.value = new Date()
  }, 1000)
})

onUnmounted(() => {
  if (currentTimeTimer) clearInterval(currentTimeTimer)
})
</script>

<template>
  <div class="schedule-studio space-y-4">
    <div class="space-y-3">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 class="text-2xl font-semibold tracking-normal">
          {{ scheduleTitle }}
        </h1>
        <div class="flex flex-wrap items-center gap-2 sm:justify-end">
          <Button variant="outline" class="schedule-action-button h-9" @click="emit('working-hours')">
            <Clock class="size-4" />
            Working hours
          </Button>
          <Button class="h-9" @click="emit('add-block', null)">
            <CalendarPlus class="size-4" />
            Add block
          </Button>
        </div>
      </div>
    </div>

    <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div class="schedule-stat-card surface-card rounded-2xl p-4">
        <div class="flex items-center gap-4">
          <span class="schedule-stat-icon flex size-10 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-[0_16px_32px_rgba(37,99,235,0.24)]">
            <CalendarCheck class="size-6" />
          </span>
          <div class="min-w-0">
            <p class="text-sm text-muted-foreground">Appointments today</p>
            <p v-if="!isLoading" class="text-2xl font-semibold">{{ appointments.length }}</p>
            <span v-else class="schedule-skeleton mt-1 block h-7 w-10 rounded-full" />
          </div>
        </div>
      </div>
      <div class="schedule-stat-card surface-card rounded-2xl p-4">
        <div class="flex items-center gap-4">
          <span class="schedule-stat-icon flex size-10 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-[0_16px_32px_rgba(16,185,129,0.24)]">
            <CheckCircle2 class="size-6" />
          </span>
          <div class="min-w-0">
            <p class="text-sm text-muted-foreground">Booked</p>
            <p v-if="!isLoading" class="text-2xl font-semibold">{{ slotStats.booked }}</p>
            <span v-else class="schedule-skeleton mt-1 block h-7 w-10 rounded-full" />
          </div>
        </div>
      </div>
      <div class="schedule-stat-card surface-card rounded-2xl p-4">
        <div class="flex items-center gap-4">
          <span class="schedule-stat-icon flex size-10 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-[0_16px_32px_rgba(245,158,11,0.24)]">
            <Clock class="size-6" />
          </span>
          <div class="min-w-0">
            <p class="text-sm text-muted-foreground">Next appointment</p>
            <p v-if="!isLoading" class="truncate text-2xl font-semibold">{{ nextUp ? formatTime(nextUp.scheduled_at) : '—' }}</p>
            <span v-else class="schedule-skeleton mt-1 block h-7 w-24 rounded-full" />
          </div>
        </div>
      </div>
      <div class="schedule-stat-card surface-card rounded-2xl p-4">
        <div class="flex items-center gap-4">
          <span class="schedule-stat-icon flex size-10 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-violet-600 text-white shadow-[0_16px_32px_rgba(139,92,246,0.24)]">
            <Activity class="size-6" />
          </span>
          <div class="min-w-0">
            <p class="text-sm text-muted-foreground">Open slots</p>
            <p v-if="!isLoading" class="text-2xl font-semibold">{{ slotStats.available }}</p>
            <span v-else class="schedule-skeleton mt-1 block h-7 w-10 rounded-full" />
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="error"
      role="alert"
      class="surface-card rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive"
    >
      {{ error }}
    </div>

    <div class="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
      <section class="schedule-map-panel surface-card overflow-hidden rounded-2xl">
        <div class="schedule-panel-header flex flex-col gap-3 p-4">
          <div>
            <h2 class="text-lg font-semibold">Availability map</h2>
            <p class="text-sm text-muted-foreground">Single-doctor view of appointments, blocks, and open gaps.</p>
          </div>
          <div class="flex min-w-0 flex-wrap gap-1">
            <button
              v-for="option in statusFilterOptions"
              :key="option.value"
              class="schedule-filter-chip whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium transition-all"
              :class="statusFilter === option.value ? 'is-active' : 'text-muted-foreground hover:text-foreground'"
              @click="setStatusFilter(option.value)"
            >
              {{ option.label }}
            </button>
          </div>
        </div>

        <div class="schedule-month-strip px-4 py-4">
          <div class="mb-3 flex items-center justify-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              class="schedule-month-nav size-8 rounded-full"
              aria-label="Previous month"
              @click="goToPreviousMonth"
            >
              <ChevronLeft class="size-4" />
            </Button>
            <Popover v-model:open="isMonthPickerOpen">
              <PopoverTrigger as-child>
                <Button
                  variant="ghost"
                  class="schedule-month-picker h-8 min-w-44 rounded-full px-4 text-sm font-semibold text-foreground"
                >
                  <CalendarDays class="mr-2 size-4 text-muted-foreground" />
                  {{ selectedMonthLabel }}
                </Button>
              </PopoverTrigger>
              <PopoverContent class="w-auto p-0" align="center">
                <ShadcnCalendar v-model="selectedDateValue" />
              </PopoverContent>
            </Popover>
            <Button
              variant="ghost"
              size="icon"
              class="schedule-month-nav size-8 rounded-full"
              aria-label="Next month"
              @click="goToNextMonth"
            >
              <ChevronRight class="size-4" />
            </Button>
          </div>
          <div class="schedule-month-rail-shell grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              class="schedule-rail-scroll-button size-8 rounded-full"
              aria-label="Scroll dates left"
              @click="scrollMonthRail(-1)"
            >
              <ChevronLeft class="size-4" />
            </Button>
            <div
              ref="monthRailRef"
              class="schedule-month-rail flex gap-3 overflow-x-auto pb-1"
            >
              <button
                v-for="day in monthDays"
                :key="day"
                class="schedule-month-day flex min-w-[64px] snap-center flex-col items-center justify-between rounded-full px-2 py-2 text-center transition-all"
                :class="[
                  day === selectedDate ? 'is-selected' : 'hover:bg-white/42 dark:hover:bg-white/5',
                  day === todayDate ? 'is-today' : '',
                ]"
                @click="selectDate(day)"
              >
                <p class="text-xs font-medium">{{ formatWeekday(day) }}</p>
                <span class="schedule-month-day-number mt-1 flex size-9 items-center justify-center rounded-full text-sm font-semibold">
                  {{ formatDayNumber(day) }}
                </span>
                <div class="mt-2 flex justify-center">
                  <span
                    class="schedule-load-dot"
                    :aria-label="`${dayLoadCount(day)} appointments`"
                    :style="dayLoadDotStyle(day)"
                  />
                </div>
              </button>
            </div>
            <Button
              variant="ghost"
              size="icon"
              class="schedule-rail-scroll-button size-8 rounded-full"
              aria-label="Scroll dates right"
              @click="scrollMonthRail(1)"
            >
              <ChevronRight class="size-4" />
            </Button>
          </div>
        </div>

        <div class="relative px-4 py-5">
          <div
            v-if="isSelectedToday"
            class="mb-5 grid grid-cols-[72px_24px_minmax(0,1fr)] items-center gap-3"
          >
            <div class="flex justify-end">
              <span class="schedule-now-pill whitespace-nowrap rounded-full px-2 py-1 text-xs font-semibold text-teal-700">
                {{ currentTimeLabel }}
              </span>
            </div>
            <div class="flex justify-center">
              <span class="size-2.5 rounded-full bg-teal-500 ring-4 ring-teal-100" />
            </div>
            <div class="border-t border-dashed border-teal-500" />
          </div>

          <div v-if="isLoading" class="space-y-5">
            <div v-for="index in 3" :key="index" class="grid grid-cols-[72px_24px_minmax(0,1fr)] gap-3">
              <div class="pt-4">
                <span class="schedule-skeleton ml-auto block h-4 w-14 rounded-full" />
              </div>
              <div class="relative flex justify-center">
                <div class="schedule-timeline-line absolute top-7 h-[calc(100%+1.5rem)] w-px" />
                <span class="schedule-skeleton relative z-10 mt-4 block size-3 rounded-full" />
              </div>
              <div class="space-y-3">
                <span class="schedule-skeleton block h-5 w-44 rounded-full" />
                <div class="schedule-skeleton h-24 rounded-2xl" />
              </div>
            </div>
          </div>

          <div v-else class="space-y-6">
            <template v-for="period in periods" :key="period">
              <section v-if="periodHasContent(period)" class="grid grid-cols-[72px_24px_minmax(0,1fr)] gap-3">
                <div />
                <div class="relative flex justify-center">
                  <div class="schedule-timeline-line absolute top-7 h-[calc(100%+1.5rem)] w-px" />
                </div>
                <div>
                  <div class="mb-3 flex items-center gap-2">
                    <span class="schedule-period-icon flex size-8 items-center justify-center rounded-xl text-white" :class="periodIconClass(period)">
                      <component :is="periodIcon(period)" class="size-4" />
                    </span>
                    <p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {{ periodLabel(period) }}
                    </p>
                  </div>

                  <div v-if="periodSlots(period).length" class="mb-3 flex flex-wrap gap-2">
                    <button
                      v-for="slot in periodSlots(period).slice(0, 10)"
                      :key="slot.start"
                      class="schedule-slot-chip rounded-full px-2.5 py-1 text-xs font-medium text-teal-700"
                      @click="emit('add-block', slot.start)"
                    >
                      {{ formatTime(slot.start) }}
                    </button>
                    <span
                      v-if="periodSlots(period).length > 10"
                      class="surface-muted rounded-full px-2.5 py-1 text-xs font-medium text-muted-foreground"
                    >
                      +{{ periodSlots(period).length - 10 }} more
                    </span>
                  </div>

                  <div class="space-y-3">
                    <div
                      v-for="block in periodBlocks(period)"
                      :key="block.id"
                      class="schedule-block-card rounded-2xl px-4 py-3"
                      :class="blockClass(block.type)"
                    >
                      <div class="flex items-center gap-3">
                        <Coffee v-if="block.type === 'leave' || block.type === 'personal'" class="size-4" />
                        <Ban v-else-if="block.type === 'unavailable'" class="size-4" />
                        <CalendarDays v-else class="size-4" />
                        <div class="min-w-0 flex-1">
                          <p class="truncate text-sm font-semibold">{{ block.title }}</p>
                          <p class="text-xs opacity-80">{{ formatTime(block.start) }} - {{ formatTime(block.end) }}</p>
                        </div>
                      </div>
                    </div>

                    <div
                      v-for="appointment in periodAppointments(period)"
                      :key="appointment.id"
                      class="relative"
                    >
                      <div class="absolute -left-[120px] top-8 w-[72px] -translate-y-1/2 text-right">
                        <p class="whitespace-nowrap text-sm font-semibold text-foreground">{{ formatTime(appointment.scheduled_at) }}</p>
                        <p class="text-xs text-muted-foreground">{{ appointment.duration }} min</p>
                      </div>
                      <span
                        class="absolute -left-[32px] top-8 z-10 size-3 -translate-y-1/2 rounded-full border-2 border-background ring-4"
                        :class="statusDotClass(appointment.status)"
                      />
                      <button
                        class="schedule-appointment-card w-full rounded-2xl p-4 text-left transition-all hover:-translate-y-0.5"
                        :class="appointment.status === 'checked_in' ? 'is-checked-in' : appointment.status === 'cancelled' ? 'opacity-60' : ''"
                        @click="emit('appointment-click', appointment.id)"
                      >
                        <div class="grid gap-3 sm:grid-cols-[48px_minmax(0,1fr)_auto] sm:items-center">
                          <div class="size-12 overflow-hidden rounded-full bg-violet-100">
                            <img
                              v-if="appointment.patient_avatar_url"
                              :src="appointment.patient_avatar_url"
                              :alt="appointment.patient_name ?? 'Patient'"
                              class="size-full object-cover"
                            >
                            <div v-else class="flex size-full items-center justify-center text-sm font-semibold text-violet-700">
                              {{ patientInitials(appointment.patient_name) }}
                            </div>
                          </div>
                          <div class="min-w-0">
                            <p class="truncate text-sm font-semibold">{{ appointment.patient_name ?? 'Patient' }}</p>
                            <div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                              <span class="inline-flex items-center gap-1">
                                <UserRound class="size-3.5" />
                                {{ appointment.reason || 'Consultation' }}
                              </span>
                            </div>
                          </div>
                          <span class="w-fit rounded-full border px-2.5 py-1 text-xs font-semibold" :class="statusClass(appointment.status)">
                            {{ statusLabel(appointment.status) }}
                          </span>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            </template>

            <div
              v-if="!appointments.length && !availableSlots.length && !selectedDayBlocks.length"
              class="surface-muted rounded-2xl py-10 text-center text-sm text-muted-foreground"
            >
              This day is clear. A good chance to catch up, plan ahead, or open slots when ready.
            </div>
          </div>
        </div>

      </section>

      <aside class="space-y-4">
        <section class="schedule-side-card surface-card rounded-2xl p-4">
          <div class="mb-4 flex items-center justify-between">
            <div>
              <h2 class="text-lg font-semibold">Next up</h2>
              <p class="text-xs text-muted-foreground">{{ selectedDate === todayDate ? 'Today' : formatDate(selectedDate) }}</p>
            </div>
            <span v-if="nextUp" class="rounded-full border px-2.5 py-1 text-xs font-semibold" :class="statusClass(nextUp.status)">
              {{ statusLabel(nextUp.status) }}
            </span>
          </div>

          <div v-if="isLoading" class="grid gap-4 sm:grid-cols-[48px_minmax(0,1fr)]">
            <span class="schedule-skeleton block size-12 rounded-full" />
            <div class="space-y-3">
              <span class="schedule-skeleton block h-5 w-44 rounded-full" />
              <span class="schedule-skeleton block h-4 w-28 rounded-full" />
              <div class="grid gap-2 sm:grid-cols-2">
                <span class="schedule-skeleton block h-12 rounded-xl" />
                <span class="schedule-skeleton block h-12 rounded-xl" />
              </div>
            </div>
          </div>
          <div v-else-if="nextUp" class="grid gap-4 sm:grid-cols-[48px_minmax(0,1fr)]">
            <div class="size-12 overflow-hidden rounded-full bg-orange-100">
              <img
                v-if="nextUp.patient_avatar_url"
                :src="nextUp.patient_avatar_url"
                :alt="nextUp.patient_name ?? 'Patient'"
                class="size-full object-cover"
              >
              <div v-else class="flex size-full items-center justify-center text-sm font-semibold text-orange-700">
                {{ patientInitials(nextUp.patient_name) }}
              </div>
            </div>
            <div class="min-w-0">
              <p class="truncate text-base font-semibold">{{ nextUp.patient_name ?? 'Patient' }}</p>
              <p class="text-sm text-muted-foreground">{{ nextUp.reason || 'Consultation' }}</p>
              <div class="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <p class="text-xs text-muted-foreground">Scheduled time</p>
                  <p class="font-medium">{{ formatTime(nextUp.scheduled_at) }} - {{ formatTime(appointmentEnd(nextUp)) }}</p>
                </div>
                <div>
                  <p class="text-xs text-muted-foreground">Duration</p>
                  <p class="font-medium">{{ nextUp.duration }} min</p>
                </div>
              </div>
              <p v-if="nextUp.notes" class="mt-3 line-clamp-2 text-sm text-muted-foreground">{{ nextUp.notes }}</p>
              <div class="mt-4 flex flex-wrap items-center gap-2" @click.stop>
                <Button
                  size="sm"
                  class="h-8 gap-1.5 px-3 text-xs"
                  @click="emit('check-in', nextUp.id)"
                >
                  <LogIn class="size-3.5" />
                  Check In
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  class="h-8 gap-1.5 px-3 text-xs"
                  @click="emit('appointment-click', nextUp.id)"
                >
                  <CalendarDays class="size-3.5" />
                  View details
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger as-child>
                    <Button variant="outline" size="icon" class="size-8">
                      <MoreVertical class="size-3.5" />
                      <span class="sr-only">Appointment actions</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem @click="emit('check-in', nextUp.id)">
                      <LogIn class="mr-2 size-4" />
                      Check in
                    </DropdownMenuItem>
                    <DropdownMenuItem @click="emit('no-show', nextUp.id)">
                      <UserX class="mr-2 size-4" />
                      Mark no-show
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      class="text-destructive focus:text-destructive"
                      @click="emit('cancel', nextUp.id)"
                    >
                      <X class="mr-2 size-4" />
                      Cancel
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
          <div v-else class="surface-muted rounded-2xl py-8 text-center text-sm text-muted-foreground">
            Nothing urgent next. The schedule is calm for now.
          </div>
        </section>

        <div class="space-y-4">
          <section class="schedule-side-card surface-card rounded-2xl p-4">
            <div class="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 class="text-lg font-semibold">Availability</h2>
                <p class="text-xs text-muted-foreground">{{ formatDate(selectedDate) }}</p>
              </div>
              <Button variant="outline" size="icon" class="size-8" :disabled="isLoading" @click="loadStudioData">
                <RefreshCw class="size-3.5" :class="isLoading ? 'animate-spin' : ''" />
              </Button>
            </div>
            <div class="mb-3 grid grid-cols-3 gap-2 text-sm">
              <div>
                <p v-if="!isLoading" class="text-xl font-semibold">{{ slotStats.total }}</p>
                <span v-else class="schedule-skeleton mb-1 block h-6 w-9 rounded-full" />
                <p class="text-xs text-muted-foreground">Total</p>
              </div>
              <div>
                <p v-if="!isLoading" class="text-xl font-semibold">{{ slotStats.available }}</p>
                <span v-else class="schedule-skeleton mb-1 block h-6 w-9 rounded-full" />
                <p class="text-xs text-muted-foreground">Open</p>
              </div>
              <div>
                <p v-if="!isLoading" class="text-xl font-semibold">{{ slotStats.booked }}</p>
                <span v-else class="schedule-skeleton mb-1 block h-6 w-9 rounded-full" />
                <p class="text-xs text-muted-foreground">Booked</p>
              </div>
            </div>
            <div v-if="isLoading" class="flex flex-wrap gap-1.5">
              <span v-for="index in 6" :key="index" class="schedule-skeleton block h-7 w-20 rounded-full" />
            </div>
            <div v-else-if="availableSlots.length" class="flex flex-wrap gap-1.5">
              <button
                v-for="slot in availableSlots.slice(0, 8)"
                :key="slot.start"
                class="schedule-slot-chip rounded-full px-2 py-1 text-xs font-medium text-teal-700"
                @click="emit('add-block', slot.start)"
              >
                {{ formatTime(slot.start) }}
              </button>
              <span
                v-if="availableSlots.length > 8"
                class="surface-muted rounded-full px-2 py-1 text-xs font-medium text-muted-foreground"
              >
                +{{ availableSlots.length - 8 }} more
              </span>
            </div>
            <div v-else class="surface-muted rounded-2xl py-6 text-center text-sm text-muted-foreground">
              No open slots are showing yet. Add availability when you are ready to receive patients.
            </div>
          </section>

          <section class="schedule-side-card surface-card rounded-2xl p-4">
            <div class="mb-3 flex items-center justify-between">
              <div>
                <h2 class="text-lg font-semibold">Upcoming blocks</h2>
                <p class="text-xs text-muted-foreground">{{ upcomingBlockRangeLabel }}</p>
              </div>
              <span class="text-xs text-muted-foreground">{{ upcomingBlocks.length }}</span>
            </div>
            <div v-if="isLoading" class="space-y-2">
              <div v-for="index in 3" :key="index" class="schedule-block-card rounded-2xl px-3 py-2">
                <span class="schedule-skeleton block h-4 w-32 rounded-full" />
                <span class="schedule-skeleton mt-2 block h-3 w-44 rounded-full" />
              </div>
            </div>
            <div v-else class="max-h-72 space-y-2 overflow-y-auto pr-1">
              <div
                v-for="block in upcomingBlocks.slice(0, 8)"
                :key="block.id"
                class="schedule-block-card rounded-2xl px-3 py-2"
                :class="blockClass(block.type)"
              >
                <div class="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                  <div class="min-w-0 space-y-0.5">
                    <p class="truncate text-sm font-semibold">{{ block.title }}</p>
                    <p class="whitespace-nowrap text-xs opacity-80">
                      {{ formatShortDate(toLocalDate(new Date(block.start))) }} · {{ formatTime(block.start) }} - {{ formatTime(block.end) }}
                    </p>
                  </div>
                  <p class="min-w-0 truncate text-xs font-medium opacity-80 sm:max-w-40 sm:text-right">{{ block.user_name ?? 'Clinic' }}</p>
                </div>
              </div>
              <div v-if="!upcomingBlocks.length" class="surface-muted rounded-2xl py-6 text-center text-sm text-muted-foreground">
                No blocked time ahead. Your calendar is open to shape as needed.
              </div>
            </div>
          </section>
        </div>

        <section class="schedule-side-card surface-card rounded-2xl p-4">
          <div class="mb-3 flex items-center gap-2">
            <AlertTriangle class="size-4 text-amber-500" />
            <h2 class="text-lg font-semibold">Slot health</h2>
          </div>
          <div class="grid grid-cols-4 gap-3">
            <div>
              <p v-if="!isLoading" class="text-2xl font-semibold">{{ slotStats.total }}</p>
              <span v-else class="schedule-skeleton mb-1 block h-7 w-10 rounded-full" />
              <p class="text-xs text-muted-foreground">Total</p>
            </div>
            <div>
              <p v-if="!isLoading" class="text-2xl font-semibold">{{ slotStats.booked }}</p>
              <span v-else class="schedule-skeleton mb-1 block h-7 w-10 rounded-full" />
              <p class="text-xs text-muted-foreground">Booked</p>
            </div>
            <div>
              <p v-if="!isLoading" class="text-2xl font-semibold">{{ slotStats.available }}</p>
              <span v-else class="schedule-skeleton mb-1 block h-7 w-10 rounded-full" />
              <p class="text-xs text-muted-foreground">Available</p>
            </div>
            <div>
              <p v-if="!isLoading" class="text-2xl font-semibold">{{ slotStats.utilization }}%</p>
              <span v-else class="schedule-skeleton mb-1 block h-7 w-12 rounded-full" />
              <p class="text-xs text-muted-foreground">Utilized</p>
            </div>
          </div>
          <div class="mt-4 h-2 overflow-hidden rounded-full bg-muted">
            <div class="h-full rounded-full bg-teal-500" :style="{ width: `${slotStats.utilization}%` }" />
          </div>
        </section>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.schedule-stat-card,
.schedule-map-panel,
.schedule-side-card,
.schedule-appointment-card,
.schedule-block-card {
  position: relative;
}

.schedule-stat-card,
.schedule-map-panel,
.schedule-side-card {
  border: 0;
  background:
    radial-gradient(circle at 18% 0%, rgb(59 130 246 / 0.08), transparent 32%),
    radial-gradient(circle at 82% 18%, rgb(20 184 166 / 0.08), transparent 30%),
    var(--surface-panel-strong);
}

.schedule-appointment-card {
  border: 0;
  background:
    radial-gradient(circle at 18% 0%, rgb(59 130 246 / 0.1), transparent 34%),
    radial-gradient(circle at 82% 24%, rgb(20 184 166 / 0.1), transparent 32%),
    linear-gradient(135deg, rgb(255 255 255 / 0.7), rgb(255 255 255 / 0.42) 56%, rgb(255 255 255 / 0.58)),
    rgb(255 255 255 / 0.28);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.58),
    0 20px 58px -40px rgb(15 23 42 / 0.62);
}

.schedule-panel-header,
.schedule-month-strip {
  box-shadow: inset 0 -1px 0 rgb(255 255 255 / 0.32);
}

.schedule-stat-icon {
  transform: translateZ(0);
}

.schedule-period-icon {
  transform: translateZ(0);
  box-shadow:
    0 14px 28px rgb(15 23 42 / 0.12),
    inset 0 1px 0 rgb(255 255 255 / 0.26);
}

.schedule-period-icon--morning {
  background: linear-gradient(135deg, rgb(245 158 11), rgb(20 184 166));
  box-shadow:
    0 14px 30px rgb(245 158 11 / 0.18),
    inset 0 1px 0 rgb(255 255 255 / 0.28);
}

.schedule-period-icon--afternoon {
  background: linear-gradient(135deg, rgb(249 115 22), rgb(245 158 11));
  box-shadow:
    0 14px 30px rgb(249 115 22 / 0.18),
    inset 0 1px 0 rgb(255 255 255 / 0.28);
}

.schedule-period-icon--evening {
  background: linear-gradient(135deg, rgb(99 102 241), rgb(139 92 246));
  box-shadow:
    0 14px 30px rgb(99 102 241 / 0.18),
    inset 0 1px 0 rgb(255 255 255 / 0.28);
}

.schedule-action-button {
  box-shadow: 0 12px 28px rgb(15 23 42 / 0.06);
}

.schedule-filter-chip.is-active {
  color: white;
  background: linear-gradient(135deg, rgb(37 99 235), rgb(20 184 166));
  box-shadow:
    0 12px 26px rgb(37 99 235 / 0.16),
    inset 0 1px 0 rgb(255 255 255 / 0.26);
}

.schedule-filter-chip {
  background: rgb(255 255 255 / 0.42);
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.34);
}

.schedule-month-rail {
  margin: -0.75rem -0.5rem -1rem;
  padding: 0.75rem 0.5rem 1.35rem;
  overscroll-behavior-x: contain;
  scroll-snap-type: x proximity;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}

.schedule-month-rail::-webkit-scrollbar {
  display: none;
  height: 0;
  width: 0;
}

.schedule-rail-scroll-button,
.schedule-month-picker {
  position: relative;
  z-index: 2;
  background: rgb(255 255 255 / 0.5);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.54),
    0 12px 28px rgb(15 23 42 / 0.08);
}

.schedule-month-nav {
  background: rgb(255 255 255 / 0.42);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.42),
    0 12px 28px rgb(15 23 42 / 0.06);
}

.schedule-month-day {
  color: rgb(71 85 105);
  background:
    radial-gradient(circle at 50% 0%, rgb(255 255 255 / 0.78), transparent 58%),
    linear-gradient(135deg, rgb(255 255 255 / 0.72), rgb(255 255 255 / 0.38)),
    rgb(255 255 255 / 0.36);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.64),
    inset 0 0 0 1px rgb(255 255 255 / 0.44),
    0 14px 30px rgb(15 23 42 / 0.08);
}

.schedule-month-day-number {
  background: rgb(255 255 255 / 0.5);
  box-shadow:
    inset 0 0 0 1px rgb(255 255 255 / 0.5),
    0 10px 22px rgb(15 23 42 / 0.08);
}

.schedule-month-day.is-today:not(.is-selected) .schedule-month-day-number {
  color: white;
  background:
    linear-gradient(135deg, rgb(37 99 235), rgb(20 184 166)),
    rgb(20 184 166);
  box-shadow:
    0 0 0 1px rgb(255 255 255 / 0.42),
    0 14px 30px rgb(37 99 235 / 0.18),
    0 12px 26px rgb(20 184 166 / 0.16),
    inset 0 1px 0 rgb(255 255 255 / 0.24);
}

.schedule-month-day.is-selected {
  color: white;
  background:
    linear-gradient(135deg, rgb(37 99 235), rgb(20 184 166)),
    rgb(20 184 166);
  box-shadow:
    0 0 0 1px rgb(255 255 255 / 0.46),
    0 22px 52px rgb(37 99 235 / 0.26),
    0 18px 42px rgb(20 184 166 / 0.24),
    inset 0 1px 0 rgb(255 255 255 / 0.28);
}

.schedule-month-day.is-selected .schedule-month-day-number {
  background: rgb(255 255 255 / 0.18);
  box-shadow:
    inset 0 0 0 1px rgb(255 255 255 / 0.24),
    0 8px 18px rgb(15 23 42 / 0.12);
}

.schedule-load-dot {
  display: inline-flex;
  height: 0.45rem;
  width: 0.45rem;
  border-radius: 9999px;
  transition: background 160ms ease, box-shadow 160ms ease, transform 160ms ease;
}

.schedule-skeleton {
  position: relative;
  overflow: hidden;
  background:
    linear-gradient(135deg, rgb(248 253 255 / 0.9), rgb(203 232 242 / 0.52)),
    rgb(214 237 246 / 0.48);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.58),
    inset 0 0 0 1px rgb(125 211 252 / 0.14),
    0 10px 26px rgb(15 23 42 / 0.04);
}

.schedule-skeleton::after {
  content: '';
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(90deg, transparent, rgb(255 255 255 / 0.58), transparent);
  animation: schedule-skeleton-shimmer 1.2s ease-in-out infinite;
}

.schedule-now-pill,
.schedule-slot-chip {
  border: 1px solid rgb(94 234 212 / 0.42);
  background: rgb(240 253 250 / 0.72);
  box-shadow: 0 10px 24px rgb(15 118 110 / 0.1);
}

.schedule-timeline-line {
  background: rgb(148 163 184 / 0.28);
}

.schedule-block-card {
  --schedule-block-accent: 245 158 11;
  --schedule-block-text: 146 64 14;
  color: rgb(var(--schedule-block-text));
  background:
    radial-gradient(circle at 4% 24%, rgb(var(--schedule-block-accent) / 0.16), transparent 34%),
    linear-gradient(135deg, rgb(255 255 255 / 0.68), rgb(255 255 255 / 0.42)),
    rgb(var(--schedule-block-accent) / 0.06);
  box-shadow:
    inset 3px 0 0 rgb(var(--schedule-block-accent) / 0.52),
    inset 0 1px 0 rgb(255 255 255 / 0.44),
    0 18px 46px -36px rgb(15 23 42 / 0.42);
}

.schedule-block-card--meeting {
  --schedule-block-accent: 59 130 246;
  --schedule-block-text: 30 64 175;
}

.schedule-block-card--holiday {
  --schedule-block-accent: 16 185 129;
  --schedule-block-text: 4 120 87;
}

.schedule-block-card--personal {
  --schedule-block-accent: 139 92 246;
  --schedule-block-text: 91 33 182;
}

.schedule-block-card--unavailable {
  --schedule-block-accent: 244 63 94;
  --schedule-block-text: 190 18 60;
}

.schedule-block-card--break {
  --schedule-block-accent: 245 158 11;
  --schedule-block-text: 180 83 9;
}

.schedule-appointment-card:hover,
.schedule-side-card:hover {
  box-shadow: var(--surface-shadow-strong);
}

.schedule-appointment-card.is-checked-in {
  background:
    linear-gradient(135deg, rgb(16 185 129 / 0.1), rgb(255 255 255 / 0.38)),
    var(--surface-panel-strong);
}

:global(.dark .schedule-stat-card),
:global(.dark .schedule-map-panel),
:global(.dark .schedule-side-card),
:global(.dark .schedule-appointment-card) {
  background:
    radial-gradient(circle at 86% 88%, rgb(20 184 166 / 0.12), transparent 34%),
    radial-gradient(circle at 18% 10%, rgb(59 130 246 / 0.12), transparent 30%),
    linear-gradient(135deg, rgb(15 23 42 / 0.58), rgb(15 23 42 / 0.28) 54%, rgb(15 23 42 / 0.42)),
    rgb(15 23 42 / 0.12);
  border: 1px solid rgb(255 255 255 / 0.1) !important;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.06),
    inset 1px 0 0 rgb(255 255 255 / 0.035),
    0 24px 80px -38px rgb(0 0 0 / 0.82);
}

:global(.dark .schedule-appointment-card) {
  background:
    radial-gradient(circle at 86% 88%, rgb(20 184 166 / 0.14), transparent 34%),
    radial-gradient(circle at 18% 10%, rgb(59 130 246 / 0.14), transparent 30%),
    linear-gradient(135deg, rgb(15 23 42 / 0.62), rgb(15 23 42 / 0.34) 54%, rgb(15 23 42 / 0.48)),
    rgb(15 23 42 / 0.18);
  border: 1px solid rgb(255 255 255 / 0.1) !important;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.06),
    inset 1px 0 0 rgb(255 255 255 / 0.035),
    0 24px 80px -38px rgb(0 0 0 / 0.82);
}

:global(.dark .schedule-panel-header),
:global(.dark .schedule-month-strip) {
  box-shadow:
    inset 0 -1px 0 rgb(148 163 184 / 0.12),
    inset 0 1px 0 rgb(255 255 255 / 0.03);
}

:global(.dark .schedule-month-nav),
:global(.dark .schedule-rail-scroll-button),
:global(.dark .schedule-month-picker) {
  background: rgb(15 23 42 / 0.44);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.06),
    0 14px 30px rgb(0 0 0 / 0.24);
}

:global(.dark .schedule-month-day) {
  color: rgb(203 213 225 / 0.82);
  background:
    linear-gradient(135deg, rgb(15 23 42 / 0.56), rgb(15 23 42 / 0.28)),
    rgb(15 23 42 / 0.18);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.06),
    inset 0 0 0 1px rgb(255 255 255 / 0.08);
}

:global(.dark .schedule-month-day-number) {
  background: rgb(255 255 255 / 0.06);
  box-shadow:
    inset 0 0 0 1px rgb(255 255 255 / 0.08),
    0 10px 22px rgb(0 0 0 / 0.16);
}

:global(.dark .schedule-month-day.is-today:not(.is-selected) .schedule-month-day-number) {
  color: white;
  background:
    linear-gradient(135deg, rgb(37 99 235), rgb(20 184 166)),
    rgb(20 184 166);
  box-shadow:
    0 0 0 1px rgb(125 211 252 / 0.18),
    0 14px 34px rgb(56 189 248 / 0.18),
    inset 0 1px 0 rgb(255 255 255 / 0.2);
}

:global(.dark .schedule-month-day.is-selected) {
  color: white;
  background:
    linear-gradient(135deg, rgb(37 99 235), rgb(20 184 166)),
    rgb(20 184 166);
  box-shadow:
    0 0 0 1px rgb(125 211 252 / 0.22),
    0 18px 42px rgb(37 99 235 / 0.22),
    0 16px 36px rgb(20 184 166 / 0.18),
    inset 0 1px 0 rgb(255 255 255 / 0.22);
}

:global(.dark .schedule-skeleton) {
  background:
    linear-gradient(135deg, rgb(255 255 255 / 0.08), rgb(255 255 255 / 0.035)),
    rgb(15 23 42 / 0.28);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.06);
}

:global(.dark .schedule-skeleton::after) {
  background: linear-gradient(90deg, transparent, rgb(255 255 255 / 0.09), transparent);
}

:global(.dark .schedule-period-icon) {
  box-shadow:
    0 0 0 1px rgb(255 255 255 / 0.08),
    0 16px 34px rgb(0 0 0 / 0.28),
    inset 0 1px 0 rgb(255 255 255 / 0.2);
}

:global(.dark .schedule-period-icon--morning) {
  box-shadow:
    0 0 0 1px rgb(253 186 116 / 0.16),
    0 16px 34px rgb(245 158 11 / 0.14),
    inset 0 1px 0 rgb(255 255 255 / 0.2);
}

:global(.dark .schedule-period-icon--afternoon) {
  box-shadow:
    0 0 0 1px rgb(251 146 60 / 0.16),
    0 16px 34px rgb(249 115 22 / 0.14),
    inset 0 1px 0 rgb(255 255 255 / 0.2);
}

:global(.dark .schedule-period-icon--evening) {
  box-shadow:
    0 0 0 1px rgb(167 139 250 / 0.16),
    0 16px 34px rgb(99 102 241 / 0.14),
    inset 0 1px 0 rgb(255 255 255 / 0.2);
}

:global(.dark .schedule-filter-chip.is-active) {
  box-shadow:
    0 0 0 1px rgb(125 211 252 / 0.14),
    0 14px 34px rgb(56 189 248 / 0.16),
    inset 0 1px 0 rgb(255 255 255 / 0.2);
}

:global(.dark .schedule-filter-chip) {
  background: rgb(15 23 42 / 0.46);
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.08);
}

:global(.dark .schedule-now-pill),
:global(.dark .schedule-slot-chip) {
  color: rgb(94 234 212);
  border-color: rgb(94 234 212 / 0.22);
  background: rgb(20 184 166 / 0.12);
  box-shadow: 0 14px 34px rgb(0 0 0 / 0.22);
}

:global(.dark .schedule-timeline-line) {
  background: rgb(148 163 184 / 0.14);
}

:global(.dark .schedule-appointment-card:hover) {
  background:
    linear-gradient(90deg, rgb(59 130 246 / 0.12), rgb(20 184 166 / 0.08)),
    rgb(15 23 42 / 0.38);
  box-shadow:
    inset 3px 0 0 rgb(56 189 248 / 0.42),
    inset 0 1px 0 rgb(255 255 255 / 0.04),
    inset 0 -1px 0 rgb(255 255 255 / 0.04),
    0 24px 80px -38px rgb(0 0 0 / 0.82);
}

:global(.dark .schedule-block-card) {
  color: rgb(var(--schedule-block-accent));
  background:
    radial-gradient(circle at 4% 24%, rgb(var(--schedule-block-accent) / 0.16), transparent 34%),
    linear-gradient(135deg, rgb(15 23 42 / 0.56), rgb(15 23 42 / 0.26)),
    rgb(15 23 42 / 0.14);
  border: 1px solid rgb(255 255 255 / 0.1) !important;
  box-shadow:
    inset 3px 0 0 rgb(var(--schedule-block-accent) / 0.52),
    inset 0 1px 0 rgb(255 255 255 / 0.06),
    0 22px 70px -42px rgb(0 0 0 / 0.78);
}

@keyframes schedule-skeleton-shimmer {
  100% {
    transform: translateX(100%);
  }
}
</style>
