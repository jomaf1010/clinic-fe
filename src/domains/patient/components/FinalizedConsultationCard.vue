<script setup lang="ts">
import { computed, ref } from 'vue'
import { FlaskConical, CheckCircle2, Clock, Info, FileDown, FileCheck, LoaderCircle, Ellipsis, ExternalLink } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { RouteNames } from '@/router/routeNames'
import { HttpError } from '@/lib/http'
import { openNewTab, timeAgo } from '@/lib/utils'
import type { LabOrderSummary } from '@/domains/consultation/types/consultation.types'
import { consultationApi } from '@/domains/consultation/api/consultationApi'
import { documentApi } from '@/domains/consultation/api/documentApi'
import EncounterSummaryDetail from './EncounterSummaryDetail.vue'
import type { DisplaySummaryVitals, EncounterTimelineItem } from '@/domains/encounter/types/encounter.types'

const props = defineProps<{
  consultation: EncounterTimelineItem
  patientId: string
  latest?: boolean
  previousVitals?: DisplaySummaryVitals | null
}>()

const emit = defineEmits<{
  'show-lab-order': [summary: LabOrderSummary, event: MouseEvent]
}>()

const router = useRouter()
const timelineLine = computed(() => props.consultation.auto_display_line ?? props.consultation.display_line ?? null)
const timelineSummary = computed(() => props.consultation.auto_display_summary ?? null)

function openConsultation() {
  router.push({
    name: RouteNames.ENCOUNTER_DETAIL,
    params: { patientId: props.patientId, id: props.consultation.id },
  })
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-PH', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const prescriptionDoc = computed(() =>
  props.consultation.documents?.find((d) => d.type === 'prescription' && d.status === 'completed'),
)

const medCertDoc = computed(() =>
  props.consultation.documents?.find((d) => d.type === 'medical-certificate' && d.status === 'completed'),
)

const hasMedCert = computed(() => !!medCertDoc.value)

const alreadyRequested = computed(() =>
  !hasMedCert.value
  && (props.consultation.medcert_requested_by || medCertRequested.value),
)

const canRequestMedCert = computed(() =>
  props.consultation.finalized_at
  && !hasMedCert.value
  && !props.consultation.medcert_requested_by
  && !medCertRequested.value,
)

const isRequestingMedCert = ref(false)
const medCertRequested = ref(false)

async function downloadDocument(documentId: string) {
  const tab = openNewTab()
  try {
    const url = await documentApi.getSignedUrl(documentId)
    tab.navigate(url)
  } catch {
    tab.close()
    toast.error('Failed to get download link')
  }
}

async function requestMedCert() {
  if (isRequestingMedCert.value) return
  isRequestingMedCert.value = true
  try {
    await consultationApi.requestMedCert(props.consultation.id)
    medCertRequested.value = true
    toast.success('Medical certificate requested')
  } catch (err: unknown) {
    const msg = err instanceof HttpError && (err.data as { message?: string })?.message
      ? (err.data as { message: string }).message
      : 'Failed to request medical certificate.'
    toast.error(msg)
  } finally {
    isRequestingMedCert.value = false
  }
}

</script>

