<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { LoaderCircle, Baby, HeartCrack, AlertTriangle } from 'lucide-vue-next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Checkbox } from '@/components/ui/checkbox'
import MFDatePicker from '@/components/shared/MFDatePicker.vue'
import {
  PREGNANCY_OUTCOME_OPTIONS,
  DELIVERY_OUTCOMES,
  type PregnancyOutcome,
  type Pregnancy,
} from '../types/obgyn.types'

const props = defineProps<{
  open: boolean
  pregnancy: Pregnancy
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  resolve: [payload: {
    outcome: PregnancyOutcome
    outcome_date: string
    management?: string | null
    ectopic_location?: string | null
    ectopic_confirmation?: string | null
    hcg_surveillance?: boolean | null
    notes?: string | null
  }]
}>()

const selectedOutcome = ref<PregnancyOutcome | null>(null)
const outcomeDate = ref<string>(new Date().toISOString().slice(0, 10))
const management = ref<string | null>(null)
const ectopicLocation = ref('')
const ectopicConfirmation = ref('')
const hcgSurveillance = ref(false)
const notes = ref('')
const isSubmitting = ref(false)

const deliveryOutcomes = computed(() =>
  PREGNANCY_OUTCOME_OPTIONS.filter((o) => o.category === 'delivery'),
)
const lossOutcomes = computed(() =>
  PREGNANCY_OUTCOME_OPTIONS.filter((o) => o.category === 'loss'),
)

const isDeliveryOutcome = computed(() =>
  selectedOutcome.value ? DELIVERY_OUTCOMES.includes(selectedOutcome.value) : false,
)

const isEctopic = computed(() => selectedOutcome.value === 'ectopic')
const isMolar = computed(() => selectedOutcome.value === 'molar')
const isLoss = computed(() => selectedOutcome.value && !isDeliveryOutcome.value)

const gaDisplay = computed(() => {
  const ga = props.pregnancy.current_ga
  if (!ga) return null
  return `${ga.weeks}w ${ga.days}d`
})

const canSubmit = computed(() => {
  if (!selectedOutcome.value || !outcomeDate.value) return false
  if (isLoss.value && !management.value) return false
  return true
})

// Reset form when modal opens/closes
watch(() => props.open, (val) => {
  if (val) {
    selectedOutcome.value = null
    outcomeDate.value = new Date().toISOString().slice(0, 10)
    management.value = null
    ectopicLocation.value = ''
    ectopicConfirmation.value = ''
    hcgSurveillance.value = false
    notes.value = ''
    isSubmitting.value = false
  }
})

function handleSubmit() {
  if (!selectedOutcome.value || !outcomeDate.value) return
  isSubmitting.value = true

  emit('resolve', {
    outcome: selectedOutcome.value,
    outcome_date: outcomeDate.value,
    management: isLoss.value ? management.value : null,
    ectopic_location: isEctopic.value ? ectopicLocation.value || null : null,
    ectopic_confirmation: isEctopic.value ? ectopicConfirmation.value || null : null,
    hcg_surveillance: isMolar.value ? hcgSurveillance.value : null,
    notes: notes.value || null,
  })
}

function stopSubmitting() {
  isSubmitting.value = false
}

defineExpose({ stopSubmitting })
</script>

