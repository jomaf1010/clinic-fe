<script setup lang="ts">
/**
 * Routes encounter detail/new to the correct form view based on encounter type.
 *
 * For consultation encounters → ConsultationFormView (existing)
 * For OB types → PrenatalFormView / DeliveryFormView / PostpartumFormView
 */
import { defineAsyncComponent, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { LoaderCircle, AlertTriangle } from 'lucide-vue-next'
import { useEncounterStore } from '../stores/encounterStore'
import { useAuthStore } from '@/domains/auth/stores/authStore'
import { RouteNames } from '@/router/routeNames'
import ConsultationFormView from '@/domains/consultation/views/ConsultationFormView.vue'

const PrenatalFormView = defineAsyncComponent(() => import('@/domains/obgyn/views/PrenatalFormView.vue'))
const DeliveryFormView = defineAsyncComponent(() => import('@/domains/obgyn/views/DeliveryFormView.vue'))
const PostpartumFormView = defineAsyncComponent(() => import('@/domains/obgyn/views/PostpartumFormView.vue'))
const DentalVisitView = defineAsyncComponent(() => import('@/domains/dental/views/DentalVisitView.vue'))

const route = useRoute()
const router = useRouter()
const store = useEncounterStore()
const authStore = useAuthStore()

const isNewEncounter = route.name === RouteNames.ENCOUNTER_NEW
// For new encounters the `?type=` query param picks the form (e.g. `dental`,
// `prenatal`). If no explicit type is provided and the doctor's specialty
// maps to a dedicated encounter type (dental → dental visit), we default to
// that — a dentist shouldn't land on the general consultation form when they
// click "New encounter" from the patient page.
const KNOWN_TYPES = new Set(['consultation', 'prenatal', 'delivery', 'postpartum', 'dental'])
const SPECIALTY_DEFAULT_TYPE: Record<string, string> = {
  dental: 'dental',
}
function resolveInitialType(): string {
  const queryType = typeof route.query.type === 'string' ? route.query.type : null
  if (queryType && KNOWN_TYPES.has(queryType)) return queryType
  // `follow_up` is a *consultation_type*, not an encounter type — it should
  // still open ConsultationFormView, which reads the same query.
  if (queryType === 'follow_up' || queryType === 'default') return 'consultation'
  const specialty = authStore.user?.specialty ?? null
  if (specialty && SPECIALTY_DEFAULT_TYPE[specialty]) return SPECIALTY_DEFAULT_TYPE[specialty]
  return 'consultation'
}
const encounterType = ref<string | null>(isNewEncounter ? resolveInitialType() : null)
// Start loading immediately for existing encounters so we never flash the wrong form
const isPreloading = ref(!isNewEncounter)
const loadError = ref<string | null>(null)

async function detectType(id: string): Promise<void> {
  // Already loaded in store — skip API call
  if (store.current?.id === id) {
    encounterType.value = store.current.type
    isPreloading.value = false
    return
  }

  isPreloading.value = true
  loadError.value = null
  try {
    await store.loadEncounter(id)
    encounterType.value = store.current?.type ?? 'consultation'
  } catch {
    loadError.value = 'Failed to load encounter'
  } finally {
    isPreloading.value = false
  }
}

onMounted(() => {
  if (isNewEncounter) return
  detectType(route.params.id as string)
})

// Watch for route changes (e.g., navigating between encounters)
watch(() => route.params.id, (newId) => {
  if (!newId || route.name === RouteNames.ENCOUNTER_NEW) return
  encounterType.value = null
  detectType(newId as string)
})

function goBack() {
  router.back()
}
</script>

<template>
  <!-- Loading state -->
  <div v-if="isPreloading" class="flex h-[60vh] items-center justify-center">
    <LoaderCircle class="h-8 w-8 animate-spin text-muted-foreground" />
  </div>

  <!-- Error state -->
  <div v-else-if="loadError" class="flex h-[60vh] flex-col items-center justify-center gap-4">
    <AlertTriangle class="h-12 w-12 text-destructive" />
    <p class="text-sm text-muted-foreground">{{ loadError }}</p>
    <button class="text-sm text-primary underline" @click="goBack">Go back</button>
  </div>

  <!-- Route to correct form based on detected type -->
  <ConsultationFormView v-else-if="encounterType === 'consultation'" />
  <PrenatalFormView v-else-if="encounterType === 'prenatal'" />
  <DeliveryFormView v-else-if="encounterType === 'delivery'" />
  <PostpartumFormView v-else-if="encounterType === 'postpartum'" />
  <DentalVisitView v-else-if="encounterType === 'dental'" />

  <!-- Fallback for unknown types -->
  <ConsultationFormView v-else-if="encounterType !== null" />
</template>
