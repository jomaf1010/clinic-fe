<script setup lang="ts">
import { type Component } from 'vue'

defineProps<{
  icon: Component
  iconColor?: string
  title: string
  detail?: string
  subDetail?: string
  badgeText?: string
  badgeVariant?: 'default' | 'destructive' | 'outline' | 'secondary'
  loading?: boolean
}>()

defineEmits<{ click: [] }>()
</script>

<template>
  <button
    type="button"
    class="patient-section-widget surface-card flex items-start gap-3 rounded-2xl p-4 text-left transition-all hover:-translate-y-0.5 active:scale-[0.98]"
    @click="$emit('click')"
  >
    <!-- Icon -->
    <div class="relative shrink-0">
      <div
        class="patient-section-widget-icon flex size-10 items-center justify-center rounded-xl text-white"
        :class="iconColor ?? 'bg-gradient-to-br from-primary to-primary/80'"
      >
        <component :is="icon" class="size-6" />
      </div>
      <span
        v-if="badgeText"
        class="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full text-[10px] font-semibold shadow-sm ring-2 ring-card"
        :class="badgeVariant === 'destructive' ? 'bg-destructive text-destructive-foreground' : 'bg-muted-foreground text-white'"
      >
        {{ badgeText }}
      </span>
    </div>

    <!-- Content -->
    <div class="min-w-0 flex-1">
      <span class="text-sm font-semibold leading-tight">{{ title }}</span>

      <!-- Loading skeleton -->
      <template v-if="loading">
        <div class="mt-1.5 h-3 w-16 animate-pulse rounded bg-muted" />
      </template>
      <template v-else>
        <p v-if="detail" class="mt-0.5 line-clamp-2 text-xs leading-tight text-muted-foreground">
          {{ detail }}
        </p>
        <p v-if="subDetail" class="text-xs leading-tight text-muted-foreground">
          {{ subDetail }}
        </p>
      </template>
    </div>
  </button>
</template>

<style scoped>
.patient-section-widget {
  border: 0;
  background:
    radial-gradient(circle at 18% 0%, rgb(59 130 246 / 0.08), transparent 32%),
    radial-gradient(circle at 82% 18%, rgb(20 184 166 / 0.08), transparent 30%),
    linear-gradient(135deg, rgb(255 255 255 / 0.66), rgb(255 255 255 / 0.38) 56%, rgb(255 255 255 / 0.52)),
    var(--surface-panel-strong);
}

.patient-section-widget:hover {
  box-shadow: var(--surface-shadow-strong);
}

.patient-section-widget-icon {
  box-shadow:
    0 12px 28px rgb(15 23 42 / 0.1),
    inset 0 1px 0 rgb(255 255 255 / 0.26);
}

:global(.dark .patient-section-widget) {
  background:
    radial-gradient(circle at 86% 88%, rgb(20 184 166 / 0.1), transparent 34%),
    radial-gradient(circle at 18% 10%, rgb(59 130 246 / 0.1), transparent 30%),
    linear-gradient(135deg, rgb(15 23 42 / 0.58), rgb(15 23 42 / 0.28) 54%, rgb(15 23 42 / 0.42)),
    rgb(15 23 42 / 0.12);
  border: 1px solid rgb(255 255 255 / 0.1) !important;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.05),
    0 18px 58px -38px rgb(0 0 0 / 0.72);
}
</style>
