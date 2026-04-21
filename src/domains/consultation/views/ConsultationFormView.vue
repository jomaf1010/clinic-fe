<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch, type Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { HttpError } from '@/lib/http'
import {
  Stethoscope,
  Activity,
  ClipboardList,
  ClipboardPlus,
  DollarSign,
  Lock,
  LoaderCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  WifiOff,
  Eye,
  ArrowLeft,
  FileText,
  FileDown,
  Printer,
  AlertTriangle,
  Heart,
  AlertCircle,
  ShieldAlert,
  Pill,
  Users,
  Stamp,
} from 'lucide-vue-next'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
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
import TriageTab from '../components/tabs/TriageTab.vue'
import AssessmentTab from '../components/tabs/AssessmentTab.vue'
import TreatmentPlanTab from '../components/tabs/TreatmentPlanTab.vue'
import PaymentTab from '../components/tabs/PaymentTab.vue'
import VitalsSummary from '../components/VitalsSummary.vue'
import FinalizeModal from '../components/FinalizeModal.vue'
import { documentApi, type GeneratedDocumentResponse } from '../api/documentApi'
import { openNewTab, printPdf } from '@/lib/utils'
import type { UpdateEncounterPayload } from '@/domains/encounter/types/encounter.types'
import { useEncounterSync } from '@/domains/encounter/composables/useEncounterSync'
import { usePatientSync } from '@/domains/patient/composables/usePatientSync'
import { usePatientDetailStore } from '@/stores/patientDetailStore'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const store = useEncounterStore()
const pdStore = usePatientDetailStore()
const { isOnline, pendingCount } = useOfflineSync()

const encounterId = computed(() => store.current?.id)
const clinicId = computed(() => store.current?.clinic_id)
const patientId = computed(() => store.current?.patient_id)
const { prescriptionUpdate, labOrderUpdate, documentUpdate } = useEncounterSync(encounterId, clinicId)
usePatientSync(patientId, clinicId, () => {})

const canEditTriage = computed(() => authStore.hasPermission('encounters.edit-triage'))
const canEditAssessment = computed(() => authStore.hasPermission('encounters.edit-assessment'))
const canEditTreatmentPlan = computed(() => authStore.hasPermission('encounters.edit-treatment-plan'))
const canFinalize = computed(() => authStore.hasPermission('encounters.finalize'))

const activeTab = ref('triage')
const showPreviewModal = ref(false)
const showFinalizeModal = ref(false)
const showFeeWarningModal = ref(false)
const autoOpenMedCert = ref(false)
const loadError = ref<string | null>(null)
const pendingFinalizeAction = ref<'confirm' | 'pay'>('confirm')

function hasFeeConfigured(): boolean {
  const isFollowUp = store.current?.consultation?.type === 'follow_up'
  const doctorFee = isFollowUp ? authStore.user?.follow_up_fee : authStore.user?.consultation_fee
  const clinicFee = isFollowUp
    ? authStore.currentClinic?.settings?.default_follow_up_fee
    : authStore.currentClinic?.settings?.default_consultation_fee
  return (!!doctorFee && doctorFee > 0) || (!!clinicFee && clinicFee > 0)
}

function handleFinalizeClick() {
  if (!hasFeeConfigured()) {
    pendingFinalizeAction.value = 'confirm'
    showFeeWarningModal.value = true
    return
  }
  showFinalizeModal.value = true
}

function handleFinalizeAndPayClick() {
  if (!hasFeeConfigured()) {
    pendingFinalizeAction.value = 'pay'
    showFeeWarningModal.value = true
    return
  }
  doFinalizeAndPay()
}

// --- Consultation Summary PDF ---
const summaryDoc = ref<GeneratedDocumentResponse | null>(null)
const isGeneratingSummary = ref(false)
const summaryReady = computed(() => summaryDoc.value?.status === 'completed')
let summaryPollTimer: ReturnType<typeof setInterval> | null = null

async function loadSummaryDoc() {
  if (!encounterId.value) return
  try {
    const res = await documentApi.list(encounterId.value)
    summaryDoc.value = res.data.find((d) => d.type === 'consultation-summary') ?? null
  } catch {
    // ignore
  }
}

watch(documentUpdate, async (update) => {
  if (update && (update as Record<string, unknown>).type === 'consultation-summary') {
    const status = (update as Record<string, unknown>).status as string
    if (status === 'completed' || status === 'failed') {
      stopSummaryPolling()
      isGeneratingSummary.value = false
      // Reload full doc to get the id for print/download
      await loadSummaryDoc()
    }
  }
})

