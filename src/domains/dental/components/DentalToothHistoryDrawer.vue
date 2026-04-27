<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { LoaderCircle, Clipboard, FileCheck2, ClipboardList } from 'lucide-vue-next'
import { dentalApi } from '../api/dentalApi'
import type {
  DentalToothHistory,
  ToothHistoryEvent,
  ToothHistoryEventType,
} from '../types/dental.types'

const props = defineProps<{
  open: boolean
  patientId: string
  /** FDI number, e.g. "16". */
  tooth: string | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const isOpen = computed({
  get: () => props.open,
  set: (v) => emit('update:open', v),
})

const history = ref<DentalToothHistory | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

async function load(patientId: string, tooth: string) {
  loading.value = true
  error.value = null
  try {
    const res = await dentalApi.toothHistory(patientId, tooth)
    history.value = res.data
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load tooth history.'
    history.value = null
  } finally {
    loading.value = false
  }
}

watch(
  () => [props.open, props.patientId, props.tooth] as const,
  ([open, patientId, tooth]) => {
    if (!open || !patientId || !tooth) return
    // Only fetch when the drawer is opening on a new tooth
    if (history.value?.tooth === tooth && !error.value) return
    void load(patientId, tooth)
  },
  { immediate: true },
)

function formatDate(iso: string | null): string {
  // An event without a date typically comes from an encounter that was
  // created but not finalized (visit_date is set on finalize). "Pending
  // visit" reads better than a cryptic em-dash and signals to the dentist
  // that the row is real but not yet locked in.
  if (!iso) return 'Pending visit'
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return iso
  }
}

function formatPeso(amount: number | null | undefined): string {
  if (amount == null) return ''
  return `₱${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const EVENT_META: Record<ToothHistoryEventType, { label: string; icon: typeof Clipboard; color: string }> = {
  assessment_delta: { label: 'Finding', icon: Clipboard, color: 'bg-amber-500' },
  plan_item: { label: 'Proposed', icon: ClipboardList, color: 'bg-blue-500' },
  procedure_completed: { label: 'Completed', icon: FileCheck2, color: 'bg-emerald-500' },
}

function eventMeta(type: ToothHistoryEventType) {
  return EVENT_META[type]
}

function surfaceAbbrev(surfaces: string[] | null | undefined): string {
  if (!surfaces || surfaces.length === 0) return ''
  return surfaces.map((s) => s.charAt(0).toUpperCase()).join('')
}

function eventDetail(event: ToothHistoryEvent): string | null {
  if (event.type === 'procedure_completed') {
    const bits: string[] = []
    if (event.surfaces && event.surfaces.length > 0) bits.push(`Surfaces: ${surfaceAbbrev(event.surfaces)}`)
    if (event.material) bits.push(`Material: ${event.material}`)
    return bits.length ? bits.join(' · ') : null
  }
  if (event.type === 'plan_item') {
    const bits: string[] = []
    if (event.phase) bits.push(`Phase: ${event.phase}`)
    if (event.status) bits.push(`Status: ${event.status}`)
    return bits.length ? bits.join(' · ') : null
  }
  return null
}
</script>

<template>
  <Sheet v-model:open="isOpen">
    <SheetContent side="right" class="w-full sm:max-w-lg overflow-y-auto">
      <SheetHeader>
        <SheetTitle>Tooth {{ tooth ?? '—' }} history</SheetTitle>
        <SheetDescription>
          Every finding, proposal, and completion recorded for this tooth, newest first.
        </SheetDescription>
      </SheetHeader>

      <div class="mt-4">
        <div v-if="loading" class="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <LoaderCircle class="size-4 animate-spin" />
          Loading history…
        </div>

        <div v-else-if="error" role="alert" class="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          {{ error }}
        </div>

        <div v-else-if="history && history.events.length === 0" class="py-12 text-center text-sm text-muted-foreground">
          No recorded activity for tooth {{ history.tooth }} yet.
        </div>

        <ol v-else-if="history" class="relative space-y-4 border-l-2 border-border pl-5">
          <li
            v-for="(event, i) in history.events"
            :key="`${event.type}-${event.visit_id ?? event.plan_id ?? i}-${i}`"
            class="relative"
          >
            <!-- Timeline dot -->
            <span
              :class="[
                'absolute -left-[27px] mt-1 size-4 rounded-full border-2 border-background',
                eventMeta(event.type).color,
              ]"
            />

            <div class="rounded-lg border bg-card p-3 space-y-1.5">
              <div class="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" class="flex items-center gap-1">
                  <component :is="eventMeta(event.type).icon" class="size-3" />
                  {{ eventMeta(event.type).label }}
                </Badge>
                <span v-if="event.cdt_code" class="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wide text-muted-foreground">
                  {{ event.cdt_code }}
                </span>
                <span class="text-xs text-muted-foreground">{{ formatDate(event.date) }}</span>
                <span v-if="event.billable_amount != null || event.cost_estimate != null" class="ml-auto text-sm font-semibold tabular-nums">
                  {{ formatPeso(event.billable_amount ?? event.cost_estimate) }}
                </span>
              </div>

              <p class="text-sm">{{ event.summary }}</p>

              <p v-if="eventDetail(event)" class="text-xs text-muted-foreground">{{ eventDetail(event) }}</p>

              <p v-if="event.doctor_name" class="text-[11px] text-muted-foreground">
                by {{ event.doctor_name }}
              </p>
            </div>
          </li>
        </ol>
      </div>
    </SheetContent>
  </Sheet>
</template>