<template>
  <div
    class="surface-card group relative min-w-0 flex-1 cursor-pointer rounded-lg border p-3 transition-colors"
    :class="latest
      ? 'border-primary/30 hover:bg-primary/5 hover:border-primary/40'
      : 'border-border/60 opacity-75 hover:opacity-100'"
    @click="openConsultation"
  >
    <!-- 3-dot menu -->
    <div class="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100" @click.stop>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <button
            type="button"
            class="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Ellipsis class="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-52">
          <DropdownMenuItem class="gap-2" @click="openConsultation">
            <ExternalLink class="size-3.5" />
            View Consultation
          </DropdownMenuItem>

          <template v-if="prescriptionDoc || medCertDoc">
            <DropdownMenuSeparator />
            <DropdownMenuItem v-if="prescriptionDoc" class="gap-2" @click="downloadDocument(prescriptionDoc.id)">
              <FileDown class="size-3.5" />
              Download Prescription
            </DropdownMenuItem>
            <DropdownMenuItem v-if="medCertDoc" class="gap-2" @click="downloadDocument(medCertDoc.id)">
              <FileDown class="size-3.5" />
              Download Med Cert
            </DropdownMenuItem>
          </template>

          <template v-if="consultation.finalized_at && !hasMedCert">
            <DropdownMenuSeparator />
            <DropdownMenuItem
              v-if="canRequestMedCert"
              class="gap-2"
              :disabled="isRequestingMedCert"
              @click="requestMedCert"
            >
              <LoaderCircle v-if="isRequestingMedCert" class="size-3.5 animate-spin" />
              <FileCheck v-else class="size-3.5" />
              Request Med Cert
            </DropdownMenuItem>
            <DropdownMenuItem v-else-if="alreadyRequested" disabled class="gap-2">
              <Clock class="size-3.5" />
              Med Cert Requested
            </DropdownMenuItem>
          </template>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>

    <div class="flex items-center gap-2">
      <TooltipProvider :delay-duration="200">
        <Tooltip>
          <TooltipTrigger as-child>
            <p class="cursor-help text-xs text-muted-foreground">
              {{ timeAgo(consultation.created_at) }}
            </p>
          </TooltipTrigger>
          <TooltipContent side="top" class="text-xs">
            {{ formatDate(consultation.created_at) }}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <span v-if="consultation.consultation_type === 'follow_up'" class="surface-muted rounded border px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground">Follow-up</span>
      <span v-if="consultation.doctor_name" class="text-xs text-muted-foreground">
        &middot; Dr. {{ consultation.doctor_name }}
      </span>
    </div>
    <div v-if="consultation.display_summary" class="mt-1">
      <EncounterSummaryDetail
        :summary="consultation.display_summary"
        :headline="timelineLine"
        :display-summary="timelineSummary"
        :previous-vitals="previousVitals"
      />
    </div>
    <p v-else-if="timelineLine" class="mt-1 text-sm text-muted-foreground leading-relaxed">{{ timelineLine }}</p>
    <p v-if="!consultation.display_summary && timelineSummary" class="mt-1 text-sm text-muted-foreground leading-relaxed">{{ timelineSummary }}</p>
    <TooltipProvider v-if="consultation.lab_order_summary" :delay-duration="200">
      <div class="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <FlaskConical class="size-3 shrink-0" />
        <span>Lab Orders:</span>
        <Tooltip v-if="consultation.lab_order_summary.completed">
          <TooltipTrigger as-child>
            <span class="flex cursor-help items-center gap-0.5 text-green-600">
              <CheckCircle2 class="size-3" />
              {{ consultation.lab_order_summary.completed }} completed
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" class="max-w-64 text-xs">
            <ul class="list-disc pl-3.5">
              <li v-for="name in consultation.lab_order_summary.completed_items" :key="name">{{ name }}</li>
            </ul>
          </TooltipContent>
        </Tooltip>
        <Tooltip v-if="consultation.lab_order_summary.pending">
          <TooltipTrigger as-child>
            <span class="flex cursor-help items-center gap-0.5 text-amber-600">
              <Clock class="size-3" />
              {{ consultation.lab_order_summary.pending }} pending
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" class="max-w-64 text-xs">
            <ul class="list-disc pl-3.5">
              <li v-for="name in consultation.lab_order_summary.pending_items" :key="name">{{ name }}</li>
            </ul>
          </TooltipContent>
        </Tooltip>
        <button
          type="button"
          class="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          @click.stop="emit('show-lab-order', consultation.lab_order_summary!, $event)"
        >
          <Info class="size-3.5" />
        </button>
      </div>
    </TooltipProvider>
  </div>
</template>