async function generateSummary() {
  if (!encounterId.value) return
  isGeneratingSummary.value = true
  try {
    const res = await documentApi.generate(encounterId.value, 'consultation-summary')
    summaryDoc.value = res.data
    startSummaryPolling()
  } catch {
    isGeneratingSummary.value = false
  }
}

function startSummaryPolling() {
  stopSummaryPolling()
  summaryPollTimer = setInterval(async () => {
    await loadSummaryDoc()
    if (summaryDoc.value?.status === 'completed' || summaryDoc.value?.status === 'failed') {
      stopSummaryPolling()
      isGeneratingSummary.value = false
    }
  }, 3000)
}

function stopSummaryPolling() {
  if (summaryPollTimer) {
    clearInterval(summaryPollTimer)
    summaryPollTimer = null
  }
}

async function printSummary() {
  if (!summaryDoc.value?.id) return
  try {
    const url = await documentApi.getSignedUrl(summaryDoc.value.id)
    printPdf(url)
  } catch { /* ignore */ }
}

async function downloadSummary() {
  if (!summaryDoc.value?.id) return
  const tab = openNewTab()
  try {
    const url = await documentApi.getSignedUrl(summaryDoc.value.id)
    tab.navigate(url)
  } catch {
    tab.close()
  }
}

onMounted(async () => {
  loadError.value = null
  try {
    if (route.name === RouteNames.ENCOUNTER_NEW) {
      const patientId = route.params.patientId as string
      const consultationType = (route.query.type as 'default' | 'follow_up') || 'default'
      const consultation = await store.createForPatient(patientId, consultationType)

      await router.replace({
        name: RouteNames.ENCOUNTER_DETAIL,
        params: { patientId, id: consultation.id },
      })
    } else {
      const id = route.params.id as string
      if (!store.current || store.current.id !== id) {
        await store.loadEncounter(id)
      }
    }

    // Load summary doc status if finalized
    if (store.isFinalized) {
      loadSummaryDoc()
    }

    // Load patient data for sidebar
    const pid = store.current?.patient_id
    if (pid && !pdStore.patient) {
      pdStore.loadPatient(pid).then(() => {
        pdStore.loadCore()
        // Lifestyle / family history / medications are patient-level, not FM-only
        if (!pdStore.lifestyle && !pdStore.medications.length && !pdStore.familyHistory.length) {
          pdStore.loadFM()
        }
      })
    }
    // Load recent encounters for sidebar (timeline data)
    if (pid) {
      store.loadForPatient(pid)
    }

    // Auto-open med cert dialog from notification — switch to payment tab
    if (route.query.openMedCert === '1') {
      activeTab.value = 'payment'
      autoOpenMedCert.value = true
      router.replace({ ...route, query: { ...route.query, openMedCert: undefined } })
    }
  } catch (err) {
    if (err instanceof HttpError && err.status === 403) {
      loadError.value = 'You don\'t have permission to access this consultation.'
    } else {
      loadError.value = 'Failed to load consultation. Please try again.'
    }
  }
  setupTabsObserver()
})

// Handle openMedCert query when navigating to same consultation (component reuse)
watch(() => route.query.openMedCert, (val) => {
  if (val === '1') {
    activeTab.value = 'payment'
    autoOpenMedCert.value = true
    router.replace({ ...route, query: { ...route.query, openMedCert: undefined } })
  }
})

onUnmounted(() => {
  tabsObserver?.disconnect()
  tabsObserver = null
  stopSummaryPolling()
  store.clearCurrent()
})

async function handleSave(payload: UpdateEncounterPayload): Promise<void> {
  await store.saveSection(payload)
}

// ── Circle stepper + floating mini tabs ──────────────────────────────────
const stepperRef = ref<HTMLElement | null>(null)
const formScrollRef = ref<HTMLElement | null>(null)
const showMiniTabs = ref(false)
let tabsObserver: IntersectionObserver | null = null

const tabIcons: Record<string, Component> = {
  'triage': Activity,
  'assessment': Stethoscope,
  'treatment-plan': ClipboardPlus,
  'payment': DollarSign,
}

function setupTabsObserver() {
  setTimeout(() => {
    const stepperEl = stepperRef.value
    const scrollEl = formScrollRef.value
    if (!stepperEl || !scrollEl) return
    tabsObserver = new IntersectionObserver(
      ([entry]) => { showMiniTabs.value = !entry!.isIntersecting },
      { root: scrollEl, threshold: 0 },
    )
    tabsObserver.observe(stepperEl)
  }, 300)
}

// ── Sidebar data ────────────────────────────────────────────────────────
const patientInitials = computed(() => {
  const p = pdStore.patient
  if (!p) return '?'
  return `${p.first_name?.charAt(0) ?? ''}${p.last_name?.charAt(0) ?? ''}`.toUpperCase()
})

