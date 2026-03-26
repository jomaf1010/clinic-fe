<script setup lang="ts">
import { computed } from 'vue'
import { usePasswordStrength } from '@/composables/usePasswordStrength'

const props = defineProps<{
  password: string
}>()

const passwordRef = computed(() => props.password)
const { strength } = usePasswordStrength(passwordRef)

const barClass = computed(() => {
  switch (strength.value.level) {
    case 'strong': return 'bg-green-500'
    case 'fair':   return 'bg-amber-500'
    default:       return 'bg-destructive'
  }
})

const labelClass = computed(() => {
  switch (strength.value.level) {
    case 'strong': return 'text-green-600 dark:text-green-400'
    case 'fair':   return 'text-amber-600 dark:text-amber-400'
    default:       return 'text-destructive'
  }
})

const barWidth = computed(() => {
  switch (strength.value.level) {
    case 'strong': return 'w-full'
    case 'fair':   return 'w-2/3'
    default:       return 'w-1/3'
  }
})
</script>

<template>
  <div v-if="password" class="flex flex-col gap-1.5">
    <div class="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        class="h-full rounded-full transition-all duration-300 ease-out"
        :class="[barClass, barWidth]"
      />
    </div>
    <div class="flex items-center justify-between gap-2">
      <p class="text-xs" :class="labelClass">{{ strength.label }}</p>
      <p v-if="strength.feedback" class="text-xs text-muted-foreground">
        {{ strength.feedback }}
      </p>
    </div>
  </div>
</template>
