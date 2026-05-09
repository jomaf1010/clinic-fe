<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  CheckCircle2,
  DollarSign,
  FileText,
  FileCheck,
  ExternalLink,
  LoaderCircle,
  RefreshCw,
  CreditCard,
  Banknote,
  Pencil,
  Printer,
  FileDown,
  PercentCircle,
  Pill,
} from 'lucide-vue-next'
import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'
import Separator from '@/components/ui/separator/Separator.vue'
import Skeleton from '@/components/ui/skeleton/Skeleton.vue'
import { toast } from 'vue-sonner'
import { useAuthStore } from '@/domains/auth/stores/authStore'
import { useBillingStore } from '@/domains/billing/stores/billingStore'
import { documentApi, type GeneratedDocumentResponse } from '../../api/documentApi'
import { openNewTab, printPdf } from '@/lib/utils'
import { useFeeDiscount } from '../../composables/useFeeDiscount'
import MedCertDialog from '../MedCertDialog.vue'
import InvoiceStatusBadge from '@/domains/billing/components/InvoiceStatusBadge.vue'
import RecordPaymentDialog from '@/domains/billing/components/RecordPaymentDialog.vue'
import type { InvoiceResponse } from '@/domains/billing/types/billing.types'
import type {
  ConsultationPayment,
  ConsultationConsumable,
  PrescriptionSummary,
  LabOrderSummary,
  AssessmentDiagnosis,
  ConsultationType,
} from '../../types/consultation.types'
import { RouteNames } from '@/router/routeNames'

const props = withDefaults(defineProps<{
  disabled: boolean
  encounterId: string
  status: 'draft' | 'finalized'
  consultationType: ConsultationType
  patientId: string
  diagnoses: AssessmentDiagnosis[]
  documentUpdate?: GeneratedDocumentResponse | null
  consumables: ConsultationConsumable[]
  procedures?: Array<{ service_id: string; name: string; quantity: number; unit_price: number | null; notes: string | null }>
  prescriptionSummary: PrescriptionSummary | null
  labOrderSummary: LabOrderSummary | null
  payment: ConsultationPayment
  openMedCertOnMount?: boolean
  canFinalize?: boolean
  isSaving?: boolean
  encounterType?: string
  deliveryMode?: string | null
}>(), {
  openMedCertOnMount: false,
  canFinalize: false,
  isSaving: false,
  encounterType: 'consultation',
  deliveryMode: null,
})

const emit = defineEmits<{
  'update:payment': [payment: ConsultationPayment]
  'finalize': []
}>()

const router = useRouter()
const authStore = useAuthStore()
const billingStore = useBillingStore()

const invoice = ref<InvoiceResponse | null>(null)
const isLoading = ref(false)
const loadError = ref<string | null>(null)
const showPaymentDialog = ref(false)
const showMedCertDialog = ref(false)

const isDraft = computed(() => props.status === 'draft')
const isFinalized = computed(() => props.status === 'finalized')
const hasInvoice = computed(() => invoice.value !== null)
const canManage = computed(() => authStore.hasPermission('billing.manage'))
const canGenerate = computed(() => authStore.hasPermission('encounters.edit-treatment-plan'))

// Documents
const prescriptionDoc = ref<GeneratedDocumentResponse | null>(null)
const medCertDoc = ref<GeneratedDocumentResponse | null>(null)
const isLoadingDocs = ref(false)

async function loadDocuments() {
  isLoadingDocs.value = true
  try {
    const res = await documentApi.list(props.encounterId)
    prescriptionDoc.value = res.data.find((d) => d.type === 'prescription') ?? null
    medCertDoc.value = res.data.find((d) => d.type === 'medical-certificate') ?? null
  } catch {
    // ignore
  } finally {
    isLoadingDocs.value = false
  }
}

watch(() => props.documentUpdate, (update) => {
  if (update && update.type === 'prescription') {
    prescriptionDoc.value = update
    if (update.status === 'completed' || update.status === 'failed') {
      stopPrescriptionPolling()
      isGeneratingPrescription.value = false
    }
  }
  if (update && update.type === 'medical-certificate') {
    medCertDoc.value = update
  }
})

const hasPrescription = computed(() =>
  (props.prescriptionSummary?.items?.length ?? 0) > 0,
)

const prescriptionReady = computed(() => prescriptionDoc.value?.status === 'completed')
const medCertReady = computed(() => medCertDoc.value?.status === 'completed')

