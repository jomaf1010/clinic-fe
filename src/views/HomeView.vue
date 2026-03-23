<script setup lang="ts">
import { computed } from 'vue'
import { useAuthStore } from '@/domains/auth/stores/authStore'
import OwnerDashboardView from '@/domains/dashboard/views/OwnerDashboardView.vue'
import DoctorDashboardView from '@/domains/dashboard/views/DoctorDashboardView.vue'
import StaffDashboardView from '@/domains/dashboard/views/StaffDashboardView.vue'

const authStore = useAuthStore()

const role = computed(() => authStore.currentRole)
const clinicId = computed(() => authStore.currentClinic?.id)
</script>

<template>
  <DoctorDashboardView v-if="role === 'doctor'" :key="clinicId" />
  <StaffDashboardView v-else-if="role === 'secretary' || role === 'staff'" :key="clinicId" />
  <OwnerDashboardView v-else :key="clinicId" />
</template>
