<script setup lang="ts">
/**
 * Patient-profile sections for dental specialty — parallel to
 * ObGynPatientSections. Mounted by PatientSpecialtyFactory when the
 * doctor's specialty is `dental`. Surfaces the authoritative odontogram,
 * DMFT badge, perio screening summary, and a list of active treatment
 * plans. Read-only here — odontogram editing happens inside a visit.
 */
import { computed, onMounted } from 'vue'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { LoaderCircle, Plus, Stethoscope } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { usePatientDetailStore } from '@/stores/patientDetailStore'
import { RouteNames } from '@/router/routeNames'
import DentalChart from './DentalChart.vue'
import DmftBadge from './DmftBadge.vue'
import type { StampedOdontogram } from '../types/dental.types'

const pdStore = usePatientDetailStore()
const router = useRouter()

onMounted(() => {
  if (!pdStore.dentalProfile && !pdStore.isLoadingDental) {
    pdStore.loadDental()
  }
})

const profile = computed(() => pdStore.dentalProfile)
const stampedOdontogram = computed<StampedOdontogram>(
  () => (profile.value?.odontogram ?? {}) as StampedOdontogram,
)
const activePlans = computed(() => pdStore.dentalTreatmentPlans.filter((p) => p.status === 'active'))
const recentVisits = computed(() => pdStore.dentalVisits.slice(0, 3))

const psrSummary = computed(() => {
  if (!profile.value?.perio_psr) return null
  const codes = Object.values(profile.value.perio_psr).filter((c): c is number => typeof c === 'number')
  if (codes.length === 0) return null
  const max = Math.max(...codes)
  return { max, count: codes.length }
})

function newDentalVisit() {
  if (!pdStore.patientId) return
  router.push({
    name: RouteNames.ENCOUNTER_NEW,
    params: { patientId: pdStore.patientId },
    query: { type: 'dental' },
  })
}
</script>

<template>
  <!-- Odontogram + DMFT (full-width on the grid) -->
  <section class="rounded-2xl border bg-card p-4 sm:col-span-2 lg:col-span-3">
    <header class="mb-3 flex flex-wrap items-center gap-2">
      <Stethoscope class="size-4 text-primary" />
      <h2 class="text-sm font-semibold">Dental Profile</h2>
      <DmftBadge
        v-if="profile"
        :score="profile.dmft_score"
        :decayed="profile.dmft_decayed"
        :missing="profile.dmft_missing"
        :filled="profile.dmft_filled"
        :primary-score="profile.dmft_score_primary"
      />
      <span v-if="psrSummary" class="ml-auto text-xs text-muted-foreground">
        PSR max: <strong class="font-semibold">{{ psrSummary.max }}</strong>
      </span>
      <Button size="sm" class="ml-2" @click="newDentalVisit">
        <Plus class="size-4" /> New visit
      </Button>
    </header>

    <div v-if="pdStore.isLoadingDental" class="flex h-32 items-center justify-center">
      <LoaderCircle class="size-5 animate-spin text-muted-foreground" />
    </div>
    <div v-else-if="!profile" class="rounded-lg border-dashed border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
      No dental profile yet. Start a dental visit to begin charting.
    </div>
    <DentalChart v-else :stamped="stampedOdontogram" />
  </section>

  <!-- Active treatment plans -->
  <section class="rounded-2xl border bg-card p-4">
    <h3 class="mb-2 text-sm font-semibold">Active Treatment Plans</h3>
    <div v-if="pdStore.isLoadingDental" class="flex h-20 items-center justify-center">
      <LoaderCircle class="size-4 animate-spin text-muted-foreground" />
    </div>
    <p v-else-if="activePlans.length === 0" class="text-xs text-muted-foreground">No active plans.</p>
    <ul v-else class="space-y-2 text-sm">
      <li v-for="p in activePlans" :key="p.id" class="rounded-lg border bg-card/60 px-3 py-2">
        <p class="font-medium">{{ p.chief_complaint || 'Untitled plan' }}</p>
        <p class="text-xs text-muted-foreground">
          {{ p.line_items.length }} item{{ p.line_items.length === 1 ? '' : 's' }}
          <span v-if="p.total_estimated_cost"> · ₱{{ p.total_estimated_cost.toFixed(2) }}</span>
        </p>
      </li>
    </ul>
  </section>

  <!-- Recent visits -->
  <section class="rounded-2xl border bg-card p-4">
    <h3 class="mb-2 text-sm font-semibold">Recent Visits</h3>
    <div v-if="pdStore.isLoadingDental" class="flex h-20 items-center justify-center">
      <LoaderCircle class="size-4 animate-spin text-muted-foreground" />
    </div>
    <p v-else-if="recentVisits.length === 0" class="text-xs text-muted-foreground">No visits yet.</p>
    <ul v-else class="space-y-2 text-sm">
      <li v-for="v in recentVisits" :key="v.id" class="rounded-lg border bg-card/60 px-3 py-2">
        <p class="font-medium">{{ v.visit_date ?? '—' }}</p>
        <p class="text-xs text-muted-foreground">
          {{ v.triage?.chief_complaint || 'No chief complaint' }}
        </p>
        <Badge v-if="v.plan?.procedures?.length" variant="secondary" class="mt-1">
          {{ v.plan.procedures.length }} procedure{{ v.plan.procedures.length === 1 ? '' : 's' }}
        </Badge>
      </li>
    </ul>
  </section>
</template>
