<script setup lang="ts">
import { LoaderCircle } from 'lucide-vue-next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { ConsultationResponse } from '../types/consultation.types'

const props = withDefaults(defineProps<{
  open: boolean
  consultation: ConsultationResponse
  isSaving: boolean
  previewOnly?: boolean
}>(), {
  previewOnly: false,
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  confirm: []
}>()

function formatValue(val: string | number | null | undefined): string {
  if (val === null || val === undefined || val === '') return '—'
  return String(val)
}
</script>

<template>
  <Dialog :open="props.open" @update:open="(val) => emit('update:open', val)">
    <DialogContent class="max-h-[85vh] w-[66vw] sm:max-w-[66vw] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{{ previewOnly ? 'Consultation Preview' : 'Finalize Consultation' }}</DialogTitle>
        <DialogDescription>
          {{ previewOnly ? 'Review the current consultation summary.' : 'Review the consultation before finalizing. This action cannot be undone.' }}
        </DialogDescription>
      </DialogHeader>

      <div class="grid grid-cols-1 gap-5 py-2 md:grid-cols-2">
        <!-- Left Column: Triage -->
        <div class="flex flex-col gap-3">
          <h3 class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Triage
          </h3>
          <div v-if="consultation.triage.chief_complaint" class="rounded-md border bg-muted/30 p-3">
            <p class="mb-1 text-xs text-muted-foreground">Chief Complaint</p>
            <p class="text-sm">{{ consultation.triage.chief_complaint }}</p>
          </div>
          <div class="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-md border bg-muted/30 p-3 text-sm">
            <div class="flex justify-between gap-2">
              <span class="text-muted-foreground">BP</span>
              <span class="font-medium">{{ formatValue(consultation.triage.vitals?.bp) }}</span>
            </div>
            <div class="flex justify-between gap-2">
              <span class="text-muted-foreground">HR</span>
              <span class="font-medium">
                {{ consultation.triage.vitals?.hr !== null ? `${consultation.triage.vitals?.hr} bpm` : '—' }}
              </span>
            </div>
            <div class="flex justify-between gap-2">
              <span class="text-muted-foreground">RR</span>
              <span class="font-medium">
                {{ consultation.triage.vitals?.rr !== null ? `${consultation.triage.vitals?.rr} /min` : '—' }}
              </span>
            </div>
            <div class="flex justify-between gap-2">
              <span class="text-muted-foreground">Temp</span>
              <span class="font-medium">
                {{ consultation.triage.vitals?.temp !== null ? `${consultation.triage.vitals?.temp} °C` : '—' }}
              </span>
            </div>
            <div class="flex justify-between gap-2">
              <span class="text-muted-foreground">SpO2</span>
              <span class="font-medium">
                {{ consultation.triage.vitals?.spo2 !== null ? `${consultation.triage.vitals?.spo2}%` : '—' }}
              </span>
            </div>
            <div class="flex justify-between gap-2">
              <span class="text-muted-foreground">Weight</span>
              <span class="font-medium">
                {{ consultation.triage.weight !== null ? `${consultation.triage.weight} kg` : '—' }}
              </span>
            </div>
            <div class="flex justify-between gap-2">
              <span class="text-muted-foreground">Height</span>
              <span class="font-medium">
                {{ consultation.triage.height !== null ? `${consultation.triage.height} cm` : '—' }}
              </span>
            </div>
            <div class="flex justify-between gap-2">
              <span class="text-muted-foreground">Pain</span>
              <span class="font-medium">
                {{ consultation.triage.pain_score !== null ? `${consultation.triage.pain_score}/10` : '—' }}
              </span>
            </div>
          </div>
          <div v-if="consultation.patient_allergies?.length" class="rounded-md border bg-muted/30 p-3">
            <p class="mb-1 text-xs text-muted-foreground">Allergies</p>
            <div class="flex flex-wrap gap-1">
              <Badge v-for="allergy in consultation.patient_allergies" :key="allergy" variant="secondary" class="text-xs">
                {{ allergy }}
              </Badge>
            </div>
          </div>
          <div v-if="consultation.patient_conditions?.length" class="rounded-md border bg-muted/30 p-3">
            <p class="mb-1 text-xs text-muted-foreground">Chronic Conditions</p>
            <div class="flex flex-wrap gap-1">
              <Badge v-for="condition in consultation.patient_conditions" :key="condition" variant="secondary" class="text-xs">
                {{ condition }}
              </Badge>
            </div>
          </div>
          <div v-if="consultation.triage.notes" class="rounded-md border bg-muted/30 p-3">
            <p class="mb-1 text-xs text-muted-foreground">Notes</p>
            <p class="text-sm whitespace-pre-wrap">{{ consultation.triage.notes }}</p>
          </div>
        </div>

        <!-- Right Column: Assessment, Prescription, Payment -->
        <div class="flex flex-col gap-5">
          <!-- Assessment Summary -->
          <div>
            <h3 class="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Assessment
            </h3>
            <div class="rounded-md border bg-muted/30 p-3">
              <div v-if="consultation.assessment?.diagnoses?.length" class="flex flex-col gap-2">
                <div class="flex flex-wrap gap-1.5">
                  <Badge
                    v-for="(diagnosis, index) in consultation.assessment.diagnoses"
                    :key="index"
                    variant="secondary"
                    class="text-xs"
                  >
                    <span v-if="diagnosis.code" class="mr-1 font-mono text-muted-foreground">
                      {{ diagnosis.code }}
                    </span>
                    {{ diagnosis.description }}
                  </Badge>
                </div>
                <p
                  v-if="consultation.assessment.notes"
                  class="mt-1 text-sm whitespace-pre-wrap text-muted-foreground"
                >
                  {{ consultation.assessment.notes }}
                </p>
              </div>
              <p v-else class="text-sm text-muted-foreground">—</p>
            </div>
          </div>

          <!-- Prescription Summary -->
          <div v-if="consultation.prescription_summary?.items?.length">
            <h3 class="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Prescription
            </h3>
            <div class="rounded-md border bg-muted/30 p-3">
              <div class="flex flex-col gap-1.5">
                <div
                  v-for="(med, idx) in consultation.prescription_summary.items"
                  :key="idx"
                  class="flex flex-wrap items-baseline gap-x-2 text-sm"
                >
                  <span class="font-medium">{{ med.drug_name }}</span>
                  <span class="text-muted-foreground">{{ med.dose }}</span>
                  <span class="text-xs text-muted-foreground">{{ med.frequency }}</span>
                  <span v-if="med.duration" class="text-xs text-muted-foreground">· {{ med.duration }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Treatment Plan Summary -->
          <div>
            <h3 class="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Treatment Plan
            </h3>
            <div class="flex flex-col gap-2 rounded-md border bg-muted/30 p-3">
              <div>
                <p class="mb-0.5 text-xs text-muted-foreground">Advice / Instructions</p>
                <p v-if="consultation.treatment_plan?.advice" class="text-sm whitespace-pre-wrap">
                  {{ consultation.treatment_plan.advice }}
                </p>
                <p v-else class="text-sm text-muted-foreground">—</p>
              </div>
              <div>
                <p class="mb-0.5 text-xs text-muted-foreground">Follow-up</p>
                <p v-if="consultation.treatment_plan?.follow_up" class="text-sm">
                  {{ new Date(consultation.treatment_plan.follow_up).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) }}
                </p>
                <p v-else class="text-sm text-muted-foreground">—</p>
              </div>
            </div>
          </div>

          <!-- Payment Summary -->
          <div>
            <h3 class="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Payment
            </h3>
            <div class="rounded-md border bg-muted/30 p-3">
              <p class="text-sm text-muted-foreground">Not yet configured</p>
            </div>
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button
          variant="outline"
          :disabled="isSaving"
          @click="emit('update:open', false)"
        >
          {{ previewOnly ? 'Close' : 'Cancel' }}
        </Button>
        <Button v-if="!previewOnly" :disabled="isSaving" @click="emit('confirm')">
          <LoaderCircle v-if="isSaving" class="size-4 animate-spin" />
          {{ isSaving ? 'Finalizing...' : 'Confirm Finalize' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
