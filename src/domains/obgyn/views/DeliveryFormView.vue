<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { HttpError } from '@/lib/http'
import {
  ArrowLeft,
  Baby,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  DollarSign,
  HeartPulse,
  LoaderCircle,
  Lock,
  WifiOff,
} from 'lucide-vue-next'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useOfflineSync } from '@/composables/useOfflineSync'
import { RouteNames } from '@/router/routeNames'
import { useAuthStore } from '@/domains/auth/stores/authStore'
import { useEncounterStore } from '@/domains/encounter/stores/encounterStore'
import { useEncounterSync } from '@/domains/encounter/composables/useEncounterSync'
import { usePatientSync } from '@/domains/patient/composables/usePatientSync'
import PaymentTab from '@/domains/consultation/components/tabs/PaymentTab.vue'
import ProcedureSection from '@/domains/service/components/ProcedureSection.vue'
import MFDatePicker from '@/components/shared/MFDatePicker.vue'
import type {
  DeliveryLabor,
  DeliveryMaternal,
  DeliveryNeonatal,
  DeliveryOutcome,
} from '@/domains/encounter/types/encounter.types'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const store = useEncounterStore()
const { isOnline, pendingCount } = useOfflineSync()

const encounterId = computed(() => store.current?.id)
const clinicId = computed(() => store.current?.clinic_id)
const patientId = computed(() => store.current?.patient_id)
const { documentUpdate } = useEncounterSync(encounterId, clinicId)
usePatientSync(patientId, clinicId, () => {})

const canFinalize = computed(() => authStore.hasPermission('encounters.finalize'))

const loadError = ref<string | null>(null)
const showFinalizeModal = ref(false)

// ── Local state for each section ────────────────────────────────────

const localLabor = ref<DeliveryLabor>({
  onset_type: null,
  labor_start: null,
  labor_duration_hours: null,
  induction_method: null,
  augmentation: null,
})

const localDelivery = ref<DeliveryOutcome>({
  delivery_datetime: null,
  delivery_mode: null,
  indication_for_intervention: null,
  laceration_degree: null,
})

const localMaternal = ref<DeliveryMaternal>({
  blood_loss_ml: null,
  complications: [],
  blood_transfusion_required: false,
  maternal_outcome: null,
})

const localNeonatal = ref<DeliveryNeonatal>({
  birth_weight_grams: null,
  birth_gender: null,
  apgar_1min: null,
  apgar_5min: null,
  apgar_10min: null,
  cord_ph: null,
  complications: [],
  resuscitation_required: false,
  neonatal_outcome: null,
})

const localNotes = ref<string>('')

// Sync local state when store data loads or changes
watch(
  () => store.current?.delivery_record,
  (record) => {
    if (!record) return
    localLabor.value = { ...record.labor }
    localDelivery.value = { ...record.delivery }
    localMaternal.value = { ...record.maternal, complications: [...record.maternal.complications] }
    localNeonatal.value = { ...record.neonatal, complications: [...record.neonatal.complications] }
    localNotes.value = record.notes ?? ''
  },
  { immediate: true },
)

// ── Maternal complication options ───────────────────────────────────

const maternalComplicationOptions = [
  { value: 'postpartum_hemorrhage', label: 'Postpartum Hemorrhage' },
  { value: 'infection', label: 'Infection' },
  { value: 'anesthesia_complication', label: 'Anesthesia Complication' },
  { value: 'uterine_rupture', label: 'Uterine Rupture' },
  { value: 'other', label: 'Other' },
] as const

const neonatalComplicationOptions = [
  { value: 'meconium_aspiration', label: 'Meconium Aspiration' },
  { value: 'respiratory_distress', label: 'Respiratory Distress' },
  { value: 'low_apgar', label: 'Low Apgar Score' },
  { value: 'birth_trauma', label: 'Birth Trauma' },
  { value: 'other', label: 'Other' },
] as const

// ── Complication checkbox helpers ───────────────────────────────────

function toggleMaternalComplication(value: string, checked: boolean): void {
  if (checked) {
    if (!localMaternal.value.complications.includes(value)) {
      localMaternal.value.complications = [...localMaternal.value.complications, value]
    }
  } else {
    localMaternal.value.complications = localMaternal.value.complications.filter((c) => c !== value)
  }
}

function toggleNeonatalComplication(value: string, checked: boolean): void {
  if (checked) {
    if (!localNeonatal.value.complications.includes(value)) {
      localNeonatal.value.complications = [...localNeonatal.value.complications, value]
    }
  } else {
    localNeonatal.value.complications = localNeonatal.value.complications.filter((c) => c !== value)
  }
}

// ── Apgar color coding ──────────────────────────────────────────────

function apgarColor(score: number | null): string {
  if (score === null) return ''
  if (score >= 7) return 'text-green-600'
  if (score >= 4) return 'text-yellow-600'
  return 'text-red-600'
}