async function ensureMedCertDocId(): Promise<string | null> {
  if (medCertDoc.value?.id) return medCertDoc.value.id
  await loadDocuments()
  return medCertDoc.value?.id ?? null
}

async function printMedCert() {
  const docId = await ensureMedCertDocId()
  if (!docId) return
  try {
    const url = await documentApi.getSignedUrl(docId)
    printPdf(url)
  } catch {
    toast.error('Failed to get medical certificate')
  }
}

async function downloadMedCert() {
  const docId = await ensureMedCertDocId()
  if (!docId) return
  const tab = openNewTab()
  try {
    const url = await documentApi.getSignedUrl(docId)
    await tab.navigate(url)
  } catch {
    tab.close()
    toast.error('Failed to get medical certificate')
  }
}
const isGeneratingPrescription = ref(false)

async function generatePrescription() {
  isGeneratingPrescription.value = true
  try {
    const res = await documentApi.generate(props.encounterId, 'prescription')
    prescriptionDoc.value = res.data
    startPrescriptionPolling()
  } catch {
    toast.error('Failed to generate prescription PDF')
    isGeneratingPrescription.value = false
  }
}

let prescriptionPollTimer: ReturnType<typeof setInterval> | null = null

function startPrescriptionPolling() {
  stopPrescriptionPolling()
  prescriptionPollTimer = setInterval(async () => {
    await loadDocuments()
    if (prescriptionDoc.value?.status === 'completed' || prescriptionDoc.value?.status === 'failed') {
      stopPrescriptionPolling()
      isGeneratingPrescription.value = false
      if (prescriptionDoc.value.status === 'completed') {
        toast.success('Prescription PDF is ready')
      }
    }
  }, 3000)
}

function stopPrescriptionPolling() {
  if (prescriptionPollTimer) {
    clearInterval(prescriptionPollTimer)
    prescriptionPollTimer = null
  }
}

async function ensurePrescriptionDocId(): Promise<string | null> {
  if (prescriptionDoc.value?.id) return prescriptionDoc.value.id
  // Real-time update may not include the id — reload from API
  await loadDocuments()
  return prescriptionDoc.value?.id ?? null
}

async function openPrescriptionPdf() {
  const docId = await ensurePrescriptionDocId()
  if (!docId) return
  const tab = openNewTab()
  try {
    const url = await documentApi.getSignedUrl(docId)
    await tab.navigate(url)
  } catch {
    tab.close()
    toast.error('Failed to get prescription PDF')
  }
}

async function printPrescription() {
  const docId = await ensurePrescriptionDocId()
  if (!docId) return
  try {
    const url = await documentApi.getSignedUrl(docId)
    printPdf(url)
  } catch {
    toast.error('Failed to get prescription PDF')
  }
}

// Fee discount
const {
  feeDiscountType,
  feeDiscountValue,
  isSavingDiscount,
  showFeeDiscountModal,
  openFeeDiscountModal,
  saveFeeDiscount,
} = useFeeDiscount(
  () => ({
    id: props.encounterId,
    payment: props.payment,
  } as any),
  (updated) => {
    if (updated.payment) {
      emit('update:payment', updated.payment)
    }
  },
)

// Map encounter delivery_mode values to specialty_fees keys
const deliveryModeFeeMap: Record<string, string> = {
  vaginal_spontaneous: 'nsd',
  cesarean: 'cesarean_section',
  vacuum: 'vacuum_assisted',
  forceps: 'forceps_assisted',
}

// Estimated charges (draft mode)
const isDeliveryEncounter = computed(() => props.encounterType === 'delivery')

const consultationFee = computed(() => {
  // For delivery encounters, use specialty delivery fee
  if (isDeliveryEncounter.value && props.deliveryMode) {
    const feeKey = deliveryModeFeeMap[props.deliveryMode]
    if (feeKey) {
      return authStore.user?.specialty_fees?.[feeKey] ?? 0
    }
  }

  const isFollowUp = props.consultationType === 'follow_up'
  const doctorFee = isFollowUp ? authStore.user?.follow_up_fee : authStore.user?.consultation_fee
  const clinicFee = isFollowUp
    ? authStore.currentClinic?.settings?.default_follow_up_fee
    : authStore.currentClinic?.settings?.default_consultation_fee
  return doctorFee ?? clinicFee ?? 0
})

