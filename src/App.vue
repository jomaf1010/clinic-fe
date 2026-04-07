<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import { Toaster } from 'vue-sonner'
import MaintenancePage from '@/components/MaintenancePage.vue'
import { isMaintenanceMode } from '@/lib/http'
import { useVitalsConfigStore } from '@/stores/vitalsConfigStore'
import { useSecurityConfigStore } from '@/stores/securityConfigStore'
import 'vue-sonner/style.css'

const vitalsConfigStore = useVitalsConfigStore()
const securityConfigStore = useSecurityConfigStore()
onMounted(() => {
  vitalsConfigStore.fetchConfig()
  securityConfigStore.fetchConfig()
})
</script>

<template>
  <MaintenancePage v-if="isMaintenanceMode" />
  <template v-else>
    <RouterView />
    <Toaster position="bottom-right" :duration="4000" rich-colors />
  </template>
</template>
