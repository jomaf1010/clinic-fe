<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { toast } from 'vue-sonner'
import {
  Pill,
  Plus,
  LoaderCircle,
  ChevronRight,
  ChevronLeft,
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
import { medicineApi } from '../api/medicineApi'
import MedicineFormModal from '../components/MedicineFormModal.vue'
import StockAdjustModal from '../components/StockAdjustModal.vue'
import type { ClinicMedicine, CreateMedicinePayload, UpdateMedicinePayload } from '../types/medicine.types'

const router = useRouter()
const route = useRoute()

const medicines = ref<ClinicMedicine[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)
const searchQuery = ref('')
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
  <div class="-mx-4 -mb-4 flex min-h-0 flex-1 flex-col gap-0 md:flex-row">
    <!-- Left panel -->
    <div class="flex shrink-0 flex-col gap-4 border-b p-4 md:w-64 md:gap-6 md:border-b-0 md:border-r md:p-6">
      <div class="flex items-center gap-3 md:block">
        <div class="flex size-10 items-center justify-center rounded-full bg-primary/10 md:mb-3">
          <Pill class="size-5 text-primary" />
        </div>
        <div>
          <h1 class="text-lg font-semibold">Medicines</h1>
          <p class="text-sm text-muted-foreground">
            {{ pagination.total }} medicine{{ pagination.total !== 1 ? 's' : '' }} in catalog
          </p>
        </div>
      </div>

      <Button class="w-full" @click="openCreateModal">
        <Plus class="size-4" />
        Add Medicine
      </Button>
    </div>

    <!-- Right panel -->
    <div class="flex flex-1 flex-col overflow-y-auto p-4 md:p-8">
      <!-- Search -->
      <div class="relative mb-4">
        <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <Search class="size-3.5 text-muted-foreground" />
        </div>
        <Input
          :model-value="searchQuery"
          placeholder="Search medicines..."
          class="pl-9"
          @update:model-value="onSearchInput"
        />
      </div>

      <div v-if="isLoading" class="flex flex-1 items-center justify-center py-12">
        <LoaderCircle class="size-6 animate-spin text-muted-foreground" />
      </div>

      <div
        v-else-if="error"
        role="alert"
        class="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
      >
        {{ error }}
        <Button variant="outline" size="sm" class="mt-2" @click="fetchMedicines(currentPage.value)">Try again</Button>
      </div>

      <div v-else-if="medicines.length === 0" class="flex flex-1 flex-col items-center justify-center py-12 text-muted-foreground">
        <Pill class="size-10 mb-3 opacity-50" />
        <p>{{ searchQuery ? 'No medicines found.' : 'No medicines yet.' }}</p>
        <Button v-if="!searchQuery" variant="link" class="mt-2" @click="openCreateModal">
          Add your first medicine
        </Button>
      </div>

      <template v-else>
        <div class="flex flex-col divide-y">
          <div
            v-for="medicine in medicines"
            :key="medicine.id"
            class="flex items-center gap-3 px-3 py-3"
          >
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span class="font-medium">{{ medicine.name }}</span>
                <span v-if="medicine.strength" class="text-sm text-muted-foreground">{{ medicine.strength }}</span>
              </div>
              <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                <span v-if="medicine.dosage_form">{{ medicine.dosage_form }}</span>
                <span v-if="medicine.generic_name" class="before:mr-2 before:content-['·']">{{ medicine.generic_name }}</span>
                <span v-if="medicine.default_price != null" class="before:mr-2 before:content-['·']">
                  &#8369;{{ medicine.default_price.toFixed(2) }}
                </span>
              </div>
            </div>

            <Badge
              v-if="medicine.inventory_enabled"
              variant="outline"
              class="shrink-0"
              :class="medicine.stock_quantity > 0
                ? 'border-green-300 bg-green-100 text-green-700 dark:border-green-700 dark:bg-green-950 dark:text-green-400'
                : 'border-red-300 bg-red-100 text-red-700 dark:border-red-700 dark:bg-red-950 dark:text-red-400'"
            >
              {{ medicine.stock_quantity }} in stock
            </Badge>

            <DropdownMenu>
              <DropdownMenuTrigger as-child>
                <button
                  type="button"
                  :aria-label="`${medicine.name} options`"
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
          </div>
        </div>

        <div v-if="pagination.last_page > 1" class="mt-6 flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" :disabled="currentPage <= 1" @click="goToPage(currentPage - 1)">
            <ChevronLeft class="size-4" />
            Previous
          </Button>
          <span class="px-3 text-sm text-muted-foreground">
            Page {{ currentPage }} of {{ pagination.last_page }}
          </span>
          <Button variant="outline" size="sm" :disabled="currentPage >= pagination.last_page" @click="goToPage(currentPage + 1)">
            Next
            <ChevronRight class="size-4" />
          </Button>
        </div>
      </template>
    </div>

    <!-- Deactivate Confirmation -->
    <Dialog v-model:open="showDeactivateDialog">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Deactivate Medicine</DialogTitle>
          <DialogDescription>
            Are you sure you want to deactivate <strong>{{ deactivateTarget?.name }}</strong>?
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
