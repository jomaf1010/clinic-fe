<script setup lang="ts">
import { ref, computed } from 'vue'
import { toast } from 'vue-sonner'
import {
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { serviceApi } from '@/domains/service/api/serviceApi'
import type { ClinicService, EncounterProcedure } from '@/domains/service/types/service.types'
import { serviceCategoryLabel } from '@/domains/service/types/service.types'
import { useAuthStore } from '@/domains/auth/stores/authStore'

const props = defineProps<{
  encounterId: string
  procedures: EncounterProcedure[]
  disabled: boolean
}>()

const emit = defineEmits<{
  update: [procedures: EncounterProcedure[]]
}>()

const authStore = useAuthStore()
const specialty = computed(() => authStore.user?.specialty ?? undefined)

// --- Modal state ---
const showModal = ref(false)
const searchQuery = ref('')
const searchResults = ref<ClinicService[]>([])
const isSearching = ref(false)
const isSaving = ref(false)
let searchTimeout: ReturnType<typeof setTimeout> | null = null

const selections = ref<Record<string, { name: string; quantity: number; unit_price: number | null }>>({})
const selectionCount = computed(() => Object.keys(selections.value).length)

function openModal() {
  const record: Record<string, { name: string; quantity: number; unit_price: number | null }> = {}
  for (const p of props.procedures) {
    record[p.service_id] = { name: p.name, quantity: p.quantity, unit_price: p.unit_price }
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
    const res = await serviceApi.list(1, 50, { q: q || undefined, specialty: specialty.value })
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

function toggleSelection(item: ClinicService, checked: boolean) {
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
  const procedures: EncounterProcedure[] = []
  for (const [service_id, { name, quantity, unit_price }] of Object.entries(selections.value)) {
    procedures.push({ service_id, name, quantity, unit_price, notes: null })
  }

  isSaving.value = true
  try {
    await serviceApi.saveProcedures(props.encounterId, procedures)
    emit('update', procedures)
    closeModal()
    toast.success('Procedures saved')
  } catch {
    toast.error('Failed to save procedures')
  } finally {
    isSaving.value = false
  }
}

async function removeProcedure(serviceId: string) {
  const updated = props.procedures.filter((p) => p.service_id !== serviceId)
  try {
    await serviceApi.saveProcedures(props.encounterId, updated)
    emit('update', updated)
    toast.success('Procedure removed')
  } catch {
    toast.error('Failed to remove procedure')
  }
}

function formatPrice(price: number | null): string {
  if (price === null) return ''
  return `₱${price.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- Badge -->
    <Badge
      v-if="procedures.length"
      variant="outline"
      class="w-fit border-purple-300 bg-purple-100 text-purple-700 dark:border-purple-700 dark:bg-purple-950 dark:text-purple-400"
    >
      {{ procedures.length }} {{ procedures.length === 1 ? 'item' : 'items' }}
    </Badge>

    <!-- Procedures list -->
    <div v-if="procedures.length" class="flex flex-wrap gap-2">
      <div
        v-for="item in procedures"
        :key="item.service_id"
        class="flex items-center gap-1.5 rounded-md border bg-muted/30 px-2.5 py-1.5 text-sm"
      >
        <span class="font-medium">{{ item.name }}</span>
        <Badge variant="secondary" class="h-5 px-1.5 text-xs">x{{ item.quantity }}</Badge>
        <span v-if="item.unit_price != null" class="text-xs text-muted-foreground">
          ({{ formatPrice(item.unit_price) }})
        </span>
        <button
          v-if="!disabled"
          type="button"
          class="ml-0.5 rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          @click="removeProcedure(item.service_id)"
        >
          <X class="size-3" />
        </button>
      </div>
    </div>

    <div
      v-else-if="disabled"
      class="rounded-md border border-dashed bg-muted/20 p-3 text-center text-sm text-muted-foreground"
    >
      No procedures performed.
    </div>

    <Button
      v-if="!disabled"
      variant="outline"
      size="sm"
      class="gap-1.5 self-start"
      @click="openModal"
    >
      <Plus class="size-3.5" />
      {{ procedures.length ? 'Edit Procedures' : 'Add Procedures' }}
    </Button>

    <!-- Selection Modal -->
    <Dialog :open="showModal" @update:open="(val) => { if (!val) closeModal() }">
      <DialogContent class="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Select Procedures</DialogTitle>
          <DialogDescription>Search and select procedures performed during this visit.</DialogDescription>
        </DialogHeader>

        <div class="flex flex-col gap-4">
          <!-- Search -->
          <div class="relative">
            <Search class="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              v-model="searchQuery"
              placeholder="Search procedures..."
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
              No services found. Add services in Clinic Settings.
            </div>

            <label
              v-for="item in searchResults"
              :key="item.id"
              class="flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/50"
              :class="{ 'bg-purple-50/50 dark:bg-purple-950/20': isSelected(item.id) }"
            >
              <Checkbox
                :model-value="isSelected(item.id)"
                @update:model-value="(val) => toggleSelection(item, !!val)"
              />
              <div class="flex min-w-0 flex-1 flex-col">
                <span class="text-sm font-medium">{{ item.name }}</span>
                <div class="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge v-if="item.category" variant="secondary" class="h-4 px-1 text-[10px]">
                    {{ serviceCategoryLabel(item.category) }}
                  </Badge>
                  <span v-if="item.price != null">{{ formatPrice(item.price) }}</span>
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
          <Button :disabled="isSaving" @click="handleSave">
            <LoaderCircle v-if="isSaving" class="size-3.5 animate-spin" />
            <CheckCircle2 v-else class="size-3.5" />
            Save ({{ selectionCount }})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
