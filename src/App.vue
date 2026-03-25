<script setup lang="ts">
import { RouterView } from 'vue-router'
import { Toaster } from 'vue-sonner'
import MaintenancePage from '@/components/MaintenancePage.vue'
import { isMaintenanceMode } from '@/lib/http'
import 'vue-sonner/style.css'
</script>

<template>
  <MaintenancePage v-if="isMaintenanceMode" />
  <template v-else>
    <RouterView />
    <Toaster position="bottom-right" :duration="4000" rich-colors />
  </template>
</template>
