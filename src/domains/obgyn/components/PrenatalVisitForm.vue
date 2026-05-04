<script setup lang="ts">
import { computed, reactive } from 'vue'
import {
  MessageSquare,
  Activity,
  Stethoscope,
  ClipboardList,
  CalendarDays,
  LoaderCircle,
  AlertTriangle,
} from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import MFDatePicker from '@/components/shared/MFDatePicker.vue'
import GACalculator from './GACalculator.vue'
import DangerSignsChecklist from './DangerSignsChecklist.vue'
import { usePregnancyStore } from '../stores/pregnancyStore'
import type { Pregnancy, PrenatalVisit } from '../types/obgyn.types'
import type { CreateVisitPayload } from '../api/obgynApi'

const props = defineProps<{
  patientId: string
  pregnancyId: string
  pregnancy: Pregnancy
  visit?: PrenatalVisit
}>()

const emit = defineEmits<{
  saved: [visit: PrenatalVisit]
  cancel: []
}>()

const store = usePregnancyStore()

const currentGa = computed(() => {
  if (!props.pregnancy.edd) return null
  const eddDate = new Date(props.pregnancy.edd)
  const today = new Date()
  const totalDays = 280 - Math.round((eddDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
  if (totalDays < 0) return null
  return { weeks: Math.floor(totalDays / 7), days: totalDays % 7 }
})

const showPresentation = computed(() => {
  if (!currentGa.value) return false
  return currentGa.value.weeks >= 34
})

interface FormState {
  visit_date: string
  // Subjective
  concerns: string
  fetal_movement: 'normal' | 'decreased' | 'not_yet_felt' | ''
  danger_signs: string[]
  // Vitals
  bp_systolic: number | null
  bp_diastolic: number | null
  heart_rate: number | null
  respiratory_rate: number | null
  temperature: number | null
  weight: number | null
  // Obstetric exam
  fundal_height: number | null
  fetal_heart_rate: number | null
  fhr_method: 'doppler' | 'fetoscope' | 'ultrasound' | ''
  fetal_presentation: 'cephalic' | 'breech' | 'transverse' | 'unknown' | ''
  edema: 'none' | 'trace' | '1+' | '2+' | '3+' | '4+' | ''
  // Assessment
  pregnancy_progress: 'normal' | 'concerning' | 'complicated' | ''
  risk_level_update: 'low' | 'high' | ''
  complications: string
  // Plan
  medications: string
  next_visit_date: string
  counseling: string[]
  danger_signs_reviewed: boolean
}

function todayIso(): string {
  return new Date().toISOString().split('T')[0]!
}

function buildInitialState(): FormState {
  const v = props.visit
  return {
    visit_date: v?.visit_date ?? todayIso(),
    concerns: v?.concerns ?? '',
    fetal_movement: (v?.fetal_movement ?? '') as FormState['fetal_movement'],
    danger_signs: v?.danger_signs ?? [],
    bp_systolic: v?.bp_systolic ?? null,
    bp_diastolic: v?.bp_diastolic ?? null,
    heart_rate: null,
    respiratory_rate: null,
    temperature: null,
    weight: v?.weight ?? null,
    fundal_height: v?.fundal_height ?? null,
    fetal_heart_rate: v?.fetal_heart_rate ?? null,
    fhr_method: '',
    fetal_presentation: (v?.fetal_presentation ?? '') as FormState['fetal_presentation'],
    edema: '',
    pregnancy_progress: (v?.pregnancy_progress ?? '') as FormState['pregnancy_progress'],
    risk_level_update: (v?.risk_level_update ?? '') as FormState['risk_level_update'],
    complications: v?.complications?.join('\n') ?? '',
    medications: '',
    next_visit_date: v?.next_visit_date ?? '',
    counseling: [],
    danger_signs_reviewed: false,
  }
}

const form = reactive<FormState>(buildInitialState())

const fhrAlert = computed(() => {
  if (!form.fetal_heart_rate) return null
  if (form.fetal_heart_rate < 110) return 'FHR below normal range (<110 bpm)'
  if (form.fetal_heart_rate > 160) return 'FHR above normal range (>160 bpm)'
  return null
})

// Weight gain calculations
const weightGainThisVisit = computed(() => {
  if (!form.weight) return null
  const lastVisit = store.visits.at(-1)
  if (!lastVisit?.weight) return null
  return Math.round((form.weight - lastVisit.weight) * 10) / 10
})

const cumulativeWeightGain = computed(() => {
  if (!form.weight || !props.pregnancy.pre_pregnancy_weight) return null
  return Math.round((form.weight - props.pregnancy.pre_pregnancy_weight) * 10) / 10
})

const counselingOptions: { key: string; label: string }[] = [
  { key: 'nutrition', label: 'Nutrition' },
  { key: 'exercise', label: 'Exercise' },
  { key: 'danger_signs', label: 'Danger Signs' },
  { key: 'breastfeeding', label: 'Breastfeeding' },
  { key: 'family_planning', label: 'Family Planning' },
  { key: 'birth_plan', label: 'Birth Plan' },
]

function toggleCounseling(key: string): void {
  const idx = form.counseling.indexOf(key)
  if (idx === -1) {
    form.counseling.push(key)
  } else {
    form.counseling.splice(idx, 1)
  }
}

async function handleSubmit(): Promise<void> {
  const payload: CreateVisitPayload = {
    visit_date: form.visit_date,
    gestational_age_weeks: currentGa.value?.weeks ?? null,
    gestational_age_days: currentGa.value?.days ?? null,
    concerns: form.concerns || null,
    fetal_movement: form.fetal_movement || null,
    danger_signs: form.danger_signs,
    bp_systolic: form.bp_systolic,
    bp_diastolic: form.bp_diastolic,
    weight: form.weight,
    fundal_height: form.fundal_height,
    fetal_heart_rate: form.fetal_heart_rate,
    fetal_presentation: form.fetal_presentation || null,
    next_visit_date: form.next_visit_date || null,
    complications: form.complications
      ? form.complications.split('\n').map((s) => s.trim()).filter(Boolean)
      : [],
    pregnancy_progress: form.pregnancy_progress || null,
    risk_level_update: form.risk_level_update || null,
  }

  let result: PrenatalVisit
  if (props.visit) {
    result = await store.updateVisit(props.patientId, props.pregnancyId, props.visit.id, payload)
  } else {
    result = await store.createVisit(props.patientId, props.pregnancyId, payload)
  }
  emit('saved', result)
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Visit header: GA badge + context -->
    <div class="flex flex-wrap items-start justify-between gap-3 rounded-lg border bg-muted/30 p-3">
      <div class="flex flex-col gap-1">
        <p class="text-xs font-medium text-muted-foreground">Current Gestational Age</p>
        <GACalculator v-if="pregnancy.edd" :edd="pregnancy.edd" />
        <p v-else class="text-sm text-muted-foreground">EDD not set</p>
      </div>
      <div class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span v-if="pregnancy.edd">
          EDD: <strong class="text-foreground">{{ new Date(pregnancy.edd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }}</strong>
        </span>
        <Badge v-if="visit" variant="secondary">Visit #{{ visit.visit_number }}</Badge>
        <Badge v-else variant="outline">New Visit</Badge>
      </div>
    </div>

    <!-- Visit Date -->
    <div class="flex flex-col gap-1.5">
      <Label for="visit_date" class="text-xs">Visit Date <span class="text-destructive">*</span></Label>
      <MFDatePicker
        :model-value="form.visit_date"
        disable-future
        class="h-8 w-48 text-sm"
        @update:model-value="(value) => form.visit_date = value ?? ''"
      />
    </div>

    <Separator />

    <!-- A. Subjective -->
    <section class="flex flex-col gap-4">
      <div class="flex items-center gap-2">
        <MessageSquare class="size-3.5 text-muted-foreground" />
        <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Subjective
        </h3>
      </div>

      <div class="flex flex-col gap-3">
        <div class="flex flex-col gap-1.5">
          <Label for="concerns" class="text-xs">Concerns / Complaints</Label>
          <Textarea
            id="concerns"
            v-model="form.concerns"
            placeholder="Patient's chief concerns for this visit..."
            class="min-h-20 resize-none text-sm"
          />
        </div>

        <div class="flex flex-col gap-1.5">
          <Label for="fetal_movement" class="text-xs">Fetal Movement</Label>
          <Select
            :model-value="form.fetal_movement"
            @update:model-value="(v) => { form.fetal_movement = v as typeof form.fetal_movement }"
          >
            <SelectTrigger id="fetal_movement" class="h-8 w-56 text-sm">
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="decreased">Decreased</SelectItem>
              <SelectItem value="not_yet_felt">Not yet felt</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="flex flex-col gap-2">
          <Label class="text-xs">Danger Signs</Label>
          <DangerSignsChecklist v-model="form.danger_signs" />
        </div>
      </div>
    </section>

    <Separator />

    <!-- B. Vitals -->
    <section class="flex flex-col gap-4">
      <div class="flex items-center gap-2">
        <Activity class="size-3.5 text-muted-foreground" />
        <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Vitals
        </h3>
      </div>

      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <!-- BP paired inputs -->
        <div class="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-1">
          <Label class="text-xs">Blood Pressure (mmHg)</Label>
          <div class="flex items-center gap-1.5">
            <Input
              :model-value="form.bp_systolic ?? undefined"
              type="number"
              min="60"
              max="240"
              placeholder="Sys"
              class="h-8 text-sm"
              @update:model-value="(v) => (form.bp_systolic = v ? Number(v) : null)"
            />
            <span class="shrink-0 text-muted-foreground">/</span>
            <Input
              :model-value="form.bp_diastolic ?? undefined"
              type="number"
              min="40"
              max="150"
              placeholder="Dia"
              class="h-8 text-sm"
              @update:model-value="(v) => (form.bp_diastolic = v ? Number(v) : null)"
            />
          </div>
        </div>

        <div class="flex flex-col gap-1.5">
          <Label for="heart_rate" class="text-xs">Heart Rate (bpm)</Label>
          <Input
            id="heart_rate"
            :model-value="form.heart_rate ?? undefined"
            type="number"
            min="40"
            max="200"
            placeholder="e.g. 80"
            class="h-8 text-sm"
            @update:model-value="(v) => (form.heart_rate = v ? Number(v) : null)"
          />
        </div>

        <div class="flex flex-col gap-1.5">
          <Label for="rr" class="text-xs">Respiratory Rate</Label>
          <Input
            id="rr"
            :model-value="form.respiratory_rate ?? undefined"
            type="number"
            min="8"
            max="40"
            placeholder="e.g. 16"
            class="h-8 text-sm"
            @update:model-value="(v) => (form.respiratory_rate = v ? Number(v) : null)"
          />
        </div>

        <div class="flex flex-col gap-1.5">
          <Label for="temperature" class="text-xs">Temperature (°C)</Label>
          <Input
            id="temperature"
            :model-value="form.temperature ?? undefined"
            type="number"
            min="35"
            max="42"
            step="0.1"
            placeholder="e.g. 36.8"
            class="h-8 text-sm"
            @update:model-value="(v) => (form.temperature = v ? Number(v) : null)"
          />
        </div>

        <div class="flex flex-col gap-1.5">
          <Label for="weight" class="text-xs">Weight (kg)</Label>
          <Input
            id="weight"
            :model-value="form.weight ?? undefined"
            type="number"
            min="30"
            max="200"
            step="0.1"
            placeholder="e.g. 62.5"
            class="h-8 text-sm"
            @update:model-value="(v) => (form.weight = v ? Number(v) : null)"
          />
        </div>

        <div class="flex flex-col gap-1.5">
          <Label class="text-xs">Weight Gain (This Visit)</Label>
          <div class="flex h-8 items-center rounded-md border bg-muted/50 px-3 text-sm text-muted-foreground">
            {{ weightGainThisVisit !== null ? `${weightGainThisVisit > 0 ? '+' : ''}${weightGainThisVisit} kg` : '—' }}
          </div>
        </div>

        <div class="flex flex-col gap-1.5">
          <Label class="text-xs">Cumulative Weight Gain</Label>
          <div class="flex h-8 items-center rounded-md border bg-muted/50 px-3 text-sm text-muted-foreground">
            {{ cumulativeWeightGain !== null ? `${cumulativeWeightGain > 0 ? '+' : ''}${cumulativeWeightGain} kg` : '—' }}
          </div>
        </div>
      </div>
    </section>

    <Separator />

    <!-- C. Obstetric Exam -->
    <section class="flex flex-col gap-4">
      <div class="flex items-center gap-2">
        <Stethoscope class="size-3.5 text-muted-foreground" />
        <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Obstetric Exam
        </h3>
      </div>

      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div class="flex flex-col gap-1.5">
          <Label for="fundal_height" class="text-xs">Fundal Height (cm)</Label>
          <Input
            id="fundal_height"
            :model-value="form.fundal_height ?? undefined"
            type="number"
            min="0"
            max="45"
            placeholder="e.g. 28"
            class="h-8 text-sm"
            @update:model-value="(v) => (form.fundal_height = v ? Number(v) : null)"
          />
        </div>

        <div class="flex flex-col gap-1.5">
          <Label for="fhr" class="text-xs">
            Fetal Heart Rate (bpm)
            <span v-if="fhrAlert" class="ml-1 text-destructive">!</span>
          </Label>
          <Input
            id="fhr"
            :model-value="form.fetal_heart_rate ?? undefined"
            type="number"
            min="60"
            max="220"
            placeholder="e.g. 140"
            class="h-8 text-sm"
            :class="fhrAlert ? 'border-destructive' : ''"
            @update:model-value="(v) => (form.fetal_heart_rate = v ? Number(v) : null)"
          />
          <div
            v-if="fhrAlert"
            class="flex items-center gap-1 text-xs text-destructive"
          >
            <AlertTriangle class="size-3" />
            {{ fhrAlert }}
          </div>
        </div>

        <div class="flex flex-col gap-1.5">
          <Label for="fhr_method" class="text-xs">FHR Method</Label>
          <Select
            :model-value="form.fhr_method"
            @update:model-value="(v) => { form.fhr_method = v as typeof form.fhr_method }"
          >
            <SelectTrigger id="fhr_method" class="h-8 text-sm">
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="doppler">Doppler</SelectItem>
              <SelectItem value="fetoscope">Fetoscope</SelectItem>
              <SelectItem value="ultrasound">Ultrasound</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div v-if="showPresentation" class="flex flex-col gap-1.5">
          <Label for="presentation" class="text-xs">Fetal Presentation</Label>
          <Select
            :model-value="form.fetal_presentation"
            @update:model-value="(v) => { form.fetal_presentation = v as typeof form.fetal_presentation }"
          >
            <SelectTrigger id="presentation" class="h-8 text-sm">
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cephalic">Cephalic</SelectItem>
              <SelectItem value="breech">Breech</SelectItem>
              <SelectItem value="transverse">Transverse</SelectItem>
              <SelectItem value="unknown">Unknown</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="flex flex-col gap-1.5">
          <Label for="edema" class="text-xs">Edema</Label>
          <Select
            :model-value="form.edema"
            @update:model-value="(v) => { form.edema = v as typeof form.edema }"
          >
            <SelectTrigger id="edema" class="h-8 text-sm">
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="trace">Trace</SelectItem>
              <SelectItem value="1+">1+</SelectItem>
              <SelectItem value="2+">2+</SelectItem>
              <SelectItem value="3+">3+</SelectItem>
              <SelectItem value="4+">4+</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </section>

    <Separator />

    <!-- D. Assessment -->
    <section class="flex flex-col gap-4">
      <div class="flex items-center gap-2">
        <ClipboardList class="size-3.5 text-muted-foreground" />
        <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Assessment
        </h3>
      </div>

      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div class="flex flex-col gap-1.5">
          <Label for="pregnancy_progress" class="text-xs">Pregnancy Progress</Label>
          <Select
            :model-value="form.pregnancy_progress"
            @update:model-value="(v) => { form.pregnancy_progress = v as typeof form.pregnancy_progress }"
          >
            <SelectTrigger id="pregnancy_progress" class="h-8 text-sm">
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="concerning">Concerning</SelectItem>
              <SelectItem value="complicated">Complicated</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="flex flex-col gap-1.5">
          <Label for="risk_level_update" class="text-xs">Risk Level Update</Label>
          <Select
            :model-value="form.risk_level_update"
            @update:model-value="(v) => { form.risk_level_update = v as typeof form.risk_level_update }"
          >
            <SelectTrigger id="risk_level_update" class="h-8 text-sm">
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low Risk</SelectItem>
              <SelectItem value="high">High Risk</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="flex flex-col gap-1.5 sm:col-span-2">
          <Label for="complications" class="text-xs">Complications</Label>
          <Textarea
            id="complications"
            v-model="form.complications"
            placeholder="One complication per line..."
            class="min-h-20 resize-none text-sm"
          />
        </div>
      </div>
    </section>

    <Separator />

    <!-- E. Plan -->
    <section class="flex flex-col gap-4">
      <div class="flex items-center gap-2">
        <CalendarDays class="size-3.5 text-muted-foreground" />
        <h3 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Plan
        </h3>
      </div>

      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div class="flex flex-col gap-1.5 sm:col-span-2">
          <Label for="medications" class="text-xs">Medications</Label>
          <Textarea
            id="medications"
            v-model="form.medications"
            placeholder="e.g. Ferrous sulfate 300mg OD, Folic acid 400mcg OD..."
            class="min-h-20 resize-none text-sm"
          />
        </div>

        <div class="flex flex-col gap-1.5">
          <Label for="next_visit" class="text-xs">Next Visit Date</Label>
          <MFDatePicker
            :model-value="form.next_visit_date"
            class="h-8 text-sm"
            @update:model-value="(value) => form.next_visit_date = value ?? ''"
          />
        </div>

        <div class="flex flex-col gap-2">
          <Label class="text-xs">Counseling Provided</Label>
          <div class="grid grid-cols-2 gap-2">
            <div
              v-for="opt in counselingOptions"
              :key="opt.key"
              class="flex items-center gap-2"
            >
              <Checkbox
                :id="`counsel-${opt.key}`"
                :checked="form.counseling.includes(opt.key)"
                @update:checked="toggleCounseling(opt.key)"
              />
              <Label :for="`counsel-${opt.key}`" class="cursor-pointer text-sm">
                {{ opt.label }}
              </Label>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <Checkbox
            id="danger_signs_reviewed"
            :checked="form.danger_signs_reviewed"
            @update:checked="(v: boolean) => (form.danger_signs_reviewed = v)"
          />
          <Label for="danger_signs_reviewed" class="cursor-pointer text-sm">
            Danger signs reviewed with patient
          </Label>
        </div>
      </div>
    </section>

    <!-- Footer -->
    <div class="flex items-center justify-end gap-2 border-t pt-4">
      <Button variant="outline" :disabled="store.isSaving" @click="emit('cancel')">
        Cancel
      </Button>
      <Button :disabled="store.isSaving" @click="handleSubmit">
        <LoaderCircle v-if="store.isSaving" class="size-4 animate-spin" />
        {{ visit ? 'Update Visit' : 'Save Visit' }}
      </Button>
    </div>
  </div>
</template>
