<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, nextTick, watch } from 'vue'
import FeatureGate from '@/components/shared/FeatureGate.vue'
import { toast } from 'vue-sonner'
import { CalendarDate, type DateValue, getLocalTimeZone, today } from '@internationalized/date'
import type { DateRange } from 'reka-ui'
import { Calendar as CalendarLucide, CalendarCheck, CalendarIcon, CalendarX, LoaderCircle, Plus, RefreshCw } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Calendar as ShadcnCalendar } from '@/components/ui/calendar'
import { RangeCalendar } from '@/components/ui/range-calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuthStore } from '@/domains/auth/stores/authStore'
import { useCentrifugo } from '@/composables/useCentrifugo'
import { useScheduleStore } from '../stores/scheduleStore'
import ScheduleCalendar from '../components/ScheduleCalendar.vue'
import WeeklyScheduleEditor from '../components/WeeklyScheduleEditor.vue'
import CalendarBlockList from '../components/CalendarBlockList.vue'
import CalendarBlockForm from '../components/CalendarBlockForm.vue'
import AvailabilityGrid from '../components/AvailabilityGrid.vue'
import type { CalendarBlock, StoreCalendarBlockPayload, UpsertWorkingSchedulePayload, UpdateCalendarBlockPayload } from '../types/schedule.types'
import { appointmentApi } from '@/domains/appointment/api/appointmentApi'
import AppointmentBookingWizard from '@/domains/appointment/components/AppointmentBookingWizard.vue'
import AppointmentDetailSheet from '@/domains/appointment/components/AppointmentDetailSheet.vue'
import type { AppointmentResponse } from '@/domains/appointment/types/appointment.types'

const authStore = useAuthStore()
const store = useScheduleStore()
const { connect, subscribe, getSubscription } = useCentrifugo()

const scheduleTimezone = computed(() => store.schedule?.timezone ?? 'Asia/Manila')

const userId = computed(() => authStore.user?.id ?? '')

// Sidebar mini calendar
const sidebarDate = ref<DateValue>(today(getLocalTimeZone()))
const scheduleCalendarRef = ref<InstanceType<typeof ScheduleCalendar> | null>(null)
const activeTab = ref('calendar')

function handleSidebarDateChange(date: DateValue) {
  sidebarDate.value = date
  const dateStr = calendarDateToIso(date)
  // Navigate FullCalendar if on calendar tab
  if (activeTab.value === 'calendar') {
    scheduleCalendarRef.value?.goToDate(dateStr)
  }
  // Update availability date if on availability tab
  if (activeTab.value === 'availability') {
    availabilityDateValue.value = date
    loadAvailability()
  }
}

// Working hours tab
const scheduleError = ref<string | null>(null)

// Calendar blocks tab
const blocksError = ref<string | null>(null)
const showBlockForm = ref(false)
const editingBlock = ref<CalendarBlock | null>(null)
const isSavingBlock = ref(false)
const deleteTarget = ref<CalendarBlock | null>(null)
const showDeleteDialog = ref(false)
const isDeleting = ref(false)

// Month/range for blocks list tab: default to current month
function getMonthDateRange(): DateRange {
  const now = today(getLocalTimeZone())
  return {
    start: new CalendarDate(now.year, now.month, 1),
    end: new CalendarDate(now.year, now.month, new Date(now.year, now.month, 0).getDate()),
  }
}

const blockFilterRange = ref<DateRange>(getMonthDateRange())

function calendarDateToIso(d: DateValue): string {
  return `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`
}

