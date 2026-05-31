<script setup lang="ts">
import { computed, watch } from 'vue'
import { LoaderCircle, TrendingUp } from 'lucide-vue-next'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { usePatientDetailStore } from '@/stores/patientDetailStore'
import type { PatientSex } from '@/domains/patient/lib/whoGrowthStandards'
import GrowthChart from './GrowthChart.vue'

/**
 * Pediatric companion to ChronicTrendsDialog. Shown from the consultation
 * Assessment tab's "Trends" button when the encounter specialty is
 * pediatrics. Lazy-loads the patient's growth + pediatrics data via the
 * shared patient-detail store so we don't refetch if the peds tab was
 * already opened on the profile page.
 */
const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const pdStore = usePatientDetailStore()

const growthMeasurements = computed(() => pdStore.growthHistory)
const isLoading = computed(() => pdStore.isLoadingPeds)
const sex = computed<PatientSex>(
  () => (pdStore.patient?.sex === 'female' ? 'female' : 'male'),
)

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return
    // Lazy-load peds data on first open — skip if the patient-detail page
    // already hydrated it, otherwise the button on a fresh Assessment tab
    // would show an empty chart.
    if (!pdStore.pedsLoaded && !pdStore.isLoadingPeds) {
      pdStore.loadPediatrics()
    }
  },
)
</script>

<template>
  <Dialog :open="props.open" @update:open="emit('update:open', $event)">
    <DialogContent class="flex sm:max-w-5xl min-h-[40vh] max-h-[85vh] flex-col overflow-y-auto">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <TrendingUp class="size-5 text-primary" />
          Growth Chart
        </DialogTitle>
      </DialogHeader>

      <div v-if="isLoading" class="flex min-h-[400px] items-center justify-center">
        <LoaderCircle class="size-6 animate-spin text-muted-foreground" />
      </div>

      <div
        v-else-if="growthMeasurements.length === 0"
        class="flex min-h-[400px] flex-col items-center justify-center gap-2 py-12 text-center"
      >
        <TrendingUp class="size-10 text-muted-foreground/30" />
        <p class="text-sm font-medium text-muted-foreground">No growth measurements recorded</p>
        <p class="max-w-sm text-xs text-muted-foreground/70">
          Growth data is captured from consultation vitals — weight, height, and head
          circumference are plotted against WHO percentile curves.
        </p>
      </div>

      <GrowthChart
        v-else
        :measurements="growthMeasurements"
        :sex="sex"
      />
    </DialogContent>
  </Dialog>
</template>
