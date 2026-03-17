<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { X } from 'lucide-vue-next'

const props = defineProps<{
  modelValue: string[]
  searchFn: (q: string) => Promise<{ data: string[] }>
  placeholder?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

const inputValue = ref('')
const suggestions = ref<string[]>([])
const showSuggestions = ref(false)
const isSearching = ref(false)
let debounceTimer: ReturnType<typeof setTimeout> | null = null

const filteredSuggestions = computed(() =>
  suggestions.value.filter((s) => !props.modelValue.includes(s)),
)

function addTag(value: string) {
  const normalized = value.trim().toLowerCase()
  if (!normalized) return
  if (props.modelValue.includes(normalized)) return
  emit('update:modelValue', [...props.modelValue, normalized])
  inputValue.value = ''
  suggestions.value = []
  showSuggestions.value = false
}

function removeTag(index: number) {
  const updated = [...props.modelValue]
  updated.splice(index, 1)
  emit('update:modelValue', updated)
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Tab' || e.key === 'Enter') {
    if (inputValue.value.trim()) {
      e.preventDefault()
      addTag(inputValue.value)
    }
  }
}

watch(inputValue, (val) => {
  if (debounceTimer) clearTimeout(debounceTimer)

  const trimmed = val.trim()
  if (!trimmed) {
    suggestions.value = []
    showSuggestions.value = false
    return
  }

  debounceTimer = setTimeout(async () => {
    isSearching.value = true
    try {
      const result = await props.searchFn(trimmed)
      suggestions.value = result.data
      showSuggestions.value = true
    } catch {
      suggestions.value = []
    } finally {
      isSearching.value = false
    }
  }, 300)
})

function onBlur() {
  // Delay to allow click on suggestion
  setTimeout(() => {
    showSuggestions.value = false
  }, 200)
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <div v-if="modelValue.length > 0" class="flex flex-wrap gap-1.5">
      <Badge
        v-for="(tag, i) in modelValue"
        :key="tag"
        variant="secondary"
        class="gap-1 pr-1"
      >
        {{ tag }}
        <button
          type="button"
          class="ml-0.5 rounded-full p-0.5 hover:bg-muted"
          @click="removeTag(i)"
        >
          <X class="size-3" />
        </button>
      </Badge>
    </div>

    <div class="relative">
      <Input
        v-model="inputValue"
        type="text"
        :placeholder="placeholder"
        @keydown="onKeydown"
        @blur="onBlur"
        @focus="inputValue.trim() && filteredSuggestions.length > 0 && (showSuggestions = true)"
      />

      <div
        v-if="showSuggestions && filteredSuggestions.length > 0"
        class="absolute z-50 mt-1 w-full rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
      >
        <button
          v-for="suggestion in filteredSuggestions"
          :key="suggestion"
          type="button"
          class="w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
          @mousedown.prevent="addTag(suggestion)"
        >
          {{ suggestion }}
        </button>
      </div>
    </div>
  </div>
</template>
