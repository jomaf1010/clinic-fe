<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowLeft,
  Baby,
  CheckCircle2,
  Pencil,
  Plus,
  CalendarDays,
} from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { RouteNames } from '@/router/routeNames'
import { usePatientDetailStore } from '@/stores/patientDetailStore'
import { useEncounterStore } from '@/domains/encounter/stores/encounterStore'
import type { EncounterTimelineItem } from '@/domains/encounter/types/encounter.types'
import PregnancySetupForm from '../components/PregnancySetupForm.vue'
import PregnancyDashboard from '../components/PregnancyDashboard.vue'
import ResolvePregnancyModal from '../components/ResolvePregnancyModal.vue'
import ObgynPregnancyTopbar from '../components/ObgynPregnancyTopbar.vue'
import type { Pregnancy, PregnancyOutcome } from '../types/obgyn.types'
import { pregnancyOutcomeLabel } from '../types/obgyn.types'

const route = useRoute()
const router = useRouter()
const pdStore = usePatientDetailStore()
const encounterStore = useEncounterStore()

const patientId = computed(() => {
  const id = route.params.patientId
  return typeof id === 'string' ? id : (id?.[0] ?? '')
})

const pregnancyId = computed(() => {
  const id = route.params.pregnancyId
  return typeof id === 'string' ? id : (id?.[0] ?? '')
})

const isNew = computed(() => route.name === RouteNames.PREGNANCY_CREATE)
const showSetupForm = ref(false)
const loadError = ref<string | null>(null)
const isPageLoading = ref(route.name !== RouteNames.PREGNANCY_CREATE)
const pregnancyReady = computed(() => !isNew.value && pdStore.currentPregnancy !== null)
const topbarStatusLabel = computed(() =>
  pdStore.currentPregnancy ? statusLabel(pdStore.currentPregnancy.status) : 'Loading',
)
const topbarStatusClass = computed(() =>
  pdStore.currentPregnancy
    ? statusClass(pdStore.currentPregnancy.status)
    : 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400',
)
const canCreateVisit = computed(() => pdStore.currentPregnancy?.status === 'active')
const canCreatePostpartumVisit = computed(() => pdStore.currentPregnancy?.status === 'delivered')
const canOpenDelivery = computed(() => Boolean(pdStore.currentPregnancy?.delivery_encounter_id))
const draftPregnancyVisit = computed(() =>
  encounterStore.patientEncounters.find((encounter) =>
    encounter.status === 'draft'
    && encounter.pregnancy_id === pregnancyId.value
    && encounter.type === 'prenatal',
  ) ?? null,
)
const hasDraftPregnancyVisit = computed(() => draftPregnancyVisit.value !== null)
const canResolvePrimary = computed(() =>
  pdStore.currentPregnancy?.status === 'active'
  && (pdStore.currentPregnancy?.current_ga?.weeks ?? 0) >= 24
  && !pdStore.currentPregnancy?.delivery_encounter_id,
)
const canResolveMenu = computed(() =>
  pdStore.currentPregnancy?.status === 'active'
  && !pdStore.currentPregnancy?.delivery_encounter_id
  && (pdStore.currentPregnancy?.current_ga?.weeks ?? 0) < 24,
)

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
  isPageLoading.value = !isNew.value
  try {
    // Ensure patient is loaded in store (may navigate directly to this URL)
    if (!pdStore.patient) {
      await pdStore.loadPatient(patientId.value)
      await pdStore.loadCore()
      await pdStore.loadObgyn()
    }
    if (!isNew.value) {
      await Promise.all([
        pdStore.loadPregnancyDetail(pregnancyId.value),
        encounterStore.loadForPatient(patientId.value, { pregnancy_id: pregnancyId.value }),
      ])
    }
  } catch {
    loadError.value = 'Failed to load pregnancy record.'
  } finally {
    isPageLoading.value = false
  }
})

