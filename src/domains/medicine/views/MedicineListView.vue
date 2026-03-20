<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { toast } from 'vue-sonner'
import {
  Pill,
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
import { medicineApi } from '../api/medicineApi'
import MedicineFormModal from '../components/MedicineFormModal.vue'
import StockAdjustModal from '../components/StockAdjustModal.vue'
import type { ClinicMedicine, CreateMedicinePayload, UpdateMedicinePayload } from '../types/medicine.types'

const router = useRouter()
const route = useRoute()

const medicines = ref<ClinicMedicine[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)
const searchQuery = ref((route.query.search as string) || '')
const pagination = ref({ page: 1, per_page: 20, total: 0, last_page: 1 })
const currentPage = ref(Number(route.query.page) || 1)

// Modal state
const showFormModal = ref(false)
const editingMedicine = ref<ClinicMedicine | null>(null)
const showStockModal = ref(false)
const stockMedicine = ref<ClinicMedicine | null>(null)
const formModalRef = ref<InstanceType<typeof MedicineFormModal> | null>(null)
const stockModalRef = ref<InstanceType<typeof StockAdjustModal> | null>(null)

let searchDebounce: ReturnType<typeof setTimeout> | null = null

async function fetchMedicines(page: number) {
  isLoading.value = true
  error.value = null
  try {
    const response = await medicineApi.list(page, 20, searchQuery.value || undefined)
    medicines.value = response.data
    pagination.value = response.meta.pagination
  } catch {
    error.value = 'Failed to load medicines.'
  } finally {
    isLoading.value = false
  }
}

function goToPage(page: number) {
  if (page < 1 || page > pagination.value.last_page) return
  currentPage.value = page
  router.replace({ query: { ...route.query, page: String(page) } })
}

function onSearchInput(val: string | number) {
  searchQuery.value = String(val)
  if (searchDebounce) clearTimeout(searchDebounce)
  searchDebounce = setTimeout(() => {
    currentPage.value = 1
    router.replace({ query: { search: searchQuery.value || undefined, page: '1' } })
    fetchMedicines(1)
  }, 300)
}

watch(currentPage, (page) => fetchMedicines(page))
onMounted(() => fetchMedicines(currentPage.value))

// Form modal handlers
function openCreateModal() {
  editingMedicine.value = null
  showFormModal.value = true
}

function openEditModal(medicine: ClinicMedicine) {
  editingMedicine.value = medicine
  showFormModal.value = true
}

async function handleFormSave(payload: CreateMedicinePayload | UpdateMedicinePayload) {
  if (formModalRef.value) formModalRef.value.isSaving = true
  try {
    if (editingMedicine.value) {
      await medicineApi.update(editingMedicine.value.id, payload as UpdateMedicinePayload)
      toast.success('Medicine updated')
    } else {
      await medicineApi.create(payload as CreateMedicinePayload)
      toast.success('Medicine added')
    }
    showFormModal.value = false
    fetchMedicines(currentPage.value)
  } catch {
    toast.error(editingMedicine.value ? 'Failed to update medicine' : 'Failed to add medicine')
  } finally {
    if (formModalRef.value) formModalRef.value.isSaving = false
  }
}

// Stock modal handlers
function openStockModal(medicine: ClinicMedicine) {
  stockMedicine.value = medicine
  showStockModal.value = true
}

async function handleStockAdjust(payload: { adjustment: number; reason: string }) {
  if (!stockMedicine.value) return
  if (stockModalRef.value) stockModalRef.value.isSaving = true
  try {
    await medicineApi.adjustStock(stockMedicine.value.id, payload)
    toast.success('Stock adjusted')
    showStockModal.value = false
    fetchMedicines(currentPage.value)
  } catch {
    toast.error('Failed to adjust stock')
  } finally {
    if (stockModalRef.value) stockModalRef.value.isSaving = false
  }
}

// Deactivate with confirmation
const deactivateTarget = ref<ClinicMedicine | null>(null)
const showDeactivateDialog = ref(false)
const isDeactivating = ref(false)

function confirmDeactivate(medicine: ClinicMedicine) {
  deactivateTarget.value = medicine
  showDeactivateDialog.value = true
}

async function handleDeactivate() {
  if (!deactivateTarget.value) return
  isDeactivating.value = true
  try {
    await medicineApi.deactivate(deactivateTarget.value.id)
    toast.success('Medicine deactivated')
    showDeactivateDialog.value = false
    fetchMedicines(currentPage.value)
  } catch {
    toast.error('Failed to deactivate medicine')
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
        <h1 class="text-lg font-semibold">Medicines</h1>
        <Badge variant="secondary" class="text-xs">
          {{ pagination.total }}
        </Badge>
      </div>

      <div class="flex items-center gap-2">
        <div class="relative flex-1 sm:w-64 sm:flex-none">
          <Search class="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            :model-value="searchQuery"
            placeholder="Search medicines..."
            class="pl-8"
            @update:model-value="onSearchInput"
          />
        </div>

        <Button class="shrink-0" @click="openCreateModal">
          <Plus class="size-4" />
          <span class="hidden sm:inline">Add Medicine</span>
        </Button>
      </div>
    </div>

    <!-- Loading skeleton -->
    <div v-if="isLoading" class="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Medicine</TableHead>
            <TableHead class="hidden md:table-cell">Form</TableHead>
            <TableHead class="hidden md:table-cell">Classification</TableHead>
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
                <Skeleton class="h-3 w-24" />
              </div>
            </TableCell>
            <TableCell class="hidden md:table-cell"><Skeleton class="h-4 w-16" /></TableCell>
            <TableCell class="hidden md:table-cell"><Skeleton class="h-5 w-12 rounded-full" /></TableCell>
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
      <Button variant="outline" size="sm" class="mt-2" @click="fetchMedicines(currentPage)">Try again</Button>
    </div>

    <!-- Empty -->
    <div
      v-else-if="medicines.length === 0 && !searchQuery"
      class="flex flex-1 flex-col items-center justify-center py-12 text-muted-foreground"
    >
      <Pill class="mb-3 size-10 opacity-50" />
      <p>No medicines yet.</p>
      <Button variant="link" class="mt-2" @click="openCreateModal">
        Add your first medicine
      </Button>
    </div>

    <!-- No results -->
    <div
      v-else-if="medicines.length === 0"
      class="flex flex-1 flex-col items-center justify-center py-12 text-muted-foreground"
    >
      <Search class="mb-3 size-10 opacity-50" />
      <p>No medicines match your search.</p>
    </div>

    <!-- Data table -->
    <template v-else>
      <div class="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Medicine</TableHead>
              <TableHead class="hidden md:table-cell">Form</TableHead>
              <TableHead class="hidden md:table-cell">Classification</TableHead>
              <TableHead class="hidden lg:table-cell">Price</TableHead>
              <TableHead class="hidden lg:table-cell">Stock</TableHead>
              <TableHead class="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow
              v-for="medicine in medicines"
              :key="medicine.id"
              class="cursor-pointer hover:bg-muted/50"
              @click="openEditModal(medicine)"
            >
              <TableCell>
                <div class="min-w-0">
                  <p class="font-medium">{{ medicine.display_name }}</p>
                  <div class="flex items-center gap-2">
                    <span v-if="medicine.dosage_strength" class="text-xs text-muted-foreground">
                      {{ medicine.dosage_strength }}
                    </span>
                    <span v-if="medicine.prescription_count" class="text-xs text-muted-foreground">
                      {{ medicine.dosage_strength ? '·' : '' }} Prescribed {{ medicine.prescription_count }} {{ medicine.prescription_count === 1 ? 'time' : 'times' }}
                    </span>
                  </div>
                </div>
              </TableCell>
              <TableCell class="hidden md:table-cell">
                <span v-if="medicine.dosage_form" class="text-sm">{{ medicine.dosage_form }}</span>
                <span v-else class="text-sm text-muted-foreground">&mdash;</span>
              </TableCell>
              <TableCell class="hidden md:table-cell">
                <Badge v-if="medicine.classification" variant="outline" class="text-[10px]">
                  {{ medicine.classification }}
                </Badge>
                <span v-else class="text-sm text-muted-foreground">&mdash;</span>
              </TableCell>
              <TableCell class="hidden lg:table-cell">
                <div v-if="medicine.price_per_piece != null || medicine.price_per_pack != null" class="flex flex-col text-sm">
                  <span v-if="medicine.price_per_piece != null">&#8369;{{ medicine.price_per_piece.toFixed(2) }} <span class="text-xs text-muted-foreground">/ pc</span></span>
                  <span v-if="medicine.price_per_pack != null">&#8369;{{ medicine.price_per_pack.toFixed(2) }} <span class="text-xs text-muted-foreground">/ pack</span></span>
                </div>
                <span v-else class="text-sm text-muted-foreground">&mdash;</span>
              </TableCell>
              <TableCell class="hidden lg:table-cell">
                <Badge
                  v-if="medicine.inventory_enabled"
                  variant="outline"
                  :class="medicine.stock_quantity > 0
                    ? 'border-green-300 bg-green-100 text-green-700 dark:border-green-700 dark:bg-green-950 dark:text-green-400'
                    : 'border-red-300 bg-red-100 text-red-700 dark:border-red-700 dark:bg-red-950 dark:text-red-400'"
                >
                  {{ medicine.stock_quantity }} in stock
                </Badge>
                <span v-else class="text-sm text-muted-foreground">&mdash;</span>
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger as-child>
                    <button
                      type="button"
                      :aria-label="`${medicine.display_name} options`"
                      class="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <EllipsisVertical class="size-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" class="w-40">
                    <DropdownMenuItem @click="openEditModal(medicine)">
                      <Pencil class="size-3.5" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem @click="openStockModal(medicine)">
                      <Package class="size-3.5" />
                      Adjust Stock
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      class="text-destructive focus:text-destructive"
                      @click="confirmDeactivate(medicine)"
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
          <DialogTitle>Deactivate Medicine</DialogTitle>
          <DialogDescription>
            Are you sure you want to deactivate <strong>{{ deactivateTarget?.display_name }}</strong>?
            It will be removed from the prescription catalog.
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
    <MedicineFormModal
      ref="formModalRef"
      :open="showFormModal"
      :medicine="editingMedicine"
      @update:open="showFormModal = $event"
      @save="handleFormSave"
    />
    <StockAdjustModal
      ref="stockModalRef"
      :open="showStockModal"
      :medicine="stockMedicine"
      @update:open="showStockModal = $event"
      @adjust="handleStockAdjust"
    />
  </div>
</template>
