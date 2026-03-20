<script setup lang="ts">
import { ref, computed } from 'vue'
import { toast } from 'vue-sonner'
import {
  Package,
  Plus,
  Minus,
  X,
  LoaderCircle,
  Search,
  CheckCircle2,
} from 'lucide-vue-next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { consultationApi } from '../api/consultationApi'
import { consumableApi } from '@/domains/consumable/api/consumableApi'
import type { ClinicConsumable } from '@/domains/consumable/types/consumable.types'
import type { ConsultationConsumable } from '../types/consultation.types'

const props = defineProps<{
  consultationId: string
  consumables: ConsultationConsumable[]
  disabled: boolean
}>()

const emit = defineEmits<{
  update: [consumables: ConsultationConsumable[]]
}>()

// --- Modal state ---
const showModal = ref(false)
const searchQuery = ref('')
const searchResults = ref<ClinicConsumable[]>([])
const isSearching = ref(false)
const isSaving = ref(false)
let searchTimeout: ReturnType<typeof setTimeout> | null = null

// Selection record: consumable_id -> { name, quantity, unit_price }
const selections = ref<Record<string, { name: string; quantity: number; unit_price: number | null }>>({})

const selectionCount = computed(() => Object.keys(selections.value).length)
const hasSelections = computed(() => selectionCount.value > 0)

function openModal() {
  // Pre-populate selections from existing consumables
  const record: Record<string, { name: string; quantity: number; unit_price: number | null }> = {}
  for (const c of props.consumables) {
    record[c.consumable_id] = { name: c.name, quantity: c.quantity, unit_price: c.unit_price }
  }
  selections.value = record
  searchQuery.value = ''
  searchResults.value = []
  showModal.value = true
  doSearch('')
}

function closeModal() {
  showModal.value = false
}

function onSearchInput() {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => doSearch(searchQuery.value), 300)
}

async function doSearch(q: string) {
  isSearching.value = true
  try {
    const res = await consumableApi.list(1, 50, q || undefined)
    searchResults.value = res.data
  } catch {
    searchResults.value = []
  } finally {
    isSearching.value = false
  }
}

function isSelected(id: string): boolean {
  return id in selections.value
}

function getQuantity(id: string): number {
  return selections.value[id]?.quantity ?? 1
}

function toggleSelection(item: ClinicConsumable, checked: boolean) {
  if (checked) {
    selections.value = { ...selections.value, [item.id]: { name: item.name, quantity: 1, unit_price: item.price } }
  } else {
    const { [item.id]: _, ...rest } = selections.value
    selections.value = rest
  }
}

function adjustQuantity(id: string, delta: number) {
  const entry = selections.value[id]
  if (!entry) return
  const newQty = Math.max(1, entry.quantity + delta)
  selections.value = { ...selections.value, [id]: { ...entry, quantity: newQty } }
}

async function handleSave() {
  const consumables: ConsultationConsumable[] = []
  for (const [consumable_id, { name, quantity, unit_price }] of Object.entries(selections.value)) {
    consumables.push({ consumable_id, name, quantity, unit_price })
  }

  isSaving.value = true
  try {
    const res = await consultationApi.saveConsumables(props.consultationId, consumables)
    emit('update', res.data.consumables)
    closeModal()
    toast.success('Consumables saved')
  } catch {
    toast.error('Failed to save consumables')
  } finally {
    isSaving.value = false
  }
}

