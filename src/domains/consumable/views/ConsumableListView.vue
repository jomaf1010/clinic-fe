<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { toast } from 'vue-sonner'
import {
  FlaskConical,
  Plus,
  LoaderCircle,
  Search,
  Pencil,
  Package,
  EllipsisVertical,
  Ban,
} from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { consumableApi } from '../api/consumableApi'
import ConsumableFormModal from '../components/ConsumableFormModal.vue'
import ConsumableStockAdjustModal from '../components/ConsumableStockAdjustModal.vue'
import type { ClinicConsumable, CreateConsumablePayload, UpdateConsumablePayload } from '../types/consumable.types'

const consumables = ref<ClinicConsumable[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)
const searchQuery = ref('')
const pagination = ref({ page: 1, per_page: 20, total: 0, last_page: 1 })
const currentPage = ref(1)

// Modal state
const showFormModal = ref(false)
const editingConsumable = ref<ClinicConsumable | null>(null)
const showStockModal = ref(false)
const stockConsumable = ref<ClinicConsumable | null>(null)
const formModalRef = ref<InstanceType<typeof ConsumableFormModal> | null>(null)
const stockModalRef = ref<InstanceType<typeof ConsumableStockAdjustModal> | null>(null)

let searchDebounce: ReturnType<typeof setTimeout> | null = null

async function fetchConsumables(page: number) {
  isLoading.value = true
  error.value = null
  try {
    const response = await consumableApi.list(page, 20, searchQuery.value || undefined)
    consumables.value = response.data
    pagination.value = response.meta.pagination
  } catch {
    error.value = 'Failed to load consumables.'
  } finally {
    isLoading.value = false
  }
}

function goToPage(page: number) {
  if (page < 1 || page > pagination.value.last_page) return
  currentPage.value = page
}

function onSearchInput(val: string | number) {
  searchQuery.value = String(val)
  if (searchDebounce) clearTimeout(searchDebounce)
  searchDebounce = setTimeout(() => {
    currentPage.value = 1
    fetchConsumables(1)
  }, 300)
}

watch(currentPage, (page) => fetchConsumables(page))
onMounted(() => fetchConsumables(currentPage.value))

function openCreateModal() {
  editingConsumable.value = null
  showFormModal.value = true
}

function openEditModal(consumable: ClinicConsumable) {
  editingConsumable.value = consumable
  showFormModal.value = true
}

async function handleFormSave(payload: CreateConsumablePayload | UpdateConsumablePayload) {
  if (formModalRef.value) formModalRef.value.isSaving = true
  try {
    if (editingConsumable.value) {
      await consumableApi.update(editingConsumable.value.id, payload as UpdateConsumablePayload)
      toast.success('Consumable updated')
    } else {
      await consumableApi.create(payload as CreateConsumablePayload)
      toast.success('Consumable added')
    }
    showFormModal.value = false
    fetchConsumables(currentPage.value)
  } catch {
    toast.error(editingConsumable.value ? 'Failed to update consumable' : 'Failed to add consumable')
  } finally {
    if (formModalRef.value) formModalRef.value.isSaving = false
  }
}

function openStockModal(consumable: ClinicConsumable) {
  stockConsumable.value = consumable
  showStockModal.value = true
}

async function handleStockAdjust(payload: { adjustment: number; reason: string }) {
  if (!stockConsumable.value) return
  if (stockModalRef.value) stockModalRef.value.isSaving = true
  try {
    await consumableApi.adjustStock(stockConsumable.value.id, payload)
    toast.success('Stock adjusted')
    showStockModal.value = false
    fetchConsumables(currentPage.value)
  } catch {
    toast.error('Failed to adjust stock')
  } finally {
    if (stockModalRef.value) stockModalRef.value.isSaving = false
  }
}

const deactivateTarget = ref<ClinicConsumable | null>(null)
const showDeactivateDialog = ref(false)
const isDeactivating = ref(false)

function confirmDeactivate(consumable: ClinicConsumable) {
  deactivateTarget.value = consumable
  showDeactivateDialog.value = true
}

async function handleDeactivate() {
  if (!deactivateTarget.value) return
  isDeactivating.value = true
  try {
    await consumableApi.deactivate(deactivateTarget.value.id)
    toast.success('Consumable deactivated')
    showDeactivateDialog.value = false
    fetchConsumables(currentPage.value)
  } catch {
    toast.error('Failed to deactivate consumable')
  } finally {
    isDeactivating.value = false
  }
}

onUnmounted(() => {
  if (searchDebounce) clearTimeout(searchDebounce)
})
</script>