onUnmounted(() => {
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
  pdStore.reloadDashboard(pregnancy.id).catch(() => {})
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
    const result = await pdStore.resolvePregnancy(pregnancyId.value, payload)

    showResolveModal.value = false

    // Reload pregnancy list so cached data reflects resolved status
    await pdStore.loadObgyn()

    if (result.encounter_id) {
      // Delivery outcome — navigate to delivery form
      toast.success('Delivery encounter created')
      router.push({
        name: RouteNames.ENCOUNTER_DETAIL,
        params: { patientId: patientId.value, id: result.encounter_id },
      })
    } else {
      // Loss outcome — pregnancy closed, reload detail + encounters
      toast.success('Pregnancy resolved')
      await Promise.all([
        pdStore.loadPregnancyDetail(pregnancyId.value),
        encounterStore.loadForPatient(patientId.value, { pregnancy_id: pregnancyId.value }),
      ])
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

function goToDraftVisit(): void {
  if (!draftPregnancyVisit.value) return
  goToVisit(draftPregnancyVisit.value.id)
}

function goToPatientProfile(): void {
  router.push({ name: RouteNames.PATIENT_DETAIL, params: { id: patientId.value } })
}

function goToDelivery(): void {
  const encounterId = pdStore.currentPregnancy?.delivery_encounter_id
  if (!encounterId) return

  router.push({
    name: RouteNames.ENCOUNTER_DETAIL,
    params: { patientId: patientId.value, id: encounterId },
  })
}

// ── Close postpartum ────────────────────────────────────────────────
const daysPostpartum = computed(() => {
  const delivered = pdStore.currentPregnancy?.delivered_at
  if (!delivered) return 0
  return Math.floor((Date.now() - new Date(delivered).getTime()) / (1000 * 60 * 60 * 24))
})

const canClosePostpartum = computed(() => {
  const status = pdStore.currentPregnancy?.status
  return (status === 'delivered' || status === 'postpartum') && daysPostpartum.value >= 42
})

const isClosingPostpartum = ref(false)

async function closePostpartum(): Promise<void> {
  if (!pdStore.currentPregnancy) return
  isClosingPostpartum.value = true
  try {
    await pdStore.updatePregnancy(pregnancyId.value, { status: 'inactive' } as any)
    await pdStore.loadObgyn()
    toast.success('Postpartum period closed')
  } catch {
    // store already shows error toast
  } finally {
    isClosingPostpartum.value = false
  }
}
</script>

<template>
  <div class="pregnancy-detail-page flex flex-1 flex-col">
    <ObgynPregnancyTopbar
      v-if="!isNew && !showSetupForm"
      :patient-name="pdStore.patient?.full_name ?? null"
      :status-label="topbarStatusLabel"
      :status-class="topbarStatusClass"
      :risk-level="pdStore.currentPregnancy?.risk_level"
      :risk-factors="pdStore.currentPregnancy?.risk_factors"
      :edd="pdStore.currentPregnancy?.edd"
      :gestational-age-weeks="pdStore.currentPregnancy?.current_ga?.weeks"
      :gestational-age-days="pdStore.currentPregnancy?.current_ga?.days"
      :trimester="pdStore.currentPregnancy?.current_ga?.trimester"
      :is-active="pdStore.currentPregnancy?.status === 'active'"
      :can-create-visit="canCreateVisit"
      :has-draft-visit="hasDraftPregnancyVisit"
      :can-create-postpartum-visit="canCreatePostpartumVisit"
      :can-close-postpartum="canClosePostpartum"
      :is-closing-postpartum="isClosingPostpartum"
      :can-open-delivery="canOpenDelivery"
      :can-resolve-primary="canResolvePrimary"
      :can-resolve-menu="canResolveMenu"
      @back="goToPatientProfile"
      @new-visit="goToNewVisit"
      @continue-visit="goToDraftVisit"
      @postpartum-visit="goToPostpartum"
      @close-postpartum="closePostpartum"
      @open-delivery="goToDelivery"
      @resolve="showResolveModal = true"
      @edit-setup="showSetupForm = true"
    />

    <!-- Loading -->
    <div
      v-if="isPageLoading && !isNew"
      class="pregnancy-dashboard-page flex flex-col gap-6 px-2 pb-4 pt-3"
    >
      <div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div class="flex min-w-0 flex-col gap-6">
          <section class="surface-card rounded-2xl p-5">
            <div class="mb-6 flex items-center gap-4">
              <Skeleton class="size-14 rounded-full" />
              <div class="min-w-0 flex-1 space-y-2">
                <Skeleton class="h-5 w-56 rounded-xl" />
                <Skeleton class="h-4 w-72 rounded-xl" />
              </div>
              <Skeleton class="hidden h-7 w-20 rounded-full sm:block" />
            </div>
            <Skeleton class="mb-5 h-3 w-full rounded-full" />
            <div class="grid grid-cols-6 gap-4">
              <Skeleton
                v-for="n in 6"
                :key="`marker-${n}`"
                class="h-3 rounded-full"
              />
            </div>
          </section>

          <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <div
              v-for="n in 5"
              :key="`summary-${n}`"
              class="surface-card-lite rounded-2xl p-4"
            >
              <div class="flex items-start gap-3">
                <Skeleton class="size-10 shrink-0 rounded-xl" />
                <div class="min-w-0 flex-1 space-y-2">
                  <Skeleton class="h-3 w-24 rounded-xl" />
                  <Skeleton class="h-7 w-28 rounded-xl" />
                  <Skeleton v-if="n === 2 || n === 3" class="h-4 w-36 rounded-xl" />
                </div>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
            <section
              v-for="n in 2"
              :key="`chart-${n}`"
              class="surface-card rounded-2xl border-0 p-5"
            >
              <Skeleton class="mb-8 h-4 w-40 rounded-xl" />
              <div class="space-y-5">
                <Skeleton class="h-3 w-full rounded-full" />
                <Skeleton class="h-3 w-10/12 rounded-full" />
                <Skeleton class="h-3 w-11/12 rounded-full" />
                <Skeleton class="h-3 w-8/12 rounded-full" />
                <Skeleton class="h-3 w-9/12 rounded-full" />
              </div>
            </section>
          </div>
        </div>

        <aside class="surface-card hidden rounded-2xl p-4 xl:block">
          <div class="mb-5 flex items-center gap-2">
            <Skeleton class="size-4 rounded-full" />
            <Skeleton class="h-4 w-24 rounded-xl" />
          </div>
          <div class="space-y-4">
            <div
              v-for="n in 4"
              :key="`timeline-${n}`"
              class="flex gap-3"
            >
              <div class="flex flex-col items-center">
                <Skeleton class="mt-2 size-3 rounded-full" />
                <div v-if="n < 4" class="mt-1 h-16 w-px bg-foreground/10" />
              </div>
              <div class="surface-card-lite flex-1 rounded-2xl p-3">
                <Skeleton class="mb-3 h-4 w-24 rounded-xl" />
                <Skeleton class="mb-2 h-4 w-full rounded-xl" />
                <Skeleton class="h-3 w-28 rounded-xl" />
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>

    <!-- Error -->
    <div
      v-else-if="loadError"
      role="alert"
      class="surface-card mx-auto mt-8 max-w-md rounded-2xl border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
    >
      {{ loadError }}
    </div>

    <!-- New Pregnancy — show setup form only -->
    <template v-else-if="isNew || showSetupForm">
      <div class="pt-4">
        <div class="surface-card flex items-center gap-2 rounded-2xl p-3">
          <Button variant="ghost" size="sm" class="gap-1.5" @click="isNew ? router.back() : (showSetupForm = false)">
            <ArrowLeft class="size-3.5" />
            {{ isNew ? 'Back' : 'Back to Dashboard' }}
          </Button>
          <Separator orientation="vertical" class="h-4" />
          <Baby class="size-4 text-purple-500" />
          <span class="text-sm font-semibold">{{ isNew ? 'New Pregnancy Record' : 'Edit Pregnancy Setup' }}</span>
        </div>
      </div>
      <div class="flex-1 px-4 pb-8 pt-4 md:px-8">
        <div class="mx-auto max-w-3xl">
          <PregnancySetupForm
            :patient-id="patientId"
            :pregnancy="pdStore.currentPregnancy ?? undefined"
            @saved="handleSetupSaved"
            @cancel="isNew ? router.back() : (showSetupForm = false)"
          />
        </div>
      </div>
    </template>

    <!-- Pregnancy Dashboard -->
    <template v-else-if="pregnancyReady">
      <div class="pregnancy-dashboard-page flex flex-col gap-6 px-2 pb-4 pt-3">
        <!-- Dashboard content — 2 column layout -->
        <div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">

          <!-- Left: Dashboard (2/3) -->
          <div class="flex min-w-0 flex-col gap-6">
            <!-- Outcome banner for resolved/delivered pregnancies -->
            <div
              v-if="pdStore.currentPregnancy?.outcome && pdStore.currentPregnancy?.status !== 'active'"
              class="surface-card rounded-2xl border p-3 text-sm"
              :class="pdStore.currentPregnancy.status === 'delivered'
                ? 'border-blue-200 bg-blue-50/60 dark:border-blue-800 dark:bg-blue-950/50'
                : 'border-red-200 bg-red-50/60 dark:border-red-800 dark:bg-red-950/50'"
            >
              <p class="font-medium" :class="pdStore.currentPregnancy.status === 'delivered' ? 'text-blue-800 dark:text-blue-300' : 'text-red-800 dark:text-red-300'">
                {{ pregnancyOutcomeLabel(pdStore.currentPregnancy.outcome) }}
              </p>
              <p class="mt-0.5 text-xs text-muted-foreground">
                <span v-if="pdStore.currentPregnancy.outcome_date">
                  {{ formatDate(pdStore.currentPregnancy.outcome_date) }}
                </span>
                <span v-if="pdStore.currentPregnancy.outcome_ga_weeks != null">
                  &middot; {{ pdStore.currentPregnancy.outcome_ga_weeks }}w{{ pdStore.currentPregnancy.outcome_ga_days ? ` ${pdStore.currentPregnancy.outcome_ga_days}d` : '' }}
                </span>
                <span v-if="pdStore.currentPregnancy.birth_weight">
                  &middot; {{ pdStore.currentPregnancy.birth_weight }}g
                </span>
                <span v-if="pdStore.currentPregnancy.birth_gender">
                  &middot; {{ pdStore.currentPregnancy.birth_gender }}
                </span>
              </p>
              <p
                v-if="pdStore.currentPregnancy.outcome_details?.notes"
                class="mt-1 text-xs text-muted-foreground"
              >
                {{ pdStore.currentPregnancy.outcome_details.notes }}
              </p>
            </div>

            <!-- Trend Charts -->
            <PregnancyDashboard
              v-if="encounterStore.patientEncounters.length > 0"
              :patient-id="patientId"
              :pregnancy-id="pregnancyId"
              :pregnancy="pdStore.currentPregnancy!"
              :patient="pdStore.patient"
            />

            <!-- Empty dashboard state -->
            <div
              v-else-if="!encounterStore.isLoadingEncounters"
              class="surface-card flex flex-col items-center justify-center gap-2 rounded-2xl py-16 text-center"
            >
              <CalendarDays class="size-10 text-muted-foreground/30" />
              <p class="text-sm font-medium text-muted-foreground">No visits recorded yet</p>
              <p class="max-w-sm text-xs text-muted-foreground/70">
                Dashboard will populate as prenatal visits are recorded.
              </p>
            </div>
          </div>

          <!-- Right: Timeline (1/3) -->
          <aside class="surface-card flex flex-col gap-3 rounded-2xl p-4 xl:self-start">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <CalendarDays class="size-4 text-muted-foreground" />
                <h3 class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Timeline
                </h3>
                <span v-if="encounterStore.patientEncounters.length" class="surface-muted rounded-full px-1.5 py-0.5 text-xs text-muted-foreground">
                  {{ encounterStore.patientEncounters.length }}
                </span>
              </div>
            </div>

            <!-- Loading -->
            <div v-if="encounterStore.isLoadingEncounters" class="mt-2">
              <div v-for="n in 3" :key="n" class="flex gap-3">
                <div class="pregnancy-visit-timeline-marker-col">
                  <div class="pregnancy-visit-timeline-marker pregnancy-visit-timeline-marker--skeleton" />
                  <div v-if="n < 3" class="pregnancy-visit-timeline-line" />
                </div>
                <div class="surface-card-lite min-w-0 flex-1 rounded-2xl p-3" :class="n < 3 ? 'mb-3' : ''">
                  <div class="h-3 w-20 mb-2 rounded bg-muted animate-pulse" />
                  <div class="h-4 w-3/4 rounded bg-muted animate-pulse" />
                </div>
              </div>
            </div>

            <!-- Empty -->
            <div
              v-else-if="encounterStore.patientEncounters.length === 0"
              class="surface-muted flex flex-col items-center justify-center gap-2 rounded-2xl py-12 text-center"
            >
              <CalendarDays class="size-8 text-muted-foreground/30" />
              <p class="text-sm text-muted-foreground">No visits yet</p>
              <Button
                v-if="pdStore.currentPregnancy?.status === 'active'"
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
                <div class="pregnancy-visit-timeline-marker-col">
                  <div
                    class="pregnancy-visit-timeline-marker"
                    :class="
                      e.status === 'draft'
                        ? 'pregnancy-visit-timeline-marker--draft'
                        : index === 0
                          ? 'pregnancy-visit-timeline-marker--latest'
                          : 'pregnancy-visit-timeline-marker--finalized'
                    "
                  >
                    <Pencil v-if="e.status === 'draft'" class="size-3.5" />
                    <CheckCircle2 v-else class="size-3.5" />
                  </div>
                  <div
                    v-if="index < encounterStore.patientEncounters.length - 1"
                    class="pregnancy-visit-timeline-line"
                    :class="{ 'pregnancy-visit-timeline-line--draft': e.status === 'draft' }"
                  />
                </div>

                <!-- Card -->
                <div
                  class="surface-card-lite min-w-0 flex-1 rounded-2xl p-3 transition-all hover:-translate-y-0.5"
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
                  <p v-if="e.auto_display_line ?? e.display_line" class="text-sm font-medium leading-snug">{{ e.auto_display_line ?? e.display_line }}</p>
                  <p class="mt-1 text-xs text-muted-foreground">{{ formatDate(e.created_at) }}</p>
                </div>
              </div>
            </div>
          </aside>

        </div>
      </div>
    </template>

    <!-- Resolve Pregnancy Modal -->
    <ResolvePregnancyModal
      v-if="pdStore.currentPregnancy"
      ref="resolveModalRef"
      :open="showResolveModal"
      :pregnancy="pdStore.currentPregnancy"
      @update:open="showResolveModal = $event"
      @resolve="handleResolve"
    />
  </div>
</template>

<style scoped>
.pregnancy-visit-timeline-marker-col {
  display: flex;
  width: 2.25rem;
  flex: none;
  flex-direction: column;
  align-items: center;
}

.pregnancy-visit-timeline-marker {
  margin-top: 0.5rem;
  display: flex;
  width: 2rem;
  height: 2rem;
  flex: none;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  color: white;
  box-shadow:
    0 10px 22px rgb(15 23 42 / 0.14),
    inset 0 1px 0 rgb(255 255 255 / 0.28);
}

.pregnancy-visit-timeline-marker--draft {
  background: linear-gradient(135deg, rgb(245 158 11), rgb(249 115 22));
}

.pregnancy-visit-timeline-marker--latest {
  background: linear-gradient(135deg, rgb(37 99 235), rgb(20 184 166));
  animation: pulse-primary 2.2s ease-out infinite;
}

.pregnancy-visit-timeline-marker--finalized {
  background: linear-gradient(135deg, rgb(20 184 166), rgb(16 185 129));
}

.pregnancy-visit-timeline-marker--skeleton {
  background: rgb(148 163 184 / 0.28);
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

.pregnancy-visit-timeline-line {
  margin-top: 0.5rem;
  width: 2px;
  flex: 1 1 auto;
  min-height: 2rem;
  background: linear-gradient(to bottom, rgb(37 99 235 / 0.22), rgb(20 184 166 / 0.14));
}

.pregnancy-visit-timeline-line--draft {
  background: linear-gradient(to bottom, rgb(245 158 11 / 0.38), rgb(20 184 166 / 0.16));
}
</style>
