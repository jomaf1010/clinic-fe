<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
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
} from 'lucide-vue-next'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const store = useEncounterStore()
const { isOnline, pendingCount } = useOfflineSync()

const encounterId = computed(() => store.current?.id)
const clinicId = computed(() => store.current?.clinic_id)
const patientId = computed(() => store.current?.patient_id)
const { prescriptionUpdate, labOrderUpdate, documentUpdate } = useEncounterSync(encounterId, clinicId)
usePatientSync(patientId, clinicId, () => {})

const canEditTriage = computed(() => authStore.hasPermission('consultations.edit-triage'))
const canEditAssessment = computed(() => authStore.hasPermission('consultations.edit-assessment'))
const canEditTreatmentPlan = computed(() => authStore.hasPermission('consultations.edit-treatment-plan'))
const canFinalize = computed(() => authStore.hasPermission('consultations.finalize'))

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
  stopSummaryPolling()
  store.clearCurrent()
})

async function handleSave(payload: UpdateEncounterPayload): Promise<void> {
  await store.saveSection(payload)
}

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
    size="lg"
    class="-mx-4 flex flex-1 flex-col"
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

    <!-- Tabs row -->
    <TabsList class="w-full justify-start overflow-x-auto overflow-y-hidden px-4">
      <TabsTrigger value="triage">
        <Activity class="size-4" />
        Triage
      </TabsTrigger>
      <TabsTrigger v-if="canEditAssessment" value="assessment">
        <Stethoscope class="size-4" />
        Assessment
      </TabsTrigger>
      <TabsTrigger value="treatment-plan">
        <ClipboardPlus class="size-4" />
        Treatment Plan
      </TabsTrigger>
      <TabsTrigger value="payment">
        <DollarSign class="size-4" />
        Payment
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
      This consultation has been finalized and is read-only.
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto px-4 pb-4 pt-4 md:px-8 md:pb-8">
      <div class="mx-auto max-w-4xl">
        <TabsContent value="triage" class="mt-0">
          <TriageTab
            :triage="store.current.consultation?.triage"
            :patient-id="store.current.patient_id"
            :consultation-id="store.current.id"
            :disabled="store.isFinalized || !canEditTriage"
            :lab-order-update="labOrderUpdate"
            @save="handleSave"
            @lab-updated="store.loadEncounter(store.current!.id)"
          />
          <div class="mt-8 flex justify-end border-t pt-4">
            <Button variant="outline" @click="goToTab('next')">
              {{ nextTabLabel }}
              <ChevronRight class="ml-1 size-4" />
            </Button>
          </div>
        </TabsContent>

        <TabsContent v-if="canEditAssessment" value="assessment" class="mt-0 flex flex-col gap-6">
          <VitalsSummary
              :triage="store.current.consultation?.triage"
              :patient-id="store.current.patient_id"
              :consultation-id="store.current.id"
              :lab-order-summary="store.current.lab_order_summary"
              show-trends-button
            />
          <AssessmentTab
            :assessment="store.current.consultation?.assessment"
            :disabled="store.isFinalized"
            @save="handleSave"
          />
          <div class="mt-8 flex justify-between border-t pt-4">
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

        <TabsContent value="treatment-plan" class="mt-0 flex flex-col gap-6">
          <TreatmentPlanTab
            :treatment-plan="store.current.consultation?.treatment_plan ?? { advice: null, follow_up: null }"
            :consultation-id="store.current.id"
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
          <div class="mt-8 flex items-center justify-between border-t pt-4">
            <Button variant="outline" @click="goToTab('prev')">
              <ChevronLeft class="mr-1 size-4" />
              {{ prevTabLabel }}
            </Button>
            <div class="flex items-center gap-2">
              <Button
                v-if="store.isDraft && canFinalize"
                @click="handleFinalizeAndPayClick"
                :disabled="store.isSaving"
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

        <TabsContent value="payment" class="mt-0">
          <PaymentTab
              :disabled="store.isFinalized"
              :consultation-id="store.current.id"
              :status="store.current.status"
              :consultation-type="store.current.type"
              :patient-id="store.current.patient_id"
              :diagnoses="store.current.consultation?.assessment?.diagnoses ?? []"
              :document-update="documentUpdate"
              :consumables="store.current.consumables ?? []"
              :prescription-summary="store.current.prescription_summary"
              :lab-order-summary="store.current.lab_order_summary"
              :payment="store.current.payment"
              :open-med-cert-on-mount="autoOpenMedCert"
              :can-finalize="store.isDraft && canFinalize"
              :is-saving="store.isSaving"
              @update:payment="(p) => { if (store.current) store.current.payment = p }"
              @finalize="handleFinalizeAndPayClick"
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
