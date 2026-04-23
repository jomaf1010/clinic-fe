<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { toast } from 'vue-sonner'
import {
  Stethoscope,
  Plus,
  LoaderCircle,
  Search,
  Pencil,
  EllipsisVertical,
  Ban,
  CornerDownLeft,
} from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { serviceApi } from '../api/serviceApi'
import type { ClinicService, SystemServiceResult } from '../types/service.types'
import { SERVICE_CATEGORIES, serviceCategoryLabel } from '../types/service.types'

const SPECIALTY_OPTIONS = [
  { value: 'family_medicine', label: 'Family Medicine' },
  { value: 'internal_medicine', label: 'Internal Medicine' },
  { value: 'pediatrics', label: 'Pediatrics' },
  { value: 'obgyn', label: 'OB-GYN' },
  { value: 'dentistry', label: 'Dentistry' },
  { value: 'ent', label: 'ENT' },
  { value: 'dermatology', label: 'Dermatology' },
  { value: 'general', label: 'General' },
] as const

type SpecialtyValue = (typeof SPECIALTY_OPTIONS)[number]['value']

function specialtyLabel(value: string): string {
  return SPECIALTY_OPTIONS.find((s) => s.value === value)?.label ?? value
}

// ─── List state ───────────────────────────────────────────────────────────────

const services = ref<ClinicService[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)
const searchQuery = ref('')
const filterCategory = ref('all')
const filterSpecialty = ref('all')
const pagination = ref({ page: 1, per_page: 20, total: 0, last_page: 1 })
const currentPage = ref(1)

let searchDebounce: ReturnType<typeof setTimeout> | null = null

async function fetchServices(page: number) {
  isLoading.value = true
  error.value = null
  try {
    const response = await serviceApi.list(page, 20, {
      q: searchQuery.value || undefined,
      category: filterCategory.value !== 'all' ? filterCategory.value : undefined,
      specialty: filterSpecialty.value !== 'all' ? filterSpecialty.value : undefined,
    })
    services.value = response.data
    pagination.value = response.meta.pagination
  } catch {
    error.value = 'Failed to load services.'
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
    fetchServices(1)
  }, 300)
}

function onFilterChange() {
  currentPage.value = 1
  fetchServices(1)
}

watch(currentPage, (page) => fetchServices(page))
onMounted(() => fetchServices(currentPage.value))
onUnmounted(() => {
  if (searchDebounce) clearTimeout(searchDebounce)
  if (nameSearchTimer) clearTimeout(nameSearchTimer)
})

// ─── Form modal state ─────────────────────────────────────────────────────────

const showFormModal = ref(false)
const editingService = ref<ClinicService | null>(null)
const isSaving = ref(false)

const form = ref({
  name: '',
  description: '',
  category: '',
  specialties: [] as string[],
  price: '',
})

// System service autocomplete
const systemResults = ref<SystemServiceResult[]>([])
const showDropdown = ref(false)
const highlightedIndex = ref(-1)
const isSearching = ref(false)
const dropdownRef = ref<HTMLElement | null>(null)
let nameSearchTimer: ReturnType<typeof setTimeout> | null = null

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

  if (nameSearchTimer) clearTimeout(nameSearchTimer)
  const q = form.value.name.trim()
  if (q.length < 2 || editingService.value) {
    systemResults.value = []
    showDropdown.value = false
    return
  }

  showDropdown.value = true
  highlightedIndex.value = 0

  nameSearchTimer = setTimeout(async () => {
    isSearching.value = true
    try {
      const [systemRes, clinicRes] = await Promise.all([
        serviceApi.searchSystem(q),
        serviceApi.list(1, 100, { q }),
      ])

      const clinicNames = new Set(
        clinicRes.data.map((s) => s.name.toLowerCase()),
      )

      systemResults.value = systemRes.data.filter(
        (item) => !clinicNames.has(item.name.toLowerCase()),
      )
    } finally {
      isSearching.value = false
    }
  }, 300)
}

