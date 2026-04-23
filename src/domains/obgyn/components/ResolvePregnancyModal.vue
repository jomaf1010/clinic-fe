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
    <DialogContent class="max-h-[85vh] overflow-y-auto sm:max-w-lg">
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
                class="flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
                :class="{ 'border-primary bg-primary/5': selectedOutcome === opt.value }"
              >
                <RadioGroupItem :value="opt.value" class="mt-0.5" />
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
                class="flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
                :class="{ 'border-primary bg-primary/5': selectedOutcome === opt.value }"
              >
                <RadioGroupItem :value="opt.value" class="mt-0.5" />
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
          <div
            v-if="isDeliveryOutcome"
            class="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300"
          >
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
            <div v-if="isMolar" class="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
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
          <div class="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
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
