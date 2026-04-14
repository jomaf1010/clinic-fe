<script setup lang="ts">
import { type Component } from 'vue'
import { Badge } from '@/components/ui/badge'

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
    class="flex items-start gap-3 rounded-xl border bg-card p-4 text-left transition-all hover:border-primary/20 hover:shadow-sm active:scale-[0.98]"
    @click="$emit('click')"
  >
    <!-- Icon -->
    <div
      class="flex size-10 shrink-0 items-center justify-center rounded-lg"
      :class="iconColor ?? 'bg-primary/10 text-primary'"
    >
      <component :is="icon" class="size-5" />
    </div>

    <!-- Content -->
    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-2">
        <span class="text-sm font-semibold leading-tight">{{ title }}</span>
        <Badge v-if="badgeText" :variant="badgeVariant ?? 'secondary'" class="text-[10px] px-1.5 py-0">
          {{ badgeText }}
        </Badge>
      </div>

      <!-- Loading skeleton -->
      <template v-if="loading">
        <div class="mt-1.5 h-3 w-16 animate-pulse rounded bg-muted" />
      </template>
      <template v-else>
        <p v-if="detail" class="mt-0.5 text-xs leading-tight text-muted-foreground">
          {{ detail }}
        </p>
        <p v-if="subDetail" class="text-xs leading-tight text-muted-foreground">
          {{ subDetail }}
        </p>
      </template>
    </div>
  </button>
</template>
