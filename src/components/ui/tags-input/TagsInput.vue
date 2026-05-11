<script setup lang="ts">
import type { TagsInputRootEmits, TagsInputRootProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { TagsInputRoot, useForwardPropsEmits } from "reka-ui"
import { cn } from "@/lib/utils"

const props = defineProps<TagsInputRootProps & { class?: HTMLAttributes["class"] }>()
const emits = defineEmits<TagsInputRootEmits>()

const delegatedProps = reactiveOmit(props, "class")

const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <TagsInputRoot
    v-slot="slotProps" v-bind="forwarded" :class="cn(
      'flex min-h-11 flex-wrap items-center gap-2 rounded-2xl border border-white/55 bg-white/60 px-3 py-2 text-sm shadow-[0_10px_26px_rgba(15,23,42,0.06)] backdrop-blur-md transition-[color,box-shadow,background-color,border-color] outline-none dark:border-white/10 dark:bg-slate-950/50 dark:shadow-[0_12px_28px_rgba(0,0,0,0.24)]',
      'focus-within:border-white/75 focus-within:bg-white/75 focus-within:ring-ring/40 focus-within:ring-[3px] dark:focus-within:bg-slate-950/65',
      'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
      props.class)"
  >
    <slot v-bind="slotProps" />
  </TagsInputRoot>
</template>
