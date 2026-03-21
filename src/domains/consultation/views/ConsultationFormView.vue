<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
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
  PercentCircle,
  FileCheck,
} from 'lucide-vue-next'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
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
import { consultationApi } from '../api/consultationApi'
import { useConsultationStore } from '../stores/consultationStore'
import TriageTab from '../components/tabs/TriageTab.vue'
import AssessmentTab from '../components/tabs/AssessmentTab.vue'
import TreatmentPlanTab from '../components/tabs/TreatmentPlanTab.vue'
import PaymentTab from '../components/tabs/PaymentTab.vue'
import VitalsSummary from '../components/VitalsSummary.vue'
import FinalizeModal from '../components/FinalizeModal.vue'
import MedCertDialog from '../components/MedCertDialog.vue'
import type { UpdateConsultationPayload } from '../types/consultation.types'
import { useConsultationSync } from '../composables/useConsultationSync'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const store = useConsultationStore()
const { isOnline, pendingCount } = useOfflineSync()

const consultationId = computed(() => store.current?.id)
const clinicId = computed(() => store.current?.clinic_id)
const { prescriptionUpdate, labOrderUpdate, documentUpdate } = useConsultationSync(consultationId, clinicId)

const canEditTriage = computed(() => authStore.hasPermission('consultations.edit-triage'))
const canEditAssessment = computed(() => authStore.hasPermission('consultations.edit-assessment'))
const canEditTreatmentPlan = computed(() => authStore.hasPermission('consultations.edit-treatment-plan'))
const canFinalize = computed(() => authStore.hasPermission('consultations.finalize'))

const activeTab = ref('triage')
const showPreviewModal = ref(false)
const showFinalizeModal = ref(false)
const showMedCertDialog = ref(false)
const showFeeDiscountModal = ref(false)
const loadError = ref<string | null>(null)

// Fee discount state
const feeDiscountType = ref<'percentage' | 'fixed'>('percentage')
const feeDiscountValue = ref('')
const isSavingDiscount = ref(false)

function openFeeDiscountModal() {
  const payment = store.current?.payment
  feeDiscountType.value = (payment?.fee_discount_type as 'percentage' | 'fixed') ?? 'percentage'
  feeDiscountValue.value = payment?.fee_discount_value ? String(payment.fee_discount_value) : ''
  showFeeDiscountModal.value = true
}

async function saveFeeDiscount() {
  if (!store.current) return
  isSavingDiscount.value = true
  try {
    const val = parseFloat(feeDiscountValue.value) || 0
    await consultationApi.saveFeeDiscount(store.current.id, {
      fee_discount_type: val > 0 ? feeDiscountType.value : null,
      fee_discount_value: val > 0 ? val : null,
    })
    // Update local state
    if (store.current) {
      store.current = {
        ...store.current,
        payment: {
          ...store.current.payment,
          fee_discount_type: val > 0 ? feeDiscountType.value : null,
          fee_discount_value: val > 0 ? val : null,
        },
      }
    }
    showFeeDiscountModal.value = false
  } catch {
    // silent
  } finally {
    isSavingDiscount.value = false
  }
}

onMounted(async () => {
  loadError.value = null
  try {
    if (route.name === RouteNames.CONSULTATION_NEW) {
      const patientId = route.params.patientId as string
      const consultation = await store.createForPatient(patientId)

      await router.replace({
        name: RouteNames.CONSULTATION_DETAIL,
        params: { patientId, id: consultation.id },
      })
    } else {
      const id = route.params.id as string
      await store.loadConsultation(id)

    }
  } catch {
    loadError.value = 'Failed to load consultation. Please try again.'
  }
})

onUnmounted(() => {
  store.clearCurrent()
})

