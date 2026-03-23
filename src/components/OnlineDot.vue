<script setup lang="ts">
import { computed } from 'vue'
import { useOnlineStatus } from '@/composables/useOnlineStatus'

const props = defineProps<{
  userId: string | null
}>()

const { isOnline } = useOnlineStatus()

const online = computed(() => props.userId ? isOnline(props.userId) : false)
</script>

<template>
  <span
    class="absolute bottom-0 right-0 block size-2.5 rounded-full ring-2 ring-background transition-colors"
    :class="online ? 'bg-green-500' : 'bg-muted-foreground/30'"
  />
</template>
