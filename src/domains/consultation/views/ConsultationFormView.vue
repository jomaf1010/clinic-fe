<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  Stethoscope,
  Activity,
  ClipboardList,
  ClipboardPlus,
  DollarSign,
  Lock,
  LoaderCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  WifiOff,
  Eye,
  ArrowLeft,
} from 'lucide-vue-next'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useOfflineSync } from '@/composables/useOfflineSync'
import { RouteNames } from '@/router/routeNames'
import { useAuthStore } from '@/domains/auth/stores/authStore'
import { useConsultationStore } from '../stores/consultationStore'
import TriageTab from '../components/tabs/TriageTab.vue'
import AssessmentTab from '../components/tabs/AssessmentTab.vue'
import TreatmentPlanTab from '../components/tabs/TreatmentPlanTab.vue'
import PaymentTab from '../components/tabs/PaymentTab.vue'
import VitalsSummary from '../components/VitalsSummary.vue'
import FinalizeModal from '../components/FinalizeModal.vue'
import type { UpdateConsultationPayload } from '../types/consultation.types'
import { useConsultationSync } from '../composables/useConsultationSync'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const store = useConsultationStore()
const { isOnline, pendingCount } = useOfflineSync()

const consultationId = computed(() => store.current?.id)
const clinicId = computed(() => store.current?.clinic_id)
const { prescriptionUpdate, labOrderUpdate } = useConsultationSync(consultationId, clinicId)

const canEditTriage = computed(() => authStore.hasPermission('consultations.edit-triage'))
const canEditAssessment = computed(() => authStore.hasPermission('consultations.edit-assessment'))
const canEditTreatmentPlan = computed(() => authStore.hasPermission('consultations.edit-treatment-plan'))
const canFinalize = computed(() => authStore.hasPermission('consultations.finalize'))

const activeTab = ref('triage')
const showPreviewModal = ref(false)
const showFinalizeModal = ref(false)
const loadError = ref<string | null>(null)

onMounted(async () => {
  loadError.value = null
  try {
    if (route.name === RouteNames.CONSULTATION_NEW) {
      const patientId = route.params.patientId as string
      const consultation = await store.createForPatient(patientId)

      await router.replace({
        name: RouteNames.CONSULTATION_DETAIL,
        params: { patientId, id: consultation.id },
      })
    } else {
      const id = route.params.id as string
      await store.loadConsultation(id)

    }
  } catch {
    loadError.value = 'Failed to load consultation. Please try again.'
  }
})

onUnmounted(() => {
  store.clearCurrent()
})

async function handleSave(payload: UpdateConsultationPayload): Promise<void> {
  await store.saveSection(payload)
}

const allTabs = ['triage', 'assessment', 'treatment-plan', 'payment'] as const
const tabLabels: Record<string, string> = {
  'triage': 'Triage',
  'assessment': 'Assessment',
  'treatment-plan': 'Treatment Plan',
  'payment': 'Payment',
}
const visibleTabs = computed(() =>
  allTabs.filter((tab) => {
    if (tab === 'assessment') return canEditAssessment.value
    return true
  }),
)
const currentTabIndex = computed(() => visibleTabs.value.indexOf(activeTab.value as (typeof allTabs)[number]))
const prevTabLabel = computed(() => currentTabIndex.value > 0 ? tabLabels[visibleTabs.value[currentTabIndex.value - 1]] : null)
const nextTabLabel = computed(() => currentTabIndex.value < visibleTabs.value.length - 1 ? tabLabels[visibleTabs.value[currentTabIndex.value + 1]] : null)
function goToTab(direction: 'prev' | 'next') {
  const idx = currentTabIndex.value + (direction === 'next' ? 1 : -1)
  if (idx >= 0 && idx < visibleTabs.value.length) activeTab.value = visibleTabs.value[idx]
}

async function handleFinalizeConfirm(): Promise<void> {
  await store.finalize()
  if (!store.saveError) {
    showFinalizeModal.value = false
  }
}
</script>