async function handleSave(payload: UpdateConsultationPayload): Promise<void> {
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
const prevTabLabel = computed(() => currentTabIndex.value > 0 ? tabLabels[visibleTabs.value[currentTabIndex.value - 1]] : null)
const nextTabLabel = computed(() => currentTabIndex.value < visibleTabs.value.length - 1 ? tabLabels[visibleTabs.value[currentTabIndex.value + 1]] : null)
function goToTab(direction: 'prev' | 'next') {
  const idx = currentTabIndex.value + (direction === 'next' ? 1 : -1)
  if (idx >= 0 && idx < visibleTabs.value.length) activeTab.value = visibleTabs.value[idx]
}

async function handleFinalizeConfirm(): Promise<void> {
  await store.finalize()
  if (!store.saveError) {
    showFinalizeModal.value = false
  }
}

async function handleFinalizeAndPay(): Promise<void> {
  await store.finalize()
  if (!store.saveError) {
    activeTab.value = 'payment'
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
            @click="showFinalizeModal = true"
          >
            <CheckCircle2 class="size-3.5" />
            Finalize
          </Button>
        </div>
      </div>
    </div>

    <!-- Tabs row -->
    <TabsList class="w-full justify-start px-4">
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
            :triage="store.current.triage"
            :patient-id="store.current.patient_id"
            :patient-allergies="store.current.patient_allergies ?? []"
            :patient-conditions="store.current.patient_conditions ?? []"
            :consultation-id="store.current.id"
            :disabled="store.isFinalized || !canEditTriage"
            @save="handleSave"
            @patient-updated="store.loadConsultation(store.current!.id)"
            @lab-updated="store.loadConsultation(store.current!.id)"
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
              :triage="store.current.triage"
              :allergies="store.current.patient_allergies ?? []"
              :conditions="store.current.patient_conditions ?? []"
              :patient-id="store.current.patient_id"
              :consultation-id="store.current.id"
              :lab-order-summary="store.current.lab_order_summary"
              show-trends-button
            />
          <AssessmentTab
            :assessment="store.current.assessment"
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
            :treatment-plan="store.current.treatment_plan ?? { advice: null, follow_up: null }"
            :consultation-id="store.current.id"
            :patient-id="store.current.patient_id"
            :doctor-id="store.current.created_by"
            :consumables="store.current.consumables ?? []"
            :disabled="store.isFinalized || !canEditTreatmentPlan"
            :lab-order-disabled="store.isFinalized || !authStore.hasPermission('lab-orders.create')"
            :prescription-update="prescriptionUpdate"
            :lab-order-update="labOrderUpdate"
            :document-update="documentUpdate"
            @save="handleSave"
            @update:consumables="(c) => { if (store.current) store.current.consumables = c }"
            @lab-updated="store.loadConsultation(store.current!.id)"
          />
          <div class="mt-8 flex items-center justify-between border-t pt-4">
            <Button variant="outline" @click="goToTab('prev')">
              <ChevronLeft class="mr-1 size-4" />
              {{ prevTabLabel }}
            </Button>
            <div class="flex items-center gap-2">
              <Button
                v-if="store.isDraft"
                variant="outline"
                size="sm"
                @click="openFeeDiscountModal"
              >
                <PercentCircle class="size-3.5" />
                <span class="hidden sm:inline">Fee Discount</span>
              </Button>
              <Badge
                v-if="store.current?.payment?.fee_discount_value"
                variant="outline"
                class="border-green-300 bg-green-100 text-green-700 dark:border-green-700 dark:bg-green-950 dark:text-green-400"
              >
                {{ store.current.payment.fee_discount_type === 'percentage' ? `${store.current.payment.fee_discount_value}% off` : `₱${store.current.payment.fee_discount_value} off` }}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                @click="showMedCertDialog = true"
              >
                <FileCheck class="size-3.5" />
                Medical Certificate
              </Button>
              <Button
                v-if="store.isDraft && canFinalize"
                @click="handleFinalizeAndPay"
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

    <!-- Medical Certificate Dialog -->
    <MedCertDialog
      v-if="store.current"
      :open="showMedCertDialog"
      :consultation-id="store.current.id"
      :diagnoses="store.current.assessment?.diagnoses ?? []"
      :document-update="documentUpdate"
      @update:open="showMedCertDialog = $event"
    />

    <!-- Fee Discount Modal -->
    <Dialog v-model:open="showFeeDiscountModal">
      <DialogContent class="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <PercentCircle class="size-5 text-primary" />
            Consultation Fee Discount
          </DialogTitle>
          <DialogDescription>
            Set a discount on the consultation fee for this visit.
          </DialogDescription>
        </DialogHeader>

        <div class="flex flex-col gap-4">
          <div class="flex gap-2">
            <Button
              type="button"
              size="sm"
              :variant="feeDiscountType === 'percentage' ? 'default' : 'outline'"
              @click="feeDiscountType = 'percentage'"
            >
              Percentage (%)
            </Button>
            <Button
              type="button"
              size="sm"
              :variant="feeDiscountType === 'fixed' ? 'default' : 'outline'"
              @click="feeDiscountType = 'fixed'"
            >
              Fixed (₱)
            </Button>
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs text-muted-foreground">
              {{ feeDiscountType === 'percentage' ? 'Discount %' : 'Discount Amount (₱)' }}
            </label>
            <Input
              v-model="feeDiscountValue"
              type="number"
              min="0"
              :max="feeDiscountType === 'percentage' ? '100' : undefined"
              step="0.01"
              :placeholder="feeDiscountType === 'percentage' ? 'e.g. 20' : 'e.g. 100'"
              :disabled="isSavingDiscount"
            />
          </div>
        </div>

        <DialogFooter class="gap-2 sm:gap-0">
          <Button variant="outline" :disabled="isSavingDiscount" @click="showFeeDiscountModal = false">
            Cancel
          </Button>
          <Button :disabled="isSavingDiscount" @click="saveFeeDiscount">
            <LoaderCircle v-if="isSavingDiscount" class="size-3.5 animate-spin" />
            Save Discount
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </Tabs>
</template>
