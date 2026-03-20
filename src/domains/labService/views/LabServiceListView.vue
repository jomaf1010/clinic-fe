<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { toast } from 'vue-sonner'
import {
  TestTubes,
  Plus,
  LoaderCircle,
  Search,
  Pencil,
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
import { labServiceApi } from '../api/labServiceApi'
import LabServiceFormModal from '../components/LabServiceFormModal.vue'
import type { ClinicLabService } from '../types/labService.types'

const labServices = ref<ClinicLabService[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)
const searchQuery = ref('')
const pagination = ref({ page: 1, per_page: 20, total: 0, last_page: 1 })
const currentPage = ref(1)

// Modal state
const showFormModal = ref(false)
const editingService = ref<ClinicLabService | null>(null)
const formModalRef = ref<InstanceType<typeof LabServiceFormModal> | null>(null)

let searchDebounce: ReturnType<typeof setTimeout> | null = null

async function fetchLabServices(page: number) {
  isLoading.value = true
  error.value = null
  try {
    const response = await labServiceApi.list(page, 20, searchQuery.value || undefined)
    labServices.value = response.data
    pagination.value = response.meta.pagination
  } catch {
    error.value = 'Failed to load lab services.'
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
    fetchLabServices(1)
  }, 300)
}

watch(currentPage, (page) => fetchLabServices(page))
onMounted(() => fetchLabServices(currentPage.value))

function openCreateModal() {
  editingService.value = null
  showFormModal.value = true
}

function openEditModal(service: ClinicLabService) {
  editingService.value = service
  showFormModal.value = true
}

async function handleFormSave(payload: { name: string; category?: string | null; price?: number | null }) {
  if (formModalRef.value) formModalRef.value.isSaving = true
  try {
    if (editingService.value) {
      await labServiceApi.update(editingService.value.id, payload)
      toast.success('Lab service updated')
    } else {
      await labServiceApi.create(payload)
      toast.success('Lab service added')
    }
    showFormModal.value = false
    fetchLabServices(currentPage.value)
  } catch {
    toast.error(editingService.value ? 'Failed to update lab service' : 'Failed to add lab service')
  } finally {
    if (formModalRef.value) formModalRef.value.isSaving = false
  }
}

const deactivateTarget = ref<ClinicLabService | null>(null)
const showDeactivateDialog = ref(false)
const isDeactivating = ref(false)

function confirmDeactivate(service: ClinicLabService) {
  deactivateTarget.value = service
  showDeactivateDialog.value = true
}

async function handleDeactivate() {
  if (!deactivateTarget.value) return
  isDeactivating.value = true
  try {
    await labServiceApi.deactivate(deactivateTarget.value.id)
    toast.success('Lab service deactivated')
    showDeactivateDialog.value = false
    fetchLabServices(currentPage.value)
  } catch {
    toast.error('Failed to deactivate lab service')
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
        <h1 class="text-lg font-semibold">Lab Services</h1>
        <Badge variant="secondary" class="text-xs">
          {{ pagination.total }}
        </Badge>
      </div>

      <div class="flex items-center gap-2">
        <div class="relative flex-1 sm:w-64 sm:flex-none">
          <Search class="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            :model-value="searchQuery"
            placeholder="Search lab services..."
            class="pl-8"
            @update:model-value="onSearchInput"
          />
        </div>

        <Button class="shrink-0" @click="openCreateModal">
          <Plus class="size-4" />
          <span class="hidden sm:inline">Add Lab Service</span>
        </Button>
      </div>
    </div>

    <!-- Loading skeleton -->
    <div v-if="isLoading" class="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Lab Service</TableHead>
            <TableHead class="hidden lg:table-cell">Category</TableHead>
            <TableHead class="hidden lg:table-cell">Price</TableHead>
            <TableHead class="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="i in 8" :key="i">
            <TableCell>
              <div class="space-y-1.5">
                <Skeleton class="h-4 w-48" />
                <Skeleton class="h-3 w-32" />
              </div>
            </TableCell>
            <TableCell class="hidden lg:table-cell"><Skeleton class="h-4 w-24" /></TableCell>
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
      <Button variant="outline" size="sm" class="mt-2" @click="fetchLabServices(currentPage)">Try again</Button>
    </div>

    <!-- Empty -->
    <div
      v-else-if="labServices.length === 0 && !searchQuery"
      class="flex flex-1 flex-col items-center justify-center py-12 text-muted-foreground"
    >
      <TestTubes class="mb-3 size-10 opacity-50" />
      <p>No lab services yet.</p>
      <p class="mt-1 text-xs">Lab services are auto-added when selected during lab order creation.</p>
      <Button variant="link" class="mt-2" @click="openCreateModal">
        Add manually
      </Button>
    </div>

    <!-- No results -->
    <div
      v-else-if="labServices.length === 0"
      class="flex flex-1 flex-col items-center justify-center py-12 text-muted-foreground"
    >
      <Search class="mb-3 size-10 opacity-50" />
      <p>No lab services match your search.</p>
    </div>

    <!-- Data table -->
    <template v-else>
      <div class="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lab Service</TableHead>
              <TableHead class="hidden lg:table-cell">Category</TableHead>
              <TableHead class="hidden lg:table-cell">Price</TableHead>
              <TableHead class="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow
              v-for="service in labServices"
              :key="service.id"
              class="cursor-pointer hover:bg-muted/50"
              @click="openEditModal(service)"
            >
              <TableCell>
                <div class="min-w-0">
                  <p class="font-medium">{{ service.name }}</p>
                  <div class="flex items-center gap-2">
                    <span v-if="service.category" class="text-xs text-muted-foreground lg:hidden">
                      {{ service.category }}
                    </span>
                    <span v-if="service.usage_count" class="text-xs text-muted-foreground">
                      {{ service.category ? '· ' : '' }}Ordered {{ service.usage_count }} {{ service.usage_count === 1 ? 'time' : 'times' }}
                    </span>
                  </div>
                </div>
              </TableCell>
              <TableCell class="hidden lg:table-cell">
                <span v-if="service.category" class="text-sm">{{ service.category }}</span>
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

    <!-- Deactivate Confirmation -->
    <Dialog v-model:open="showDeactivateDialog">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Deactivate Lab Service</DialogTitle>
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

    <!-- Form Modal -->
    <LabServiceFormModal
      ref="formModalRef"
      :open="showFormModal"
      :lab-service="editingService"
      @update:open="showFormModal = $event"
      @save="handleFormSave"
    />
  </div>
</template>