<template>
  <div class="flex flex-1 flex-col gap-4">
    <!-- Header -->
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div class="flex items-center gap-3">
        <h1 class="text-lg font-semibold">Consumables</h1>
        <Badge variant="secondary" class="text-xs">
          {{ pagination.total }}
        </Badge>
      </div>

      <div class="flex items-center gap-2">
        <div class="relative flex-1 sm:w-64 sm:flex-none">
          <Search class="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            :model-value="searchQuery"
            placeholder="Search consumables..."
            class="pl-8"
            @update:model-value="onSearchInput"
          />
        </div>

        <Button class="shrink-0" @click="openCreateModal">
          <Plus class="size-4" />
          <span class="hidden sm:inline">Add Consumable</span>
        </Button>
      </div>
    </div>

    <!-- Loading skeleton -->
    <div v-if="isLoading" class="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Consumable</TableHead>
            <TableHead class="hidden lg:table-cell">Price</TableHead>
            <TableHead class="hidden lg:table-cell">Stock</TableHead>
            <TableHead class="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="i in 8" :key="i">
            <TableCell>
              <div class="space-y-1.5">
                <Skeleton class="h-4 w-40" />
                <Skeleton class="h-3 w-56" />
              </div>
            </TableCell>
            <TableCell class="hidden lg:table-cell"><Skeleton class="h-4 w-16" /></TableCell>
            <TableCell class="hidden lg:table-cell"><Skeleton class="h-5 w-20 rounded-full" /></TableCell>
            <TableCell><Skeleton class="h-4 w-4" /></TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <!-- Error -->
    <div
      v-else-if="error"
      role="alert"
      class="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
    >
      {{ error }}
      <Button variant="outline" size="sm" class="mt-2" @click="fetchConsumables(currentPage)">Try again</Button>
    </div>

    <!-- Empty -->
    <div
      v-else-if="consumables.length === 0 && !searchQuery"
      class="flex flex-1 flex-col items-center justify-center py-12 text-muted-foreground"
    >
      <FlaskConical class="mb-3 size-10 opacity-50" />
      <p>No consumables yet.</p>
      <Button variant="link" class="mt-2" @click="openCreateModal">
        Add your first consumable
      </Button>
    </div>

    <!-- No results -->
    <div
      v-else-if="consumables.length === 0"
      class="flex flex-1 flex-col items-center justify-center py-12 text-muted-foreground"
    >
      <Search class="mb-3 size-10 opacity-50" />
      <p>No consumables match your search.</p>
    </div>

    <!-- Data table -->
    <template v-else>
      <div class="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Consumable</TableHead>
              <TableHead class="hidden lg:table-cell">Price</TableHead>
              <TableHead class="hidden lg:table-cell">Stock</TableHead>
              <TableHead class="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow
              v-for="consumable in consumables"
              :key="consumable.id"
              class="cursor-pointer hover:bg-muted/50"
              @click="openEditModal(consumable)"
            >
              <TableCell>
                <div class="min-w-0">
                  <p class="font-medium">{{ consumable.name }}</p>
                  <div class="flex items-center gap-2">
                    <span v-if="consumable.description" class="truncate text-xs text-muted-foreground">
                      {{ consumable.description }}
                    </span>
                    <span v-if="consumable.usage_count" class="text-xs text-muted-foreground">
                      {{ consumable.description ? '·' : '' }} Used {{ consumable.usage_count }} {{ consumable.usage_count === 1 ? 'time' : 'times' }}
                    </span>
                  </div>
                </div>
              </TableCell>
              <TableCell class="hidden lg:table-cell">
                <span v-if="consumable.price != null" class="text-sm">&#8369;{{ consumable.price.toFixed(2) }}</span>
                <span v-else class="text-sm text-muted-foreground">&mdash;</span>
              </TableCell>
              <TableCell class="hidden lg:table-cell">
                <Badge
                  variant="outline"
                  :class="consumable.stock_quantity > 0
                    ? 'border-green-300 bg-green-100 text-green-700 dark:border-green-700 dark:bg-green-950 dark:text-green-400'
                    : 'border-red-300 bg-red-100 text-red-700 dark:border-red-700 dark:bg-red-950 dark:text-red-400'"
                >
                  {{ consumable.stock_quantity }} in stock
                </Badge>
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger as-child>
                    <button
                      type="button"
                      :aria-label="`${consumable.name} options`"
                      class="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <EllipsisVertical class="size-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" class="w-40">
                    <DropdownMenuItem @click="openEditModal(consumable)">
                      <Pencil class="size-3.5" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem @click="openStockModal(consumable)">
                      <Package class="size-3.5" />
                      Adjust Stock
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      class="text-destructive focus:text-destructive"
                      @click="confirmDeactivate(consumable)"
                    >
                      <Ban class="size-3.5" />
                      Deactivate
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <!-- Pagination -->
      <div v-if="pagination.last_page > 1" class="flex justify-center">
        <Pagination
          :total="pagination.total"
          :items-per-page="pagination.per_page"
          :page="currentPage"
          :sibling-count="1"
          :show-edges="true"
          @update:page="goToPage"
        >
          <PaginationContent v-slot="{ items }">
            <PaginationPrevious />

            <template v-for="(item, index) in items" :key="item.type === 'page' ? item.value : `ellipsis-${index}`">
              <PaginationItem v-if="item.type === 'page'" :value="item.value" :is-active="item.value === currentPage">
                {{ item.value }}
              </PaginationItem>
              <PaginationEllipsis v-else :index="index" />
            </template>

            <PaginationNext />
          </PaginationContent>
        </Pagination>
      </div>
    </template>

    <!-- Deactivate Confirmation -->
    <Dialog v-model:open="showDeactivateDialog">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Deactivate Consumable</DialogTitle>
          <DialogDescription>
            Are you sure you want to deactivate <strong>{{ deactivateTarget?.name }}</strong>?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter class="gap-2 sm:gap-0">
          <Button variant="outline" @click="showDeactivateDialog = false">Cancel</Button>
          <Button variant="destructive" :disabled="isDeactivating" @click="handleDeactivate">
            <LoaderCircle v-if="isDeactivating" class="size-4 animate-spin" />
            Deactivate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Modals -->
    <ConsumableFormModal
      ref="formModalRef"
      :open="showFormModal"
      :consumable="editingConsumable"
      @update:open="showFormModal = $event"
      @save="handleFormSave"
    />
    <ConsumableStockAdjustModal
      ref="stockModalRef"
      :open="showStockModal"
      :consumable="stockConsumable"
      @update:open="showStockModal = $event"
      @adjust="handleStockAdjust"
    />
  </div>
</template>