const activeProblems = computed(() => pdStore.problems.filter((p) => p.status !== 'resolved').slice(0, 5))
const activeAllergies = computed(() => pdStore.allergies.slice(0, 5))
const activeMedications = computed(() => pdStore.medications.filter((m) => m.status === 'active').slice(0, 5))
const familyHistoryEntries = computed(() => pdStore.familyHistory.slice(0, 5))

const lifestyleSummary = computed(() => {
  const ls = pdStore.lifestyle
  if (!ls) return []
  const items: { label: string; value: string }[] = []
  if (ls.smoking) items.push({ label: 'Smoking', value: ls.smoking })
  if (ls.alcohol) items.push({ label: 'Alcohol', value: ls.alcohol })
  if (ls.exercise) items.push({ label: 'Exercise', value: ls.exercise })
  if (ls.diet) items.push({ label: 'Diet', value: ls.diet })
  if (ls.medication_adherence) items.push({ label: 'Med Adherence', value: ls.medication_adherence.replace(/_/g, ' ') })
  return items
})

const recentEncounters = computed(() => {
  return store.patientEncounters
    .filter((e) => e.status === 'finalized' && e.id !== store.current?.id && e.display_line)
    .slice(0, 3)
})

const finalizedEncounterCount = computed(() =>
  store.patientEncounters.filter((e) => e.status === 'finalized' && e.id !== store.current?.id).length,
)

// Trends only meaningful with enough historical data points
const canShowTrends = computed(() => finalizedEncounterCount.value > 3)

const hasLabSummary = computed(() => (store.current?.lab_order_summary?.total ?? 0) > 0)

function formatEncounterDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function openEncounter(encounterId: string) {
  router.push({
    name: RouteNames.ENCOUNTER_DETAIL,
    params: { patientId: store.current!.patient_id, id: encounterId },
  })
}

const clinicalSummary = computed<string | null>(() => {
  const lines: string[] = []
  const problems = pdStore.problems.filter((p) => p.status !== 'resolved')
  const meds = pdStore.medications.filter((m) => m.status === 'active')
  const allergies = pdStore.allergies
  const ls = pdStore.lifestyle
  const fh = pdStore.familyHistory

  const b = (t: string | number) => `<b>${t}</b>`

  if (problems.length) {
    const top = problems.slice(0, 3).map((p) => b(p.description)).join(', ')
    const more = problems.length > 3 ? ` (+${problems.length - 3} more)` : ''
    lines.push(`Active conditions: ${top}${more}.`)
  }
  if (meds.length) {
    lines.push(`On ${b(meds.length + ' active medication' + (meds.length > 1 ? 's' : ''))}.`)
  }
  if (allergies.length) {
    const names = allergies.slice(0, 3).map((a) => b(a.allergen)).join(', ')
    lines.push(`Allergic to ${names}.`)
  }
  if (ls?.smoking && ls.smoking !== 'never') {
    lines.push(`${b(ls.smoking + ' smoker')}.`)
  }
  if (ls?.alcohol && ls.alcohol !== 'none' && ls.alcohol !== 'social') {
    lines.push(`Alcohol use: ${b(ls.alcohol)}.`)
  }
  if (fh.length) {
    const conditions = fh.flatMap((e) => e.conditions.map((c) => c.name)).filter(Boolean)
    const unique = [...new Set(conditions)].slice(0, 3)
    if (unique.length) {
      lines.push(`Family history: ${unique.map(b).join(', ')}.`)
    }
  }
  return lines.length ? lines.join(' ') : null
})

const currentVitals = computed(() => {
  const vitals = store.current?.consultation?.triage?.vitals
  if (!vitals) return null
  const hasAny = Object.values(vitals).some((v) => v != null && v !== '')
  return hasAny ? vitals : null
})

// ── Tabs ────────────────────────────────────────────────────────────────
const allTabs = ['triage', 'assessment', 'treatment-plan', 'payment'] as const
const tabLabels: Record<string, string> = {
  'triage': 'Triage',
  'assessment': 'Assessment',
  'treatment-plan': 'Treatment Plan',
  'payment': 'Payment',
}
const visibleTabs = computed(() =>
  allTabs.filter((tab) => {
    if (tab === 'assessment') return canEditAssessment.value
    return true
  }),
)
const currentTabIndex = computed(() => visibleTabs.value.indexOf(activeTab.value as (typeof allTabs)[number]))
const prevTabLabel = computed(() => {
  const idx = currentTabIndex.value - 1
  return idx >= 0 ? tabLabels[visibleTabs.value[idx]!] : null
})
const nextTabLabel = computed(() => {
  const idx = currentTabIndex.value + 1
  return idx < visibleTabs.value.length ? tabLabels[visibleTabs.value[idx]!] : null
})
function goToTab(direction: 'prev' | 'next') {
  const idx = currentTabIndex.value + (direction === 'next' ? 1 : -1)
  const tab = visibleTabs.value[idx]
  if (tab) activeTab.value = tab
}

