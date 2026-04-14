<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowLeft,
  Baby,
  LoaderCircle,
  Plus,
  CalendarDays,
  Activity,
  Weight,
  LayoutDashboard,
} from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { RouteNames } from '@/router/routeNames'
import { usePregnancyStore } from '../stores/pregnancyStore'
import PregnancySetupForm from '../components/PregnancySetupForm.vue'
import GACalculator from '../components/GACalculator.vue'
import RiskClassificationBadge from '../components/RiskClassificationBadge.vue'
import PregnancyDashboard from '../components/PregnancyDashboard.vue'
import type { Pregnancy } from '../types/obgyn.types'

const route = useRoute()
const router = useRouter()
const store = usePregnancyStore()

const patientId = computed(() => {
  const id = route.params.patientId
  return typeof id === 'string' ? id : id[0] ?? ''
})

const pregnancyId = computed(() => {
  const id = route.params.pregnancyId
  return typeof id === 'string' ? id : id[0] ?? ''
})

const isNew = computed(() => route.name === RouteNames.PREGNANCY_CREATE)
const activeTab = ref('setup')
const loadError = ref<string | null>(null)

function formatDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function statusClass(status: Pregnancy['status']): string {
  switch (status) {
    case 'active': return 'border-green-200 bg-green-100 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400'
    case 'postpartum': return 'border-blue-200 bg-blue-100 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-400'
    case 'delivered': return 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400'
    case 'lost': return 'border-red-200 bg-red-100 text-red-600 dark:border-red-800 dark:bg-red-950 dark:text-red-400'
    default: return ''
  }
}

function statusLabel(status: Pregnancy['status']): string {
  switch (status) {
    case 'active': return 'Active'
    case 'postpartum': return 'Postpartum'
    case 'delivered': return 'Delivered'
    case 'lost': return 'Lost'
    case 'inactive': return 'Inactive'
  }
}

onMounted(async () => {
  loadError.value = null
  if (!isNew.value) {
    try {
      await Promise.all([
        store.loadPregnancy(patientId.value, pregnancyId.value),
        store.loadVisits(patientId.value, pregnancyId.value),
      ])
    } catch {
      loadError.value = 'Failed to load pregnancy record.'
    }
  }
})

onUnmounted(() => {
  store.$reset()
})

function handleSetupSaved(pregnancy: Pregnancy): void {
  if (isNew.value) {
    router.replace({
      name: RouteNames.PREGNANCY_DETAIL,
      params: { patientId: patientId.value, pregnancyId: pregnancy.id },
    })
  }
}

function goToNewVisit(): void {
  router.push({
    name: RouteNames.PRENATAL_VISIT_CREATE,
    params: { patientId: patientId.value, pregnancyId: pregnancyId.value },
  })
}

function goToVisit(visitId: string): void {
  router.push({
    name: RouteNames.PRENATAL_VISIT_DETAIL,
    params: { patientId: patientId.value, pregnancyId: pregnancyId.value, visitId },
  })
}
</script>

