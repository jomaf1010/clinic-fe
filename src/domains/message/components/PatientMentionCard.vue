<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Calendar, ExternalLink, MapPin, Phone, AlertTriangle, Activity, User } from 'lucide-vue-next'
import { Badge } from '@/components/ui/badge'
import { RouteNames } from '@/router/routeNames'
import { patientApi } from '@/domains/patient/api/patientApi'
import type { PatientResponse } from '@/domains/patient/types/patient.types'

const props = defineProps<{
  patientId: string
  patientName: string
}>()

const router = useRouter()
const patient = ref<PatientResponse | null>(null)
const isLoading = ref(true)
const failed = ref(false)

function getInitials(name: string): string {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

function formatAge(dob: string): string {
  const birth = new Date(dob)
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const m = now.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--
  return `${age}y`
}

function goToPatient() {
  router.push({ name: RouteNames.PATIENT_DETAIL, params: { id: props.patientId } })
}

onMounted(async () => {
  try {
    const response = await patientApi.get(props.patientId)
    patient.value = response.data
  } catch {
    failed.value = true
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <div
    class="mt-1.5 cursor-pointer overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm transition-colors hover:bg-accent/50"
    @click="goToPatient"
  >
    <!-- Loading skeleton -->
    <div v-if="isLoading" class="flex items-center gap-3 p-3">
      <div class="size-9 animate-pulse rounded-full bg-muted" />
      <div class="flex-1 space-y-1.5">
        <div class="h-3 w-24 animate-pulse rounded bg-muted" />
        <div class="h-2.5 w-32 animate-pulse rounded bg-muted" />
      </div>
    </div>

    <!-- Failed state -->
    <div v-else-if="failed" class="flex items-center gap-2 p-3 text-muted-foreground">
      <User class="size-4" />
      <span class="text-xs">{{ patientName }}</span>
    </div>

    <!-- Patient card -->
    <div v-else-if="patient" class="p-3">
      <div class="flex items-start gap-3">
        <!-- Avatar -->
        <div class="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
          {{ getInitials(patient.full_name) }}
        </div>

        <!-- Info -->
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span class="truncate text-sm font-semibold text-foreground">{{ patient.full_name }}</span>
            <Badge variant="outline" class="shrink-0 px-1.5 py-0 text-[10px] capitalize">
              {{ patient.status }}
            </Badge>
          </div>

          <div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
            <span class="flex items-center gap-1">
              <Calendar class="size-3" />
              {{ formatAge(patient.date_of_birth) }} · {{ patient.sex }}
            </span>
            <span v-if="patient.contact_number" class="flex items-center gap-1">
              <Phone class="size-3" />
              {{ patient.contact_number }}
            </span>
            <span v-if="patient.formatted_address" class="flex items-center gap-1">
              <MapPin class="size-3" />
              {{ patient.formatted_address }}
            </span>
          </div>

          <!-- Conditions & Allergies -->
          <div v-if="patient.allergies.length > 0 || patient.chronic_conditions.length > 0" class="mt-1.5 flex flex-wrap gap-1">
            <Badge
              v-for="allergy in patient.allergies.slice(0, 3)"
              :key="'a-' + allergy"
              variant="outline"
              class="border-red-200 px-1.5 py-0 text-[10px] text-red-600 dark:border-red-800 dark:text-red-400"
            >
              <AlertTriangle class="mr-0.5 size-2.5" />
              {{ allergy }}
            </Badge>
            <Badge
              v-for="condition in patient.chronic_conditions.slice(0, 3)"
              :key="'c-' + condition"
              variant="outline"
              class="px-1.5 py-0 text-[10px]"
            >
              <Activity class="mr-0.5 size-2.5" />
              {{ condition }}
            </Badge>
          </div>
        </div>

        <!-- Open link icon -->
        <ExternalLink class="size-3.5 shrink-0 text-muted-foreground/50" />
      </div>
    </div>
  </div>
</template>
