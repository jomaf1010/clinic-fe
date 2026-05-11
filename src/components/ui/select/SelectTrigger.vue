<script setup lang="ts">
import type { SelectTriggerProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { ChevronDownIcon } from '@radix-icons/vue'
import { SelectIcon, SelectTrigger, useForwardProps } from "reka-ui"
import { cn } from "@/lib/utils"

const props = withDefaults(
  defineProps<SelectTriggerProps & { class?: HTMLAttributes["class"], size?: "sm" | "default" }>(),
  { size: "default" },
)

const delegatedProps = reactiveOmit(props, "class", "size")
const forwardedProps = useForwardProps(delegatedProps)
</script>

<template>
  <SelectTrigger
    data-slot="select-trigger"
    :data-size="size"
    v-bind="forwardedProps"
    :class="cn(
      'data-[placeholder]:text-muted-foreground [&_svg:not([class*=\'text-\'])]:text-muted-foreground flex w-full items-center justify-between gap-2 rounded-2xl border border-white/55 bg-white/60 px-4 py-2 text-sm whitespace-nowrap shadow-[0_10px_26px_rgba(15,23,42,0.06)] backdrop-blur-md transition-[color,box-shadow,background-color,border-color,transform] outline-none hover:-translate-y-0.5 hover:bg-white/70 hover:shadow-[0_16px_34px_rgba(15,23,42,0.1)] focus-visible:border-white/75 focus-visible:bg-white/75 focus-visible:ring-ring/40 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-11 data-[size=sm]:h-9 dark:border-white/10 dark:bg-slate-950/50 dark:shadow-[0_12px_28px_rgba(0,0,0,0.24)] dark:hover:bg-slate-950/60 dark:focus-visible:bg-slate-950/65 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=\'size-\'])]:size-4',
      props.class,
    )"
  >
    <slot />
    <SelectIcon as-child>
      <ChevronDownIcon class="size-4 opacity-50" />
    </SelectIcon>
  </SelectTrigger>
</template>
