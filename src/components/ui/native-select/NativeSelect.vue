<script setup lang="ts">
import type { AcceptableValue } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { reactiveOmit, useVModel } from "@vueuse/core"
import { ChevronDownIcon } from "lucide-vue-next"
import { cn } from "@/lib/utils"

defineOptions({
  inheritAttrs: false,
})

const props = defineProps<{
  modelValue?: AcceptableValue | AcceptableValue[]
  class?: HTMLAttributes["class"]
  wrapperClass?: HTMLAttributes["class"]
}>()

const emit = defineEmits<{
  "update:modelValue": [value: AcceptableValue | AcceptableValue[]]
}>()

const modelValue = useVModel(props, "modelValue", emit, {
  passive: true,
  defaultValue: "",
})

const delegatedProps = reactiveOmit(props, "class", "wrapperClass")
</script>

<template>
  <div
    :class="cn(
      'group/native-select relative w-full has-[select:disabled]:opacity-50',
      props.wrapperClass,
    )"
    data-slot="native-select-wrapper"
  >
    <select
      v-bind="{ ...$attrs, ...delegatedProps }"
      v-model="modelValue"
      data-slot="native-select"
      :class="cn(
        'selection:bg-primary selection:text-primary-foreground h-11 w-full min-w-0 appearance-none rounded-2xl border border-white/55 bg-white/60 px-4 py-2 pr-10 text-sm shadow-[0_10px_26px_rgba(15,23,42,0.06)] backdrop-blur-md transition-[color,box-shadow,background-color,border-color] outline-none disabled:pointer-events-none disabled:cursor-not-allowed dark:border-white/10 dark:bg-slate-950/50 dark:shadow-[0_12px_28px_rgba(0,0,0,0.24)]',
        'focus-visible:border-white/75 focus-visible:bg-white/75 focus-visible:ring-ring/40 focus-visible:ring-[3px] dark:focus-visible:bg-slate-950/65',
        'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
        props.class,
      )"
    >
      <slot />
    </select>
    <ChevronDownIcon
      class="text-muted-foreground pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 opacity-50 select-none"
      aria-hidden="true"
      data-slot="native-select-icon"
    />
  </div>
</template>
