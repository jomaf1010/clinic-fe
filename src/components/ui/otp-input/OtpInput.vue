<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { cn } from '@/lib/utils'

interface Props {
  value: string
  length?: number
  disabled?: boolean
  invalid?: boolean
  autofocus?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  length: 6,
  disabled: false,
  invalid: false,
  autofocus: false,
})

const emit = defineEmits<{
  (e: 'update:value', value: string): void
  (e: 'complete', value: string): void
}>()

const inputs = ref<HTMLInputElement[]>([])

function setInputRef(el: Element | null, idx: number): void {
  if (el instanceof HTMLInputElement) {
    inputs.value[idx] = el
  }
}

const digits = computed<string[]>(() => {
  const arr: string[] = []
  for (let i = 0; i < props.length; i++) {
    arr.push(props.value[i] ?? '')
  }
  return arr
})

function emitValue(next: string[]): void {
  const joined = next.join('').slice(0, props.length)
  emit('update:value', joined)
  if (joined.length === props.length && joined.split('').every((c) => /\d/.test(c))) {
    emit('complete', joined)
  }
}

function focusInput(idx: number): void {
  const target = inputs.value[idx]
  if (target) {
    target.focus()
    target.select()
  }
}

function onInput(event: Event, idx: number): void {
  const input = event.target as HTMLInputElement
  const raw = input.value
  // Strip non-digits and keep only the last digit if user typed multiple
  const cleaned = raw.replace(/\D/g, '')

  if (cleaned.length > 1) {
    // Treat as paste-like input scattered across boxes
    fillFrom(cleaned, idx)
    return
  }

  const next = [...digits.value]
  next[idx] = cleaned
  emitValue(next)

  if (cleaned && idx < props.length - 1) {
    nextTick(() => focusInput(idx + 1))
  }
}

function onKeydown(event: KeyboardEvent, idx: number): void {
  const input = event.target as HTMLInputElement

  if (event.key === 'Backspace') {
    if (input.value === '') {
      // Empty box: move back and clear previous
      if (idx > 0) {
        event.preventDefault()
        const next = [...digits.value]
        next[idx - 1] = ''
        emitValue(next)
        nextTick(() => focusInput(idx - 1))
      }
    } else {
      // Has value: clear it (default backspace behavior will erase)
      const next = [...digits.value]
      next[idx] = ''
      emitValue(next)
    }
    return
  }

  if (event.key === 'ArrowLeft' && idx > 0) {
    event.preventDefault()
    focusInput(idx - 1)
    return
  }

  if (event.key === 'ArrowRight' && idx < props.length - 1) {
    event.preventDefault()
    focusInput(idx + 1)
    return
  }

  if (event.key === 'Delete') {
    const next = [...digits.value]
    next[idx] = ''
    emitValue(next)
    return
  }
}

function onPaste(event: ClipboardEvent, idx: number): void {
  const pasted = event.clipboardData?.getData('text') ?? ''
  if (!pasted) return
  event.preventDefault()
  fillFrom(pasted, idx)
}

function fillFrom(raw: string, startIdx: number): void {
  const cleaned = raw.replace(/\D/g, '')
  if (!cleaned) return
  const next = [...digits.value]
  let cursor = startIdx
  for (const ch of cleaned) {
    if (cursor >= props.length) break
    next[cursor] = ch
    cursor++
  }
  emitValue(next)
  nextTick(() => focusInput(Math.min(cursor, props.length - 1)))
}

function onFocus(event: FocusEvent): void {
  const input = event.target as HTMLInputElement
  // Select the digit on focus so typing replaces cleanly on mobile
  input.select()
}

watch(
  () => props.autofocus,
  (val) => {
    if (val) nextTick(() => focusInput(0))
  },
  { immediate: true },
)
</script>

<template>
  <div
    role="group"
    aria-label="One-time code"
    class="flex items-center justify-center gap-2 sm:gap-3"
    data-slot="otp-input"
  >
    <input
      v-for="(digit, idx) in digits"
      :key="idx"
      :ref="(el) => setInputRef(el as Element | null, idx)"
      :value="digit"
      type="text"
      inputmode="numeric"
      pattern="[0-9]*"
      :autocomplete="idx === 0 ? 'one-time-code' : 'off'"
      maxlength="1"
      :disabled="disabled"
      :aria-invalid="invalid || undefined"
      :aria-label="`Digit ${idx + 1}`"
      :class="cn(
        'h-12 w-10 sm:h-14 sm:w-12 rounded-2xl border border-white/55 bg-white/60 text-center text-lg sm:text-xl font-semibold shadow-[0_10px_26px_rgba(15,23,42,0.06)] backdrop-blur-md transition-[color,box-shadow,background-color,border-color] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-slate-950/50 dark:shadow-[0_12px_28px_rgba(0,0,0,0.24)]',
        'focus-visible:border-white/75 focus-visible:bg-white/75 focus-visible:ring-ring/40 focus-visible:ring-[3px] dark:focus-visible:bg-slate-950/65',
        invalid && 'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 border-destructive ring-destructive/20 ring-[3px]',
      )"
      @input="onInput($event, idx)"
      @keydown="onKeydown($event, idx)"
      @paste="onPaste($event, idx)"
      @focus="onFocus($event)"
    >
  </div>
</template>