<template>
  <Dialog :open="props.open" @update:open="(val) => emit('update:open', val)">
    <DialogContent class="resolve-pregnancy-dialog max-h-[85vh] overflow-y-auto sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Resolve Pregnancy</DialogTitle>
        <DialogDescription>
          Select the pregnancy outcome. This will close the pregnancy record
          <span v-if="gaDisplay"> at {{ gaDisplay }} gestational age</span>.
        </DialogDescription>
      </DialogHeader>

      <div class="flex flex-col gap-5 py-2">
        <!-- Outcome Selection -->
        <div class="flex flex-col gap-3">
          <!-- Delivery Outcomes -->
          <div>
            <p class="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <Baby class="size-3.5" />
              Delivery Outcomes
            </p>
            <RadioGroup
              :model-value="selectedOutcome ?? ''"
              @update:model-value="(val) => selectedOutcome = String(val) as PregnancyOutcome"
              class="flex flex-col gap-1.5"
            >
              <label
                v-for="opt in deliveryOutcomes"
                :key="opt.value"
                class="resolve-outcome-option flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition-all"
                :class="{ 'is-selected': selectedOutcome === opt.value }"
              >
                <RadioGroupItem :value="opt.value" class="resolve-outcome-radio mt-0.5" />
                <div>
                  <p class="text-sm font-medium">{{ opt.label }}</p>
                  <p class="text-xs text-muted-foreground">{{ opt.description }}</p>
                </div>
              </label>
            </RadioGroup>
          </div>

          <!-- Loss Outcomes -->
          <div>
            <p class="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <HeartCrack class="size-3.5" />
              Pregnancy Loss
            </p>
            <RadioGroup
              :model-value="selectedOutcome ?? ''"
              @update:model-value="(val) => selectedOutcome = String(val) as PregnancyOutcome"
              class="flex flex-col gap-1.5"
            >
              <label
                v-for="opt in lossOutcomes"
                :key="opt.value"
                class="resolve-outcome-option flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition-all"
                :class="{ 'is-selected': selectedOutcome === opt.value }"
              >
                <RadioGroupItem :value="opt.value" class="resolve-outcome-radio mt-0.5" />
                <div>
                  <p class="text-sm font-medium">{{ opt.label }}</p>
                  <p class="text-xs text-muted-foreground">{{ opt.description }}</p>
                </div>
              </label>
            </RadioGroup>
          </div>
        </div>

        <!-- Outcome Details (shown after selection) -->
        <template v-if="selectedOutcome">
          <!-- Delivery outcome info -->
          <div v-if="isDeliveryOutcome" class="resolve-info-card rounded-2xl border p-3 text-sm">
            <p class="font-medium">A delivery form will be created</p>
            <p class="mt-0.5 text-xs text-blue-600 dark:text-blue-400">
              You'll be redirected to fill in labor, delivery, and neonatal details. The pregnancy will close when the delivery record is finalized.
            </p>
          </div>

          <!-- Date -->
          <div class="flex flex-col gap-1.5">
            <Label>{{ isDeliveryOutcome ? 'Delivery Date' : 'Date of Loss' }}</Label>
            <MFDatePicker v-model="outcomeDate" disable-future />
          </div>

          <!-- Loss-specific fields -->
          <template v-if="isLoss">
            <!-- Management -->
            <div class="flex flex-col gap-1.5">
              <Label>Management</Label>
              <Select v-model="management">
                <SelectTrigger>
                  <SelectValue placeholder="Select management approach" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expectant">Expectant — Watch and wait</SelectItem>
                  <SelectItem value="medical">Medical — Medication (e.g., misoprostol)</SelectItem>
                  <SelectItem value="surgical">Surgical — D&C or procedural</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <!-- Ectopic-specific -->
            <template v-if="isEctopic">
              <div class="flex flex-col gap-1.5">
                <Label>Ectopic Location</Label>
                <Select v-model="ectopicLocation">
                  <SelectTrigger>
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tubal_right">Right Fallopian Tube</SelectItem>
                    <SelectItem value="tubal_left">Left Fallopian Tube</SelectItem>
                    <SelectItem value="cornual">Cornual / Interstitial</SelectItem>
                    <SelectItem value="cervical">Cervical</SelectItem>
                    <SelectItem value="ovarian">Ovarian</SelectItem>
                    <SelectItem value="abdominal">Abdominal</SelectItem>
                    <SelectItem value="cesarean_scar">Cesarean Scar</SelectItem>
                    <SelectItem value="heterotopic">Heterotopic</SelectItem>
                    <SelectItem value="unknown">Unknown</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div class="flex flex-col gap-1.5">
                <Label>Confirmation Method</Label>
                <Select v-model="ectopicConfirmation">
                  <SelectTrigger>
                    <SelectValue placeholder="How was it confirmed?" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ultrasound">Ultrasound</SelectItem>
                    <SelectItem value="laparoscopy">Laparoscopy</SelectItem>
                    <SelectItem value="clinical_serial_bhcg">Clinical + Serial bHCG</SelectItem>
                    <SelectItem value="laparotomy">Laparotomy</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </template>

            <!-- Molar-specific -->
            <div v-if="isMolar" class="resolve-warning-card flex items-start gap-2 rounded-2xl border p-3">
              <Checkbox
                :model-value="hcgSurveillance"
                @update:model-value="(val) => hcgSurveillance = !!val"
                class="mt-0.5"
              />
              <div>
                <p class="text-sm font-medium text-amber-800 dark:text-amber-300">hCG Surveillance Required</p>
                <p class="text-xs text-amber-600 dark:text-amber-400">
                  Weekly serum hCG monitoring until undetectable for 3 consecutive weeks, then monthly for 6-12 months.
                </p>
              </div>
            </div>
          </template>

          <!-- Notes -->
          <div class="flex flex-col gap-1.5">
            <Label>Notes <span class="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea
              v-model="notes"
              placeholder="Additional notes about the outcome..."
              :rows="3"
            />
          </div>

          <!-- GTPAL update notice -->
          <div class="resolve-muted-card rounded-2xl border p-3 text-xs text-muted-foreground">
            <p class="font-medium text-foreground">GTPAL will be updated automatically</p>
            <p v-if="isDeliveryOutcome" class="mt-0.5">
              Parity and living children will be updated when the delivery record is finalized.
            </p>
            <p v-else class="mt-0.5">
              Abortions (A) will be incremented by 1 upon confirmation.
            </p>
          </div>
        </template>
      </div>

      <DialogFooter>
        <Button variant="outline" :disabled="isSubmitting" @click="emit('update:open', false)">
          Cancel
        </Button>
        <Button
          v-if="isDeliveryOutcome"
          :disabled="!canSubmit || isSubmitting"
          @click="handleSubmit"
        >
          <LoaderCircle v-if="isSubmitting" class="size-4 animate-spin" />
          <Baby v-else class="size-4" />
          {{ isSubmitting ? 'Creating...' : 'Continue to Delivery Form' }}
        </Button>
        <Button
          v-else-if="selectedOutcome"
          :disabled="!canSubmit || isSubmitting"
          variant="destructive"
          @click="handleSubmit"
        >
          <LoaderCircle v-if="isSubmitting" class="size-4 animate-spin" />
          <AlertTriangle v-else class="size-4" />
          {{ isSubmitting ? 'Resolving...' : 'Confirm & Close Pregnancy' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
.resolve-pregnancy-dialog {
  border-color: rgb(148 163 184 / 0.28);
}

.resolve-outcome-option {
  border-color: rgb(148 163 184 / 0.2);
  background:
    linear-gradient(135deg, rgb(255 255 255 / 0.48), rgb(255 255 255 / 0.2)),
    rgb(255 255 255 / 0.06);
  box-shadow:
    0 12px 28px rgb(15 23 42 / 0.05),
    inset 0 1px 0 rgb(255 255 255 / 0.26);
}

.resolve-outcome-option:hover {
  transform: translateY(-1px);
  border-color: rgb(37 99 235 / 0.28);
  background:
    linear-gradient(135deg, rgb(255 255 255 / 0.66), rgb(255 255 255 / 0.3)),
    rgb(255 255 255 / 0.12);
  box-shadow:
    0 18px 36px rgb(37 99 235 / 0.08),
    inset 0 1px 0 rgb(255 255 255 / 0.34);
}

.resolve-outcome-option.is-selected {
  border-color: rgb(37 99 235 / 0.5);
  background:
    radial-gradient(circle at 0% 0%, rgb(37 99 235 / 0.16), transparent 42%),
    radial-gradient(circle at 100% 0%, rgb(20 184 166 / 0.14), transparent 36%),
    linear-gradient(135deg, rgb(255 255 255 / 0.76), rgb(255 255 255 / 0.36)),
    rgb(255 255 255 / 0.12);
  box-shadow:
    0 18px 40px rgb(37 99 235 / 0.12),
    inset 0 0 0 1px rgb(255 255 255 / 0.32);
}

:deep(.resolve-outcome-radio) {
  width: 1.25rem;
  height: 1.25rem;
  border-color: rgb(100 116 139 / 0.45);
  background: rgb(255 255 255 / 0.5);
  box-shadow:
    0 8px 18px rgb(15 23 42 / 0.08),
    inset 0 1px 0 rgb(255 255 255 / 0.44);
}

:deep(.resolve-outcome-radio[data-state='checked']) {
  border-color: rgb(37 99 235);
  background: linear-gradient(135deg, rgb(37 99 235), rgb(20 184 166));
  color: white;
  box-shadow:
    0 12px 26px rgb(37 99 235 / 0.22),
    inset 0 1px 0 rgb(255 255 255 / 0.24);
}

:deep(.resolve-outcome-radio[data-state='checked'] svg) {
  width: 0.75rem;
  height: 0.75rem;
  fill: white;
}

.resolve-info-card {
  border-color: rgb(59 130 246 / 0.24);
  color: rgb(30 64 175);
  background:
    linear-gradient(135deg, rgb(59 130 246 / 0.12), rgb(20 184 166 / 0.08)),
    rgb(255 255 255 / 0.38);
}

.resolve-warning-card {
  border-color: rgb(245 158 11 / 0.28);
  background:
    linear-gradient(135deg, rgb(245 158 11 / 0.14), rgb(255 255 255 / 0.22)),
    rgb(255 255 255 / 0.2);
}

.resolve-muted-card {
  border-color: rgb(148 163 184 / 0.2);
  background: rgb(255 255 255 / 0.22);
}

:global(.dark) .resolve-outcome-option {
  color: rgb(248 250 252);
  border-color: rgb(148 163 184 / 0.18);
  background:
    radial-gradient(circle at 0% 0%, rgb(37 99 235 / 0.12), transparent 38%),
    linear-gradient(135deg, rgb(15 23 42 / 0.84), rgb(2 6 23 / 0.68)),
    rgb(15 23 42 / 0.72);
  box-shadow:
    0 16px 34px rgb(0 0 0 / 0.34),
    inset 0 1px 0 rgb(255 255 255 / 0.08);
}

:global(.dark) .resolve-outcome-option p:last-child {
  color: rgb(203 213 225 / 0.76);
}

:global(.dark) .resolve-outcome-option:hover,
:global(.dark) .resolve-outcome-option.is-selected {
  border-color: rgb(96 165 250 / 0.5);
  background:
    radial-gradient(circle at 0% 0%, rgb(37 99 235 / 0.28), transparent 42%),
    radial-gradient(circle at 100% 0%, rgb(20 184 166 / 0.2), transparent 38%),
    linear-gradient(135deg, rgb(15 23 42 / 0.92), rgb(2 6 23 / 0.76)),
    rgb(15 23 42 / 0.78);
  box-shadow:
    0 18px 42px rgb(37 99 235 / 0.14),
    inset 0 1px 0 rgb(255 255 255 / 0.1);
}

:global(.dark) :deep(.resolve-outcome-radio) {
  border-color: rgb(203 213 225 / 0.42);
  background: rgb(15 23 42 / 0.78);
  box-shadow:
    0 8px 18px rgb(0 0 0 / 0.32),
    inset 0 1px 0 rgb(255 255 255 / 0.1);
}

:global(.dark) :deep(.resolve-outcome-radio[data-state='checked']) {
  border-color: rgb(96 165 250);
  background: linear-gradient(135deg, rgb(37 99 235), rgb(20 184 166));
  color: white;
}

:global(.dark) .resolve-info-card {
  border-color: rgb(96 165 250 / 0.22);
  color: rgb(191 219 254);
  background:
    linear-gradient(135deg, rgb(59 130 246 / 0.14), rgb(20 184 166 / 0.08)),
    rgb(15 23 42 / 0.42);
}

:global(.dark) .resolve-warning-card {
  border-color: rgb(245 158 11 / 0.24);
  background:
    linear-gradient(135deg, rgb(245 158 11 / 0.14), rgb(15 23 42 / 0.34)),
    rgb(15 23 42 / 0.36);
}

:global(.dark) .resolve-muted-card {
  border-color: rgb(255 255 255 / 0.08);
  background: rgb(255 255 255 / 0.05);
}
</style>