async function handleFinalizeConfirm(): Promise<void> {
  await store.finalize()
  if (!store.saveError) {
    showFinalizeModal.value = false
  }
}

async function doFinalizeAndPay(): Promise<void> {
  await store.finalize()
  if (!store.saveError) {
    activeTab.value = 'payment'
  }
}

function proceedAfterFeeWarning() {
  showFeeWarningModal.value = false
  if (pendingFinalizeAction.value === 'pay') {
    doFinalizeAndPay()
  } else {
    showFinalizeModal.value = true
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
    class="-mx-4 -mb-4 flex min-h-0 flex-1 flex-col overflow-hidden"
  >
    <!-- Patient name + actions (sticky) -->
    <div class="sticky top-0 z-10 border-b bg-background">
      <div class="flex flex-col gap-2 px-4 pb-1 pt-2 sm:flex-row sm:items-center sm:justify-between">
        <!-- Left: back + patient name + status badge -->
        <div class="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            class="gap-1.5"
            @click="router.back()"
          >
            <ArrowLeft class="size-3.5" />
            {{ store.current.patient_name }}
          </Button>
          <Badge
            v-if="store.current.type === 'follow_up'"
            variant="secondary"
          >
            Follow-up
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

        <!-- Right: actions (finalized) -->
        <div v-if="store.isFinalized" class="flex items-center gap-2">
          <Button
            v-if="summaryReady"
            variant="outline"
            size="sm"
            @click="printSummary"
          >
            <Printer class="size-3.5" />
            Print
          </Button>
          <Button
            v-if="summaryReady"
            variant="outline"
            size="sm"
            @click="downloadSummary"
          >
            <FileDown class="size-3.5" />
            Download
          </Button>
          <Button
            variant="outline"
            size="sm"
            :disabled="isGeneratingSummary"
            @click="generateSummary"
          >
            <LoaderCircle v-if="isGeneratingSummary" class="size-3.5 animate-spin" />
            <FileText v-else class="size-3.5" />
            {{ isGeneratingSummary ? 'Generating...' : summaryReady ? 'Regenerate' : 'Consultation Summary' }}
          </Button>
        </div>

        <!-- Right: actions (drafts only) -->
        <div v-if="store.isDraft" class="flex items-center gap-2">
          <p v-if="store.isSaving" class="text-xs text-muted-foreground">
            Saving...
          </p>
          <p v-if="store.saveError" class="text-xs text-destructive">
            {{ store.saveError }}
          </p>
          <Button
            variant="outline"
            size="sm"
            @click="showPreviewModal = true"
          >
            <Eye class="size-3.5" />
            Preview
          </Button>
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
            @click="handleFinalizeClick"
          >
            <CheckCircle2 class="size-3.5" />
            Finalize
          </Button>
        </div>
      </div>
    </div>

    <!-- Two-column layout -->
    <div class="relative flex min-h-0 flex-1 flex-col lg:flex-row">

      <!-- Floating mini tabs -->
      <Transition
        enter-active-class="transition-all duration-200 ease-out"
        enter-from-class="opacity-0 -translate-y-2"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition-all duration-150 ease-in"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 -translate-y-2"
      >
        <div v-if="showMiniTabs" class="pointer-events-none absolute inset-x-0 top-2 z-30 flex lg:pr-[25%]">
          <div class="pointer-events-auto mx-auto flex items-center gap-1 rounded-full border bg-background/95 px-2 py-1 shadow-md backdrop-blur">
            <button
              v-for="tab in visibleTabs"
              :key="tab"
              type="button"
              class="flex h-7 items-center justify-center rounded-full px-2 text-[10px] font-medium uppercase tracking-wide transition-all duration-200"
              :class="activeTab === tab
                ? 'gap-1.5 bg-primary text-primary-foreground min-w-[5rem]'
                : 'gap-0 text-muted-foreground hover:bg-muted size-7 min-w-7 max-w-7 px-0'"
              @click="activeTab = tab"
            >
              <component :is="tabIcons[tab]" class="size-3.5 shrink-0" />
              <span
                class="overflow-hidden whitespace-nowrap transition-all duration-200"
                :class="activeTab === tab ? 'max-w-[5rem] opacity-100' : 'max-w-0 opacity-0'"
              >{{ tabLabels[tab] }}</span>
            </button>
          </div>
        </div>
      </Transition>

      <!-- Left: Form content -->
      <div ref="formScrollRef" class="min-h-0 min-w-0 flex-1 overflow-y-auto px-4 pb-4 pt-0 md:px-6 md:pb-8 lg:w-3/4">

        <!-- Hidden TabsList for reka-ui a11y -->
        <TabsList class="sr-only">
          <TabsTrigger v-for="tab in visibleTabs" :key="tab" :value="tab">{{ tabLabels[tab] }}</TabsTrigger>
        </TabsList>

        <div>

          <!-- Circle stepper -->
          <div ref="stepperRef" class="mb-5 py-3">
            <div class="relative mx-0 md:mx-8">
              <!-- Connector line -->
              <div class="absolute top-5 right-5 left-5 h-0.5 bg-border">
                <div
                  class="absolute inset-y-0 left-0 bg-primary/40 transition-all duration-500"
                  :style="{ width: `${visibleTabs.length > 1 ? (currentTabIndex / (visibleTabs.length - 1)) * 100 : 0}%` }"
                />
              </div>
              <!-- Step circles -->
              <div class="relative flex justify-between">
                <button
                  v-for="(tab, i) in visibleTabs"
                  :key="tab"
                  type="button"
                  class="group flex flex-col items-center gap-1.5"
                  @click="activeTab = tab"
                >
                  <div
                    class="flex size-10 items-center justify-center rounded-full border-2 transition-all duration-300"
                    :class="
                      activeTab === tab
                        ? 'border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/25 scale-110'
                        : currentTabIndex > i
                          ? 'border-primary bg-background text-primary hover:scale-105 scale-100'
                          : 'border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground hover:scale-105 scale-100'
                    "
                  >
                    <component :is="tabIcons[tab]" class="size-4" />
                  </div>
                  <span
                    class="text-xs font-semibold uppercase tracking-wide transition-colors duration-200"
                    :class="activeTab === tab ? 'text-primary' : 'text-muted-foreground'"
                  >
                    {{ tabLabels[tab] }}
                  </span>
                </button>
              </div>
            </div>
          </div>

          <!-- Offline banner (inline) -->
          <div
            v-if="!isOnline"
            class="mb-3 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400"
          >
            <WifiOff class="size-3.5 shrink-0" />
            You are offline. Changes will be saved locally and synced when you reconnect.
            <span v-if="pendingCount" class="ml-auto text-xs font-medium">
              {{ pendingCount }} pending
            </span>
          </div>

          <!-- Read-only banner (inline) -->
          <div
            v-if="store.isFinalized"
            class="mb-3 flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2.5 text-sm text-muted-foreground"
          >
            <Lock class="size-3.5 shrink-0" />
            This consultation has been finalized and is read-only.
          </div>

          <!-- ── Triage Tab ──────────────────────────────────────────── -->
          <TabsContent value="triage" class="mt-0 px-0 md:px-8">
            <TriageTab
              :triage="store.current.consultation?.triage"
              :patient-id="store.current.patient_id"
              :encounter-id="store.current.id"
              :disabled="store.isFinalized || !canEditTriage"
              :lab-order-update="labOrderUpdate"
              @save="handleSave"
              @lab-updated="store.loadEncounter(store.current!.id)"
            />
            <div class="mt-5 flex justify-end">
              <Button variant="outline" @click="goToTab('next')">
                {{ nextTabLabel }}
                <ChevronRight class="ml-1 size-4" />
              </Button>
            </div>
          </TabsContent>

          <!-- ── Assessment Tab ───────────────────────────────────────── -->
          <TabsContent v-if="canEditAssessment" value="assessment" class="mt-0 flex flex-col divide-y divide-dashed divide-border px-0 md:px-8 [&>*]:py-8 [&>*:first-child]:pt-0 [&>*:last-child]:pb-0 [&>*:last-child]:border-t-0">
            <!-- Lab Results + Trends (compact, no vitals panel since sidebar shows them) -->
            <div v-if="hasLabSummary || canShowTrends">
              <VitalsSummary
                :triage="store.current.consultation?.triage"
                :patient-id="store.current.patient_id"
                :encounter-id="store.current.id"
                :specialty="store.current.specialty"
                :lab-order-summary="store.current.lab_order_summary"
                :show-trends-button="canShowTrends"
                hide-vitals-panel
              />
            </div>
            <div>
              <AssessmentTab
                :assessment="store.current.consultation?.assessment"
                :disabled="store.isFinalized"
                @save="handleSave"
              />
            </div>
            <div class="flex justify-between">
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

          <!-- ── Treatment Plan Tab ───────────────────────────────────── -->
          <TabsContent value="treatment-plan" class="mt-0 px-0 md:px-8">
            <TreatmentPlanTab
              :treatment-plan="store.current.consultation?.treatment_plan ?? { advice: null, follow_up: null }"
              :encounter-id="store.current.id"
              :patient-id="store.current.patient_id"
              :doctor-id="store.current.doctor_id"
              :consumables="store.current.consumables ?? []"
              :procedures="store.current.procedures ?? []"
              :disabled="store.isFinalized || !canEditTreatmentPlan"
              :lab-order-disabled="store.isFinalized || !authStore.hasPermission('lab-orders.create') || !authStore.hasFeature('lab_orders')"
              :prescription-update="prescriptionUpdate"
              :lab-order-update="labOrderUpdate"
              :document-update="documentUpdate"
              @save="handleSave"
              @update:consumables="(c) => { if (store.current) store.current.consumables = c }"
              @procedures-updated="(p) => { if (store.current) store.current.procedures = p }"
              @lab-updated="store.loadEncounter(store.current!.id)"
            />
            <div class="mt-5 flex items-center justify-between">
              <Button variant="outline" @click="goToTab('prev')">
                <ChevronLeft class="mr-1 size-4" />
                {{ prevTabLabel }}
              </Button>
              <div class="flex items-center gap-2">
                <Button
                  v-if="store.isDraft && canFinalize"
                  :disabled="store.isSaving"
                  @click="handleFinalizeAndPayClick"
                >
                  <LoaderCircle v-if="store.isSaving" class="size-3.5 animate-spin" />
                  <CheckCircle2 v-else class="size-3.5" />
                  Finalize & Payment
                  <ChevronRight class="ml-1 size-4" />
                </Button>
                <Button v-else variant="outline" @click="goToTab('next')">
                  {{ nextTabLabel }}
                  <ChevronRight class="ml-1 size-4" />
                </Button>
              </div>
            </div>
          </TabsContent>

          <!-- ── Payment Tab ──────────────────────────────────────────── -->
          <TabsContent value="payment" class="mt-0 px-0 md:px-8">
            <PaymentTab
              :disabled="store.isFinalized"
              :encounter-id="store.current.id"
              :status="store.current.status"
              :consultation-type="store.current.type"
              :patient-id="store.current.patient_id"
              :diagnoses="store.current.consultation?.assessment?.diagnoses ?? []"
              :document-update="documentUpdate"
              :consumables="store.current.consumables ?? []"
              :procedures="store.current.procedures ?? []"
              :prescription-summary="store.current.prescription_summary"
              :lab-order-summary="store.current.lab_order_summary"
              :payment="store.current.payment"
              :open-med-cert-on-mount="autoOpenMedCert"
              :can-finalize="store.isDraft && canFinalize"
              :is-saving="store.isSaving"
              @update:payment="(p) => { if (store.current) store.current.payment = p }"
              @finalize="handleFinalizeAndPayClick"
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

      <!-- Right: Summary Sidebar -->
      <aside class="hidden min-h-0 overflow-y-auto border-l px-4 pb-4 pt-3 lg:block lg:w-1/4">
        <div class="flex flex-col gap-3">

          <!-- Patient Card -->
          <div v-if="pdStore.patient" class="flex flex-col gap-3 rounded-xl border bg-card p-3">
            <div class="flex items-center gap-3">
              <Avatar class="size-10">
                <AvatarImage v-if="pdStore.patient.avatar_url" :src="pdStore.patient.avatar_url" :alt="pdStore.patient.full_name" />
                <AvatarFallback class="bg-gradient-to-br from-purple-500 to-pink-500 text-sm font-semibold text-white">
                  {{ patientInitials }}
                </AvatarFallback>
              </Avatar>
              <div class="min-w-0 flex-1">
                <p class="text-sm font-bold leading-tight">{{ pdStore.patient.full_name }}</p>
                <div class="flex flex-wrap items-center gap-x-2 text-[10px] text-muted-foreground">
                  <span v-if="pdStore.patientAge !== null">{{ pdStore.patientAge }} yrs</span>
                  <span v-if="pdStore.patient.sex">&middot; {{ pdStore.patient.sex === 'female' ? 'F' : pdStore.patient.sex === 'male' ? 'M' : pdStore.patient.sex }}</span>
                  <span v-if="pdStore.patient.blood_type">&middot; {{ pdStore.patient.blood_type }}</span>
                </div>
              </div>
            </div>
            <Badge
              v-if="store.current?.consultation?.type === 'follow_up'"
              variant="secondary"
              class="w-fit text-[10px]"
            >
              Follow-up
            </Badge>
            <Badge v-else variant="outline" class="w-fit text-[10px]">
              New Consultation
            </Badge>
          </div>

          <!-- Clinical Summary -->
          <div class="rounded-xl border bg-card p-3">
            <div class="flex items-start gap-3">
              <div class="flex size-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-slate-500 to-slate-600 text-white shadow-sm">
                <FileText class="size-4" />
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Clinical Summary</p>
                <p v-if="clinicalSummary" class="mt-1 text-xs leading-relaxed text-muted-foreground [&_b]:text-foreground [&_b]:font-semibold" v-html="clinicalSummary" />
                <p v-else class="mt-1 text-xs italic text-muted-foreground/50">No clinical history recorded yet.</p>
              </div>
            </div>
          </div>

          <!-- Recent Encounters -->
          <div v-if="recentEncounters.length" class="rounded-xl border bg-card p-3">
            <div class="flex items-start gap-3">
              <div class="flex size-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-fuchsia-500 to-pink-500 text-white shadow-sm">
                <Stamp class="size-4" />
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Recent Encounters</p>
                <div class="mt-2 flex flex-col gap-1.5">
                  <button
                    v-for="enc in recentEncounters"
                    :key="enc.id"
                    type="button"
                    class="flex flex-col gap-0.5 rounded-md border border-transparent bg-muted/30 px-2 py-1.5 text-left text-xs transition-colors hover:border-border hover:bg-muted"
                    @click="openEncounter(enc.id)"
                  >
                    <p class="font-medium leading-tight">{{ enc.display_line }}</p>
                    <p class="text-[10px] text-muted-foreground">{{ formatEncounterDate(enc.finalized_at) }}</p>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Current Vitals -->
          <div v-if="currentVitals" class="rounded-xl border bg-card p-3">
            <div class="flex items-start gap-3">
              <div class="flex size-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-rose-500 to-red-500 text-white shadow-sm">
                <Activity class="size-4" />
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Current Vitals</p>
                <div class="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                  <div v-if="currentVitals.bp_systolic && currentVitals.bp_diastolic">
                    <span class="text-muted-foreground">BP</span>
                    <p class="font-medium">{{ currentVitals.bp_systolic }}/{{ currentVitals.bp_diastolic }} mmHg</p>
                  </div>
                  <div v-if="currentVitals.weight">
                    <span class="text-muted-foreground">Weight</span>
                    <p class="font-medium">{{ currentVitals.weight }} kg</p>
                  </div>
                  <div v-if="currentVitals.temp">
                    <span class="text-muted-foreground">Temp</span>
                    <p class="font-medium">{{ currentVitals.temp }}°C</p>
                  </div>
                  <div v-if="currentVitals.spo2">
                    <span class="text-muted-foreground">SpO2</span>
                    <p class="font-medium">{{ currentVitals.spo2 }}%</p>
                  </div>
                  <div v-if="currentVitals.hr">
                    <span class="text-muted-foreground">HR</span>
                    <p class="font-medium">{{ currentVitals.hr }} bpm</p>
                  </div>
                  <div v-if="currentVitals.rr">
                    <span class="text-muted-foreground">RR</span>
                    <p class="font-medium">{{ currentVitals.rr }}/min</p>
                  </div>
                  <div v-if="currentVitals.blood_sugar">
                    <span class="text-muted-foreground">Blood Sugar</span>
                    <p class="font-medium">{{ currentVitals.blood_sugar }} mg/dL</p>
                  </div>
                  <div v-if="currentVitals.height">
                    <span class="text-muted-foreground">Height</span>
                    <p class="font-medium">{{ currentVitals.height }} cm</p>
                  </div>
                  <div v-if="currentVitals.waist_circumference">
                    <span class="text-muted-foreground">Waist</span>
                    <p class="font-medium">{{ currentVitals.waist_circumference }} cm</p>
                  </div>
                  <div v-if="currentVitals.pain_score != null">
                    <span class="text-muted-foreground">Pain</span>
                    <p class="font-medium">{{ currentVitals.pain_score }}/10</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Active Problems -->
          <div class="rounded-xl border bg-card p-3">
            <div class="flex items-start gap-3">
              <div class="flex size-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-sm">
                <AlertCircle class="size-4" />
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Active Problems</p>
                <div v-if="activeProblems.length" class="mt-2 flex flex-col gap-1">
                  <div v-for="p in activeProblems" :key="p.uuid" class="flex items-start gap-1.5 text-xs">
                    <span class="mt-1.5 size-1.5 shrink-0 rounded-full bg-amber-500" />
                    <span>{{ p.description }}</span>
                  </div>
                  <p v-if="pdStore.problems.length > 5" class="text-[10px] text-muted-foreground">
                    +{{ pdStore.problems.length - 5 }} more
                  </p>
                </div>
                <p v-else class="mt-1 text-xs text-muted-foreground">No active problems</p>
              </div>
            </div>
          </div>

          <!-- Allergies -->
          <div class="rounded-xl border bg-card p-3">
            <div class="flex items-start gap-3">
              <div class="flex size-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-sm">
                <ShieldAlert class="size-4" />
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Allergies</p>
                <div v-if="activeAllergies.length" class="mt-2 flex flex-wrap gap-1">
                  <Badge v-for="a in activeAllergies" :key="a.uuid" variant="destructive" class="text-[10px]">
                    {{ a.allergen }}
                  </Badge>
                  <Badge v-if="pdStore.allergies.length > 5" variant="outline" class="text-[10px]">
                    +{{ pdStore.allergies.length - 5 }}
                  </Badge>
                </div>
                <p v-else class="mt-1 text-xs text-muted-foreground">No known allergies</p>
              </div>
            </div>
          </div>

          <!-- Active Medications -->
          <div v-if="activeMedications.length" class="rounded-xl border bg-card p-3">
            <div class="flex items-start gap-3">
              <div class="flex size-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-sm">
                <Pill class="size-4" />
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Active Medications</p>
                <div class="mt-2 flex flex-col gap-1">
                  <div v-for="m in activeMedications" :key="m.uuid" class="flex items-start gap-1.5 text-xs">
                    <span class="mt-1.5 size-1.5 shrink-0 rounded-full bg-blue-500" />
                    <div class="min-w-0 flex-1">
                      <p class="font-medium leading-tight">{{ m.drug_name }}</p>
                      <p v-if="m.dose || m.frequency" class="text-[10px] leading-tight text-muted-foreground">
                        <template v-if="m.dose">{{ m.dose }}</template>
                        <template v-if="m.dose && m.frequency"> · </template>
                        <template v-if="m.frequency">{{ m.frequency }}</template>
                      </p>
                    </div>
                  </div>
                  <p v-if="pdStore.medications.filter(m => m.status === 'active').length > 5" class="text-[10px] text-muted-foreground">
                    +{{ pdStore.medications.filter(m => m.status === 'active').length - 5 }} more
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Lifestyle -->
          <div v-if="lifestyleSummary.length" class="rounded-xl border bg-card p-3">
            <div class="flex items-start gap-3">
              <div class="flex size-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-green-500 text-white shadow-sm">
                <Heart class="size-4" />
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Lifestyle</p>
                <div class="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  <div v-for="item in lifestyleSummary" :key="item.label">
                    <p class="text-[10px] text-muted-foreground">{{ item.label }}</p>
                    <p class="font-medium capitalize leading-tight">{{ item.value }}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Family History -->
          <div v-if="familyHistoryEntries.length" class="rounded-xl border bg-card p-3">
            <div class="flex items-start gap-3">
              <div class="flex size-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-500 text-white shadow-sm">
                <Users class="size-4" />
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Family History</p>
                <div class="mt-2 flex flex-col gap-1.5">
                  <div v-for="f in familyHistoryEntries" :key="f.uuid" class="text-xs">
                    <p class="font-medium capitalize leading-tight">{{ f.relative }}</p>
                    <p v-if="f.conditions.length" class="text-[10px] leading-tight text-muted-foreground">
                      {{ f.conditions.map(c => c.name).join(', ') }}
                    </p>
                  </div>
                  <p v-if="pdStore.familyHistory.length > 5" class="text-[10px] text-muted-foreground">
                    +{{ pdStore.familyHistory.length - 5 }} more
                  </p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </aside>

    </div>

    <!-- Preview Modal -->
    <FinalizeModal
      v-if="store.current"
      :open="showPreviewModal"
      :consultation="store.current"
      :is-saving="false"
      preview-only
      @update:open="showPreviewModal = $event"
    />

    <!-- Finalize Modal -->
    <FinalizeModal
      v-if="store.current"
      :open="showFinalizeModal"
      :consultation="store.current"
      :is-saving="store.isSaving"
      @update:open="showFinalizeModal = $event"
      @confirm="handleFinalizeConfirm"
    />

    <!-- Consultation Fee Warning -->
    <Dialog :open="showFeeWarningModal" @update:open="showFeeWarningModal = $event">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <AlertTriangle class="size-5 text-amber-500" />
            Consultation Fee Not Set
          </DialogTitle>
          <DialogDescription>
            Your consultation fee is not configured. The invoice will be generated without a consultation fee line item. You can set it in your
            <button
              class="inline font-medium text-primary underline underline-offset-2 hover:text-primary/80"
              @click="showFeeWarningModal = false; router.push({ name: RouteNames.ACCOUNT })"
            >account settings</button>.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter class="gap-2 sm:gap-0">
          <Button variant="outline" @click="showFeeWarningModal = false; router.push({ name: RouteNames.ACCOUNT })">
            Go to Settings
          </Button>
          <Button @click="proceedAfterFeeWarning">
            Continue Anyway
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

  </Tabs>
</template>
