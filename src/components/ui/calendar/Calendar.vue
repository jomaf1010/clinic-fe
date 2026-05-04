<script lang="ts" setup>
import type { CalendarRootEmits, CalendarRootProps, DateValue } from "reka-ui"
import type { HTMLAttributes, Ref } from "vue"
import { getLocalTimeZone, today } from "@internationalized/date"
import { createReusableTemplate, reactiveOmit, useVModel } from "@vueuse/core"
import { CalendarRoot, useDateFormatter, useForwardPropsEmits } from "reka-ui"
import { createYear, createYearRange, toDate } from "reka-ui/date"
import { computed, toRaw } from "vue"
import { cn } from "@/lib/utils"
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import CalendarCell from "./CalendarCell.vue"
import CalendarCellTrigger from "./CalendarCellTrigger.vue"
import CalendarGrid from "./CalendarGrid.vue"
import CalendarGridBody from "./CalendarGridBody.vue"
import CalendarGridHead from "./CalendarGridHead.vue"
import CalendarGridRow from "./CalendarGridRow.vue"
import CalendarHeadCell from "./CalendarHeadCell.vue"
import CalendarHeader from "./CalendarHeader.vue"
import CalendarHeading from "./CalendarHeading.vue"
import CalendarNextButton from "./CalendarNextButton.vue"
import CalendarPrevButton from "./CalendarPrevButton.vue"

type LayoutTypes = "month-and-year" | "month-only" | "year-only" | undefined

const props = withDefaults(defineProps<CalendarRootProps & { class?: HTMLAttributes["class"], layout?: LayoutTypes, yearRange?: DateValue[] }>(), {
  modelValue: undefined,
  layout: undefined,
})
const emits = defineEmits<CalendarRootEmits>()

const delegatedProps = reactiveOmit(props, "class", "layout", "placeholder")

const placeholder = useVModel(props, "placeholder", emits, {
  passive: true,
  defaultValue: props.defaultPlaceholder ?? today(getLocalTimeZone()),
}) as Ref<DateValue>

const formatter = useDateFormatter(props.locale ?? "en")

const yearRange = computed(() => {
  return props.yearRange ?? createYearRange({
    start: props?.minValue ?? (toRaw(props.placeholder) ?? props.defaultPlaceholder ?? today(getLocalTimeZone()))
      .cycle("year", -100),

    end: props?.maxValue ?? (toRaw(props.placeholder) ?? props.defaultPlaceholder ?? today(getLocalTimeZone()))
      .cycle("year", 10),
  })
})

const [DefineMonthTemplate, ReuseMonthTemplate] = createReusableTemplate<{ date: DateValue }>()
const [DefineYearTemplate, ReuseYearTemplate] = createReusableTemplate<{ date: DateValue }>()

const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <DefineMonthTemplate v-slot="{ date }">
    <div class="calendar-heading-select **:data-[slot=native-select-icon]:right-2 **:data-[slot=native-select-icon]:text-foreground **:data-[slot=native-select-icon]:opacity-70">
      <div class="calendar-heading-control relative rounded-xl border border-white/65 bg-white/72 shadow-[0_10px_24px_rgba(15,23,42,0.08)] backdrop-blur-md dark:border-white/15 dark:bg-white/10 dark:shadow-[0_14px_30px_rgba(0,0,0,0.24)]">
        <div class="pointer-events-none absolute inset-0 z-10 flex h-full items-center pl-3 pr-7 text-sm font-semibold text-foreground">
          {{ formatter.custom(toDate(date), { month: 'short' }) }}
        </div>
        <NativeSelect
          wrapper-class="w-fit"
          class="relative z-20 h-8 border-transparent bg-transparent pl-3 pr-7 text-xs text-transparent shadow-none hover:bg-transparent focus-visible:bg-transparent dark:border-transparent dark:bg-transparent dark:focus-visible:bg-transparent"
          @change="(e: Event) => {
            placeholder = placeholder.set({
              month: Number((e?.target as any)?.value),
            })
          }"
        >
          <NativeSelectOption v-for="(month) in createYear({ dateObj: date })" :key="month.toString()" :value="month.month" :selected="date.month === month.month">
            {{ formatter.custom(toDate(month), { month: 'short' }) }}
          </NativeSelectOption>
        </NativeSelect>
      </div>
    </div>
  </DefineMonthTemplate>

  <DefineYearTemplate v-slot="{ date }">
    <div class="calendar-heading-select **:data-[slot=native-select-icon]:right-2 **:data-[slot=native-select-icon]:text-foreground **:data-[slot=native-select-icon]:opacity-70">
      <div class="calendar-heading-control relative rounded-xl border border-white/65 bg-white/72 shadow-[0_10px_24px_rgba(15,23,42,0.08)] backdrop-blur-md dark:border-white/15 dark:bg-white/10 dark:shadow-[0_14px_30px_rgba(0,0,0,0.24)]">
        <div class="pointer-events-none absolute inset-0 z-10 flex h-full items-center pl-3 pr-7 text-sm font-semibold text-foreground">
          {{ formatter.custom(toDate(date), { year: 'numeric' }) }}
        </div>
        <NativeSelect
          wrapper-class="w-fit"
          class="relative z-20 h-8 border-transparent bg-transparent pl-3 pr-7 text-xs text-transparent shadow-none hover:bg-transparent focus-visible:bg-transparent dark:border-transparent dark:bg-transparent dark:focus-visible:bg-transparent"
          @change="(e: Event) => {
            placeholder = placeholder.set({
              year: Number((e?.target as any)?.value),
            })
          }"
        >
          <NativeSelectOption v-for="(year) in yearRange" :key="year.toString()" :value="year.year" :selected="date.year === year.year">
            {{ formatter.custom(toDate(year), { year: 'numeric' }) }}
          </NativeSelectOption>
        </NativeSelect>
      </div>
    </div>
  </DefineYearTemplate>

  <CalendarRoot
    v-slot="{ grid, weekDays, date }"
    v-bind="forwarded"
    v-model:placeholder="placeholder"
    data-slot="calendar"
    :class="cn('calendar-glass rounded-[1.4rem] p-4 text-foreground', props.class)"
  >
    <CalendarHeader class="pt-0">
      <nav class="flex items-center gap-1 absolute top-0 inset-x-0 justify-between">
        <CalendarPrevButton>
          <slot name="calendar-prev-icon" />
        </CalendarPrevButton>
        <CalendarNextButton>
          <slot name="calendar-next-icon" />
        </CalendarNextButton>
      </nav>

      <slot name="calendar-heading" :date="date" :month="ReuseMonthTemplate" :year="ReuseYearTemplate">
        <template v-if="layout === 'month-and-year'">
          <div class="flex items-center justify-center gap-1">
            <ReuseMonthTemplate :date="date" />
            <ReuseYearTemplate :date="date" />
          </div>
        </template>
        <template v-else-if="layout === 'month-only'">
          <div class="flex items-center justify-center gap-1">
            <ReuseMonthTemplate :date="date" />
            {{ formatter.custom(toDate(date), { year: 'numeric' }) }}
          </div>
        </template>
        <template v-else-if="layout === 'year-only'">
          <div class="flex items-center justify-center gap-1">
            {{ formatter.custom(toDate(date), { month: 'short' }) }}
            <ReuseYearTemplate :date="date" />
          </div>
        </template>
        <template v-else>
          <CalendarHeading />
        </template>
      </slot>
    </CalendarHeader>

    <div class="flex flex-col gap-y-4 mt-4 sm:flex-row sm:gap-x-4 sm:gap-y-0">
      <CalendarGrid v-for="month in grid" :key="month.value.toString()">
        <CalendarGridHead>
          <CalendarGridRow>
            <CalendarHeadCell
              v-for="day in weekDays" :key="day"
            >
              {{ day }}
            </CalendarHeadCell>
          </CalendarGridRow>
        </CalendarGridHead>
        <CalendarGridBody>
          <CalendarGridRow v-for="(weekDates, index) in month.rows" :key="`weekDate-${index}`" class="mt-2 w-full">
            <CalendarCell
              v-for="weekDate in weekDates"
              :key="weekDate.toString()"
              :date="weekDate"
            >
              <CalendarCellTrigger
                :day="weekDate"
                :month="month.value"
              />
            </CalendarCell>
          </CalendarGridRow>
        </CalendarGridBody>
      </CalendarGrid>
    </div>
  </CalendarRoot>
