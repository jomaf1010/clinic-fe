<script setup lang="ts">
import DefaultEncounterTopbar from './DefaultEncounterTopbar.vue'
import type { EncounterTopbarProps } from './DefaultEncounterTopbar.vue'

defineOptions({
  inheritAttrs: false,
})

defineProps<EncounterTopbarProps>()
</script>

<template>
  <DefaultEncounterTopbar v-bind="{ ...$props, ...$attrs }" />
</template>
