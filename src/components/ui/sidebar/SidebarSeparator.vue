<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from "@/lib/utils"
import { Separator } from '@/components/ui/separator'

const props = defineProps<{
  class?: HTMLAttributes["class"]
}>()
</script>

<template>
  <Separator
    data-slot="sidebar-separator"
    data-sidebar="separator"
    :class="cn('mx-3 my-2 w-auto bg-white/45 group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:w-8 dark:bg-white/10', props.class)"
  >
    <slot />
  </Separator>
</template>
