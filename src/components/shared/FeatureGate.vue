<script setup lang="ts">
import { computed } from 'vue'
import { useAuthStore } from '@/domains/auth/stores/authStore'
import UpgradePrompt from './UpgradePrompt.vue'

const props = defineProps<{
  feature: string
  label?: string
}>()

const authStore = useAuthStore()
const hasAccess = computed(() => authStore.hasFeature(props.feature))
</script>

<template>
  <slot v-if="hasAccess" />
  <UpgradePrompt v-else inline :feature="label ?? feature" />
</template>
