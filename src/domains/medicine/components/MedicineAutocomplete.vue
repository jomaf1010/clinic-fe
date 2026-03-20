<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { Search, LoaderCircle } from 'lucide-vue-next'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { medicineApi } from '../api/medicineApi'
import type { MedicineSearchResult } from '../types/medicine.types'

const props = defineProps<{
  modelValue: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  select: [result: MedicineSearchResult]
  createNew: [name: string]
}>()

const searchResults = ref<MedicineSearchResult[]>([])
const isSearching = ref(false)
const showDropdown = ref(false)
const highlightedIndex = ref(-1)
const dropdownRef = ref<HTMLElement | null>(null)
let debounceTimer: ReturnType<typeof setTimeout> | null = null

function scrollToHighlighted() {
  nextTick(() => {
    const container = dropdownRef.value
    if (!container) return
    const el = container.children[highlightedIndex.value] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  })
}

function onInput(val: string | number) {
  const value = String(val)
  emit('update:modelValue', value)

  if (debounceTimer) clearTimeout(debounceTimer)

  const q = value.trim()
  if (q.length < 2) {
    searchResults.value = []
    showDropdown.value = false
    return
  }

  debounceTimer = setTimeout(async () => {
    isSearching.value = true
    try {
      const response = await medicineApi.search(q)
      searchResults.value = response.data
      highlightedIndex.value = searchResults.value.length > 0 ? 0 : -1
      showDropdown.value = true
    } finally {
      isSearching.value = false
    }
  }, 300)
}

function selectResult(result: MedicineSearchResult) {
  emit('update:modelValue', result.display_name)
  emit('select', result)
  searchResults.value = []
  showDropdown.value = false
}

function handleCreateNew() {
  const name = props.modelValue.trim()
  if (!name) return
  emit('createNew', name)
  searchResults.value = []
  showDropdown.value = false
}

function onKeydown(e: KeyboardEvent) {
  const totalItems = searchResults.value.length + (hasExactMatch() ? 0 : 1)
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (showDropdown.value && totalItems > 0) {
      highlightedIndex.value = (highlightedIndex.value + 1) % totalItems
      scrollToHighlighted()
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (showDropdown.value && totalItems > 0) {
      highlightedIndex.value = highlightedIndex.value <= 0
        ? totalItems - 1
        : highlightedIndex.value - 1
      scrollToHighlighted()
    }
  } else if (e.key === 'Enter') {
    e.preventDefault()
    if (showDropdown.value && highlightedIndex.value >= 0) {
      const result = searchResults.value[highlightedIndex.value]
      if (result) {
        selectResult(result)
      } else {
        handleCreateNew()
      }
    }
  } else if (e.key === 'Escape') {
    showDropdown.value = false
    highlightedIndex.value = -1
  }
}

function hasExactMatch(): boolean {
  const q = props.modelValue.trim().toLowerCase()
  return searchResults.value.some(
    (r) => r.display_name.toLowerCase() === q
      || (r.generic_name && r.generic_name.toLowerCase() === q)
      || (r.brand_name && r.brand_name.toLowerCase() === q),
  )
}

function onBlur() {
  setTimeout(() => {
    showDropdown.value = false
  }, 200)
}
</script>

<template>
  <div class="relative">
    <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
      <LoaderCircle v-if="isSearching" class="size-3.5 animate-spin text-muted-foreground" />
      <Search v-else class="size-3.5 text-muted-foreground" />
    </div>
    <Input
      :model-value="modelValue"
      :disabled="disabled"
      placeholder="Search medicine or type name..."
      class="pl-9"
      @update:model-value="onInput"
      @keydown="onKeydown"
      @blur="onBlur"
    />

    <div
      ref="dropdownRef"
      v-if="showDropdown && (searchResults.length > 0 || modelValue.trim().length >= 2)"
      class="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-md border bg-popover shadow-md"
    >
      <button
        v-for="(result, idx) in searchResults"
        :key="`${result.source}-${result.id}`"
        class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
        :class="idx === highlightedIndex ? 'bg-primary/10 text-primary' : 'hover:bg-accent'"
        @mousedown.prevent="selectResult(result)"
        @mouseenter="highlightedIndex = idx"
      >
        <Badge
          variant="outline"
          class="shrink-0 text-[10px]"
          :class="result.source === 'clinic'
            ? 'border-green-300 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-950 dark:text-green-400'
            : 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-400'"
        >
          {{ result.source === 'clinic' ? 'Clinic' : 'FDA' }}
        </Badge>
        <span class="truncate font-medium">{{ result.display_name }}</span>
        <span v-if="result.dosage_strength" class="shrink-0 text-xs text-muted-foreground">{{ result.dosage_strength }}</span>
        <Badge
          v-if="result.source === 'clinic' && result.inventory_enabled && result.stock_quantity <= 0"
          variant="outline"
          class="shrink-0 text-[10px] border-red-300 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-950 dark:text-red-400"
        >
          Out of stock
        </Badge>
      </button>

      <!-- Create new option -->
      <button
        v-if="!hasExactMatch() && modelValue.trim().length >= 2"
        class="flex w-full items-center gap-2 border-t px-3 py-2 text-left text-sm"
        :class="highlightedIndex === searchResults.length ? 'bg-primary/10 text-primary' : 'hover:bg-accent'"
        @mousedown.prevent="handleCreateNew"
        @mouseenter="highlightedIndex = searchResults.length"
      >
        <span class="text-muted-foreground">+</span>
        <span>Use "{{ modelValue.trim() }}"</span>
      </button>
    </div>
  </div>
</template>
