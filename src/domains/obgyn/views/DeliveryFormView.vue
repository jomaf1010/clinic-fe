<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
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
import { Separator } from '@/components/ui/separator'
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

const canFinalize = computed(() => authStore.hasPermission('consultations.finalize'))

const activeTab = ref('labor')
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

const allTabs = ['labor', 'delivery', 'neonatal', 'billing'] as const
const tabLabels: Record<string, string> = {
  labor: 'Labor',
  delivery: 'Delivery',
  neonatal: 'Neonatal',
  billing: 'Billing',
}
const currentTabIndex = computed(() =>
  allTabs.indexOf(activeTab.value as (typeof allTabs)[number]),
)
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
})

onUnmounted(() => {
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
    class="-mx-4 flex flex-1 flex-col"
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

    <!-- Tab triggers -->
    <TabsList class="w-full justify-start overflow-x-auto overflow-y-hidden px-4">
      <TabsTrigger value="labor">
        <HeartPulse class="size-4" />
        Labor
      </TabsTrigger>
      <TabsTrigger value="delivery">
        <Baby class="size-4" />
        Delivery
      </TabsTrigger>
      <TabsTrigger value="neonatal">
        <HeartPulse class="size-4" />
        Neonatal
      </TabsTrigger>
      <TabsTrigger value="billing">
        <DollarSign class="size-4" />
        Billing
      </TabsTrigger>
    </TabsList>

    <!-- Offline banner -->
    <div
      v-if="!isOnline"
      class="flex items-center gap-2 border-b bg-amber-50 px-4 py-2.5 text-sm text-amber-700 dark:bg-amber-950 dark:text-amber-400"
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
      class="flex items-center gap-2 border-b bg-muted/50 px-4 py-2.5 text-sm text-muted-foreground"
    >
      <Lock class="size-3.5 shrink-0" />
      This delivery record has been finalized and is read-only.
    </div>

    <!-- Tab content -->
    <div class="flex-1 overflow-y-auto px-4 pb-4 pt-4 md:px-8 md:pb-8">
      <div class="mx-auto max-w-4xl">

        <!-- ── Labor Tab ─────────────────────────────────────────── -->
        <TabsContent value="labor" class="mt-0 flex flex-col gap-6">
          <div class="rounded-lg border p-4 md:p-6">
            <h3 class="mb-4 text-sm font-semibold">Labor Information</h3>
            <div class="grid gap-4 sm:grid-cols-2">

              <!-- Onset type -->
              <div class="flex flex-col gap-1.5">
                <Label class="flex items-center gap-1.5 text-xs text-muted-foreground">
                  Onset Type
                </Label>
                <Select
                  :model-value="localLabor.onset_type ?? ''"
                  :disabled="store.isFinalized"
                  @update:model-value="(v) => { localLabor.onset_type = v as DeliveryLabor['onset_type'] || null }"
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
                <Label class="flex items-center gap-1.5 text-xs text-muted-foreground">
                  Labor Start
                </Label>
                <Input
                  type="datetime-local"
                  :model-value="localLabor.labor_start ?? ''"
                  :disabled="store.isFinalized"
                  @update:model-value="(v) => { localLabor.labor_start = String(v) || null }"
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
                />
              </div>

            </div>
          </div>

          <!-- Navigation -->
          <div class="flex justify-end border-t pt-4">
            <Button
              v-if="!store.isFinalized"
              variant="outline"
              size="sm"
              :disabled="store.isSaving"
              class="mr-auto"
              @click="saveLaborSection"
            >
              <LoaderCircle v-if="store.isSaving" class="size-3.5 animate-spin" />
              <ClipboardList v-else class="size-3.5" />
              Save Labor
            </Button>
            <Button variant="outline" @click="goToTab('next')">
              {{ nextTabLabel }}
              <ChevronRight class="ml-1 size-4" />
            </Button>
          </div>
        </TabsContent>

        <!-- ── Delivery Tab ──────────────────────────────────────── -->
        <TabsContent value="delivery" class="mt-0 flex flex-col gap-6">
          <div class="rounded-lg border p-4 md:p-6">
            <h3 class="mb-4 text-sm font-semibold">Delivery Outcome</h3>
            <div class="grid gap-4 sm:grid-cols-2">

              <!-- Delivery datetime -->
              <div class="flex flex-col gap-1.5">
                <Label class="flex items-center gap-1.5 text-xs text-muted-foreground">
                  Delivery Date & Time
                </Label>
                <Input
                  type="datetime-local"
                  :model-value="localDelivery.delivery_datetime ?? ''"
                  :disabled="store.isFinalized"
                  @update:model-value="(v) => { localDelivery.delivery_datetime = String(v) || null }"
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
                  @update:model-value="(v) => { localDelivery.delivery_mode = v as DeliveryOutcome['delivery_mode'] || null }"
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
                  @update:model-value="(v) => { localDelivery.laceration_degree = v as DeliveryOutcome['laceration_degree'] || null }"
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

          <!-- Maternal Status section -->
          <div class="rounded-lg border p-4 md:p-6">
            <h3 class="mb-4 text-sm font-semibold">Maternal Status</h3>
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
                  @update:model-value="(v) => { localMaternal.maternal_outcome = v as DeliveryMaternal['maternal_outcome'] || null }"
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
                      @update:model-value="(checked) => toggleMaternalComplication(opt.value, !!checked)"
                    />
                    {{ opt.label }}
                  </label>
                </div>
              </div>

              <!-- Blood transfusion -->
              <div class="flex flex-col gap-2 sm:col-span-2">
                <Separator />
                <label class="flex cursor-pointer items-center gap-2 text-sm" :class="{ 'opacity-60': store.isFinalized }">
                  <Checkbox
                    :model-value="localMaternal.blood_transfusion_required"
                    :disabled="store.isFinalized"
                    @update:model-value="(checked) => { localMaternal.blood_transfusion_required = !!checked }"
                  />
                  Blood transfusion required
                </label>
              </div>

            </div>
          </div>

          <!-- Navigation -->
          <div class="flex items-center justify-between border-t pt-4">
            <Button variant="outline" @click="goToTab('prev')">
              <ChevronLeft class="mr-1 size-4" />
              {{ prevTabLabel }}
            </Button>
            <div class="flex items-center gap-2">
              <Button
                v-if="!store.isFinalized"
                variant="outline"
                size="sm"
                :disabled="store.isSaving"
                @click="saveDeliverySection(); saveMaternalSection()"
              >
                <LoaderCircle v-if="store.isSaving" class="size-3.5 animate-spin" />
                <ClipboardList v-else class="size-3.5" />
                Save
              </Button>
              <Button variant="outline" @click="goToTab('next')">
                {{ nextTabLabel }}
                <ChevronRight class="ml-1 size-4" />
              </Button>
            </div>
          </div>
        </TabsContent>

        <!-- ── Neonatal Tab ──────────────────────────────────────── -->
        <TabsContent value="neonatal" class="mt-0 flex flex-col gap-6">
          <div class="rounded-lg border p-4 md:p-6">
            <h3 class="mb-4 text-sm font-semibold">Newborn Information</h3>
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
                  @update:model-value="(v) => { localNeonatal.birth_gender = v as 'M' | 'F' || null }"
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
          <div class="rounded-lg border p-4 md:p-6">
            <h3 class="mb-4 text-sm font-semibold">Apgar Scores</h3>
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
                  @update:model-value="(v) => { localNeonatal.apgar_1min = v !== '' ? Number(v) : null }"
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
                  @update:model-value="(v) => { localNeonatal.apgar_5min = v !== '' ? Number(v) : null }"
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
                  @update:model-value="(v) => { localNeonatal.apgar_10min = v !== '' ? Number(v) : null }"
                />
              </div>

            </div>
          </div>

          <!-- Neonatal Status -->
          <div class="rounded-lg border p-4 md:p-6">
            <h3 class="mb-4 text-sm font-semibold">Neonatal Status</h3>
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
                  @update:model-value="(v) => { localNeonatal.neonatal_outcome = v as DeliveryNeonatal['neonatal_outcome'] || null }"
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
                      @update:model-value="(checked) => toggleNeonatalComplication(opt.value, !!checked)"
                    />
                    {{ opt.label }}
                  </label>
                </div>
              </div>

              <!-- Resuscitation required -->
              <div class="flex flex-col gap-2 sm:col-span-2">
                <Separator />
                <label class="flex cursor-pointer items-center gap-2 text-sm" :class="{ 'opacity-60': store.isFinalized }">
                  <Checkbox
                    :model-value="localNeonatal.resuscitation_required"
                    :disabled="store.isFinalized"
                    @update:model-value="(checked) => { localNeonatal.resuscitation_required = !!checked }"
                  />
                  Resuscitation required
                </label>
              </div>

            </div>
          </div>

          <!-- Notes -->
          <div class="rounded-lg border p-4 md:p-6">
            <h3 class="mb-4 text-sm font-semibold">Notes</h3>
            <Textarea
              placeholder="Additional notes about the delivery encounter..."
              :model-value="localNotes"
              :disabled="store.isFinalized"
              rows="4"
              @update:model-value="(v) => { localNotes = String(v) }"
            />
          </div>

          <!-- Navigation -->
          <div class="flex items-center justify-between border-t pt-4">
            <Button variant="outline" @click="goToTab('prev')">
              <ChevronLeft class="mr-1 size-4" />
              {{ prevTabLabel }}
            </Button>
            <div class="flex items-center gap-2">
              <Button
                v-if="!store.isFinalized"
                variant="outline"
                size="sm"
                :disabled="store.isSaving"
                @click="saveNeonatalSection"
              >
                <LoaderCircle v-if="store.isSaving" class="size-3.5 animate-spin" />
                <ClipboardList v-else class="size-3.5" />
                Save
              </Button>
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
        <TabsContent value="billing" class="mt-0">
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
            :consultation-id="store.current.id"
            :status="store.current.status"
            :consultation-type="store.current.consultation?.type ?? 'default'"
            :patient-id="store.current.patient_id"
            :diagnoses="[]"
            :document-update="documentUpdate"
            :consumables="store.current.consumables ?? []"
            :prescription-summary="store.current.prescription_summary"
            :lab-order-summary="store.current.lab_order_summary"
            :payment="store.current.payment"
            :can-finalize="store.isDraft && canFinalize"
            :is-saving="store.isSaving"
            @update:payment="(p) => { if (store.current) store.current.payment = p }"
            @finalize="handleFinalizeAndBilling"
          />
          <div class="mt-8 flex justify-start border-t pt-4">
            <Button variant="outline" @click="goToTab('prev')">
              <ChevronLeft class="mr-1 size-4" />
              {{ prevTabLabel }}
            </Button>
          </div>
        </TabsContent>

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