<template>
  <div class="flex flex-1 flex-col">
    <!-- Loading -->
    <div v-if="store.isLoading && !store.currentPregnancy && !isNew" class="flex flex-1 items-center justify-center py-16">
      <LoaderCircle class="size-6 animate-spin text-muted-foreground" />
    </div>

    <!-- Error -->
    <div
      v-else-if="loadError"
      role="alert"
      class="mx-auto mt-8 max-w-md rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
    >
      {{ loadError }}
    </div>

    <template v-else>
      <!-- Sticky Header -->
      <div class="sticky top-0 z-10 border-b bg-background">
        <div class="flex flex-col gap-2 px-4 pb-2 pt-3 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex items-center gap-2">
            <Button variant="ghost" size="sm" class="gap-1.5" @click="router.back()">
              <ArrowLeft class="size-3.5" />
              Back
            </Button>
            <Separator orientation="vertical" class="h-4" />
            <Baby class="size-4 text-purple-500" />
            <span class="text-sm font-semibold">
              {{ isNew ? 'New Pregnancy Record' : 'Pregnancy Record' }}
            </span>
            <template v-if="store.currentPregnancy">
              <Badge
                variant="outline"
                class="text-xs"
                :class="statusClass(store.currentPregnancy.status)"
              >
                {{ statusLabel(store.currentPregnancy.status) }}
              </Badge>
              <RiskClassificationBadge
                v-if="store.currentPregnancy.risk_level"
                :level="store.currentPregnancy.risk_level"
                :factors="store.currentPregnancy.risk_factors"
              />
            </template>
          </div>

          <!-- GA Summary (header) -->
          <div v-if="store.currentPregnancy?.edd && store.currentPregnancy.status === 'active'" class="flex items-center gap-2">
            <GACalculator :edd="store.currentPregnancy.edd" />
          </div>
        </div>
      </div>

      <!-- Tabs -->
      <Tabs v-model="activeTab" class="-mx-4 flex flex-1 flex-col">
        <TabsList class="w-full justify-start overflow-x-auto px-4">
          <TabsTrigger value="setup">
            <Baby class="size-4" />
            Setup
          </TabsTrigger>
          <TabsTrigger v-if="!isNew" value="visits">
            <CalendarDays class="size-4" />
            Visits
            <Badge v-if="store.visits.length" variant="secondary" class="ml-1 h-4 min-w-4 px-1 text-[10px]">
              {{ store.visits.length }}
            </Badge>
          </TabsTrigger>
          <TabsTrigger v-if="!isNew && store.visits.length > 0" value="dashboard">
            <LayoutDashboard class="size-4" />
            Dashboard
          </TabsTrigger>
        </TabsList>

        <div class="flex-1 overflow-y-auto px-4 pb-8 pt-4 md:px-8">
          <div class="mx-auto max-w-3xl">
            <!-- Setup Tab -->
            <TabsContent value="setup" class="mt-0">
              <PregnancySetupForm
                :patient-id="patientId"
                :pregnancy="store.currentPregnancy ?? undefined"
                @saved="handleSetupSaved"
                @cancel="router.back()"
              />
            </TabsContent>

            <!-- Dashboard Tab -->
            <TabsContent v-if="!isNew && store.visits.length > 0" value="dashboard" class="mt-0">
              <PregnancyDashboard
                v-if="store.currentPregnancy"
                :patient-id="patientId"
                :pregnancy-id="pregnancyId"
                :pregnancy="store.currentPregnancy"
              />
            </TabsContent>

            <!-- Visits Tab -->
            <TabsContent v-if="!isNew" value="visits" class="mt-0">
              <div class="flex flex-col gap-4">
                <div class="flex items-center justify-between">
                  <h2 class="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Prenatal Visits
                  </h2>
                  <Button size="sm" @click="goToNewVisit">
                    <Plus class="size-3.5" />
                    New Visit
                  </Button>
                </div>

                <!-- Loading visits -->
                <div v-if="store.isLoading" class="flex items-center gap-2 text-sm text-muted-foreground">
                  <LoaderCircle class="size-3.5 animate-spin" />
                  Loading visits...
                </div>

                <!-- Empty -->
                <div
                  v-else-if="store.visits.length === 0"
                  class="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-12 text-center"
                >
                  <CalendarDays class="size-10 text-muted-foreground/30" />
                  <p class="text-sm font-medium text-muted-foreground">No visits recorded</p>
                  <p class="max-w-sm text-xs text-muted-foreground/70">
                    Record the first prenatal visit for this pregnancy.
                  </p>
                  <Button size="sm" variant="outline" class="mt-2" @click="goToNewVisit">
                    <Plus class="size-3.5" />
                    Record First Visit
                  </Button>
                </div>

                <!-- Visit cards -->
                <div v-else class="flex flex-col gap-3">
                  <Card
                    v-for="v in store.visits"
                    :key="v.id"
                    class="cursor-pointer transition-colors hover:bg-muted/30"
                    @click="goToVisit(v.id)"
                  >
                    <CardHeader class="pb-2 pt-3">
                      <div class="flex items-center justify-between">
                        <CardTitle class="flex items-center gap-2 text-sm">
                          <span class="font-semibold">Visit #{{ v.visit_number }}</span>
                          <span class="text-muted-foreground">·</span>
                          <span class="text-muted-foreground">{{ formatDate(v.visit_date) }}</span>
                        </CardTitle>
                        <div class="flex items-center gap-1.5">
                          <Badge
                            v-if="v.gestational_age_weeks !== null"
                            variant="secondary"
                            class="text-xs"
                          >
                            {{ v.gestational_age_weeks }}w{{ v.gestational_age_days }}d
                          </Badge>
                          <Badge
                            v-if="v.pregnancy_progress"
                            variant="outline"
                            class="text-xs"
                            :class="
                              v.pregnancy_progress === 'normal'
                                ? 'border-green-200 bg-green-50 text-green-700'
                                : v.pregnancy_progress === 'complicated'
                                  ? 'border-red-200 bg-red-50 text-red-700'
                                  : 'border-amber-200 bg-amber-50 text-amber-700'
                            "
                          >
                            {{ v.pregnancy_progress }}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent class="pb-3">
                      <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
                        <div v-if="v.bp_systolic && v.bp_diastolic" class="flex items-center gap-1 text-muted-foreground">
                          <Activity class="size-3" />
                          BP: <strong class="text-foreground">{{ v.bp_systolic }}/{{ v.bp_diastolic }}</strong>
                        </div>
                        <div v-if="v.weight" class="flex items-center gap-1 text-muted-foreground">
                          <Weight class="size-3" />
                          Wt: <strong class="text-foreground">{{ v.weight }} kg</strong>
                        </div>
                        <div v-if="v.fetal_heart_rate" class="flex items-center gap-1 text-muted-foreground">
                          FHR: <strong class="text-foreground">{{ v.fetal_heart_rate }} bpm</strong>
                        </div>
                        <div v-if="v.fundal_height" class="flex items-center gap-1 text-muted-foreground">
                          FH: <strong class="text-foreground">{{ v.fundal_height }} cm</strong>
                        </div>
                      </div>
                      <div v-if="v.danger_signs.length > 0" class="mt-2 flex flex-wrap gap-1">
                        <Badge
                          v-for="sign in v.danger_signs"
                          :key="sign"
                          variant="destructive"
                          class="text-[10px]"
                        >
                          {{ sign.replace(/_/g, ' ') }}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>
          </div>
        </div>
      </Tabs>
    </template>
  </div>
</template>