async function removeConsumable(consumableId: string) {
  const updated = props.consumables.filter((c) => c.consumable_id !== consumableId)
  try {
    const res = await consultationApi.saveConsumables(props.consultationId, updated)
    emit('update', res.data.consumables)
    toast.success('Consumable removed')
  } catch {
    toast.error('Failed to remove consumable')
  }
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- Header -->
    <div class="flex items-center gap-2">
      <Label class="flex items-center gap-1.5">
        <Package class="size-3.5 text-muted-foreground" />
        Consumables
      </Label>
      <Badge
        v-if="consumables.length"
        variant="outline"
        class="border-teal-300 bg-teal-100 text-teal-700 dark:border-teal-700 dark:bg-teal-950 dark:text-teal-400"
      >
        {{ consumables.length }} {{ consumables.length === 1 ? 'item' : 'items' }}
      </Badge>
    </div>

    <!-- Consumables list -->
    <div v-if="consumables.length" class="flex flex-wrap gap-2">
      <div
        v-for="item in consumables"
        :key="item.consumable_id"
        class="flex items-center gap-1.5 rounded-md border bg-muted/30 px-2.5 py-1.5 text-sm"
      >
        <span class="font-medium">{{ item.name }}</span>
        <Badge variant="secondary" class="h-5 px-1.5 text-xs">
          x{{ item.quantity }}
        </Badge>
        <span v-if="item.unit_price != null" class="text-xs text-muted-foreground">
          ({{ item.unit_price }}/ea)
        </span>
        <button
          v-if="!disabled"
          type="button"
          class="ml-0.5 rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          @click="removeConsumable(item.consumable_id)"
        >
          <X class="size-3" />
        </button>
      </div>
    </div>

    <div
      v-else-if="disabled"
      class="rounded-md border border-dashed bg-muted/20 p-3 text-center text-sm text-muted-foreground"
    >
      No consumables used.
    </div>

    <Button
      v-if="!disabled"
      variant="outline"
      size="sm"
      class="gap-1.5 self-start"
      @click="openModal"
    >
      <Plus class="size-3.5" />
      {{ consumables.length ? 'Edit Consumables' : 'Add Consumables' }}
    </Button>

    <!-- Selection Modal -->
    <Dialog :open="showModal" @update:open="(val) => { if (!val) closeModal() }">
      <DialogContent class="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Select Consumables</DialogTitle>
          <DialogDescription>Search and select consumables to add to this consultation.</DialogDescription>
        </DialogHeader>

        <div class="flex flex-col gap-4">
          <!-- Search -->
          <div class="relative">
            <Search class="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              v-model="searchQuery"
              placeholder="Search consumables..."
              class="pl-9"
              @input="onSearchInput"
            />
          </div>

          <!-- Results -->
          <div class="flex max-h-[50vh] flex-col divide-y overflow-y-auto rounded-md border">
            <div v-if="isSearching && !searchResults.length" class="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <LoaderCircle class="size-4 animate-spin" />
              Searching...
            </div>

            <div
              v-else-if="!searchResults.length"
              class="py-8 text-center text-sm text-muted-foreground"
            >
              No consumables found.
            </div>

            <label
              v-for="item in searchResults"
              :key="item.id"
              class="flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/50"
              :class="{ 'bg-teal-50/50 dark:bg-teal-950/20': isSelected(item.id) }"
            >
              <Checkbox
                :model-value="isSelected(item.id)"
                @update:model-value="(val) => toggleSelection(item, !!val)"
              />
              <div class="flex min-w-0 flex-1 flex-col">
                <span class="text-sm font-medium">{{ item.name }}</span>
                <div class="flex items-center gap-2 text-xs text-muted-foreground">
                  <span v-if="item.price != null">{{ item.price }}/unit</span>
                  <span>Stock: {{ item.stock_quantity }}</span>
                </div>
              </div>

              <!-- Quantity controls -->
              <div v-if="isSelected(item.id)" class="flex items-center gap-1" @click.stop>
                <button
                  type="button"
                  class="rounded border p-0.5 text-muted-foreground hover:bg-accent"
                  @click="adjustQuantity(item.id, -1)"
                >
                  <Minus class="size-3" />
                </button>
                <span class="w-6 text-center text-sm font-medium">{{ getQuantity(item.id) }}</span>
                <button
                  type="button"
                  class="rounded border p-0.5 text-muted-foreground hover:bg-accent"
                  @click="adjustQuantity(item.id, 1)"
                >
                  <Plus class="size-3" />
                </button>
              </div>
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" :disabled="isSaving" @click="closeModal">
            Cancel
          </Button>
          <Button :disabled="isSaving || !hasSelections" @click="handleSave">
            <LoaderCircle v-if="isSaving" class="size-3.5 animate-spin" />
            <CheckCircle2 v-else class="size-3.5" />
            Save ({{ selectionCount }})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