<template>
  <div v-if="store.isLoading && !store.current" class="flex flex-1 items-center justify-center py-12">
    <LoaderCircle class="size-6 animate-spin text-muted-foreground" />
  </div>

  <div
    v-else-if="loadError"
    role="alert"
    class="mx-auto max-w-md rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
  >
    {{ loadError }}
  </div>

  <Tabs
    v-else-if="store.current"
    v-model="activeTab"
    class="-mx-4 flex flex-1 flex-col"
  >
    <!-- Patient name + actions (sticky) -->
    <div class="sticky top-0 z-10 border-b bg-background">
      <div class="flex flex-col gap-2 px-4 pb-1 pt-2 sm:flex-row sm:items-center sm:justify-between">
        <!-- Left: back + patient name + status badge -->
        <div class="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            class="gap-1.5"
            @click="router.back()"
          >
            <ArrowLeft class="size-3.5" />
            {{ store.current.patient_name }}
          </Button>
          <Badge
            v-if="store.isDraft"
            class="border-amber-300 bg-amber-100 text-amber-700 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-400"
            variant="outline"
          >
            Draft
          </Badge>
          <Badge
            v-else-if="store.isFinalized"
            class="border-green-300 bg-green-100 text-green-700 dark:border-green-700 dark:bg-green-950 dark:text-green-400"
            variant="outline"
          >
            <CheckCircle2 class="size-3" />
            Finalized
          </Badge>
        </div>

        <!-- Right: actions (drafts only) -->
        <div v-if="store.isDraft" class="flex items-center gap-2">
          <p v-if="store.isSaving" class="text-xs text-muted-foreground">
            Saving...
          </p>
          <p v-if="store.saveError" class="text-xs text-destructive">
            {{ store.saveError }}
          </p>
          <Button
            variant="outline"
            size="sm"
            @click="showPreviewModal = true"
          >
            <Eye class="size-3.5" />
            Preview
          </Button>
          <Button
            variant="outline"
            size="sm"
            :disabled="store.isSaving"
            @click="store.saveSection({})"
          >
            <LoaderCircle v-if="store.isSaving" class="size-3.5 animate-spin" />
            <ClipboardList v-else class="size-3.5" />
            Save
          </Button>
          <Button
            v-if="canFinalize"
            size="sm"
            @click="showFinalizeModal = true"
          >
            <CheckCircle2 class="size-3.5" />
            Finalize
          </Button>
        </div>
      </div>
    </div>

    <!-- Tabs row -->
    <TabsList class="h-auto w-full rounded-none border-b bg-transparent p-0">
      <TabsTrigger
        value="triage"
        class="h-auto gap-2 rounded-none border-0 border-b-[3px] border-transparent bg-transparent py-2 text-muted-foreground shadow-none hover:text-foreground focus-visible:ring-0 focus-visible:outline-none data-[state=active]:border-b-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none dark:data-[state=active]:border-b-primary dark:data-[state=active]:bg-transparent"
      >
        <Activity class="size-4" />
        Triage
      </TabsTrigger>
      <TabsTrigger
        v-if="canEditAssessment"
        value="assessment"
        class="h-auto gap-2 rounded-none border-0 border-b-[3px] border-transparent bg-transparent py-2 text-muted-foreground shadow-none hover:text-foreground focus-visible:ring-0 focus-visible:outline-none data-[state=active]:border-b-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none dark:data-[state=active]:border-b-primary dark:data-[state=active]:bg-transparent"
      >
        <Stethoscope class="size-4" />
        Assessment
      </TabsTrigger>
      <TabsTrigger
        value="treatment-plan"
        class="h-auto gap-2 rounded-none border-0 border-b-[3px] border-transparent bg-transparent py-2 text-muted-foreground shadow-none hover:text-foreground focus-visible:ring-0 focus-visible:outline-none data-[state=active]:border-b-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none dark:data-[state=active]:border-b-primary dark:data-[state=active]:bg-transparent"
      >
        <ClipboardPlus class="size-4" />
        Treatment Plan
      </TabsTrigger>
      <TabsTrigger
        value="payment"
        class="h-auto gap-2 rounded-none border-0 border-b-[3px] border-transparent bg-transparent py-2 text-muted-foreground shadow-none hover:text-foreground focus-visible:ring-0 focus-visible:outline-none data-[state=active]:border-b-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none dark:data-[state=active]:border-b-primary dark:data-[state=active]:bg-transparent"
      >
        <DollarSign class="size-4" />
        Payment
      </TabsTrigger>
    </TabsList>

    <!-- Offline banner -->
    <div
      v-if="!isOnline"
      class="flex items-center gap-2 border-b bg-amber-50 px-4 py-2.5 text-sm text-amber-700 dark:bg-amber-950 dark:text-amber-400"
    >
      <WifiOff class="size-3.5 shrink-0" />
      You are offline. Changes will be saved locally and synced when you reconnect.
      <span v-if="pendingCount" class="ml-auto text-xs font-medium">
        {{ pendingCount }} pending
      </span>
    </div>

    <!-- Read-only banner -->
    <div
      v-if="store.isFinalized"
      class="flex items-center gap-2 border-b bg-muted/50 px-4 py-2.5 text-sm text-muted-foreground"
    >
      <Lock class="size-3.5 shrink-0" />
      This consultation has been finalized and is read-only.
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto px-4 pb-4 pt-4 md:px-8 md:pb-8">
      <div class="mx-auto max-w-4xl">
        <TabsContent value="triage" class="mt-0">
          <TriageTab
            :triage="store.current.triage"
            :patient-id="store.current.patient_id"
            :patient-allergies="store.current.patient_allergies ?? []"
            :patient-conditions="store.current.patient_conditions ?? []"
            :consultation-id="store.current.id"
            :disabled="store.isFinalized || !canEditTriage"
            @save="handleSave"
            @patient-updated="store.loadConsultation(store.current!.id)"
          />
          <div class="mt-8 flex justify-end border-t pt-4">
            <Button variant="outline" @click="goToTab('next')">
              {{ nextTabLabel }}
              <ChevronRight class="ml-1 size-4" />
            </Button>
          </div>
        </TabsContent>

        <TabsContent v-if="canEditAssessment" value="assessment" class="mt-0 flex flex-col gap-6">
          <VitalsSummary :triage="store.current.triage" />
          <AssessmentTab
            :assessment="store.current.assessment"
            :disabled="store.isFinalized"
            @save="handleSave"
          />
          <div class="mt-8 flex justify-between border-t pt-4">
            <Button variant="outline" @click="goToTab('prev')">
              <ChevronLeft class="mr-1 size-4" />
              {{ prevTabLabel }}
            </Button>
            <Button variant="outline" @click="goToTab('next')">
              {{ nextTabLabel }}
              <ChevronRight class="ml-1 size-4" />
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="treatment-plan" class="mt-0 flex flex-col gap-6">
          <VitalsSummary :triage="store.current.triage" />
          <TreatmentPlanTab
            :treatment-plan="store.current.treatment_plan ?? { advice: null, follow_up: null }"
            :consultation-id="store.current.id"
            :patient-id="store.current.patient_id"
            :doctor-id="store.current.created_by"
            :disabled="store.isFinalized || !canEditTreatmentPlan"
            :lab-order-disabled="store.isFinalized || !authStore.hasPermission('lab-orders.create')"
            :prescription-update="prescriptionUpdate"
            :lab-order-update="labOrderUpdate"
            @save="handleSave"
          />
          <div class="mt-8 flex justify-between border-t pt-4">
            <Button variant="outline" @click="goToTab('prev')">
              <ChevronLeft class="mr-1 size-4" />
              {{ prevTabLabel }}
            </Button>
            <Button variant="outline" @click="goToTab('next')">
              {{ nextTabLabel }}
              <ChevronRight class="ml-1 size-4" />
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="payment" class="mt-0">
          <PaymentTab :disabled="store.isFinalized" />
          <div class="mt-8 flex justify-start border-t pt-4">
            <Button variant="outline" @click="goToTab('prev')">
              <ChevronLeft class="mr-1 size-4" />
              {{ prevTabLabel }}
            </Button>
          </div>
        </TabsContent>
      </div>
    </div>

    <!-- Preview Modal -->
    <FinalizeModal
      v-if="store.current"
      :open="showPreviewModal"
      :consultation="store.current"
      :is-saving="false"
      preview-only
      @update:open="showPreviewModal = $event"
    />

    <!-- Finalize Modal -->
    <FinalizeModal
      v-if="store.current"
      :open="showFinalizeModal"
      :consultation="store.current"
      :is-saving="store.isSaving"
      @update:open="showFinalizeModal = $event"
      @confirm="handleFinalizeConfirm"
    />
  </Tabs>
</template>
