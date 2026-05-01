<script setup lang="ts">
import type { TabsListProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { inject } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { TabsList } from "reka-ui"
import { cn } from "@/lib/utils"
import { TabsSizeKey } from "./tabs"

const props = defineProps<TabsListProps & { class?: HTMLAttributes["class"] }>()

const delegatedProps = reactiveOmit(props, "class")

const size = inject(TabsSizeKey, "default")

const sizeClasses: Record<string, string> = {
  sm: "h-8 p-0.5",
  default: "h-9 p-[3px]",
  lg: "h-11 p-1",
}
</script>

<template>
  <TabsList
    data-slot="tabs-list"
    v-bind="delegatedProps"
    :class="cn(
      'surface-muted text-muted-foreground inline-flex w-fit items-center justify-center rounded-lg border',
      sizeClasses[size],
      props.class,
    )"
  >
    <slot />
  </TabsList>
</template>