const feeLabel = computed(() => {
  if (isDeliveryEncounter.value && props.deliveryMode) {
    const labels: Record<string, string> = {
      vaginal_spontaneous: 'NSD Fee',
      cesarean: 'Cesarean Section Fee',
      vacuum: 'Vacuum-Assisted Fee',
      forceps: 'Forceps-Assisted Fee',
    }
    return labels[props.deliveryMode] ?? 'Delivery Fee'
  }
  return props.consultationType === 'follow_up' ? 'Follow-up Fee' : 'Consultation Fee'
})

const medicinesTotalEstimate = computed(() => {
  if (!props.prescriptionSummary?.items?.length) return 0
  return props.prescriptionSummary.items.reduce((sum, item) => {
    const qty = (item as any).quantity ?? 0
    const price = (item as any).unit_price ?? 0
    return sum + qty * price
  }, 0)
})

const consumablesTotalEstimate = computed(() => {
  return props.consumables.reduce((sum, c) => sum + c.quantity * (c.unit_price ?? 0), 0)
})

const proceduresTotalEstimate = computed(() => {
  if (!props.procedures?.length) return 0
  return props.procedures.reduce((sum, p) => sum + p.quantity * (p.unit_price ?? 0), 0)
})

const discountAmount = computed(() => {
  const fee = consultationFee.value
  const type = props.payment?.fee_discount_type
  const val = props.payment?.fee_discount_value ?? 0
  if (!type || val <= 0) return 0
  if (type === 'percentage') return fee * Math.min(val, 100) / 100
  return Math.min(val, fee)
})

const estimatedTotal = computed(() => {
  const fee = consultationFee.value - discountAmount.value
  return Math.max(0, fee) + medicinesTotalEstimate.value + consumablesTotalEstimate.value + proceduresTotalEstimate.value
})

// Edit mode (finalized)
const isEditing = ref(false)
const editedQuantities = ref<Record<string, number>>({})

const canEdit = computed(() =>
  invoice.value
  && invoice.value.status !== 'void'
  && invoice.value.amount_paid === 0
  && canManage.value,
)

function startEditing() {
  if (!invoice.value) return
  editedQuantities.value = {}
  for (const item of invoice.value.line_items) {
    editedQuantities.value[item.id] = item.quantity
  }
  isEditing.value = true
}

function cancelEditing() {
  if (!invoice.value) return
  for (const item of invoice.value.line_items) {
    editedQuantities.value[item.id] = item.quantity
  }
  isEditing.value = false
}

async function saveItemQty(itemId: string) {
  if (!invoice.value) return
  const original = invoice.value.line_items.find((i) => i.id === itemId)
  if (!original || editedQuantities.value[itemId] === original.quantity) return

  const isMedicine = original.type === 'medicine'

  try {
    await billingStore.updateInvoice(invoice.value.id, [
      { id: itemId, quantity: editedQuantities.value[itemId] ?? 0 },
    ])
    invoice.value = billingStore.currentInvoice

    if (isMedicine) {
      const settings = authStore.currentClinic?.settings
      const isAdjustedMode = settings?.prescription_quantity_mode === 'adjusted'
      const autoRegen = isAdjustedMode && settings?.auto_regenerate_pdf_on_qty_change !== false

      if (autoRegen) {
        regeneratePdf()
      } else if (isAdjustedMode) {
        promptRegenerate()
      }
    }
  } catch {
    editedQuantities.value[itemId] = original.quantity
  }
}

function promptRegenerate() {
  toast('Prescription quantities changed', {
    description: 'Would you like to regenerate the prescription PDF?',
    action: {
      label: 'Regenerate',
      onClick: () => regeneratePdf(),
    },
    duration: 8000,
  })
}

async function regeneratePdf() {
  try {
    await documentApi.generate(props.encounterId, 'prescription')
    toast.success('Prescription PDF is being regenerated')
  } catch {
    toast.error('Failed to regenerate prescription PDF')
  }
}

function calcMedicinePricing(quantity: number, item: { price_per_piece?: number | null; price_per_pack?: number | null; quantity_per_pack?: number | null; unit_price: number }): number {
  const ppp = item.price_per_piece ?? item.unit_price
  const ppk = item.price_per_pack ?? 0
  const qpk = item.quantity_per_pack ?? 0

  if (ppk > 0 && qpk > 0 && quantity >= qpk) {
    const packs = Math.floor(quantity / qpk)
    const remaining = quantity % qpk
    return packs * ppk + remaining * ppp
  }
  return quantity * ppp
}

