<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { toast } from 'vue-sonner'
import { HttpError } from '@/lib/http'
import { FlaskConical, LoaderCircle, FileDown, Printer, FileText } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { openNewTab, printPdf } from '@/lib/utils'
import { documentApi, type GeneratedDocumentResponse } from '../api/documentApi'

const props = defineProps<{
  open: boolean
  encounterId: string
  documentUpdate?: GeneratedDocumentResponse | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'generated': [doc: GeneratedDocumentResponse]
}>()

const laboratoryName = ref('')
const isGenerating = ref(false)
const labRequestDoc = ref<GeneratedDocumentResponse | null>(null)
let pollTimer: ReturnType<typeof setInterval> | null = null

watch(() => props.open, (open) => {
  if (open) {
    loadExistingDoc()
  }
})

watch(() => props.documentUpdate, (update) => {
  if (update && update.type === 'lab-request') {
    if (labRequestDoc.value) {
      labRequestDoc.value = { ...labRequestDoc.value, status: update.status }
    } else {
      labRequestDoc.value = update
    }
    if (update.status === 'completed' || update.status === 'failed') {
      stopPolling()
      isGenerating.value = false
      if (update.status === 'completed') {
        toast.success('Lab request PDF is ready')
        emit('generated', update)
      }
    }
  }
})

async function loadExistingDoc() {
  try {
    const res = await documentApi.list(props.encounterId)
    labRequestDoc.value = res.data.find((d) => d.type === 'lab-request') ?? null
  } catch {
    // ignore
  }
}

async function generate() {
  isGenerating.value = true
  try {
    const res = await documentApi.generate(props.encounterId, 'lab-request', {
      laboratory_name: laboratoryName.value || null,
    })
    labRequestDoc.value = res.data
    startPolling()
  } catch (err: unknown) {
    const msg = err instanceof HttpError && (err.data as { message?: string })?.message
      ? (err.data as { message: string }).message
      : 'Failed to generate lab request PDF'
    toast.error(msg)
    isGenerating.value = false
  }
}

function startPolling() {
  stopPolling()
  pollTimer = setInterval(async () => {
    await loadExistingDoc()
    if (labRequestDoc.value?.status === 'completed' || labRequestDoc.value?.status === 'failed') {
      stopPolling()
      isGenerating.value = false
      if (labRequestDoc.value.status === 'completed') {
        toast.success('Lab request PDF is ready')
        emit('generated', labRequestDoc.value)
      } else {
        toast.error('Lab request PDF generation failed')
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
  if (!labRequestDoc.value?.id) return
  const tab = openNewTab()
  try {
    const url = await documentApi.getSignedUrl(labRequestDoc.value.id)
    await tab.navigate(url)
  } catch {
    tab.close()
    toast.error('Failed to get download link')
  }
}

async function printDoc() {
  if (!labRequestDoc.value?.id) return
  try {
    const url = await documentApi.getSignedUrl(labRequestDoc.value.id)
    printPdf(url)
  } catch {
    toast.error('Failed to get download link')
  }
}

const isReady = computed(() => labRequestDoc.value?.status === 'completed')
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <FlaskConical class="size-4" />
          Generate Lab Request
        </DialogTitle>
        <DialogDescription>
          Optionally specify the target laboratory name.
        </DialogDescription>
      </DialogHeader>

      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-2">
          <Label for="lr-lab-name">Laboratory Name <span class="text-muted-foreground font-normal">(optional)</span></Label>
          <Input id="lr-lab-name" v-model="laboratoryName" placeholder="e.g., St. Luke's Medical Center Laboratory" />
        </div>

        <!-- Ready state -->
        <div v-if="isReady" class="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-950">
          <FileText class="size-4 text-green-600" />
          <span class="flex-1 text-sm text-green-700 dark:text-green-400">Lab request PDF is ready</span>
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
        <Button :disabled="isGenerating" @click="generate">
          <LoaderCircle v-if="isGenerating" class="size-4 animate-spin" />
          <FileText v-else class="size-4" />
          {{ isGenerating ? 'Generating...' : isReady ? 'Regenerate' : 'Generate' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
