<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, LoaderCircle } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { RouteNames } from '@/router/routeNames'
import { usePregnancyStore } from '../stores/pregnancyStore'
import PrenatalVisitForm from '../components/PrenatalVisitForm.vue'
import type { PrenatalVisit } from '../types/obgyn.types'

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

const visitId = computed(() => {
  const id = route.params.visitId
  return typeof id === 'string' ? id : (Array.isArray(id) ? id[0] : null) ?? null
})

const isNew = computed(() => route.name === RouteNames.PRENATAL_VISIT_CREATE)
const loadError = ref<string | null>(null)

onMounted(async () => {
  loadError.value = null
  try {
    const tasks: Promise<void>[] = [
      store.loadPregnancy(patientId.value, pregnancyId.value),
      store.loadVisits(patientId.value, pregnancyId.value),
    ]
    await Promise.all(tasks)

    if (!isNew.value && visitId.value) {
      const found = store.visits.find((v) => v.uuid === visitId.value)
      if (found) {
        store.currentVisit = found
      }
    }
  } catch {
    loadError.value = 'Failed to load visit data.'
  }
})

onUnmounted(() => {
  store.currentVisit = null
})

function handleSaved(_visit: PrenatalVisit): void {
  router.push({
    name: RouteNames.PREGNANCY_DETAIL,
    params: { patientId: patientId.value, pregnancyId: pregnancyId.value },
    query: { tab: 'visits' },
  })
}

function handleCancel(): void {
  router.push({
    name: RouteNames.PREGNANCY_DETAIL,
    params: { patientId: patientId.value, pregnancyId: pregnancyId.value },
    query: { tab: 'visits' },
  })
}
</script>

<template>
  <div class="flex flex-1 flex-col">
    <!-- Loading -->
    <div
      v-if="store.isLoading && !store.currentPregnancy"
      class="flex flex-1 items-center justify-center py-16"
    >
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

    <template v-else-if="store.currentPregnancy">
      <!-- Sticky Header -->
      <div class="sticky top-0 z-10 border-b bg-background">
        <div class="flex items-center gap-2 px-4 pb-2 pt-3">
          <Button variant="ghost" size="sm" class="gap-1.5" @click="handleCancel">
            <ArrowLeft class="size-3.5" />
            Back to Pregnancy
          </Button>
          <Separator orientation="vertical" class="h-4" />
          <span class="text-sm font-semibold">
            {{ isNew ? 'New Prenatal Visit' : 'Edit Prenatal Visit' }}
          </span>
        </div>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto px-4 pb-8 pt-4 md:px-8">
        <div class="mx-auto max-w-3xl">
          <PrenatalVisitForm
            :patient-id="patientId"
            :pregnancy-id="pregnancyId"
            :pregnancy="store.currentPregnancy"
            :visit="store.currentVisit ?? undefined"
            @saved="handleSaved"
            @cancel="handleCancel"
          />
        </div>
      </div>
    </template>
  </div>
</template>
