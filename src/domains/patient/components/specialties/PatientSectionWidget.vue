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
    class="flex items-start gap-3 rounded-xl border bg-card p-4 text-left transition-all hover:border-primary/20 hover:shadow-sm active:scale-[0.98]"
    @click="$emit('click')"
  >
    <!-- Icon -->
    <div class="relative shrink-0">
      <div
        class="flex size-10 items-center justify-center rounded-xl text-white shadow-sm"
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
