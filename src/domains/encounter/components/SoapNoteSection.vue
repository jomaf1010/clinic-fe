<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { AlertTriangle, LoaderCircle, Save, Sparkles } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useEncounterStore } from '@/domains/encounter/stores/encounterStore'
import type { SoapDraftResponse, SoapNote } from '@/domains/encounter/types/soapNote.types'

const props = defineProps<{
  soapNote?: SoapNote | null
  disabled?: boolean
  canGenerate?: boolean
  isGenerating?: boolean
  error?: string | null
}>()

const store = useEncounterStore()
const fields = ref<Pick<SoapNote, 'subjective' | 'objective' | 'assessment' | 'plan'>>({
  subjective: '',
  objective: '',
  assessment: '',
  plan: '',
})
const draft = ref<SoapDraftResponse | null>(null)

watch(
  () => props.soapNote,
  (note) => {
    fields.value = {
      subjective: note?.subjective ?? '',
      objective: note?.objective ?? '',
      assessment: note?.assessment ?? '',
      plan: note?.plan ?? '',
    }
    draft.value = null
  },
  { immediate: true },
)

const noteSections = [
  { key: 'subjective', label: 'Subjective' },
  { key: 'objective', label: 'Objective' },
  { key: 'assessment', label: 'Assessment' },
  { key: 'plan', label: 'Plan' },
] as const

const isComplete = computed(() =>
  noteSections.every((section) => fields.value[section.key].trim().length > 0),
)

const canSave = computed(() => !props.disabled && isComplete.value && !store.isSaving)

const generatedLabel = computed(() => {
  const generatedAt = draft.value?.meta.generated_at ?? props.soapNote?.generated_at
  if (!generatedAt) return null

  return new Date(generatedAt).toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
})

const activeWarnings = computed(() => draft.value?.warnings ?? [])
const missingInputs = computed(() => draft.value?.source_fidelity.missing_key_inputs ?? [])

async function handleGenerate(): Promise<void> {
  const hadUnsavedDraft = draft.value !== null
  draft.value = null
  if (hadUnsavedDraft && !props.soapNote) {
    fields.value = {
      subjective: '',
      objective: '',
      assessment: '',
      plan: '',
    }
  }

  const response = await store.generateSoapDraft()
  if (!response) return

  draft.value = response
  fields.value = {
    subjective: response.soap.subjective,
    objective: response.soap.objective,
    assessment: response.soap.assessment,
    plan: response.soap.plan,
  }
  toast.success('SOAP note generated')
}

async function handleSave(): Promise<void> {
  if (!canSave.value) return

  const note: SoapNote = {
    subjective: fields.value.subjective.trim(),
    objective: fields.value.objective.trim(),
    assessment: fields.value.assessment.trim(),
    plan: fields.value.plan.trim(),
    source: draft.value ? 'ai_draft_reviewed' : props.soapNote?.source ?? 'manual',
    draft_id: draft.value?.draft_id ?? props.soapNote?.draft_id ?? null,
    provider: draft.value?.meta.provider ?? props.soapNote?.provider ?? null,
    model: draft.value?.meta.model ?? props.soapNote?.model ?? null,
    generated_at: draft.value?.meta.generated_at ?? props.soapNote?.generated_at ?? null,
  }

  await store.saveSection({ soap_note: note })
  if (!store.saveError) {
    draft.value = null
    toast.success('SOAP note saved')
  }
}
</script>

<template>
  <section class="surface-card-lite rounded-2xl border p-4">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div class="min-w-0">
        <div class="flex flex-wrap items-center gap-2">
          <h3 class="text-sm font-semibold">SOAP Note</h3>
        </div>
        <p v-if="generatedLabel" class="mt-1 text-xs text-muted-foreground">
          Generated {{ generatedLabel }}
        </p>
      </div>

      <div class="flex shrink-0 items-center gap-2">
        <Button
          v-if="canGenerate"
          type="button"
          variant="outline"
          size="sm"
          :disabled="disabled || isGenerating || store.isSaving"
          @click="handleGenerate"
        >
          <LoaderCircle v-if="isGenerating" class="size-3.5 animate-spin" />
          <Sparkles v-else class="size-3.5" />
          {{ isGenerating ? 'Generating...' : 'Generate' }}
        </Button>
        <Button
          type="button"
          size="sm"
          :disabled="!canSave"
          @click="handleSave"
        >
          <LoaderCircle v-if="store.isSaving" class="size-3.5 animate-spin" />
          <Save v-else class="size-3.5" />
          Save
        </Button>
      </div>
    </div>

    <div v-if="error" class="mt-3 rounded-2xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {{ error }}
    </div>

    <div
      v-if="activeWarnings.length || missingInputs.length"
      class="mt-3 flex gap-2 rounded-2xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-sm text-amber-800 dark:border-amber-800/70 dark:bg-amber-950/50 dark:text-amber-300"
    >
      <AlertTriangle class="mt-0.5 size-4 shrink-0" />
      <div class="min-w-0 space-y-1">
        <p v-for="warning in activeWarnings" :key="warning">
          {{ warning }}
        </p>
        <p v-if="missingInputs.length">
          Missing inputs: {{ missingInputs.join(', ') }}
        </p>
      </div>
    </div>

    <div class="mt-4 grid gap-4 lg:grid-cols-2">
      <div
        v-for="section in noteSections"
        :key="section.key"
        class="space-y-1.5"
      >
        <Label class="text-xs font-medium text-muted-foreground">{{ section.label }}</Label>
        <Textarea
          v-model="fields[section.key]"
          :disabled="disabled"
          class="min-h-28 resize-y text-sm leading-relaxed"
          :aria-label="section.label"
        />
      </div>
    </div>
  </section>
</template>