function formatDisplayDate(d: DateValue): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[d.month - 1]} ${d.day}, ${d.year}`
}

const blockFilterLabel = computed(() => {
  if (!blockFilterRange.value.start || !blockFilterRange.value.end) return 'Select date range'
  return `${formatDisplayDate(blockFilterRange.value.start)} – ${formatDisplayDate(blockFilterRange.value.end)}`
})

// Availability tab
const availabilityError = ref<string | null>(null)
const availabilityDateValue = ref<DateValue>(today(getLocalTimeZone()))
const availabilityDateLabel = computed(() => formatDisplayDate(availabilityDateValue.value))

// --- Appointment interactions from calendar ---
const showBookingWizard = ref(false)
const prefillDateTime = ref<string | null>(null)
const showDetailSheet = ref(false)
const selectedAppointment = ref<AppointmentResponse | null>(null)
const scrollContainerRef = ref<HTMLElement | null>(null)
let savedContainerScroll = 0
let savedWindowScroll = 0

function saveScroll() {
  savedContainerScroll = scrollContainerRef.value?.scrollTop ?? 0
  savedWindowScroll = window.scrollY
}

function restoreScroll() {
  // Delay to ensure dialog fully unmounts and body scroll lock is released
  setTimeout(() => {
    if (scrollContainerRef.value) {
      scrollContainerRef.value.scrollTop = savedContainerScroll
    }
    window.scrollTo(0, savedWindowScroll)
  }, 50)
}

// Slot action picker
const showSlotActionPicker = ref(false)
const slotActionDateTime = ref<string | null>(null)

function handleSlotSelect(dateTime: string) {
  saveScroll()
  slotActionDateTime.value = dateTime
  showSlotActionPicker.value = true
}

function slotActionBookAppointment() {
  showSlotActionPicker.value = false
  prefillDateTime.value = slotActionDateTime.value
  showBookingWizard.value = true
}

function slotActionAddBlock() {
  showSlotActionPicker.value = false
  prefillDateTime.value = slotActionDateTime.value
  editingBlock.value = null
  showBlockForm.value = true
}

function formatSlotTime(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  })
}

// Restore scroll position after dialog closes
watch(showBookingWizard, (open) => { if (!open) restoreScroll() })
watch(showDetailSheet, (open) => { if (!open) restoreScroll() })
watch(showSlotActionPicker, (open) => { if (!open) restoreScroll() })
watch(showBlockForm, (open) => { if (!open) restoreScroll() })

async function handleAppointmentClick(id: string) {
  saveScroll()
  try {
    const res = await appointmentApi.get(id)
    selectedAppointment.value = res.data
    showDetailSheet.value = true
  } catch {
    toast.error('Failed to load appointment')
  }
}

function handleAppointmentUpdated() {
  if (calendarRange.start) {
    loadAppointmentsForRange(calendarRange.start, calendarRange.end)
  }
}

function handleAppointmentCreated() {
  handleAppointmentUpdated()
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
    // Refresh calendar blocks to reflect new schedule
    if (calendarRange.start) {
      loadBlocksForRange(calendarRange.start, calendarRange.end)
    }
  } catch {
    toast.error('Failed to save schedule')
  }
}

// --- Calendar Preview ---
const calendarRange = { start: '', end: '' }
const calendarAppointments = ref<AppointmentResponse[]>([])

function handleCalendarDateRange(start: string, end: string) {
  calendarRange.start = start
  calendarRange.end = end
  loadBlocksForRange(start, end)
  loadAppointmentsForRange(start, end)
}

async function loadBlocksForRange(start: string, end: string) {
  if (!userId.value) return
  try {
    await store.fetchBlocks(userId.value, start, end)
  } catch {
    // Calendar will just show no blocks — not critical
  }
}

async function loadAppointmentsForRange(start: string, end: string) {
  if (!userId.value) return
  try {
    const response = await appointmentApi.list(1, 200, {
      doctor_id: userId.value,
      start_date: start,
      end_date: end,
    })
    calendarAppointments.value = response.data
  } catch {
    calendarAppointments.value = []
  }
}

function handleCalendarBlockClick(block: CalendarBlock) {
  editingBlock.value = block
  showBlockForm.value = true
}

// --- Calendar Blocks List ---
async function loadBlocks() {
  if (!userId.value || !blockFilterRange.value.start || !blockFilterRange.value.end) return
  blocksError.value = null
  try {
    await store.fetchBlocks(
      userId.value,
      calendarDateToIso(blockFilterRange.value.start),
      calendarDateToIso(blockFilterRange.value.end),
    )
  } catch {
    blocksError.value = 'Failed to load calendar blocks.'
  }
}

function openCreateBlock() {
  editingBlock.value = null
  showBlockForm.value = true
}

function openEditBlock(block: CalendarBlock) {
  editingBlock.value = block
  showBlockForm.value = true
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
  } catch {
    toast.error(editingBlock.value ? 'Failed to update block' : 'Failed to add block')
  } finally {
    isSavingBlock.value = false
  }
}

function confirmDeleteBlock(id: string) {
  const block = store.blocks.find((b) => b.id === id)
  if (!block) return
  deleteTarget.value = block
  showDeleteDialog.value = true
}

async function handleDeleteBlock() {
  if (!deleteTarget.value) return
  isDeleting.value = true
  try {
    await store.deleteBlock(deleteTarget.value.id)
    toast.success('Block deleted')
    showDeleteDialog.value = false
  } catch {
    toast.error('Failed to delete block')
  } finally {
    isDeleting.value = false
  }
}

// --- Availability ---
async function loadAvailability() {
  if (!userId.value) return
  availabilityError.value = null
  try {
    await store.fetchAvailability(userId.value, calendarDateToIso(availabilityDateValue.value))
  } catch {
    availabilityError.value = 'Failed to load availability.'
  }
}

// Tab change handler — lazy load on first visit
const loadedTabs = ref(new Set<string>(['calendar']))

function onTabChange(tab: string) {
  activeTab.value = tab
  if (loadedTabs.value.has(tab)) return
  loadedTabs.value.add(tab)
  if (tab === 'blocks') loadBlocks()
  if (tab === 'availability') loadAvailability()
}

// Real-time appointment updates
const appointmentChannel = computed(() => {
  const clinicId = authStore.currentClinic?.id
  return clinicId ? `clinic:${clinicId}:appointments` : null
})

function onAppointmentEvent() {
  if (calendarRange.start) {
    loadAppointmentsForRange(calendarRange.start, calendarRange.end)
  }
}

onMounted(() => {
  loadSchedule()
  if (appointmentChannel.value) {
    connect()
    subscribe(appointmentChannel.value, onAppointmentEvent)
  }
})

onUnmounted(() => {
  if (appointmentChannel.value) {
    getSubscription(appointmentChannel.value)?.removeListener('publication', onAppointmentEvent)
  }
})
</script>

<template>
  <FeatureGate feature="schedule" label="Schedule">
  <div class="-mx-4 -mb-4 flex min-h-0 flex-1 flex-col gap-0 md:flex-row">
    <!-- Left panel -->
    <div class="hidden shrink-0 flex-col gap-4 border-r p-4 md:flex md:w-72 md:p-5">
      <div class="flex items-center gap-3">
        <div class="flex size-8 items-center justify-center rounded-lg bg-primary/10">
          <CalendarLucide class="size-4 text-primary" />
        </div>
        <div>
          <h1 class="text-sm font-semibold">Schedule</h1>
          <p class="text-xs text-muted-foreground truncate">{{ authStore.user?.name ?? authStore.user?.email ?? '—' }}</p>
        </div>
      </div>

      <!-- Mini calendar for date navigation -->
      <ShadcnCalendar
        v-model="sidebarDate"
        class="rounded-md border p-2"
        @update:model-value="handleSidebarDateChange"
      />

      <Button class="w-full" size="sm" @click="openCreateBlock">
        <Plus class="size-4" />
        Add Block
      </Button>
    </div>

    <!-- Right panel -->
    <div ref="scrollContainerRef" class="flex flex-1 flex-col overflow-y-auto p-4 md:p-8">
      <Tabs default-value="calendar" @update:model-value="onTabChange(String($event))">
        <div class="mb-6 flex flex-wrap items-center gap-3">
          <TabsList class="w-full justify-start sm:w-auto">
            <TabsTrigger value="calendar">Calendar</TabsTrigger>
            <TabsTrigger value="working-hours">Working Hours</TabsTrigger>
            <TabsTrigger value="blocks">Blocks</TabsTrigger>
            <TabsTrigger value="availability">Availability</TabsTrigger>
          </TabsList>
          <Button size="sm" class="ml-auto h-8 md:hidden" @click="openCreateBlock">
            <Plus class="size-3.5" />
            Add Block
          </Button>
        </div>

        <!-- Calendar Preview tab -->
        <TabsContent value="calendar">
          <ScheduleCalendar
            ref="scheduleCalendarRef"
            :schedule="store.schedule"
            :blocks="store.blocks"
            :appointments="calendarAppointments"
            :is-loading="store.isLoadingSchedule"
            @date-range-change="handleCalendarDateRange"
            @block-click="handleCalendarBlockClick"
            @slot-select="handleSlotSelect"
            @appointment-click="handleAppointmentClick"
            @appointment-updated="handleAppointmentUpdated"
          />
        </TabsContent>

        <!-- Working Hours tab -->
        <TabsContent value="working-hours">
          <div v-if="store.isLoadingSchedule" class="flex items-center justify-center py-12">
            <LoaderCircle class="size-6 animate-spin text-muted-foreground" />
          </div>
          <div
            v-else-if="scheduleError"
            role="alert"
            class="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
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
        </TabsContent>

        <!-- Calendar Blocks tab -->
        <TabsContent value="blocks">
          <!-- Block range selector -->
          <div class="mb-4 flex flex-wrap items-center gap-3">
            <Popover>
              <PopoverTrigger as-child>
                <Button variant="outline" class="h-8 justify-start text-left text-sm font-normal">
                  <CalendarIcon class="mr-2 size-3.5 text-muted-foreground" />
                  {{ blockFilterLabel }}
                </Button>
              </PopoverTrigger>
              <PopoverContent class="w-auto p-0" align="start">
                <RangeCalendar v-model="blockFilterRange" :number-of-months="2" />
              </PopoverContent>
            </Popover>
            <Button variant="outline" size="sm" class="h-8" @click="loadBlocks">
              <RefreshCw class="size-3.5" />
              Refresh
            </Button>
            <Button size="sm" class="ml-auto h-8" @click="openCreateBlock">
              <Plus class="size-3.5" />
              Add block
            </Button>
          </div>

          <div
            v-if="blocksError"
            role="alert"
            class="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
          >
            {{ blocksError }}
            <Button variant="outline" size="sm" class="mt-2" @click="loadBlocks">
              <RefreshCw class="size-3.5" />
              Try again
            </Button>
          </div>

          <CalendarBlockList
            :blocks="store.blocks"
            :is-loading="store.isLoadingBlocks"
            :timezone="scheduleTimezone"
            @edit="openEditBlock"
            @delete="confirmDeleteBlock"
          />
        </TabsContent>

        <!-- Availability tab -->
        <TabsContent value="availability">
          <div class="mb-4 flex flex-wrap items-center gap-3">
            <Popover>
              <PopoverTrigger as-child>
                <Button variant="outline" class="h-8 justify-start text-left text-sm font-normal">
                  <CalendarIcon class="mr-2 size-3.5 text-muted-foreground" />
                  {{ availabilityDateLabel }}
                </Button>
              </PopoverTrigger>
              <PopoverContent class="w-auto p-0" align="start">
                <ShadcnCalendar v-model="availabilityDateValue" />
              </PopoverContent>
            </Popover>
            <Button variant="outline" size="sm" class="h-8" @click="loadAvailability">
              <RefreshCw class="size-3.5" />
              Check availability
            </Button>
          </div>

          <div
            v-if="availabilityError"
            role="alert"
            class="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
          >
            {{ availabilityError }}
            <Button variant="outline" size="sm" class="mt-2" @click="loadAvailability">
              <RefreshCw class="size-3.5" />
              Try again
            </Button>
          </div>

          <AvailabilityGrid
            :slots="store.availability?.slots ?? []"
            :is-loading="store.isLoadingAvailability"
          />
        </TabsContent>
      </Tabs>
    </div>
  </div>

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

  <!-- Delete confirmation dialog -->
  <Dialog v-model:open="showDeleteDialog">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Delete Calendar Block</DialogTitle>
        <DialogDescription>
          Are you sure you want to delete <strong>{{ deleteTarget?.title }}</strong>?
          This action cannot be undone.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter class="gap-2 sm:gap-0">
        <Button variant="outline" @click="showDeleteDialog = false">Cancel</Button>
        <Button variant="destructive" :disabled="isDeleting" @click="handleDeleteBlock">
          <LoaderCircle v-if="isDeleting" class="size-4 animate-spin" />
          Delete
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
  <!-- Booking wizard (doctor pre-selected) -->
  <AppointmentBookingWizard
    :open="showBookingWizard"
    :prefill-date-time="prefillDateTime"
    :prefill-doctor-id="userId"
    :prefill-doctor-name="authStore.user?.name ?? ''"
    @update:open="(val) => { showBookingWizard = val; if (!val) prefillDateTime = null }"
    @created="handleAppointmentCreated"
  />

  <!-- Slot action picker -->
  <Dialog v-model:open="showSlotActionPicker">
    <DialogContent class="sm:max-w-xs" @close-auto-focus.prevent>
      <DialogHeader>
        <DialogTitle class="text-sm">What would you like to create?</DialogTitle>
        <p v-if="slotActionDateTime" class="text-xs text-muted-foreground">
          {{ formatSlotTime(slotActionDateTime) }}
        </p>
      </DialogHeader>
      <div class="flex flex-col gap-2">
        <button
          class="flex items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent"
          @click="slotActionBookAppointment"
        >
          <div class="flex size-8 items-center justify-center rounded-full bg-primary/10">
            <CalendarCheck class="size-4 text-primary" />
          </div>
          <div>
            <p class="text-sm font-medium">Book Appointment</p>
            <p class="text-xs text-muted-foreground">Schedule a patient visit</p>
          </div>
        </button>
        <button
          class="flex items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent"
          @click="slotActionAddBlock"
        >
          <div class="flex size-8 items-center justify-center rounded-full bg-amber-500/10">
            <CalendarX class="size-4 text-amber-600" />
          </div>
          <div>
            <p class="text-sm font-medium">Add Time Block</p>
            <p class="text-xs text-muted-foreground">Leave, meeting, or unavailable</p>
          </div>
        </button>
      </div>
    </DialogContent>
  </Dialog>

  <!-- Appointment detail sheet -->
  <AppointmentDetailSheet
    :open="showDetailSheet"
    :appointment="selectedAppointment"
    :can-manage="true"
    @update:open="showDetailSheet = $event"
  />
  </FeatureGate>
</template>
