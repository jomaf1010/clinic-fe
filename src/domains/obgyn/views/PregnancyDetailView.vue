<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowLeft,
  Baby,
  LoaderCircle,
  Pencil,
  Plus,
  CalendarDays,
  CheckCircle2,
  MoreVertical,
} from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { RouteNames } from '@/router/routeNames'
import { patientApi } from '@/domains/patient/api/patientApi'
import type { PatientResponse } from '@/domains/patient/types/patient.types'
import { usePregnancyStore } from '../stores/pregnancyStore'
import { useEncounterStore } from '@/domains/encounter/stores/encounterStore'
import { obgynApi } from '../api/obgynApi'
import type { EncounterTimelineItem } from '@/domains/encounter/types/encounter.types'
import PregnancySetupForm from '../components/PregnancySetupForm.vue'
import GACalculator from '../components/GACalculator.vue'
import RiskClassificationBadge from '../components/RiskClassificationBadge.vue'
import PregnancyDashboard from '../components/PregnancyDashboard.vue'
import ResolvePregnancyModal from '../components/ResolvePregnancyModal.vue'
import type { Pregnancy, PregnancyOutcome } from '../types/obgyn.types'
import { pregnancyOutcomeLabel } from '../types/obgyn.types'

const route = useRoute()
const router = useRouter()
const store = usePregnancyStore()
const encounterStore = useEncounterStore()

const patientId = computed(() => {
  const id = route.params.patientId
  return typeof id === 'string' ? id : id[0] ?? ''
})

const pregnancyId = computed(() => {
  const id = route.params.pregnancyId
  return typeof id === 'string' ? id : id[0] ?? ''
})

const patient = ref<PatientResponse | null>(null)

const isNew = computed(() => route.name === RouteNames.PREGNANCY_CREATE)
const showSetupForm = ref(false)
const loadError = ref<string | null>(null)
const pregnancyReady = computed(() => !isNew.value && store.currentPregnancy !== null)

function formatDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

const showResolveModal = ref(false)
const resolveModalRef = ref<InstanceType<typeof ResolvePregnancyModal> | null>(null)

function statusClass(status: Pregnancy['status']): string {
  switch (status) {
    case 'active': return 'border-green-200 bg-green-100 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400'
    case 'postpartum': return 'border-blue-200 bg-blue-100 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-400'
    case 'delivered': return 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400'
    case 'resolved': return 'border-red-200 bg-red-100 text-red-600 dark:border-red-800 dark:bg-red-950 dark:text-red-400'
    default: return ''
  }
}

function statusLabel(status: Pregnancy['status']): string {
  switch (status) {
    case 'active': return 'Active'
    case 'postpartum': return 'Postpartum'
    case 'delivered': return 'Delivered'
    case 'resolved': return 'Resolved'
    case 'inactive': return 'Inactive'
  }
}

function encounterTypeLabel(type: EncounterTimelineItem['type']): string {
  switch (type) {
    case 'prenatal': return 'Prenatal'
    case 'delivery': return 'Delivery'
    case 'postpartum': return 'Postpartum'
    default: return type
  }
}

function encounterTypeBadgeClass(type: EncounterTimelineItem['type']): string {
  switch (type) {
    case 'prenatal': return 'border-purple-200 bg-purple-50 text-purple-700'
    case 'delivery': return 'border-blue-200 bg-blue-50 text-blue-700'
    case 'postpartum': return 'border-teal-200 bg-teal-50 text-teal-700'
    default: return ''
  }
}

onMounted(async () => {
  loadError.value = null
  if (!isNew.value) {
    try {
      await Promise.all([
        store.loadPregnancy(patientId.value, pregnancyId.value),
        encounterStore.loadForPatient(patientId.value, { pregnancy_id: pregnancyId.value }),
        patientApi.get(patientId.value).then((res) => { patient.value = res.data }),
      ])
    } catch {
      loadError.value = 'Failed to load pregnancy record.'
    }
  }
})

onUnmounted(() => {
  store.$reset()
  encounterStore.clearPatientEncounters()
})

function handleSetupSaved(pregnancy: Pregnancy): void {
  if (isNew.value) {
    router.replace({
      name: RouteNames.PREGNANCY_DETAIL,
      params: { patientId: patientId.value, pregnancyId: pregnancy.id },
    })
    return
  }
  // Reload dashboard data to reflect changes (EDD, risk level, etc.)
  store.loadDashboard(patientId.value, pregnancy.id).catch(() => {})
}

