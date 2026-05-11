<script setup lang="ts">
import { ref } from 'vue'
import { ShieldAlert, ShieldCheck, ChevronDown } from 'lucide-vue-next'
import { Badge } from '@/components/ui/badge'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

const props = defineProps<{
  level: 'low' | 'high'
  factors?: string[]
}>()

const open = ref(false)
</script>

<template>
  <div class="inline-flex items-center">
    <template v-if="props.factors && props.factors.length > 0">
      <Popover v-model:open="open">
        <PopoverTrigger as-child>
          <button
            type="button"
            class="inline-flex cursor-pointer items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none"
            :class="
              props.level === 'high'
                ? 'border-red-200 bg-red-100 text-red-700 hover:bg-red-200 dark:border-red-800 dark:bg-red-950 dark:text-red-400'
                : 'border-green-200 bg-green-100 text-green-700 hover:bg-green-200 dark:border-green-800 dark:bg-green-950 dark:text-green-400'
            "
          >
            <ShieldAlert v-if="props.level === 'high'" class="size-3" />
            <ShieldCheck v-else class="size-3" />
            {{ props.level === 'high' ? 'High Risk' : 'Low Risk' }}
            <ChevronDown class="size-3" />
          </button>
        </PopoverTrigger>
        <PopoverContent class="w-64 p-3" align="start">
          <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Risk Factors
          </p>
          <ul class="flex flex-col gap-1">
            <li
              v-for="factor in props.factors"
              :key="factor"
              class="flex items-start gap-1.5 text-sm"
            >
              <span class="mt-1.5 size-1.5 shrink-0 rounded-full bg-current" />
              {{ factor }}
            </li>
          </ul>
        </PopoverContent>
      </Popover>
    </template>

    <template v-else>
      <Badge
        variant="outline"
        class="gap-1"
        :class="
          props.level === 'high'
            ? 'border-red-200 bg-red-100 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400'
            : 'border-green-200 bg-green-100 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400'
        "
      >
        <ShieldAlert v-if="props.level === 'high'" class="size-3" />
        <ShieldCheck v-else class="size-3" />
        {{ props.level === 'high' ? 'High Risk' : 'Low Risk' }}
      </Badge>
    </template>
  </div>
</template>