</template>

<style scoped>
:deep([data-slot='calendar-prev-button']),
:deep([data-slot='calendar-next-button']) {
  border-color: var(--surface-border);
  background: color-mix(in oklch, var(--surface-floating) 74%, transparent);
  color: var(--foreground);
  box-shadow: 0 10px 24px oklch(0.24 0.06 245 / 0.09);
  opacity: 0.92;
}

:deep([data-slot='calendar-head-cell']) {
  color: color-mix(in oklch, var(--foreground) 72%, transparent);
  font-weight: 600;
}

:deep([data-slot='calendar-cell-trigger']) {
  color: color-mix(in oklch, var(--foreground) 86%, transparent);
  border-radius: 0.85rem;
  transition:
    background-color 160ms ease,
    color 160ms ease,
    box-shadow 160ms ease,
    transform 160ms ease;
}

:deep([data-slot='calendar-cell-trigger']:hover:not([data-disabled]):not([data-unavailable])) {
  background: color-mix(in oklch, var(--surface-floating) 72%, transparent);
  box-shadow: 0 10px 22px oklch(0.24 0.06 245 / 0.08);
}

:deep([data-slot='calendar-cell-trigger'][data-outside-view]) {
  color: color-mix(in oklch, var(--foreground) 52%, transparent);
}

:deep([data-slot='calendar-cell-trigger'][data-disabled]),
:deep([data-slot='calendar-cell-trigger'][data-unavailable]) {
  color: color-mix(in oklch, var(--foreground) 38%, transparent);
  opacity: 1;
}

:deep([data-slot='calendar-cell-trigger'][data-today]:not([data-selected])) {
  color: var(--foreground);
  background: color-mix(in oklch, var(--surface-floating) 88%, transparent);
  box-shadow:
    0 10px 22px oklch(0.24 0.06 245 / 0.1),
    inset 0 0 0 1px color-mix(in oklch, var(--ring) 36%, transparent);
}

:deep([data-slot='calendar-cell-trigger'][data-selected]) {
  color: white;
  background: linear-gradient(135deg, oklch(0.61 0.2 260), oklch(0.68 0.15 190));
  box-shadow:
    0 16px 34px oklch(0.55 0.18 255 / 0.22),
    0 12px 28px oklch(0.68 0.14 190 / 0.18),
    inset 0 1px 0 rgb(255 255 255 / 0.24);
}

:global(.dark) :deep([data-slot='calendar-cell-trigger'][data-today]:not([data-selected])) {
  background: color-mix(in oklch, var(--surface-floating) 68%, transparent);
  box-shadow:
    0 14px 30px oklch(0 0 0 / 0.24),
    inset 0 0 0 1px color-mix(in oklch, var(--ring) 42%, transparent);
}

:global(.dark) :deep([data-slot='calendar-cell-trigger'][data-selected]) {
  color: white;
}
</style>