async function goToNewVisit(): Promise<void> {
  try {
    const encounter = await encounterStore.createForPatient(
      patientId.value,
      'default',
      { encounterType: 'prenatal', pregnancyId: pregnancyId.value },
    )
    router.push({
      name: RouteNames.ENCOUNTER_DETAIL,
      params: { patientId: patientId.value, id: encounter.id },
    })
  } catch {
    toast.error('Failed to create prenatal visit')
  }
}

async function handleResolve(payload: {
  outcome: PregnancyOutcome
  outcome_date: string
  management?: string | null
  ectopic_location?: string | null
  ectopic_confirmation?: string | null
  hcg_surveillance?: boolean | null
  notes?: string | null
}): Promise<void> {
  try {
    const result = await obgynApi.resolvePregnancy(patientId.value, pregnancyId.value, payload)

    // Update local pregnancy state
    store.currentPregnancy = result.data

    showResolveModal.value = false

    if (result.encounter_id) {
      // Delivery outcome — navigate to delivery form
      toast.success('Delivery encounter created')
      router.push({
        name: RouteNames.ENCOUNTER_DETAIL,
        params: { patientId: patientId.value, id: result.encounter_id },
      })
    } else {
      // Loss outcome — pregnancy closed
      toast.success('Pregnancy resolved')
      // Reload encounters to reflect updated timeline
      await encounterStore.loadForPatient(patientId.value, { pregnancy_id: pregnancyId.value })
    }
  } catch {
    toast.error('Failed to resolve pregnancy')
    resolveModalRef.value?.stopSubmitting()
  }
}

async function goToPostpartum(): Promise<void> {
  try {
    const encounter = await encounterStore.createForPatient(
      patientId.value,
      'default',
      { encounterType: 'postpartum', pregnancyId: pregnancyId.value },
    )
    router.push({
      name: RouteNames.ENCOUNTER_DETAIL,
      params: { patientId: patientId.value, id: encounter.id },
    })
  } catch {
    toast.error('Failed to create postpartum visit')
  }
}

function goToVisit(encounterId: string): void {
  router.push({
    name: RouteNames.ENCOUNTER_DETAIL,
    params: { patientId: patientId.value, id: encounterId },
  })
}
</script>

