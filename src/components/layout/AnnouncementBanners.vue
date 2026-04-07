<script setup lang="ts">
import { X, Info, AlertTriangle, Wrench, Sparkles } from 'lucide-vue-next'
import { useAnnouncementStore } from '@/stores/announcementStore'

const store = useAnnouncementStore()

const config = {
  info:        { icon: Info,          bg: 'bg-blue-50 dark:bg-blue-950/30',   text: 'text-blue-800 dark:text-blue-200',   iconColor: 'text-blue-600 dark:text-blue-400',   dismiss: 'text-blue-600 hover:bg-blue-100 dark:text-blue-400 dark:hover:bg-blue-900/50' },
  warning:     { icon: AlertTriangle, bg: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-800 dark:text-amber-200', iconColor: 'text-amber-600 dark:text-amber-400', dismiss: 'text-amber-600 hover:bg-amber-100 dark:text-amber-400 dark:hover:bg-amber-900/50' },
  maintenance: { icon: Wrench,        bg: 'bg-red-50 dark:bg-red-950/30',     text: 'text-red-800 dark:text-red-200',     iconColor: 'text-red-600 dark:text-red-400',     dismiss: 'text-red-600 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-900/50' },
  update:      { icon: Sparkles,      bg: 'bg-green-50 dark:bg-green-950/30', text: 'text-green-800 dark:text-green-200', iconColor: 'text-green-600 dark:text-green-400', dismiss: 'text-green-600 hover:bg-green-100 dark:text-green-400 dark:hover:bg-green-900/50' },
} as const
</script>

<template>
  <div
    v-for="a in store.visible"
    :key="a.uuid"
    :class="['flex items-center justify-between gap-3 border-b px-4 py-2', config[a.type].bg]"
  >
    <div class="flex items-center gap-2 text-sm">
      <component :is="config[a.type].icon" :class="['size-4 shrink-0', config[a.type].iconColor]" />
      <span :class="config[a.type].text">
        <span class="font-medium">{{ a.title }}</span>
        <span v-if="a.message"> — {{ a.message }}</span>
      </span>
    </div>
    <button
      type="button"
      :class="['rounded p-0.5', config[a.type].dismiss]"
      @click="store.dismiss(a.uuid)"
    >
      <X class="size-3.5" />
    </button>
  </div>
</template>
