<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { today, getLocalTimeZone } from '@internationalized/date'
import type { DateRange, DateValue } from 'reka-ui'
import { toast } from 'vue-sonner'
import { HttpError } from '@/lib/http'
import { FileCheck, LoaderCircle, FileDown, Printer, CalendarDays } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { RangeCalendar } from '@/components/ui/range-calendar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { printPdf } from '@/lib/utils'
import { documentApi, type GeneratedDocumentResponse } from '../api/documentApi'
import type { AssessmentDiagnosis } from '../types/consultation.types'

const props = defineProps<{
  open: boolean
  consultationId: string
  diagnoses: AssessmentDiagnosis[]
  documentUpdate?: GeneratedDocumentResponse | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const diagnosis = ref('')
const recommendation = ref('')
const dateRange = ref<DateRange>({
  start: today(getLocalTimeZone()),
  end: today(getLocalTimeZone()),
})
const purpose = ref('')

const isGenerating = ref(false)
const medCertDoc = ref<GeneratedDocumentResponse | null>(null)
let pollTimer: ReturnType<typeof setInterval> | null = null

function formatDate(date: DateValue | undefined): string {
  if (!date) return ''
  return new Date(date.toString()).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

const rangeDateLabel = computed(() => {
  const start = dateRange.value.start
  const end = dateRange.value.end
  if (start && end) return `${formatDate(start)} — ${formatDate(end)}`
  if (start) return formatDate(start)
  return 'Select duration'
})

// Pre-fill diagnosis from assessment
watch(() => props.open, (open) => {
  if (open) {
    loadExistingDoc()
    if (!diagnosis.value && props.diagnoses.length > 0) {
      diagnosis.value = props.diagnoses
        .map((d) => [d.code, d.description].filter(Boolean).join(' - '))
        .join('; ')
    }
  }
})

// Handle WebSocket update
watch(() => props.documentUpdate, (update) => {
  if (update && update.type === 'medical-certificate') {
    medCertDoc.value = update
    if (update.status === 'completed' || update.status === 'failed') {
      stopPolling()
      isGenerating.value = false
      if (update.status === 'completed') {
        toast.success('Medical certificate is ready')
      }
    }
  }
})

async function loadExistingDoc() {
  try {
    const res = await documentApi.list(props.consultationId)
    medCertDoc.value = res.data.find((d) => d.type === 'medical-certificate') ?? null
  } catch {
    // ignore
  }
}

async function generate() {
  isGenerating.value = true
  try {
    const res = await documentApi.generate(props.consultationId, 'medical-certificate', {
      diagnosis: diagnosis.value,
      recommendation: recommendation.value,
      duration_from: dateRange.value.start?.toString() || null,
      duration_to: dateRange.value.end?.toString() || null,
      purpose: purpose.value || null,
    })
    medCertDoc.value = res.data
    startPolling()
  } catch (err: unknown) {
    const msg = err instanceof HttpError && (err.data as { message?: string })?.message
      ? (err.data as { message: string }).message
      : 'Failed to generate medical certificate'
    toast.error(msg)
    isGenerating.value = false
  }
}

function startPolling() {
  stopPolling()
  pollTimer = setInterval(async () => {
    await loadExistingDoc()
    if (medCertDoc.value?.status === 'completed' || medCertDoc.value?.status === 'failed') {
      stopPolling()
      isGenerating.value = false
      if (medCertDoc.value.status === 'completed') {
        toast.success('Medical certificate is ready')
      } else {
        toast.error('Medical certificate generation failed')
      }
    }
  }, 3000)
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

async function download() {
  if (!medCertDoc.value?.id) return
  try {
    const url = await documentApi.getSignedUrl(medCertDoc.value.id)
    window.open(url, '_blank')
  } catch {
    toast.error('Failed to get download link')
  }
}

async function printDoc() {
  if (!medCertDoc.value?.id) return
  try {
    const url = await documentApi.getSignedUrl(medCertDoc.value.id)
    printPdf(url)
  } catch {
    toast.error('Failed to get download link')
  }
}

const isReady = computed(() => medCertDoc.value?.status === 'completed')
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <FileCheck class="size-4" />
          Medical Certificate
        </DialogTitle>
        <DialogDescription>
          Fill in the details below. Diagnosis is pre-filled from the assessment.
        </DialogDescription>
      </DialogHeader>

      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-2">
          <Label for="mc-diagnosis">Diagnosis / Findings</Label>
          <Textarea id="mc-diagnosis" v-model="diagnosis" rows="2" placeholder="e.g., Upper Respiratory Tract Infection" />
        </div>

        <div class="flex flex-col gap-2">
          <Label for="mc-recommendation">Recommendation</Label>
          <Textarea id="mc-recommendation" v-model="recommendation" rows="2" placeholder="e.g., Rest for 3 days. Fit to resume work after rest period." />
        </div>

        <div class="flex flex-col gap-2">
          <Label>Duration</Label>
          <Popover>
            <PopoverTrigger as-child>
              <Button variant="outline" class="w-full justify-start text-left font-normal">
                <CalendarDays class="mr-2 size-4 text-muted-foreground" />
                {{ rangeDateLabel }}
              </Button>
            </PopoverTrigger>
            <PopoverContent class="w-auto p-0" align="start">
              <RangeCalendar v-model="dateRange" :number-of-months="2" />
            </PopoverContent>
          </Popover>
        </div>

        <div class="flex flex-col gap-2">
          <Label for="mc-purpose">Purpose</Label>
          <div class="flex flex-wrap gap-1.5 mb-1.5">
            <button
              v-for="preset in ['School', 'Employment', 'Work', 'Insurance']"
              :key="preset"
              type="button"
              class="rounded-full border px-2.5 py-0.5 text-xs transition-colors"
              :class="purpose === preset ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground'"
              @click="purpose = purpose === preset ? '' : preset"
            >
              {{ preset }}
            </button>
          </div>
          <Input id="mc-purpose" v-model="purpose" placeholder="Or type a custom purpose..." />
        </div>

        <!-- Download/Print if ready -->
        <div v-if="isReady" class="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-950">
          <FileCheck class="size-4 text-green-600" />
          <span class="flex-1 text-sm text-green-700 dark:text-green-400">Medical certificate is ready</span>
          <Button variant="outline" size="sm" class="h-7 gap-1.5 text-xs" @click="printDoc">
            <Printer class="size-3" />
            Print
          </Button>
          <Button variant="outline" size="sm" class="h-7 gap-1.5 text-xs" @click="download">
            <FileDown class="size-3" />
            Download
          </Button>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="emit('update:open', false)">Close</Button>
        <Button :disabled="isGenerating || !diagnosis.trim()" @click="generate">
          <LoaderCircle v-if="isGenerating" class="size-4 animate-spin" />
          <FileCheck v-else class="size-4" />
          {{ isGenerating ? 'Generating...' : isReady ? 'Regenerate' : 'Generate' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