<template>
  <div class="flex flex-1 flex-col">
    <!-- Loading -->
    <div v-if="store.isLoading && !store.currentPregnancy && !isNew" class="flex flex-1 items-center justify-center py-16">
      <LoaderCircle class="size-6 animate-spin text-muted-foreground" />
    </div>

    <!-- Error -->
    <div
      v-else-if="loadError"
      role="alert"
      class="mx-auto mt-8 max-w-md rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
    >
      {{ loadError }}
    </div>

    <!-- New Pregnancy — show setup form only -->
    <template v-else-if="isNew || showSetupForm">
      <div class="sticky top-0 z-10 border-b bg-background">
        <div class="flex items-center gap-2 px-4 py-3">
          <Button variant="ghost" size="sm" class="gap-1.5" @click="isNew ? router.back() : (showSetupForm = false)">
            <ArrowLeft class="size-3.5" />
            {{ isNew ? 'Back' : 'Back to Dashboard' }}
          </Button>
          <Separator orientation="vertical" class="h-4" />
          <Baby class="size-4 text-purple-500" />
          <span class="text-sm font-semibold">{{ isNew ? 'New Pregnancy Record' : 'Edit Pregnancy Setup' }}</span>
        </div>
      </div>
      <div class="flex-1 overflow-y-auto px-4 pb-8 pt-4 md:px-8">
        <div class="mx-auto max-w-3xl">
          <PregnancySetupForm
            :patient-id="patientId"
            :pregnancy="store.currentPregnancy ?? undefined"
            @saved="handleSetupSaved"
            @cancel="isNew ? router.back() : (showSetupForm = false)"
          />
        </div>
      </div>
    </template>

    <!-- Pregnancy Dashboard -->
    <template v-else-if="pregnancyReady">
      <!-- Sticky Header -->
      <div class="sticky top-0 z-10 border-b bg-background">
        <div class="flex flex-col gap-2 px-4 pb-2 pt-3 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex items-center gap-2">
            <Button variant="ghost" size="sm" class="gap-1.5" @click="router.back()">
              <ArrowLeft class="size-3.5" />
              Back
            </Button>
            <Separator orientation="vertical" class="h-4" />
            <Baby class="size-4 text-purple-500" />
            <span class="text-sm font-semibold">Pregnancy Dashboard</span>
            <Badge
              variant="outline"
              class="text-xs"
              :class="statusClass(store.currentPregnancy!.status)"
            >
              {{ statusLabel(store.currentPregnancy!.status) }}
            </Badge>
            <RiskClassificationBadge
              v-if="store.currentPregnancy!.risk_level"
              :level="store.currentPregnancy!.risk_level"
              :factors="store.currentPregnancy!.risk_factors"
            />
          </div>

          <div class="flex items-center gap-2">
            <!-- GA Summary -->
            <GACalculator v-if="store.currentPregnancy!.edd && store.currentPregnancy!.status === 'active'" :edd="store.currentPregnancy!.edd" />
          </div>
        </div>
      </div>

      <!-- Dashboard content — 2 column layout -->
      <div class="flex-1 overflow-y-auto">
        <div class="flex flex-col gap-4 p-4 md:p-6 lg:flex-row lg:gap-6">

          <!-- Left: Dashboard (2/3) -->
          <div class="flex flex-col gap-4 lg:w-2/3">
            <!-- Action buttons -->
            <div class="flex flex-wrap items-center gap-2">
              <Button v-if="store.currentPregnancy?.status === 'active'" size="sm" @click="goToNewVisit">
                <Plus class="size-3.5" /> New Visit
              </Button>
              <Button v-if="store.currentPregnancy?.status === 'delivered'" size="sm" variant="outline" @click="goToPostpartum">
                <Plus class="size-3.5" /> Postpartum Visit
              </Button>

              <div class="flex-1" />

              <!-- Resolve button (visible at ≥24 weeks) -->
              <Button
                v-if="store.currentPregnancy?.status === 'active' && (store.currentPregnancy?.current_ga?.weeks ?? 0) >= 24"
                size="sm"
                variant="outline"
                @click="showResolveModal = true"
              >
                <CheckCircle2 class="size-3.5" /> Resolve Pregnancy
              </Button>

              <!-- More actions -->
              <DropdownMenu>
                <DropdownMenuTrigger as-child>
                  <Button variant="outline" size="icon" class="size-8">
                    <MoreVertical class="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem @click="showSetupForm = true">
                    <Pencil class="mr-2 size-3.5" />
                    Edit Setup
                  </DropdownMenuItem>
                  <!-- Resolve in menu only when <24 weeks -->
                  <DropdownMenuItem
                    v-if="store.currentPregnancy?.status === 'active' && (store.currentPregnancy?.current_ga?.weeks ?? 0) < 24"
                    @click="showResolveModal = true"
                  >
                    <CheckCircle2 class="mr-2 size-3.5" />
                    Resolve Pregnancy
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <!-- Outcome banner for resolved/delivered pregnancies -->
            <div
              v-if="store.currentPregnancy?.outcome && store.currentPregnancy?.status !== 'active'"
              class="rounded-md border p-3 text-sm"
              :class="store.currentPregnancy.status === 'delivered'
                ? 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950'
                : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950'"
            >
              <p class="font-medium" :class="store.currentPregnancy.status === 'delivered' ? 'text-blue-800 dark:text-blue-300' : 'text-red-800 dark:text-red-300'">
                {{ pregnancyOutcomeLabel(store.currentPregnancy.outcome) }}
              </p>
              <p class="mt-0.5 text-xs text-muted-foreground">
                <span v-if="store.currentPregnancy.outcome_date">
                  {{ formatDate(store.currentPregnancy.outcome_date) }}
                </span>
                <span v-if="store.currentPregnancy.outcome_ga_weeks != null">
                  &middot; {{ store.currentPregnancy.outcome_ga_weeks }}w{{ store.currentPregnancy.outcome_ga_days ? ` ${store.currentPregnancy.outcome_ga_days}d` : '' }}
                </span>
                <span v-if="store.currentPregnancy.birth_weight">
                  &middot; {{ store.currentPregnancy.birth_weight }}g
                </span>
                <span v-if="store.currentPregnancy.birth_gender">
                  &middot; {{ store.currentPregnancy.birth_gender }}
                </span>
              </p>
              <p
                v-if="store.currentPregnancy.outcome_details?.notes"
                class="mt-1 text-xs text-muted-foreground"
              >
                {{ store.currentPregnancy.outcome_details.notes }}
              </p>
            </div>

            <!-- Trend Charts -->
            <PregnancyDashboard
              v-if="encounterStore.patientEncounters.length > 0"
              :patient-id="patientId"
              :pregnancy-id="pregnancyId"
              :pregnancy="store.currentPregnancy!"
              :patient="patient"
            />

            <!-- Empty dashboard state -->
            <div
              v-else-if="!encounterStore.isLoadingEncounters"
              class="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16 text-center"
            >
              <CalendarDays class="size-10 text-muted-foreground/30" />
              <p class="text-sm font-medium text-muted-foreground">No visits recorded yet</p>
              <p class="max-w-sm text-xs text-muted-foreground/70">
                Dashboard will populate as prenatal visits are recorded.
              </p>
            </div>
          </div>

          <!-- Right: Timeline (1/3) -->
          <div class="flex flex-col gap-3 lg:w-1/3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <CalendarDays class="size-4 text-muted-foreground" />
                <h3 class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Timeline
                </h3>
                <span v-if="encounterStore.patientEncounters.length" class="rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                  {{ encounterStore.patientEncounters.length }}
                </span>
              </div>
            </div>

            <!-- Loading -->
            <div v-if="encounterStore.isLoadingEncounters" class="mt-2">
              <div v-for="n in 3" :key="n" class="flex gap-3">
                <div class="flex flex-col items-center">
                  <div class="mt-3.5 size-2 shrink-0 rounded-full bg-muted animate-pulse" />
                  <div v-if="n < 3" class="mt-1 flex-1 w-[2px] bg-foreground/15" />
                </div>
                <div class="min-w-0 flex-1 rounded-lg border bg-card p-3" :class="n < 3 ? 'mb-3' : ''">
                  <div class="h-3 w-20 mb-2 rounded bg-muted animate-pulse" />
                  <div class="h-4 w-3/4 rounded bg-muted animate-pulse" />
                </div>
              </div>
            </div>

            <!-- Empty -->
            <div
              v-else-if="encounterStore.patientEncounters.length === 0"
              class="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-12 text-center"
            >
              <CalendarDays class="size-8 text-muted-foreground/30" />
              <p class="text-sm text-muted-foreground">No visits yet</p>
              <Button
                v-if="store.currentPregnancy?.status === 'active'"
                size="sm"
                variant="outline"
                class="mt-1"
                @click="goToNewVisit"
              >
                <Plus class="size-3.5" />
                Record First Visit
              </Button>
            </div>

            <!-- Timeline entries -->
            <div v-else class="mt-1">
              <div
                v-for="(e, index) in encounterStore.patientEncounters"
                :key="e.id"
                class="flex gap-3 cursor-pointer"
                @click="goToVisit(e.id)"
              >
                <!-- Dot + line -->
                <div class="flex w-3 flex-col items-center">
                  <div
                    class="mt-3.5 shrink-0 rounded-full"
                    :class="
                      e.status === 'draft'
                        ? 'size-3 bg-amber-400 pulse-ring-amber'
                        : index === 0
                          ? 'size-3 bg-primary pulse-ring-primary'
                          : 'size-2 bg-primary'
                    "
                  />
                  <div
                    v-if="index < encounterStore.patientEncounters.length - 1"
                    class="mt-1 flex-1 w-[2px]"
                    :class="e.status === 'draft' ? 'bg-amber-300' : 'bg-foreground/15'"
                  />
                </div>

                <!-- Card -->
                <div
                  class="min-w-0 flex-1 rounded-lg border bg-card p-3 transition-colors hover:bg-muted/30"
                  :class="index < encounterStore.patientEncounters.length - 1 ? 'mb-3' : ''"
                >
                  <div class="flex items-center justify-between mb-1">
                    <Badge variant="outline" class="text-[10px]" :class="encounterTypeBadgeClass(e.type)">
                      {{ encounterTypeLabel(e.type) }}
                    </Badge>
                    <Badge
                      variant="outline"
                      class="text-[10px]"
                      :class="e.status === 'finalized' ? 'border-green-200 bg-green-50 text-green-700' : 'border-amber-200 bg-amber-50 text-amber-700'"
                    >
                      {{ e.status }}
                    </Badge>
                  </div>
                  <p v-if="e.display_line" class="text-sm font-medium leading-snug">{{ e.display_line }}</p>
                  <p class="mt-1 text-xs text-muted-foreground">{{ formatDate(e.created_at) }}</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </template>

    <!-- Resolve Pregnancy Modal -->
    <ResolvePregnancyModal
      v-if="store.currentPregnancy"
      ref="resolveModalRef"
      :open="showResolveModal"
      :pregnancy="store.currentPregnancy"
      @update:open="showResolveModal = $event"
      @resolve="handleResolve"
    />
  </div>
</template>
