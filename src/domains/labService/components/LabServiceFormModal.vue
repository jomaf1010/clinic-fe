<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { LoaderCircle, CheckCircle2, Search, CornerDownLeft } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { labServiceApi } from '../api/labServiceApi'
import type { SystemLabItemResult } from '../api/labServiceApi'
import type { ClinicLabService } from '../types/labService.types'

const props = defineProps<{
  open: boolean
  labService: ClinicLabService | null
}>()

const emit = defineEmits<{
  'update:open': [val: boolean]
  save: [payload: { name: string; category?: string | null; price?: number | null }]
}>()

const isSaving = ref(false)

const form = ref({
  name: '',
  category: '',
  price: '',
})

// System suggestion state
const systemResults = ref<SystemLabItemResult[]>([])
const showDropdown = ref(false)
const highlightedIndex = ref(-1)
const isSearching = ref(false)
const dropdownRef = ref<HTMLElement | null>(null)
let searchTimer: ReturnType<typeof setTimeout> | null = null

function scrollToHighlighted() {
  nextTick(() => {
    const container = dropdownRef.value
    if (!container) return
    const el = container.children[highlightedIndex.value] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  })
}

function onNameInput(val: string | number) {
  form.value.name = String(val)

  if (searchTimer) clearTimeout(searchTimer)
  const q = form.value.name.trim()
  if (q.length < 2 || props.labService) {
    systemResults.value = []
    showDropdown.value = false
    return
  }

  showDropdown.value = true
  highlightedIndex.value = 0

  searchTimer = setTimeout(async () => {
    isSearching.value = true
    try {
      const [systemRes, clinicRes] = await Promise.all([
        labServiceApi.searchSystem(q),
        labServiceApi.list(1, 100, q),
      ])

      // Build a set of normalized clinic lab service names to exclude
      const clinicNames = new Set(
        clinicRes.data.map((s) => s.name.toLowerCase()),
      )

      // Filter out system items already in the clinic catalog
      systemResults.value = systemRes.data.filter(
        (item) => !clinicNames.has(item.name.toLowerCase()),
      )
    } finally {
      isSearching.value = false
    }
  }, 300)
}

function selectSystemItem(item: SystemLabItemResult) {
  form.value.name = item.name
  form.value.category = item.category ?? ''
  systemResults.value = []
  showDropdown.value = false
}

function selectCustomName() {
  systemResults.value = []
  showDropdown.value = false
}

function onNameKeydown(e: KeyboardEvent) {
  if (!showDropdown.value) return
  const totalItems = systemResults.value.length + 1 // +1 for "Add new"
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    highlightedIndex.value = (highlightedIndex.value + 1) % totalItems
    scrollToHighlighted()
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    highlightedIndex.value = highlightedIndex.value <= 0
      ? totalItems - 1
      : highlightedIndex.value - 1
    scrollToHighlighted()
  } else if (e.key === 'Enter') {
    e.preventDefault()
    if (highlightedIndex.value === 0) {
      selectCustomName()
    } else {
      const result = systemResults.value[highlightedIndex.value - 1]
      if (result) selectSystemItem(result)
    }
  } else if (e.key === 'Escape') {
    showDropdown.value = false
  }
}

function onNameBlur() {
  setTimeout(() => { showDropdown.value = false }, 200)
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      if (props.labService) {
        form.value = {
          name: props.labService.name,
          category: props.labService.category ?? '',
          price: props.labService.price != null ? String(props.labService.price) : '',
        }
      } else {
        form.value = { name: '', category: '', price: '' }
      }
      systemResults.value = []
      showDropdown.value = false
    }
  },
)

function handleSubmit() {
  if (!form.value.name.trim()) return
  emit('save', {
    name: form.value.name.trim(),
    category: form.value.category.trim() || null,
    price: form.value.price ? parseFloat(form.value.price) : null,
  })
}

defineExpose({ isSaving })
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ labService ? 'Edit Lab Service' : 'Add Lab Service' }}</DialogTitle>
        <DialogDescription>
          {{ labService ? 'Update lab service details.' : 'Add a new lab service to your clinic catalog.' }}
        </DialogDescription>
      </DialogHeader>

      <form class="flex flex-col gap-4" @submit.prevent="handleSubmit">
        <!-- Name with auto-suggest -->
        <div class="relative flex flex-col gap-1.5">
          <label class="text-xs text-muted-foreground" for="ls-name">Name *</label>
          <div class="relative">
            <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <LoaderCircle v-if="isSearching" class="size-3.5 animate-spin text-muted-foreground" />
              <Search v-else class="size-3.5 text-muted-foreground" />
            </div>
            <Input
              id="ls-name"
              :model-value="form.name"
              :placeholder="labService ? '' : 'Search system or type name...'"
              class="pl-9"
              @update:model-value="onNameInput"
              @keydown="onNameKeydown"
              @blur="onNameBlur"
            />
          </div>
          <div
            ref="dropdownRef"
            v-if="showDropdown"
            class="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-md border bg-popover shadow-md"
          >
            <!-- Add new (custom) option -->
            <button
              class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
              :class="highlightedIndex === 0 ? 'bg-primary/10 text-primary' : 'hover:bg-accent'"
              @mousedown.prevent="selectCustomName"
              @mouseenter="highlightedIndex = 0"
            >
              <Badge variant="outline" class="shrink-0 text-[10px] border-green-300 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-950 dark:text-green-400">
                Add new <CornerDownLeft class="ml-0.5 inline size-2.5" />
              </Badge>
              <span class="truncate font-medium">{{ form.name.trim() }}</span>
            </button>
            <!-- System results -->
            <button
              v-for="(item, idx) in systemResults"
              :key="item.name"
              class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
              :class="idx + 1 === highlightedIndex ? 'bg-primary/10 text-primary' : 'hover:bg-accent'"
              @mousedown.prevent="selectSystemItem(item)"
              @mouseenter="highlightedIndex = idx + 1"
            >
              <span class="truncate font-medium">{{ item.name }}</span>
              <span v-if="item.category" class="shrink-0 text-xs text-muted-foreground">{{ item.category }}</span>
            </button>
          </div>
        </div>

        <div class="flex flex-col gap-1.5">
          <label class="text-xs text-muted-foreground" for="ls-category">Category</label>
          <Input id="ls-category" v-model="form.category" placeholder="e.g. Hematology" />
        </div>

        <div class="flex flex-col gap-1.5">
          <label class="text-xs text-muted-foreground" for="ls-price">Price</label>
          <Input id="ls-price" v-model="form.price" type="number" step="0.01" min="0" placeholder="0.00" />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" :disabled="isSaving" @click="emit('update:open', false)">
            Cancel
          </Button>
          <Button :disabled="isSaving || !form.name.trim()">
            <LoaderCircle v-if="isSaving" class="size-3.5 animate-spin" />
            <CheckCircle2 v-else class="size-3.5" />
            {{ labService ? 'Save Changes' : 'Add Lab Service' }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