// ── Save handlers ───────────────────────────────────────────────────

async function saveLaborSection(): Promise<void> {
  await store.saveSection({ labor: { ...localLabor.value } })
}

async function saveDeliverySection(): Promise<void> {
  await store.saveSection({ delivery: { ...localDelivery.value } })
}

async function saveMaternalSection(): Promise<void> {
  await store.saveSection({ maternal: { ...localMaternal.value } })
}

async function saveNeonatalSection(): Promise<void> {
  await store.saveSection({
    neonatal: { ...localNeonatal.value },
    notes: localNotes.value,
  })
}

// ── Tab navigation ──────────────────────────────────────────────────

const activeTab = ref<string>('labor')
const allTabs = ['labor', 'delivery', 'neonatal', 'billing'] as const
type TabKey = (typeof allTabs)[number]

const tabLabels: Record<TabKey, string> = {
  labor: 'Labor',
  delivery: 'Delivery',
  neonatal: 'Neonatal',
  billing: 'Billing',
}

const tabIcons: Record<TabKey, Component> = {
  labor: ClipboardList,
  delivery: Baby,
  neonatal: HeartPulse,
  billing: DollarSign,
}

const currentTabIndex = computed(() => allTabs.indexOf(activeTab.value as TabKey))

const prevTabLabel = computed(() => {
  const idx = currentTabIndex.value - 1
  return idx >= 0 ? tabLabels[allTabs[idx]!] : null
})
const nextTabLabel = computed(() => {
  const idx = currentTabIndex.value + 1
  return idx < allTabs.length ? tabLabels[allTabs[idx]!] : null
})
function goToTab(direction: 'prev' | 'next'): void {
  const idx = currentTabIndex.value + (direction === 'next' ? 1 : -1)
  const tab = allTabs[idx]
  if (tab) activeTab.value = tab
}

// ── Datetime helpers (split date + time from "YYYY-MM-DDTHH:mm") ───
function getDatePart(dt: string | null): string {
  return dt?.split('T')[0] ?? ''
}
function getTimePart(dt: string | null): string {
  return dt?.split('T')[1]?.slice(0, 5) ?? ''
}
function combineDatetime(date: string, time: string): string | null {
  if (!date) return null
  return `${date}T${time || '00:00'}`
}

// ── Delivery date constraints (labor start → labor start + 7 days) ──
const deliveryMinDate = computed(() => getDatePart(localLabor.value.labor_start) || null)
const deliveryMaxDate = computed(() => {
  const start = getDatePart(localLabor.value.labor_start)
  if (!start) return null
  const d = new Date(start + 'T00:00')
  d.setDate(d.getDate() + 7)
  return d.toISOString().slice(0, 10)
})

// ── Floating mini tabs ──────────────────────────────────────────────

const tabsListRef = ref<HTMLElement | null>(null)
const formScrollRef = ref<HTMLElement | null>(null)
const showMiniTabs = ref(false)
let tabsObserver: IntersectionObserver | null = null

function setupTabsObserver() {
  // Use a short delay to ensure layout is stable before observing
  setTimeout(() => {
    const tabsEl = tabsListRef.value
    const scrollEl = formScrollRef.value
    if (!tabsEl || !scrollEl) return
    tabsObserver = new IntersectionObserver(
      ([entry]) => { showMiniTabs.value = !entry!.isIntersecting },
      { root: scrollEl, threshold: 0 },
    )
    tabsObserver.observe(tabsEl)
  }, 300)
}

// ── Lifecycle ───────────────────────────────────────────────────────

onMounted(async () => {
  loadError.value = null
  try {
    if (route.name === RouteNames.ENCOUNTER_NEW) {
      const pid = route.params.patientId
      const resolvedPatientId = typeof pid === 'string' ? pid : (Array.isArray(pid) ? pid[0] ?? '' : '')
      const pregnancyId =
        typeof route.query.pregnancyId === 'string' ? route.query.pregnancyId : undefined
      const encounter = await store.createForPatient(resolvedPatientId, 'default', {
        encounterType: 'delivery',
        pregnancyId,
      })
      await router.replace({
        name: RouteNames.ENCOUNTER_DETAIL,
        params: { patientId: resolvedPatientId, id: encounter.id },
      })
    } else {
      const id = route.params.id
      const resolvedId = typeof id === 'string' ? id : (Array.isArray(id) ? id[0] ?? '' : '')
      await store.loadEncounter(resolvedId)
    }
  } catch (err) {
    if (err instanceof HttpError && err.status === 403) {
      loadError.value = "You don't have permission to access this delivery record."
    } else {
      loadError.value = 'Failed to load delivery record. Please try again.'
    }
  }
  setupTabsObserver()
})

onUnmounted(() => {
  tabsObserver?.disconnect()
  tabsObserver = null
  store.clearCurrent()
})

