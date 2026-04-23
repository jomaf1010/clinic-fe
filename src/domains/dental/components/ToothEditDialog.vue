<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type {
  ToothState,
  CariesStatus, RestorationType, RestorationCondition, FractureStatus, SealantStatus,
} from '../types/dental.types'

/**
 * Per-tooth editor — opened when a tooth is clicked on the odontogram.
 * Emits the *partial state* (only the keys the user touched) so it can
 * be merged into the visit's `assessment.odontogram_delta` and pushed to
 * the patient's profile odontogram on save.
 */
const props = defineProps<{
  open: boolean
  fdi: string | null
  initial?: ToothState | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  save: [fdi: string, state: ToothState]
}>()

const caries = ref<CariesStatus | ''>('')
const restoration = ref<RestorationType | ''>('')
const condition = ref<RestorationCondition | ''>('')
const fracture = ref<FractureStatus | ''>('')
const missing = ref(false)
const missingDate = ref('')
const sealant = ref<SealantStatus | ''>('')
const notes = ref('')

watch(() => [props.open, props.fdi, props.initial], () => {
  if (!props.open) return
  caries.value = (props.initial?.caries ?? '') as CariesStatus | ''
  restoration.value = (props.initial?.restoration ?? '') as RestorationType | ''
  condition.value = (props.initial?.condition ?? '') as RestorationCondition | ''
  fracture.value = (props.initial?.fracture ?? '') as FractureStatus | ''
  missing.value = !!props.initial?.missing
  missingDate.value = props.initial?.missing_date ?? ''
  sealant.value = (props.initial?.sealant ?? '') as SealantStatus | ''
  notes.value = props.initial?.notes ?? ''
}, { immediate: true })

const cariesOptions: { value: CariesStatus; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'early', label: 'Early' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'severe', label: 'Severe' },
  { value: 'treated', label: 'Treated' },
]
const restorationOptions: { value: RestorationType; label: string }[] = [
  { value: 'composite', label: 'Composite' },
  { value: 'amalgam', label: 'Amalgam' },
  { value: 'glass_ionomer', label: 'Glass Ionomer' },
  { value: 'rmgi', label: 'RMGI' },
  { value: 'temporary', label: 'Temporary' },
  { value: 'ceramic', label: 'Ceramic' },
  { value: 'crown', label: 'Crown' },
  { value: 'gold', label: 'Gold' },
]
const conditionOptions: { value: RestorationCondition; label: string }[] = [
  { value: 'intact', label: 'Intact' },
  { value: 'small_defect', label: 'Small defect' },
  { value: 'large_defect', label: 'Large defect' },
  { value: 'breakdown', label: 'Margin breakdown' },
  { value: 'secondary_caries', label: 'Secondary caries' },
]
const fractureOptions: { value: FractureStatus; label: string }[] = [
  { value: 'crack_minor', label: 'Crack <50%' },
  { value: 'crack_major', label: 'Crack >50%' },
  { value: 'cusp', label: 'Cusp fracture' },
  { value: 'root', label: 'Root fracture' },
  { value: 'split', label: 'Split tooth' },
]
const sealantOptions: { value: SealantStatus; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'partial', label: 'Partial' },
  { value: 'complete', label: 'Complete' },
  { value: 'lost', label: 'Lost' },
]

const title = computed(() => props.fdi ? `Tooth ${props.fdi}` : 'Tooth')

function close(): void {
  emit('update:open', false)
}

function save(): void {
  if (!props.fdi) return
  // Send only the populated fields — partial state, deep-merged server-side.
  const state: ToothState = {}
  if (caries.value) state.caries = caries.value
  if (restoration.value) state.restoration = restoration.value
  if (condition.value) state.condition = condition.value
  if (fracture.value) state.fracture = fracture.value
  state.missing = missing.value
  if (missingDate.value) state.missing_date = missingDate.value
  if (sealant.value) state.sealant = sealant.value
  if (notes.value) state.notes = notes.value
  emit('save', props.fdi, state)
  close()
}
</script>

<template>
  <Dialog :open="props.open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-md max-h-[85vh] flex flex-col overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{{ title }}</DialogTitle>
        <DialogDescription>FDI numbering. Set the clinical state for this tooth — only changed fields are saved.</DialogDescription>
      </DialogHeader>

      <form class="flex flex-col gap-3" @submit.prevent="save">
        <div class="grid grid-cols-2 gap-3">
          <div class="flex flex-col gap-1.5">
            <Label class="text-xs">Caries</Label>
            <select v-model="caries" class="h-9 rounded-md border bg-background px-2 text-sm">
              <option value="">—</option>
              <option v-for="o in cariesOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
            </select>
          </div>
          <div class="flex flex-col gap-1.5">
            <Label class="text-xs">Restoration</Label>
            <select v-model="restoration" class="h-9 rounded-md border bg-background px-2 text-sm">
              <option value="">—</option>
              <option v-for="o in restorationOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
            </select>
          </div>
          <div class="flex flex-col gap-1.5">
            <Label class="text-xs">Condition</Label>
            <select v-model="condition" class="h-9 rounded-md border bg-background px-2 text-sm">
              <option value="">—</option>
              <option v-for="o in conditionOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
            </select>
          </div>
          <div class="flex flex-col gap-1.5">
            <Label class="text-xs">Fracture</Label>
            <select v-model="fracture" class="h-9 rounded-md border bg-background px-2 text-sm">
              <option value="">—</option>
              <option v-for="o in fractureOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
            </select>
          </div>
          <div class="flex flex-col gap-1.5">
            <Label class="text-xs">Sealant</Label>
            <select v-model="sealant" class="h-9 rounded-md border bg-background px-2 text-sm">
              <option value="">—</option>
              <option v-for="o in sealantOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
            </select>
          </div>
          <div class="flex items-end gap-2">
            <Switch :model-value="missing" @update:model-value="missing = !!$event" />
            <Label class="text-xs">Missing</Label>
          </div>
        </div>

        <div v-if="missing" class="flex flex-col gap-1.5">
          <Label for="missing-date" class="text-xs">Extraction date</Label>
          <Input id="missing-date" v-model="missingDate" type="date" />
        </div>

        <div class="flex flex-col gap-1.5">
          <Label for="tooth-notes" class="text-xs">Notes</Label>
          <Input id="tooth-notes" v-model="notes" placeholder="Optional clinical note" />
        </div>

        <div class="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" @click="close">Cancel</Button>
          <Button type="submit">Save</Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>
</template>
