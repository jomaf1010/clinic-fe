<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { useVModel } from "@vueuse/core"
import { cn } from "@/lib/utils"

const props = defineProps<{
  defaultValue?: string | number
  modelValue?: string | number
  class?: HTMLAttributes["class"]
}>()

const emits = defineEmits<{
  (e: "update:modelValue", payload: string | number): void
}>()

const modelValue = useVModel(props, "modelValue", emits, {
  passive: true,
  defaultValue: props.defaultValue,
})
</script>

<template>
  <input
    v-model="modelValue"
    data-slot="input"
    :class="cn(
      'file:text-foreground selection:bg-primary selection:text-primary-foreground h-11 w-full min-w-0 rounded-2xl border border-white/55 bg-white/60 px-4 py-2 text-base shadow-[0_10px_26px_rgba(15,23,42,0.06)] backdrop-blur-md transition-[color,box-shadow,background-color,border-color] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:border-white/10 dark:bg-slate-950/50 dark:shadow-[0_12px_28px_rgba(0,0,0,0.24)]',
      'focus-visible:border-white/75 focus-visible:bg-white/75 focus-visible:ring-ring/40 focus-visible:ring-[3px] dark:focus-visible:bg-slate-950/65',
      'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
      props.class,
    )"
  >
</template>
