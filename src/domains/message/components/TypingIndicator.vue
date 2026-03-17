<script setup lang="ts">
defineProps<{
  userName: string
}>()
</script>

<template>
  <div class="flex items-center gap-1.5 px-4 py-1.5 text-xs text-muted-foreground">
    <span>{{ userName }} is typing</span>
    <span class="flex gap-0.5">
      <span class="size-1 animate-bounce rounded-full bg-muted-foreground/60" style="animation-delay: 0ms" />
      <span class="size-1 animate-bounce rounded-full bg-muted-foreground/60" style="animation-delay: 150ms" />
      <span class="size-1 animate-bounce rounded-full bg-muted-foreground/60" style="animation-delay: 300ms" />
    </span>
  </div>
</template>