function editedSubtotal(item: NonNullable<typeof invoice.value>['line_items'][number]): number {
  const qty = editedQuantities.value[item.id] ?? 0
  if (item.type === 'medicine' && (item.price_per_pack || item.price_per_piece)) {
    return calcMedicinePricing(qty, item)
  }
  return qty * item.unit_price
}

function formatCurrency(amount: number): string {
  return '\u20B1' + amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function lineItemTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    consultation_fee: 'Consultation Fee',
    medicine: 'Medicine',
    consumable: 'Consumable',
    lab_service: 'Lab Service',
    custom: 'Custom',
  }
  return labels[type] ?? type
}

async function fetchInvoice() {
  isLoading.value = true
  loadError.value = null
  try {
    const result = await billingStore.fetchForEncounter(props.encounterId)
    invoice.value = result
  } catch {
    invoice.value = null
    loadError.value = 'Failed to load invoice.'
  } finally {
    isLoading.value = false
  }
}

function onPaymentRecorded() {
  fetchInvoice()
}

function goToBilling() {
  router.push({ name: RouteNames.BILLING })
}

// Auto-open med cert from notification deep link
watch(() => props.openMedCertOnMount, (val) => {
  if (val) showMedCertDialog.value = true
}, { immediate: true })

onMounted(() => {
  loadDocuments()
  if (isFinalized.value) {
    fetchInvoice()
  }
})

// When status changes from draft → finalized, fetch the newly created invoice
watch(() => props.status, (newStatus, oldStatus) => {
  if (newStatus === 'finalized' && oldStatus === 'draft') {
    fetchInvoice()
  }
})
</script>

