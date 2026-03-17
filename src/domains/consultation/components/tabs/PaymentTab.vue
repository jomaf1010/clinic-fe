<script setup lang="ts">
import { DollarSign } from 'lucide-vue-next'

defineProps<{
  disabled: boolean
}>()
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-4 py-16 text-center">
    <div class="flex size-12 items-center justify-center rounded-full bg-muted">
      <DollarSign class="size-6 text-muted-foreground" />
    </div>
    <div>
      <p class="font-medium text-muted-foreground">Payment functionality coming soon.</p>
      <p class="mt-1 text-sm text-muted-foreground">Payment processing will be available in a future update.</p>
    </div>
  </div>
</template>
