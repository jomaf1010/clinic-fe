<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  completeness: number
  contentClass?: string
}>(), {
  contentClass: 'relative p-[5px]',
})

const ringStyle = computed(() => {
  const bounded = Math.min(Math.max(props.completeness, 0), 1)
  return `--completeness-deg: ${Math.round(bounded * 360)}deg`
})
</script>

<template>
  <div class="relative shrink-0">
    <div class="absolute inset-0 rounded-full p-[3px]">
      <div class="size-full rounded-full bg-muted/60" />
    </div>
    <div
      class="absolute inset-0 rounded-full rainbow-ring-fill"
      :style="ringStyle"
    />
    <div :class="contentClass">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.rainbow-ring-fill {
  background: conic-gradient(
    #f87171 0deg,
    #fb923c 60deg,
    #facc15 120deg,
    #4ade80 180deg,
    #38bdf8 240deg,
    #818cf8 300deg,
    #f472b6 var(--completeness-deg),
    transparent var(--completeness-deg)
  );
  -webkit-mask:
    radial-gradient(farthest-side, transparent calc(100% - 4px), black calc(100% - 4px));
  mask:
    radial-gradient(farthest-side, transparent calc(100% - 4px), black calc(100% - 4px));
}
</style>