// ── Finalization ────────────────────────────────────────────────────

async function handleFinalizeConfirm(): Promise<void> {
  await store.finalize()
  if (!store.saveError) {
    showFinalizeModal.value = false
  }
}

async function handleFinalizeAndBilling(): Promise<void> {
  await store.finalize()
  if (!store.saveError) {
    activeTab.value = 'billing'
  }
}
</script>

<template>
  <div v-if="store.isLoading && !store.current" class="flex flex-1 items-center justify-center py-12">
    <LoaderCircle class="size-6 animate-spin text-muted-foreground" />
  </div>

  <div
    v-else-if="loadError"
    role="alert"
    class="mx-auto max-w-md rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
  >
    {{ loadError }}
  </div>

  <Tabs
    v-else-if="store.current"
    v-model="activeTab"
    size="lg"
    class="-mx-4 -mb-4 flex min-h-0 flex-1 flex-col overflow-hidden"
  >
    <!-- Sticky header -->
    <div class="sticky top-0 z-10 border-b bg-background">
      <div class="flex flex-col gap-2 px-4 pb-1 pt-2 sm:flex-row sm:items-center sm:justify-between">
        <!-- Left: back + patient name + status badge -->
        <div class="flex items-center gap-2">
          <Button variant="ghost" size="sm" class="gap-1.5" @click="router.back()">
            <ArrowLeft class="size-3.5" />
            {{ store.current.patient_name }}
          </Button>
          <Badge variant="secondary">
            <Baby class="size-3" />
            Delivery Record
          </Badge>
          <Badge
            v-if="store.isDraft"
            class="border-amber-300 bg-amber-100 text-amber-700 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-400"
            variant="outline"
          >
            Draft
          </Badge>
          <Badge
            v-else-if="store.isFinalized"
            class="border-green-300 bg-green-100 text-green-700 dark:border-green-700 dark:bg-green-950 dark:text-green-400"
            variant="outline"
          >
            <CheckCircle2 class="size-3" />
            Finalized
          </Badge>
        </div>

        <!-- Right: draft actions -->
        <div v-if="store.isDraft" class="flex items-center gap-2">
          <p v-if="store.isSaving" class="text-xs text-muted-foreground">
            Saving...
          </p>
          <p v-else-if="store.saveError" class="text-xs text-destructive">
            {{ store.saveError }}
          </p>
          <Button
            variant="outline"
            size="sm"
            :disabled="store.isSaving"
            @click="store.saveSection({})"
          >
            <LoaderCircle v-if="store.isSaving" class="size-3.5 animate-spin" />
            <ClipboardList v-else class="size-3.5" />
            Save
          </Button>
          <Button
            v-if="canFinalize"
            size="sm"
            :disabled="store.isSaving"
            @click="showFinalizeModal = true"
          >
            <CheckCircle2 class="size-3.5" />
            Finalize
          </Button>
        </div>
      </div>
    </div>

    <!-- Two-column layout wrapper (single column — no sidebar on delivery) -->
    <div class="relative flex min-h-0 flex-1 flex-col">
      <!-- Floating mini tabs (positioned over the form) -->
      <Transition
        enter-active-class="transition-all duration-300 ease-out"
        enter-from-class="-translate-y-3 opacity-0"
        enter-to-class="translate-y-0 opacity-100"
        leave-active-class="transition-all duration-200 ease-in"
        leave-from-class="translate-y-0 opacity-100"
        leave-to-class="-translate-y-3 opacity-0"
      >
        <div
          v-if="showMiniTabs"
          class="pointer-events-none absolute inset-x-0 top-2 z-30 flex"
        >
          <div class="pointer-events-auto mx-auto flex items-center gap-1 rounded-full border bg-background/95 px-2 py-1 shadow-md backdrop-blur">
            <button
              v-for="tab in allTabs"
              :key="tab"
              type="button"
              class="flex h-7 items-center justify-center gap-1.5 rounded-full px-2 text-[10px] font-medium transition-all duration-200"
              :class="activeTab === tab
                ? 'bg-primary text-primary-foreground min-w-[4.5rem]'
                : 'text-muted-foreground hover:bg-muted min-w-7 max-w-7'"
              @click="activeTab = tab"
            >
              <component :is="tabIcons[tab]" class="size-3.5 shrink-0" />
              <span
                class="overflow-hidden whitespace-nowrap transition-all duration-200"
                :class="activeTab === tab ? 'max-w-[4rem] opacity-100' : 'max-w-0 opacity-0'"
              >{{ tabLabels[tab] }}</span>
            </button>
          </div>
        </div>
      </Transition>

      <!-- Scrollable form area -->
      <div ref="formScrollRef" class="min-h-0 min-w-0 flex-1 overflow-y-auto px-4 pb-4 pt-0 md:px-6 md:pb-8">

        <!-- Hidden TabsList for reka-ui accessibility -->
        <TabsList class="sr-only">
          <TabsTrigger v-for="tab in allTabs" :key="tab" :value="tab">{{ tabLabels[tab] }}</TabsTrigger>
        </TabsList>

        <div class="mx-auto max-w-4xl">

        <!-- Circle stepper -->
        <div ref="tabsListRef" class="mb-5 py-3">
          <div class="relative px-0 md:px-8">
            <!-- Connector line -->
            <div class="absolute top-5 left-5 right-5 h-0.5 bg-border">
              <div
                class="absolute inset-y-0 left-0 bg-primary/40 transition-all duration-500 ease-in-out"
                :style="{ width: allTabs.length > 1 ? `${(currentTabIndex / (allTabs.length - 1)) * 100}%` : '0%' }"
              />
            </div>
            <!-- Step circles -->
            <div class="relative flex justify-between">
              <button
                v-for="tab in allTabs"
                :key="tab"
                type="button"
                class="flex flex-col items-center gap-1.5"
                @click="activeTab = tab"
              >
                <div
                  class="flex size-10 items-center justify-center rounded-full border-2 transition-all duration-300"
                  :class="activeTab === tab
                    ? 'border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/25 scale-110'
                    : allTabs.indexOf(tab) < currentTabIndex
                      ? 'border-primary bg-background text-primary hover:scale-105 scale-100'
                      : 'border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground hover:scale-105 scale-100'"
                >
                  <component :is="tabIcons[tab]" class="size-4.5" />
                </div>
                <span
                  class="text-xs font-medium transition-colors duration-200"
                  :class="activeTab === tab ? 'text-primary' : 'text-muted-foreground'"
                >
                  {{ tabLabels[tab] }}
                </span>
              </button>
            </div>
          </div>
        </div>

        <!-- Offline banner -->
        <div
          v-if="!isOnline"
          class="mb-3 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400"
        >
          <WifiOff class="size-3.5 shrink-0" />
          You are offline. Changes will be saved locally and synced when you reconnect.
          <span v-if="pendingCount" class="ml-auto text-xs font-medium">
            {{ pendingCount }} pending
          </span>
        </div>

        <!-- Read-only banner -->
        <div
          v-if="store.isFinalized"
          class="mb-3 flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground"
        >
          <Lock class="size-3.5 shrink-0" />
          This delivery record has been finalized and is read-only.
        </div>

          <!-- ── Labor Tab ─────────────────────────────────────────── -->
          <TabsContent value="labor" class="mt-0 flex flex-col divide-y divide-dashed divide-border px-0 md:px-8 [&>*]:py-8 [&>*:first-child]:pt-0 [&>*:last-child]:pb-0 [&>*:last-child]:border-t-0">

            <!-- Labor Information -->
            <div class="flex flex-col gap-4">
              <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Labor Information</h3>
              <div class="grid gap-4 sm:grid-cols-2">

                <!-- Onset type -->
                <div class="flex flex-col gap-1.5">
                  <Label class="flex items-center gap-1.5 text-xs text-muted-foreground">
                    Onset Type
                  </Label>
                  <Select
                    :model-value="localLabor.onset_type ?? ''"
                    :disabled="store.isFinalized"
                    @update:model-value="(v) => { localLabor.onset_type = v as DeliveryLabor['onset_type'] || null; saveLaborSection() }"
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select onset type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="spontaneous">Spontaneous</SelectItem>
                      <SelectItem value="induced">Induced</SelectItem>
                      <SelectItem value="elective_cesarean">Elective Cesarean</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <!-- Labor start -->
                <div class="flex flex-col gap-1.5">
                  <Label class="text-xs text-muted-foreground">Labor Start Date</Label>
                  <MFDatePicker
                    :model-value="getDatePart(localLabor.labor_start)"
                    :disabled="store.isFinalized"
                    placeholder="Select date"
                    @update:model-value="(v) => { localLabor.labor_start = combineDatetime(v ?? '', getTimePart(localLabor.labor_start)); saveLaborSection() }"
                  />
                </div>
                <div class="flex flex-col gap-1.5">
                  <Label class="text-xs text-muted-foreground">Labor Start Time</Label>
                  <Input
                    type="time"
                    :model-value="getTimePart(localLabor.labor_start)"
                    :disabled="store.isFinalized"
                    @update:model-value="(v) => { localLabor.labor_start = combineDatetime(getDatePart(localLabor.labor_start), String(v)) }"
                    @blur="saveLaborSection"
                  />
                </div>

                <!-- Labor duration -->
                <div class="flex flex-col gap-1.5">
                  <Label class="flex items-center gap-1.5 text-xs text-muted-foreground">
                    Labor Duration (hours)
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.5"
                    placeholder="e.g. 8"
                    :model-value="localLabor.labor_duration_hours ?? ''"
                    :disabled="store.isFinalized"
                    @update:model-value="(v) => { localLabor.labor_duration_hours = v !== '' ? Number(v) : null }"
                    @blur="saveLaborSection"
                  />
                </div>

                <!-- Augmentation -->
                <div class="flex flex-col gap-1.5 sm:col-span-2">
                  <Label class="flex items-center gap-1.5 text-xs text-muted-foreground">
                    Augmentation
                  </Label>
                  <Textarea
                    placeholder="Describe augmentation used, if any..."
                    :model-value="localLabor.augmentation ?? ''"
                    :disabled="store.isFinalized"
                    rows="2"
                    @update:model-value="(v) => { localLabor.augmentation = String(v) || null }"
                    @blur="saveLaborSection"
                  />
                </div>

                <!-- Induction method (conditional) -->
                <div
                  v-if="localLabor.onset_type === 'induced'"
                  class="flex flex-col gap-1.5 sm:col-span-2"
                >
                  <Label class="flex items-center gap-1.5 text-xs text-muted-foreground">
                    Induction Method
                  </Label>
                  <Textarea
                    placeholder="Describe induction method used..."
                    :model-value="localLabor.induction_method ?? ''"
                    :disabled="store.isFinalized"
                    rows="2"
                    @update:model-value="(v) => { localLabor.induction_method = String(v) || null }"
                    @blur="saveLaborSection"
                  />
                </div>

              </div>
            </div>

            <!-- Navigation -->
            <div class="flex justify-end">
              <Button variant="outline" @click="goToTab('next')">
                {{ nextTabLabel }}
                <ChevronRight class="ml-1 size-4" />
              </Button>
            </div>
          </TabsContent>

          <!-- ── Delivery Tab ──────────────────────────────────────── -->
          <TabsContent value="delivery" class="mt-0 flex flex-col divide-y divide-dashed divide-border px-0 md:px-8 [&>*]:py-8 [&>*:first-child]:pt-0 [&>*:last-child]:pb-0 [&>*:last-child]:border-t-0">

            <!-- Delivery Outcome -->
            <div class="flex flex-col gap-4">
              <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Delivery Outcome</h3>
              <div class="grid gap-4 sm:grid-cols-2">

                <!-- Delivery date & time -->
                <div class="flex flex-col gap-1.5">
                  <Label class="text-xs text-muted-foreground">Delivery Date</Label>
                  <MFDatePicker
                    :model-value="getDatePart(localDelivery.delivery_datetime)"
                    :disabled="store.isFinalized"
                    :min-date="deliveryMinDate"
                    :max-date="deliveryMaxDate"
                    placeholder="Select date"
                    @update:model-value="(v) => { localDelivery.delivery_datetime = combineDatetime(v ?? '', getTimePart(localDelivery.delivery_datetime)); saveDeliverySection() }"
                  />
                </div>
                <div class="flex flex-col gap-1.5">
                  <Label class="text-xs text-muted-foreground">Delivery Time</Label>
                  <Input
                    type="time"
                    :model-value="getTimePart(localDelivery.delivery_datetime)"
                    :disabled="store.isFinalized"
                    @update:model-value="(v) => { localDelivery.delivery_datetime = combineDatetime(getDatePart(localDelivery.delivery_datetime), String(v)) }"
                    @blur="saveDeliverySection"
                  />
                </div>

                <!-- Delivery mode -->
                <div class="flex flex-col gap-1.5">
                  <Label class="flex items-center gap-1.5 text-xs text-muted-foreground">
                    Delivery Mode
                  </Label>
                  <Select
                    :model-value="localDelivery.delivery_mode ?? ''"
                    :disabled="store.isFinalized"
                    @update:model-value="(v) => { localDelivery.delivery_mode = v as DeliveryOutcome['delivery_mode'] || null; saveDeliverySection() }"
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select delivery mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vaginal_spontaneous">Vaginal Spontaneous</SelectItem>
                      <SelectItem value="vacuum">Vacuum-Assisted</SelectItem>
                      <SelectItem value="forceps">Forceps-Assisted</SelectItem>
                      <SelectItem value="cesarean">Cesarean Section</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <!-- Indication for intervention (conditional) -->
                <div
                  v-if="localDelivery.delivery_mode && localDelivery.delivery_mode !== 'vaginal_spontaneous'"
                  class="flex flex-col gap-1.5 sm:col-span-2"
                >
                  <Label class="flex items-center gap-1.5 text-xs text-muted-foreground">
                    Indication for Intervention
                  </Label>
                  <Textarea
                    placeholder="Describe the clinical indication..."
                    :model-value="localDelivery.indication_for_intervention ?? ''"
                    :disabled="store.isFinalized"
                    rows="2"
                    @update:model-value="(v) => { localDelivery.indication_for_intervention = String(v) || null }"
                    @blur="saveDeliverySection"
                  />
                </div>

                <!-- Laceration degree (conditional: not cesarean) -->
                <div
                  v-if="localDelivery.delivery_mode && localDelivery.delivery_mode !== 'cesarean'"
                  class="flex flex-col gap-1.5"
                >
                  <Label class="flex items-center gap-1.5 text-xs text-muted-foreground">
                    Laceration Degree
                  </Label>
                  <Select
                    :model-value="localDelivery.laceration_degree ?? ''"
                    :disabled="store.isFinalized"
                    @update:model-value="(v) => { localDelivery.laceration_degree = v as DeliveryOutcome['laceration_degree'] || null; saveDeliverySection() }"
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select degree" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="1st">1st Degree</SelectItem>
                      <SelectItem value="2nd">2nd Degree</SelectItem>
                      <SelectItem value="3rd">3rd Degree</SelectItem>
                      <SelectItem value="4th">4th Degree</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

              </div>
            </div>

            <!-- Maternal Status -->
            <div class="flex flex-col gap-4">
              <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Maternal Status</h3>
              <div class="grid gap-4 sm:grid-cols-2">

                <!-- Blood loss -->
                <div class="flex flex-col gap-1.5">
                  <Label class="flex items-center gap-1.5 text-xs text-muted-foreground">
                    Estimated Blood Loss (ml)
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    step="10"
                    placeholder="e.g. 300"
                    :model-value="localMaternal.blood_loss_ml ?? ''"
                    :disabled="store.isFinalized"
                    @update:model-value="(v) => { localMaternal.blood_loss_ml = v !== '' ? Number(v) : null }"
                    @blur="saveMaternalSection"
                  />
                </div>

                <!-- Maternal outcome -->
                <div class="flex flex-col gap-1.5">
                  <Label class="flex items-center gap-1.5 text-xs text-muted-foreground">
                    Maternal Outcome
                  </Label>
                  <Select
                    :model-value="localMaternal.maternal_outcome ?? ''"
                    :disabled="store.isFinalized"
                    @update:model-value="(v) => { localMaternal.maternal_outcome = v as DeliveryMaternal['maternal_outcome'] || null; saveMaternalSection() }"
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select outcome" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="good">Good</SelectItem>
                      <SelectItem value="morbidity">Morbidity</SelectItem>
                      <SelectItem value="mortality">Mortality</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <!-- Complications -->
                <div class="flex flex-col gap-2 sm:col-span-2">
                  <Label class="text-xs text-muted-foreground">Maternal Complications</Label>
                  <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <label
                      v-for="opt in maternalComplicationOptions"
                      :key="opt.value"
                      class="flex cursor-pointer items-center gap-2 text-sm"
                      :class="{ 'opacity-60': store.isFinalized }"
                    >
                      <Checkbox
                        :model-value="localMaternal.complications.includes(opt.value)"
                        :disabled="store.isFinalized"
                        @update:model-value="(checked) => { toggleMaternalComplication(opt.value, !!checked); saveMaternalSection() }"
                      />
                      {{ opt.label }}
                    </label>
                  </div>
                </div>

                <!-- Blood transfusion -->
                <div class="flex flex-col gap-2 sm:col-span-2">
                  <label class="flex cursor-pointer items-center gap-2 text-sm" :class="{ 'opacity-60': store.isFinalized }">
                    <Checkbox
                      :model-value="localMaternal.blood_transfusion_required"
                      :disabled="store.isFinalized"
                      @update:model-value="(checked) => { localMaternal.blood_transfusion_required = !!checked; saveMaternalSection() }"
                    />
                    Blood transfusion required
                  </label>
                </div>

              </div>
            </div>

            <!-- Navigation -->
            <div class="flex items-center justify-between">
              <Button variant="outline" @click="goToTab('prev')">
                <ChevronLeft class="mr-1 size-4" />
                {{ prevTabLabel }}
              </Button>
              <Button variant="outline" @click="goToTab('next')">
                {{ nextTabLabel }}
                <ChevronRight class="ml-1 size-4" />
              </Button>
            </div>
          </TabsContent>

          <!-- ── Neonatal Tab ──────────────────────────────────────── -->
          <TabsContent value="neonatal" class="mt-0 flex flex-col divide-y divide-dashed divide-border px-0 md:px-8 [&>*]:py-8 [&>*:first-child]:pt-0 [&>*:last-child]:pb-0 [&>*:last-child]:border-t-0">

            <!-- Newborn Information -->
            <div class="flex flex-col gap-4">
              <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Newborn Information</h3>
              <div class="grid gap-4 sm:grid-cols-2">

                <!-- Birth weight -->
                <div class="flex flex-col gap-1.5">
                  <Label class="flex items-center gap-1.5 text-xs text-muted-foreground">
                    Birth Weight (grams)
                  </Label>
                  <Input
                    type="number"
                    min="200"
                    step="1"
                    placeholder="e.g. 3200"
                    :model-value="localNeonatal.birth_weight_grams ?? ''"
                    :disabled="store.isFinalized"
                    @update:model-value="(v) => { localNeonatal.birth_weight_grams = v !== '' ? Number(v) : null }"
                    @blur="saveNeonatalSection"
                  />
                </div>

                <!-- Birth gender -->
                <div class="flex flex-col gap-1.5">
                  <Label class="flex items-center gap-1.5 text-xs text-muted-foreground">
                    Birth Gender
                  </Label>
                  <Select
                    :model-value="localNeonatal.birth_gender ?? ''"
                    :disabled="store.isFinalized"
                    @update:model-value="(v) => { localNeonatal.birth_gender = v as 'M' | 'F' || null; saveNeonatalSection() }"
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="M">Male</SelectItem>
                      <SelectItem value="F">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

              </div>
            </div>

            <!-- Apgar Scores -->
            <div class="flex flex-col gap-4">
              <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Apgar Scores</h3>
              <div class="grid gap-4 sm:grid-cols-3">

                <div class="flex flex-col gap-1.5">
                  <Label class="flex items-center gap-1.5 text-xs text-muted-foreground">
                    1 Minute
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    max="10"
                    step="1"
                    placeholder="0–10"
                    :class="apgarColor(localNeonatal.apgar_1min)"
                    :model-value="localNeonatal.apgar_1min ?? ''"
                    :disabled="store.isFinalized"
                    @update:model-value="(v) => { localNeonatal.apgar_1min = v !== '' ? Math.min(10, Math.max(0, Number(v))) : null }"
                    @blur="saveNeonatalSection"
                  />
                </div>

                <div class="flex flex-col gap-1.5">
                  <Label class="flex items-center gap-1.5 text-xs text-muted-foreground">
                    5 Minutes
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    max="10"
                    step="1"
                    placeholder="0–10"
                    :class="apgarColor(localNeonatal.apgar_5min)"
                    :model-value="localNeonatal.apgar_5min ?? ''"
                    :disabled="store.isFinalized"
                    @update:model-value="(v) => { localNeonatal.apgar_5min = v !== '' ? Math.min(10, Math.max(0, Number(v))) : null }"
                    @blur="saveNeonatalSection"
                  />
                </div>

                <div class="flex flex-col gap-1.5">
                  <Label class="flex items-center gap-1.5 text-xs text-muted-foreground">
                    10 Minutes
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    max="10"
                    step="1"
                    placeholder="0–10"
                    :class="apgarColor(localNeonatal.apgar_10min)"
                    :model-value="localNeonatal.apgar_10min ?? ''"
                    :disabled="store.isFinalized"
                    @update:model-value="(v) => { localNeonatal.apgar_10min = v !== '' ? Math.min(10, Math.max(0, Number(v))) : null }"
                    @blur="saveNeonatalSection"
                  />
                </div>

              </div>
            </div>

            <!-- Neonatal Status -->
            <div class="flex flex-col gap-4">
              <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Neonatal Status</h3>
              <div class="grid gap-4 sm:grid-cols-2">

                <!-- Cord pH -->
                <div class="flex flex-col gap-1.5">
                  <Label class="flex items-center gap-1.5 text-xs text-muted-foreground">
                    Cord pH
                  </Label>
                  <Input
                    type="number"
                    min="6.5"
                    max="8"
                    step="0.01"
                    placeholder="e.g. 7.25"
                    :model-value="localNeonatal.cord_ph ?? ''"
                    :disabled="store.isFinalized"
                    @update:model-value="(v) => { localNeonatal.cord_ph = v !== '' ? Number(v) : null }"
                    @blur="saveNeonatalSection"
                  />
                </div>

                <!-- Neonatal outcome -->
                <div class="flex flex-col gap-1.5">
                  <Label class="flex items-center gap-1.5 text-xs text-muted-foreground">
                    Neonatal Outcome
                  </Label>
                  <Select
                    :model-value="localNeonatal.neonatal_outcome ?? ''"
                    :disabled="store.isFinalized"
                    @update:model-value="(v) => { localNeonatal.neonatal_outcome = v as DeliveryNeonatal['neonatal_outcome'] || null; saveNeonatalSection() }"
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select outcome" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="live_birth_well">Live Birth — Well</SelectItem>
                      <SelectItem value="live_birth_complication">Live Birth — Complication</SelectItem>
                      <SelectItem value="stillbirth">Stillbirth</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <!-- Neonatal complications -->
                <div class="flex flex-col gap-2 sm:col-span-2">
                  <Label class="text-xs text-muted-foreground">Neonatal Complications</Label>
                  <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <label
                      v-for="opt in neonatalComplicationOptions"
                      :key="opt.value"
                      class="flex cursor-pointer items-center gap-2 text-sm"
                      :class="{ 'opacity-60': store.isFinalized }"
                    >
                      <Checkbox
                        :model-value="localNeonatal.complications.includes(opt.value)"
                        :disabled="store.isFinalized"
                        @update:model-value="(checked) => { toggleNeonatalComplication(opt.value, !!checked); saveNeonatalSection() }"
                      />
                      {{ opt.label }}
                    </label>
                  </div>
                </div>

                <!-- Resuscitation required -->
                <div class="flex flex-col gap-2 sm:col-span-2">
                  <label class="flex cursor-pointer items-center gap-2 text-sm" :class="{ 'opacity-60': store.isFinalized }">
                    <Checkbox
                      :model-value="localNeonatal.resuscitation_required"
                      :disabled="store.isFinalized"
                      @update:model-value="(checked) => { localNeonatal.resuscitation_required = !!checked; saveNeonatalSection() }"
                    />
                    Resuscitation required
                  </label>
                </div>

              </div>
            </div>

            <!-- Notes -->
            <div class="flex flex-col gap-4">
              <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Notes</h3>
              <Textarea
                placeholder="Additional notes about the delivery encounter..."
                :model-value="localNotes"
                :disabled="store.isFinalized"
                rows="4"
                @update:model-value="(v) => { localNotes = String(v) }"
                @blur="saveNeonatalSection"
              />
            </div>

            <!-- Navigation -->
            <div class="flex items-center justify-between">
              <Button variant="outline" @click="goToTab('prev')">
                <ChevronLeft class="mr-1 size-4" />
                {{ prevTabLabel }}
              </Button>
              <div class="flex items-center gap-2">
                <Button
                  v-if="store.isDraft && canFinalize"
                  size="sm"
                  :disabled="store.isSaving"
                  @click="handleFinalizeAndBilling"
                >
                  <LoaderCircle v-if="store.isSaving" class="size-3.5 animate-spin" />
                  <CheckCircle2 v-else class="size-3.5" />
                  Finalize & Billing
                  <ChevronRight class="ml-1 size-4" />
                </Button>
                <Button v-else variant="outline" @click="goToTab('next')">
                  {{ nextTabLabel }}
                  <ChevronRight class="ml-1 size-4" />
                </Button>
              </div>
            </div>
          </TabsContent>

          <!-- ── Billing Tab ───────────────────────────────────────── -->
          <TabsContent value="billing" class="mt-0 flex flex-col gap-5 px-0 md:px-8">
            <div class="mb-6">
              <ProcedureSection
                :encounter-id="store.current.id"
                :procedures="store.current.procedures ?? []"
                :disabled="store.isFinalized"
                @update="(p) => { if (store.current) store.current.procedures = p }"
              />
            </div>
            <PaymentTab
              :disabled="store.isFinalized"
              :encounter-id="store.current.id"
              :status="store.current.status"
              :consultation-type="store.current.consultation?.type ?? 'default'"
              :patient-id="store.current.patient_id"
              :diagnoses="[]"
              :document-update="documentUpdate"
              :consumables="store.current.consumables ?? []"
              :procedures="store.current.procedures ?? []"
              :prescription-summary="store.current.prescription_summary"
              :lab-order-summary="store.current.lab_order_summary"
              :payment="store.current.payment"
              :can-finalize="store.isDraft && canFinalize"
              :is-saving="store.isSaving"
              encounter-type="delivery"
              :delivery-mode="localDelivery.delivery_mode"
              @update:payment="(p) => { if (store.current) store.current.payment = p }"
              @finalize="handleFinalizeAndBilling"
            />
            <div class="mt-5 flex justify-start">
              <Button variant="outline" @click="goToTab('prev')">
                <ChevronLeft class="mr-1 size-4" />
                {{ prevTabLabel }}
              </Button>
            </div>
          </TabsContent>

        </div>
      </div>
    </div>

    <!-- Finalize confirmation dialog -->
    <Dialog :open="showFinalizeModal" @update:open="showFinalizeModal = $event">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <CheckCircle2 class="size-5 text-green-600" />
            Finalize Delivery Record
          </DialogTitle>
          <DialogDescription>
            This will lock the delivery record and make it read-only. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter class="gap-2 sm:gap-0">
          <Button
            variant="outline"
            :disabled="store.isSaving"
            @click="showFinalizeModal = false"
          >
            Cancel
          </Button>
          <Button
            :disabled="store.isSaving"
            @click="handleFinalizeConfirm"
          >
            <LoaderCircle v-if="store.isSaving" class="size-3.5 animate-spin" />
            <CheckCircle2 v-else class="size-3.5" />
            {{ store.isSaving ? 'Finalizing...' : 'Finalize' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

  </Tabs>
</template>