function selectSystemItem(item: SystemServiceResult) {
  form.value.name = item.name
  form.value.description = item.description ?? ''
  form.value.category = item.category ?? ''
  form.value.specialties = item.specialties.filter((s): s is SpecialtyValue =>
    SPECIALTY_OPTIONS.some((o) => o.value === s),
  )
  // Leave price empty — user sets it
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

function toggleSpecialty(value: string) {
  const idx = form.value.specialties.indexOf(value)
  if (idx === -1) {
    form.value.specialties.push(value)
  } else {
    form.value.specialties.splice(idx, 1)
  }
}

function openCreateModal() {
  editingService.value = null
  form.value = { name: '', description: '', category: '', specialties: [], price: '' }
  systemResults.value = []
  showDropdown.value = false
  showFormModal.value = true
}

function openEditModal(service: ClinicService) {
  editingService.value = service
  form.value = {
    name: service.name,
    description: service.description ?? '',
    category: service.category ?? '',
    specialties: [...service.specialties],
    price: service.price != null ? String(service.price) : '',
  }
  systemResults.value = []
  showDropdown.value = false
  showFormModal.value = true
}

async function handleFormSubmit() {
  if (!form.value.name.trim() || !form.value.category) return
  isSaving.value = true
  try {
    if (editingService.value) {
      await serviceApi.update(editingService.value.id, {
        name: form.value.name.trim(),
        description: form.value.description.trim() || null,
        category: form.value.category,
        specialties: form.value.specialties,
        price: form.value.price ? parseFloat(form.value.price) : null,
      })
      toast.success('Service updated')
    } else {
      await serviceApi.create({
        name: form.value.name.trim(),
        description: form.value.description.trim() || null,
        category: form.value.category,
        specialties: form.value.specialties,
        price: form.value.price ? parseFloat(form.value.price) : null,
      })
      toast.success('Service added')
    }
    showFormModal.value = false
    fetchServices(currentPage.value)
  } catch {
    toast.error(editingService.value ? 'Failed to update service' : 'Failed to add service')
  } finally {
    isSaving.value = false
  }
}

// ─── Deactivate ───────────────────────────────────────────────────────────────

const deactivateTarget = ref<ClinicService | null>(null)
const showDeactivateDialog = ref(false)
const isDeactivating = ref(false)

function confirmDeactivate(service: ClinicService) {
  deactivateTarget.value = service
  showDeactivateDialog.value = true
}

async function handleDeactivate() {
  if (!deactivateTarget.value) return
  isDeactivating.value = true
  try {
    await serviceApi.deactivate(deactivateTarget.value.id)
    toast.success('Service deactivated')
    showDeactivateDialog.value = false
    fetchServices(currentPage.value)
  } catch {
    toast.error('Failed to deactivate service')
  } finally {
    isDeactivating.value = false
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const isFormValid = computed(
  () => form.value.name.trim().length > 0 && form.value.category.length > 0,
)

const hasActiveFilters = computed(
  () => filterCategory.value !== 'all' || filterSpecialty.value !== 'all',
)

function clearFilters() {
  filterCategory.value = 'all'
  filterSpecialty.value = 'all'
  onFilterChange()
}
</script>

<template>
  <div class="flex flex-1 flex-col gap-4">
    <!-- Header -->
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div class="flex items-center gap-3">
        <h1 class="text-lg font-semibold">Services</h1>
        <Badge variant="secondary" class="text-xs">
          {{ pagination.total }}
        </Badge>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <!-- Search -->
        <div class="relative flex-1 sm:w-64 sm:flex-none">
          <Search class="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            :model-value="searchQuery"
            placeholder="Search services..."
            class="pl-8"
            @update:model-value="onSearchInput"
          />
        </div>

        <!-- Category filter -->
        <Select
          :model-value="filterCategory"
          @update:model-value="(val) => { filterCategory = typeof val === 'string' ? val : 'all'; onFilterChange() }"
        >
          <SelectTrigger class="w-36 shrink-0">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            <SelectItem v-for="cat in SERVICE_CATEGORIES" :key="cat.value" :value="cat.value">
              {{ cat.label }}
            </SelectItem>
          </SelectContent>
        </Select>

        <!-- Specialty filter -->
        <Select
          :model-value="filterSpecialty"
          @update:model-value="(val) => { filterSpecialty = typeof val === 'string' ? val : 'all'; onFilterChange() }"
        >
          <SelectTrigger class="w-36 shrink-0">
            <SelectValue placeholder="Specialty" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All specialties</SelectItem>
            <SelectItem v-for="sp in SPECIALTY_OPTIONS" :key="sp.value" :value="sp.value">
              {{ sp.label }}
            </SelectItem>
          </SelectContent>
        </Select>

        <!-- Add button -->
        <Button class="shrink-0" @click="openCreateModal">
          <Plus class="size-4" />
          <span class="hidden sm:inline">Add Service</span>
        </Button>
      </div>
    </div>

    <!-- Active filter pills -->
    <div v-if="hasActiveFilters" class="flex flex-wrap items-center gap-2">
      <span class="text-xs text-muted-foreground">Filters:</span>
      <Badge
        v-if="filterCategory !== 'all'"
        variant="secondary"
        class="gap-1 text-xs"
      >
        {{ serviceCategoryLabel(filterCategory) }}
        <button
          type="button"
          class="ml-1 rounded hover:text-foreground"
          aria-label="Remove category filter"
          @click="filterCategory = 'all'; onFilterChange()"
        >
          &times;
        </button>
      </Badge>
      <Badge
        v-if="filterSpecialty !== 'all'"
        variant="secondary"
        class="gap-1 text-xs"
      >
        {{ specialtyLabel(filterSpecialty) }}
        <button
          type="button"
          class="ml-1 rounded hover:text-foreground"
          aria-label="Remove specialty filter"
          @click="filterSpecialty = 'all'; onFilterChange()"
        >
          &times;
        </button>
      </Badge>
      <Button variant="ghost" size="sm" class="h-6 px-2 text-xs" @click="clearFilters">
        Clear all
      </Button>
    </div>

    <!-- Loading skeleton -->
    <div v-if="isLoading" class="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Service</TableHead>
            <TableHead class="hidden md:table-cell">Category</TableHead>
            <TableHead class="hidden lg:table-cell">Specialties</TableHead>
            <TableHead class="hidden lg:table-cell">Price</TableHead>
            <TableHead class="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="i in 8" :key="i">
            <TableCell>
              <div class="space-y-1.5">
                <Skeleton class="h-4 w-48" />
                <Skeleton class="h-3 w-64" />
              </div>
            </TableCell>
            <TableCell class="hidden md:table-cell"><Skeleton class="h-5 w-20" /></TableCell>
            <TableCell class="hidden lg:table-cell">
              <div class="flex gap-1">
                <Skeleton class="h-5 w-16" />
                <Skeleton class="h-5 w-20" />
              </div>
            </TableCell>
            <TableCell class="hidden lg:table-cell"><Skeleton class="h-4 w-16" /></TableCell>
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
      <Button variant="outline" size="sm" class="mt-2" @click="fetchServices(currentPage)">Try again</Button>
    </div>

    <!-- Empty (no services at all) -->
    <div
      v-else-if="services.length === 0 && searchQuery === '' && !hasActiveFilters"
      class="flex flex-1 flex-col items-center justify-center py-12 text-muted-foreground"
    >
      <Stethoscope class="mb-3 size-10 opacity-50" />
      <p>No services yet.</p>
      <p class="mt-1 text-xs">Services are auto-added when selected during consultations or encounters.</p>
      <Button variant="link" class="mt-2" @click="openCreateModal">
        Add manually
      </Button>
    </div>

    <!-- No results (search/filter) -->
    <div
      v-else-if="services.length === 0"
      class="flex flex-1 flex-col items-center justify-center py-12 text-muted-foreground"
    >
      <Search class="mb-3 size-10 opacity-50" />
      <p>No services match your search.</p>
    </div>

    <!-- Data table -->
    <template v-else>
      <div class="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Service</TableHead>
              <TableHead class="hidden md:table-cell">Category</TableHead>
              <TableHead class="hidden lg:table-cell">Specialties</TableHead>
              <TableHead class="hidden lg:table-cell">Price</TableHead>
              <TableHead class="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow
              v-for="service in services"
              :key="service.id"
              class="cursor-pointer hover:bg-muted/50"
              @click="openEditModal(service)"
            >
              <TableCell>
                <div class="min-w-0">
                  <p class="font-medium">{{ service.name }}</p>
                  <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <!-- Description (if any) -->
                    <span
                      v-if="service.description"
                      class="max-w-xs truncate text-xs text-muted-foreground"
                    >
                      {{ service.description }}
                    </span>
                    <!-- Mobile: category + specialties inline -->
                    <span v-if="service.category" class="text-xs text-muted-foreground md:hidden">
                      {{ serviceCategoryLabel(service.category) }}
                    </span>
                    <span v-if="service.usage_count" class="text-xs text-muted-foreground">
                      {{ service.category || service.description ? '· ' : '' }}Ordered {{ service.usage_count }}
                      {{ service.usage_count === 1 ? 'time' : 'times' }}
                    </span>
                  </div>
                  <!-- Mobile specialties -->
                  <div v-if="service.specialties.length > 0" class="mt-1 flex flex-wrap gap-1 lg:hidden">
                    <Badge
                      v-for="sp in service.specialties"
                      :key="sp"
                      variant="outline"
                      class="text-[10px] px-1.5 py-0"
                    >
                      {{ specialtyLabel(sp) }}
                    </Badge>
                  </div>
                </div>
              </TableCell>
              <TableCell class="hidden md:table-cell">
                <Badge v-if="service.category" variant="secondary" class="text-xs font-normal">
                  {{ serviceCategoryLabel(service.category) }}
                </Badge>
                <span v-else class="text-sm text-muted-foreground">&mdash;</span>
              </TableCell>
              <TableCell class="hidden lg:table-cell">
                <div v-if="service.specialties.length > 0" class="flex flex-wrap gap-1">
                  <Badge
                    v-for="sp in service.specialties"
                    :key="sp"
                    variant="outline"
                    class="text-xs font-normal"
                  >
                    {{ specialtyLabel(sp) }}
                  </Badge>
                </div>
                <span v-else class="text-sm text-muted-foreground">&mdash;</span>
              </TableCell>
              <TableCell class="hidden lg:table-cell">
                <span v-if="service.price != null" class="text-sm">&#8369;{{ service.price.toFixed(2) }}</span>
                <span v-else class="text-sm text-muted-foreground">&mdash;</span>
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger as-child>
                    <button
                      type="button"
                      :aria-label="`${service.name} options`"
                      class="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                      @click.stop
                    >
                      <EllipsisVertical class="size-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" class="w-40">
                    <DropdownMenuItem @click="openEditModal(service)">
                      <Pencil class="size-3.5" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      class="text-destructive focus:text-destructive"
                      @click="confirmDeactivate(service)"
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

    <!-- Deactivate Confirmation Dialog -->
    <Dialog v-model:open="showDeactivateDialog">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Deactivate Service</DialogTitle>
          <DialogDescription>
            Are you sure you want to deactivate <strong>{{ deactivateTarget?.name }}</strong>?
            It will no longer appear in service selections.
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

    <!-- Create / Edit Form Modal -->
    <Dialog v-model:open="showFormModal">
      <DialogContent class="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{{ editingService ? 'Edit Service' : 'Add Service' }}</DialogTitle>
          <DialogDescription>
            {{ editingService ? 'Update service details.' : 'Add a new service to your clinic catalog.' }}
          </DialogDescription>
        </DialogHeader>

        <form class="flex flex-col gap-4" @submit.prevent="handleFormSubmit">
          <!-- Name with system autocomplete -->
          <div class="relative flex flex-col gap-1.5">
            <label class="text-xs text-muted-foreground" for="svc-name">Name *</label>
            <div class="relative">
              <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <LoaderCircle v-if="isSearching" class="size-3.5 animate-spin text-muted-foreground" />
                <Search v-else class="size-3.5 text-muted-foreground" />
              </div>
              <Input
                id="svc-name"
                :model-value="form.name"
                :placeholder="editingService ? '' : 'Search system or type name...'"
                class="pl-9"
                autocomplete="off"
                @update:model-value="onNameInput"
                @keydown="onNameKeydown"
                @blur="onNameBlur"
              />
            </div>

            <!-- Autocomplete dropdown -->
            <div
              v-if="showDropdown"
              ref="dropdownRef"
              class="absolute left-0 right-0 top-full z-50 mt-1 max-h-52 overflow-y-auto rounded-md border bg-popover shadow-md"
            >
              <!-- Add new (custom) option -->
              <button
                type="button"
                class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
                :class="highlightedIndex === 0 ? 'bg-primary/10 text-primary' : 'hover:bg-accent'"
                @mousedown.prevent="selectCustomName"
                @mouseenter="highlightedIndex = 0"
              >
                <Badge
                  variant="outline"
                  class="shrink-0 border-green-300 bg-green-50 text-[10px] text-green-700 dark:border-green-700 dark:bg-green-950 dark:text-green-400"
                >
                  Add new <CornerDownLeft class="ml-0.5 inline size-2.5" />
                </Badge>
                <span class="truncate font-medium">{{ form.name.trim() }}</span>
              </button>

              <!-- System results -->
              <button
                v-for="(item, idx) in systemResults"
                :key="item.name"
                type="button"
                class="flex w-full flex-col gap-0.5 px-3 py-2 text-left text-sm"
                :class="idx + 1 === highlightedIndex ? 'bg-primary/10 text-primary' : 'hover:bg-accent'"
                @mousedown.prevent="selectSystemItem(item)"
                @mouseenter="highlightedIndex = idx + 1"
              >
                <div class="flex items-center gap-2">
                  <span class="truncate font-medium">{{ item.name }}</span>
                  <span v-if="item.category" class="shrink-0 text-xs text-muted-foreground">
                    {{ serviceCategoryLabel(item.category) }}
                  </span>
                </div>
                <div v-if="item.specialties.length > 0" class="flex flex-wrap gap-1">
                  <Badge
                    v-for="sp in item.specialties.slice(0, 3)"
                    :key="sp"
                    variant="outline"
                    class="text-[10px] px-1.5 py-0"
                  >
                    {{ specialtyLabel(sp) }}
                  </Badge>
                  <span v-if="item.specialties.length > 3" class="text-[10px] text-muted-foreground">
                    +{{ item.specialties.length - 3 }} more
                  </span>
                </div>
              </button>
            </div>
          </div>

          <!-- Description -->
          <div class="flex flex-col gap-1.5">
            <label class="text-xs text-muted-foreground" for="svc-description">Description</label>
            <textarea
              id="svc-description"
              v-model="form.description"
              rows="2"
              placeholder="Brief description of the service..."
              class="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
            />
          </div>

          <!-- Category -->
          <div class="flex flex-col gap-1.5">
            <label class="text-xs text-muted-foreground" for="svc-category">Category *</label>
            <Select
              :model-value="form.category"
              @update:model-value="(val) => { form.category = typeof val === 'string' ? val : '' }"
            >
              <SelectTrigger id="svc-category">
                <SelectValue placeholder="Select category..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="cat in SERVICE_CATEGORIES" :key="cat.value" :value="cat.value">
                  {{ cat.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <!-- Specialties -->
          <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <span class="text-xs text-muted-foreground">Specialties</span>
              <span class="text-xs text-muted-foreground">
                {{ form.specialties.length > 0 ? `${form.specialties.length} selected` : 'None selected' }}
              </span>
            </div>
            <div class="grid grid-cols-2 gap-2 rounded-md border p-3 sm:grid-cols-3">
              <label
                v-for="sp in SPECIALTY_OPTIONS"
                :key="sp.value"
                class="flex cursor-pointer items-center gap-2 text-sm"
              >
                <Checkbox
                  :id="`svc-sp-${sp.value}`"
                  :model-value="form.specialties.includes(sp.value)"
                  @update:model-value="toggleSpecialty(sp.value)"
                />
                <span>{{ sp.label }}</span>
              </label>
            </div>
          </div>

          <!-- Price -->
          <div class="flex flex-col gap-1.5">
            <label class="text-xs text-muted-foreground" for="svc-price">Price</label>
            <div class="relative">
              <span class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm text-muted-foreground">
                &#8369;
              </span>
              <Input
                id="svc-price"
                v-model="form.price"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                class="pl-7"
              />
            </div>
          </div>

          <Separator />

          <DialogFooter class="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              :disabled="isSaving"
              @click="showFormModal = false"
            >
              Cancel
            </Button>
            <Button type="submit" :disabled="isSaving || !isFormValid">
              <LoaderCircle v-if="isSaving" class="size-3.5 animate-spin" />
              {{ editingService ? 'Save Changes' : 'Add Service' }}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </div>
</template>
