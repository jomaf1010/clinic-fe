<script setup lang="ts">
import { useTheme } from '@/composables/useTheme'
import logoLight from '@/assets/logo.svg'
import logoDark from '@/assets/logo-dark.svg'
import { computed } from 'vue'

defineProps<{
  class?: string
}>()

const { isDark } = useTheme()
const logoSrc = computed(() => (isDark.value ? logoDark : logoLight))
</script>

<template>
  <img :src="logoSrc" alt="MediFlow" :class="$props.class" />
</template>
