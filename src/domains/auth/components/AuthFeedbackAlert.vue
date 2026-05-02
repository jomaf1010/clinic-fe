<script setup lang="ts">
import { computed } from 'vue'
import { AlertTriangle, CheckCircle2, Info, LoaderCircle } from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  variant?: 'danger' | 'success' | 'info' | 'warning' | 'loading'
}>(), {
  variant: 'info',
})

const icon = computed(() => {
  switch (props.variant) {
    case 'danger':
    case 'warning':
      return AlertTriangle
    case 'success':
      return CheckCircle2
    case 'loading':
      return LoaderCircle
    case 'info':
    default:
      return Info
  }
})
</script>

<template>
  <div class="auth-feedback-alert" :class="`auth-feedback-alert-${variant}`">
    <component
      :is="icon"
      class="mt-0.5 size-4 shrink-0"
      :class="{ 'animate-spin': variant === 'loading' }"
    />
    <div class="min-w-0 flex-1">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.auth-feedback-alert {
  display: flex;
  gap: 0.75rem;
  border-radius: 1rem;
  border: 1px solid rgb(255 255 255 / 0.46);
  padding: 0.75rem 0.85rem;
  font-size: 0.875rem;
  font-weight: 650;
  line-height: 1.45;
  box-shadow: 0 10px 24px rgb(15 23 42 / 0.06);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}

.auth-feedback-alert-info {
  background: var(--feedback-info-bg);
  color: var(--feedback-info-fg);
}

.auth-feedback-alert-success {
  background: var(--feedback-success-bg);
  color: var(--feedback-success-fg);
}

.auth-feedback-alert-warning {
  background: var(--feedback-warning-bg);
  color: var(--feedback-warning-fg);
}

.auth-feedback-alert-danger {
  background: var(--feedback-danger-bg);
  color: var(--feedback-danger-fg);
}

.auth-feedback-alert-loading {
  background: var(--feedback-loading-bg);
  color: var(--feedback-loading-fg);
}

:deep(a) {
  color: currentColor;
  font-weight: 800;
  text-decoration-line: underline;
  text-underline-offset: 4px;
}

:deep(a:hover) {
  opacity: 0.78;
}

:global(.dark) .auth-feedback-alert {
  border-color: rgb(255 255 255 / 0.1);
  box-shadow: 0 10px 24px rgb(0 0 0 / 0.22);
}

</style>