<template>
  <!-- Documents section (always visible) -->
  <div class="mb-8 flex flex-col gap-5">
    <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Documents</h3>
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <!-- Prescription PDF -->
      <div
        v-if="hasPrescription"
        class="surface-card-lite flex flex-col gap-4 rounded-2xl border p-4"
      >
        <div class="flex items-center gap-3">
          <div class="flex size-8 shrink-0 items-center justify-center rounded-full bg-blue-100 shadow-[0_10px_24px_rgba(37,99,235,0.12)] dark:bg-blue-950">
            <Pill class="size-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p class="text-sm font-medium">Prescription</p>
            <p class="text-xs text-muted-foreground">{{ prescriptionSummary?.total ?? 0 }} item(s)</p>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <Button
            v-if="prescriptionReady"
            variant="outline"
            size="sm"
            class="h-8 gap-1.5 px-3 text-xs"
            @click.stop="printPrescription"
          >
            <Printer class="size-3" />
            <span class="hidden sm:inline">Print</span>
          </Button>
          <Button
            v-if="prescriptionReady"
            variant="outline"
            size="sm"
            class="h-8 gap-1.5 px-3 text-xs"
            @click.stop="openPrescriptionPdf"
          >
            <FileDown class="size-3" />
            <span class="hidden sm:inline">Download</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            class="h-8 gap-1.5 px-3 text-xs"
            :disabled="isGeneratingPrescription"
            @click.stop="generatePrescription"
          >
            <LoaderCircle v-if="isGeneratingPrescription" class="size-3 animate-spin" />
            <FileText v-else class="size-3" />
            <span class="hidden sm:inline">{{ isGeneratingPrescription ? 'Generating...' : prescriptionReady ? 'Regenerate' : 'Generate PDF' }}</span>
          </Button>
        </div>
      </div>

      <!-- Medical Certificate -->
      <div class="surface-card-lite flex flex-col gap-4 rounded-2xl border p-4">
        <div class="flex items-center gap-3">
          <div class="flex size-8 shrink-0 items-center justify-center rounded-full bg-green-100 shadow-[0_10px_24px_rgba(22,163,74,0.12)] dark:bg-green-950">
            <FileCheck class="size-4 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p class="text-sm font-medium">Medical Certificate</p>
            <p class="text-xs text-muted-foreground">
              {{ medCertReady ? 'Ready' : canGenerate ? 'Not generated' : 'View certificate' }}
            </p>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <Button
            v-if="medCertReady"
            variant="outline"
            size="sm"
            class="h-8 gap-1.5 px-3 text-xs"
            @click="printMedCert"
          >
            <Printer class="size-3" />
            <span class="hidden sm:inline">Print</span>
          </Button>
          <Button
            v-if="medCertReady"
            variant="outline"
            size="sm"
            class="h-8 gap-1.5 px-3 text-xs"
            @click="downloadMedCert"
          >
            <FileDown class="size-3" />
            <span class="hidden sm:inline">Download</span>
          </Button>
          <Button
            v-if="canGenerate"
            variant="outline"
            size="sm"
            class="h-8 gap-1.5 px-3 text-xs"
            @click="showMedCertDialog = true"
          >
            <FileCheck class="size-3" />
            <span class="hidden sm:inline">{{ medCertReady ? 'Regenerate' : 'Generate' }}</span>
          </Button>
          <Button
            v-else-if="!medCertReady"
            variant="outline"
            size="sm"
            class="h-8 gap-1.5 px-3 text-xs"
            disabled
          >
            <span class="text-xs text-muted-foreground">Not generated</span>
          </Button>
        </div>
      </div>
    </div>
  </div>

  <!-- Draft state — Estimated Charges + Fee Discount -->
  <div v-if="isDraft" class="flex flex-col divide-y divide-dashed divide-border [&>*]:py-8 [&>*:first-child]:pt-0 [&>*:last-child]:pb-0">
    <!-- Estimated Charges -->
    <div class="flex flex-col gap-4">
      <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Estimated Charges</h3>
      <div class="surface-card-lite flex flex-col gap-1.5 rounded-2xl border p-4">
        <div class="flex justify-between text-sm">
          <span class="text-muted-foreground">{{ feeLabel }}</span>
          <span class="tabular-nums">{{ formatCurrency(consultationFee) }}</span>
        </div>
        <p v-if="isDeliveryEncounter && !deliveryMode" class="text-xs text-muted-foreground italic">
          Select a delivery mode to see the delivery fee
        </p>
        <div v-if="discountAmount > 0" class="flex justify-between text-sm">
          <span class="text-muted-foreground">
            Discount
            <span v-if="payment?.fee_discount_type === 'percentage'">({{ payment.fee_discount_value }}%)</span>
          </span>
          <span class="tabular-nums text-green-600">-{{ formatCurrency(discountAmount) }}</span>
        </div>
        <div v-if="medicinesTotalEstimate > 0" class="flex justify-between text-sm">
          <span class="text-muted-foreground">Medicines</span>
          <span class="tabular-nums">{{ formatCurrency(medicinesTotalEstimate) }}</span>
        </div>
        <div v-if="proceduresTotalEstimate > 0" class="flex flex-col gap-0.5">
          <div class="flex justify-between text-sm">
            <span class="text-muted-foreground">Procedures ({{ procedures?.length }})</span>
            <span class="tabular-nums">{{ formatCurrency(proceduresTotalEstimate) }}</span>
          </div>
          <!-- Per-line breakdown so the dentist / front-desk can see exactly
               which procedures sum to the total above. -->
          <ul class="ml-3 flex flex-col gap-0.5 border-l border-border/60 pl-3">
            <li
              v-for="(proc, i) in procedures ?? []"
              :key="proc.service_id || i"
              class="flex justify-between gap-3 text-xs text-muted-foreground"
            >
              <span class="min-w-0 flex-1 truncate">
                <span v-if="proc.quantity > 1" class="mr-1 font-mono text-[10px]">×{{ proc.quantity }}</span>
                {{ proc.name }}
              </span>
              <span class="tabular-nums">{{ formatCurrency(proc.quantity * (proc.unit_price ?? 0)) }}</span>
            </li>
          </ul>
        </div>
        <div v-if="consumablesTotalEstimate > 0" class="flex justify-between text-sm">
          <span class="text-muted-foreground">Consumables</span>
          <span class="tabular-nums">{{ formatCurrency(consumablesTotalEstimate) }}</span>
        </div>
        <div v-if="labOrderSummary && labOrderSummary.total > 0" class="flex justify-between text-sm">
          <span class="text-muted-foreground">Lab Services ({{ labOrderSummary.total }})</span>
          <span class="text-xs text-muted-foreground italic">calculated at finalization</span>
        </div>
        <Separator class="my-1" />
        <div class="flex justify-between text-sm font-semibold">
          <span>Estimated Total</span>
          <span class="tabular-nums">{{ formatCurrency(estimatedTotal) }}</span>
        </div>
      </div>
    </div>

    <!-- Fee Discount -->
    <div class="flex flex-col gap-4">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Fee Discount</h3>
        <Button
          v-if="payment?.fee_discount_value"
          variant="ghost"
          size="sm"
          class="h-6 gap-1 px-2 text-xs text-green-600"
          @click="openFeeDiscountModal"
        >
          {{ payment.fee_discount_type === 'percentage' ? `${payment.fee_discount_value}% off` : `₱${payment.fee_discount_value} off` }}
          <Pencil class="size-3" />
        </Button>
      </div>
      <div v-if="!showFeeDiscountModal" class="flex items-center gap-2">
        <Button variant="outline" size="sm" @click="openFeeDiscountModal">
          <PercentCircle class="size-3.5" />
          {{ payment?.fee_discount_value ? 'Edit Discount' : 'Add Discount' }}
        </Button>
      </div>
      <div v-else class="surface-card-lite flex flex-col gap-3 rounded-2xl border p-4">
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
        <div class="flex justify-end gap-2">
          <Button variant="outline" size="sm" :disabled="isSavingDiscount" @click="showFeeDiscountModal = false">
            Cancel
          </Button>
          <Button size="sm" :disabled="isSavingDiscount" @click="saveFeeDiscount">
            <LoaderCircle v-if="isSavingDiscount" class="size-3.5 animate-spin" />
            Save
          </Button>
        </div>
      </div>
    </div>

  </div>

  <!-- Finalize button -->
  <Button
    v-if="isDraft && canFinalize"
    class="mt-5 w-full"
    :disabled="isSaving"
    @click="emit('finalize')"
  >
    <LoaderCircle v-if="isSaving" class="size-4 animate-spin" />
    <CheckCircle2 v-else class="size-4" />
    Finalize Consultation
  </Button>

  <!-- Loading -->
  <div v-else-if="isLoading" class="flex flex-col gap-4 py-4">
    <Skeleton class="h-6 w-48" />
    <Skeleton class="h-32 w-full" />
    <Skeleton class="h-20 w-full" />
  </div>

  <!-- Error -->
  <div
    v-else-if="loadError"
    class="flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-8 text-center"
  >
    <p class="text-sm text-destructive">{{ loadError }}</p>
    <Button variant="outline" size="sm" @click="fetchInvoice">
      <RefreshCw class="mr-2 size-3.5" />
      Retry
    </Button>
  </div>

  <!-- Finalized, no invoice -->
  <div
    v-else-if="isFinalized && !hasInvoice"
    class="flex flex-col items-center justify-center gap-4 py-16 text-center"
  >
    <div class="flex size-12 items-center justify-center rounded-full bg-muted">
      <FileText class="size-6 text-muted-foreground" />
    </div>
    <div>
      <p class="font-medium text-muted-foreground">No invoice for this consultation</p>
      <p class="mt-1 text-sm text-muted-foreground">
        This consultation was finalized before billing was enabled, or had no billable items.
      </p>
    </div>
  </div>

  <!-- Finalized with invoice -->
  <div v-else-if="invoice" class="flex flex-col divide-y divide-dashed divide-border [&>*]:py-5 [&>*:first-child]:pt-0 [&>*:last-child]:pb-0">
    <!-- Header -->
    <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div class="flex items-center gap-3">
        <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{{ invoice.invoice_number }}</h3>
        <InvoiceStatusBadge :status="invoice.status" />
      </div>
      <Button variant="outline" size="sm" @click="goToBilling">
        <ExternalLink class="size-3.5" />
        View Full Invoice
      </Button>
    </div>

    <!-- Line items -->
    <div class="flex flex-col gap-4">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Line Items</h3>
        <template v-if="canEdit">
          <Button v-if="isEditing" variant="ghost" size="sm" class="h-6 gap-1 px-2 text-xs" @click="cancelEditing">
            Done
          </Button>
          <Button v-else variant="ghost" size="sm" class="h-6 gap-1 px-2 text-xs" @click="startEditing">
            <Pencil class="size-3" />
            Edit Qty
          </Button>
        </template>
      </div>
      <div class="rounded-lg border">
        <div
          v-for="item in invoice.line_items"
          :key="item.id"
          class="flex items-center justify-between border-b px-4 py-3 last:border-b-0"
        >
          <div class="flex-1">
            <p class="text-sm font-medium">{{ item.description }}</p>
            <p class="text-xs text-muted-foreground">
              {{ lineItemTypeLabel(item.type) }}
              <span v-if="item.price_breakdown"> &middot; {{ item.price_breakdown }}</span>
              <span v-else-if="item.quantity > 1"> &middot; {{ item.quantity }} &times; {{ formatCurrency(item.unit_price) }}</span>
            </p>
          </div>
          <!-- Edit mode (not for consultation fee) -->
          <div v-if="isEditing && item.type !== 'consultation_fee'" class="flex items-center gap-2">
            <Input
              :model-value="editedQuantities[item.id]"
              type="number"
              min="1"
              class="h-7 w-16 text-center text-xs"
              @update:model-value="editedQuantities[item.id] = Number($event) || 1"
              @blur="saveItemQty(item.id)"
            />
            <span class="w-16 shrink-0 text-right text-xs tabular-nums font-medium">
              {{ formatCurrency(editedSubtotal(item)) }}
            </span>
          </div>
          <!-- View mode -->
          <span v-else class="text-sm font-medium tabular-nums">{{ formatCurrency(item.subtotal) }}</span>
        </div>
      </div>
    </div>

    <!-- Totals -->
    <div class="flex flex-col gap-1.5 rounded-lg bg-muted/50 p-4">
      <div class="flex justify-between text-sm">
        <span class="text-muted-foreground">Subtotal</span>
        <span class="tabular-nums">{{ formatCurrency(invoice.subtotal) }}</span>
      </div>
      <div v-if="invoice.discount_amount > 0" class="flex justify-between text-sm">
        <span class="text-muted-foreground">
          Discount
          <span v-if="invoice.discount_type === 'percentage'">({{ invoice.discount_value }}%)</span>
        </span>
        <span class="tabular-nums text-green-600">-{{ formatCurrency(invoice.discount_amount) }}</span>
      </div>
      <Separator />
      <div class="flex justify-between text-sm font-semibold">
        <span>Total</span>
        <span class="tabular-nums">{{ formatCurrency(invoice.total) }}</span>
      </div>
      <div class="flex justify-between text-sm">
        <span class="text-muted-foreground">Amount Paid</span>
        <span class="tabular-nums">{{ formatCurrency(invoice.amount_paid) }}</span>
      </div>
      <div class="flex justify-between text-sm font-semibold">
        <span>Balance</span>
        <span class="tabular-nums" :class="invoice.balance > 0 ? 'text-destructive' : 'text-green-600'">
          {{ formatCurrency(invoice.balance) }}
        </span>
      </div>
    </div>

    <!-- Payments -->
    <div v-if="invoice.payments.length > 0" class="flex flex-col gap-4">
      <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Payments</h3>
      <div class="flex flex-col gap-2">
        <div
          v-for="payment in invoice.payments"
          :key="payment.id"
          class="flex items-start gap-3 rounded-lg border p-3"
        >
          <div class="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
            <Banknote v-if="payment.method === 'cash'" class="size-4 text-muted-foreground" />
            <CreditCard v-else class="size-4 text-muted-foreground" />
          </div>
          <div class="flex-1">
            <div class="flex items-center justify-between">
              <span class="text-sm font-medium">{{ formatCurrency(payment.amount) }}</span>
              <span class="text-xs text-muted-foreground capitalize">{{ payment.method }}</span>
            </div>
            <p class="text-xs text-muted-foreground">
              {{ formatDate(payment.paid_at) }}
              <span v-if="payment.received_by_name"> &middot; {{ payment.received_by_name }}</span>
            </p>
            <p v-if="payment.reference_number" class="text-xs text-muted-foreground">
              Ref: {{ payment.reference_number }}
            </p>
          </div>
        </div>
      </div>
    </div>

  </div>

  <!-- Record payment button -->
  <Button
    v-if="invoice && canManage && invoice.status !== 'paid' && invoice.status !== 'void'"
    class="mt-5 w-full sm:w-auto"
    @click="showPaymentDialog = true"
  >
    <DollarSign class="size-4" />
    Record Payment
  </Button>

  <!-- Payment dialog -->
  <RecordPaymentDialog
    v-if="invoice"
    :open="showPaymentDialog"
    :invoice="invoice"
    @update:open="showPaymentDialog = $event"
    @recorded="onPaymentRecorded"
  />

  <!-- Medical Certificate Dialog -->
  <MedCertDialog
    :open="showMedCertDialog"
    :encounter-id="encounterId"
    :diagnoses="diagnoses"
    :document-update="documentUpdate"
    :can-generate="canGenerate"
    @update:open="showMedCertDialog = $event"
  />
</template>
