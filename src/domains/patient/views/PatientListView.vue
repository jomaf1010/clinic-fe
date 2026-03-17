<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { Button } from '@/components/ui/button'
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Users,
  UserPlus,
  Filter,
  Search,
  X,
} from 'lucide-vue-next'
import { patientApi } from '../api/patientApi'
import { RouteNames } from '@/router/routeNames'
import PatientStatusBadge from '../components/PatientStatusBadge.vue'
import CreatePatientDialog from '../components/CreatePatientDialog.vue'
import type { PatientResponse, PatientListFilters, PatientStatus, PatientSortField, SortDirection } from '../types/patient.types'

const router = useRouter()
const route = useRoute()

const patients = ref<PatientResponse[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)
const pagination = ref({
  page: 1,
  per_page: 10,
  total: 0,
  last_page: 1,
})

const currentPage = ref(Number(route.query.page) || 1)
const showCreateDialog = ref(false)

function filtersFromQuery(): PatientListFilters {
  const q = route.query
  const f: PatientListFilters = {}
  if (q.status) f.status = q.status as PatientStatus
  if (q.sex) f.sex = q.sex as string
  if (q.search) f.search = q.search as string
  if (q.sort_by) f.sort_by = q.sort_by as PatientSortField
  if (q.sort_dir) f.sort_dir = q.sort_dir as SortDirection
  return f
}

const filters = ref<PatientListFilters>(filtersFromQuery())
const searchQuery = ref((route.query.search as string) || '')
let searchTimer: ReturnType<typeof setTimeout> | null = null

const hasActiveFilters = computed(() => !!filters.value.status || !!filters.value.sex || !!filters.value.sort_by || !!filters.value.sort_dir)

function getInitials(name: string): string {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  const date = d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })
  return `${time} / ${date}`
}

async function fetchPatients() {
  isLoading.value = true
  error.value = null

  try {
    const response = await patientApi.list(currentPage.value, 10, filters.value)
    patients.value = response.data
    pagination.value = response.meta.pagination
  } catch {
    error.value = 'Failed to load patients. Please try again.'
  } finally {
    isLoading.value = false
  }
}

function buildQuery(page: number, f: PatientListFilters) {
  const q: Record<string, string> = { page: String(page) }
  if (f.status) q.status = f.status
  if (f.sex) q.sex = f.sex
  if (f.search) q.search = f.search
  if (f.sort_by) q.sort_by = f.sort_by
  if (f.sort_dir) q.sort_dir = f.sort_dir
  return q
}

function goToPage(page: number) {
  if (page < 1 || page > pagination.value.last_page) return
  currentPage.value = page
  router.replace({ query: buildQuery(page, filters.value) })
}

function onSearchInput(value: string | number) {
  searchQuery.value = String(value)
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    filters.value = { ...filters.value, search: searchQuery.value || undefined }
  }, 300)
}

function clearFilters() {
  filters.value = {}
  searchQuery.value = ''
}

function setStatusFilter(val: any) {
  const v = String(val)
  if (v === 'all') {
    const { status: _, ...rest } = filters.value
    filters.value = rest
  } else {
    filters.value = { ...filters.value, status: v as PatientStatus }
  }
}

function setSexFilter(val: any) {
  const v = String(val)
  if (v === 'all') {
    const { sex: _, ...rest } = filters.value
    filters.value = rest
  } else {
    filters.value = { ...filters.value, sex: v }
  }
}

function setSortField(val: any) {
  const v = String(val) as PatientSortField
  filters.value = { ...filters.value, sort_by: v }
}

function setSortDir(val: any) {
  const v = String(val) as SortDirection
  filters.value = { ...filters.value, sort_dir: v }
}

function onPatientCreated() {
  currentPage.value = 1
  router.replace({ query: buildQuery(1, filters.value) })
  fetchPatients()
}

watch(currentPage, () => {
  fetchPatients()
})

watch(
  filters,
  (f) => {
    currentPage.value = 1
    router.replace({ query: buildQuery(1, f) })
    fetchPatients()
  },
  { deep: true },
)

onMounted(() => {
  fetchPatients()
  if (route.query.create === '1') {
    showCreateDialog.value = true
    router.replace({ query: { ...route.query, create: undefined } })
  }
})
</script>

<template>
  <div class="flex flex-1 flex-col gap-4 pt-4">
    <!-- Header -->
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div class="flex items-center gap-3">
        <h1 class="text-lg font-semibold">Patients</h1>
        <Badge variant="secondary" class="text-xs">
          {{ pagination.total }}
        </Badge>
      </div>

      <div class="flex items-center gap-2">
        <div class="relative flex-1 sm:w-64 sm:flex-none">
          <Search class="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            :model-value="searchQuery"
            placeholder="Search patients..."
            class="pl-8"
            @update:model-value="onSearchInput"
          />
        </div>

        <Popover>
          <PopoverTrigger as-child>
            <Button variant="outline" size="icon" class="relative shrink-0">
              <Filter class="size-4" />
              <span
                v-if="hasActiveFilters"
                class="absolute -right-1 -top-1 size-2 rounded-full bg-primary"
              />
            </Button>
          </PopoverTrigger>
          <PopoverContent class="w-56" align="end">
            <div class="flex flex-col gap-3">
              <div class="flex items-center justify-between">
                <p class="text-sm font-medium">Filters</p>
                <Button
                  v-if="hasActiveFilters"
                  variant="ghost"
                  size="sm"
                  class="h-auto px-1.5 py-0.5 text-xs"
                  @click="clearFilters"
                >
                  <X class="mr-1 size-3" />
                  Clear
                </Button>
              </div>

              <div class="flex flex-col gap-1.5">
                <label class="text-xs text-muted-foreground">Status</label>
                <Select :model-value="filters.status ?? 'all'" @update:model-value="setStatusFilter">
                  <SelectTrigger>
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="returning">Returning</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div class="flex flex-col gap-1.5">
                <label class="text-xs text-muted-foreground">Gender</label>
                <Select :model-value="filters.sex ?? 'all'" @update:model-value="setSexFilter">
                  <SelectTrigger>
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div class="flex flex-col gap-1.5">
                <label class="text-xs text-muted-foreground">Sort by</label>
                <Select :model-value="filters.sort_by ?? 'updated_at'" @update:model-value="setSortField">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="updated_at">Last Updated</SelectItem>
                    <SelectItem value="created_at">Date Registered</SelectItem>
                    <SelectItem value="full_name">Name</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div class="flex flex-col gap-1.5">
                <label class="text-xs text-muted-foreground">Order</label>
                <Select :model-value="filters.sort_dir ?? 'desc'" @update:model-value="setSortDir">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="desc">Newest first</SelectItem>
                    <SelectItem value="asc">Oldest first</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <Button class="shrink-0" @click="showCreateDialog = true">
          <UserPlus class="size-4" />
          <span class="hidden sm:inline">Add Patient</span>
        </Button>
      </div>
    </div>

    <!-- Loading skeleton -->
    <div v-if="isLoading" class="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Patient</TableHead>
            <TableHead class="hidden md:table-cell">Date Registered</TableHead>
            <TableHead class="hidden md:table-cell">Contact</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="i in 8" :key="i">
            <TableCell>
              <div class="flex items-center gap-3">
                <Skeleton class="size-8 shrink-0 rounded-full" />
                <div class="flex-1 space-y-1.5">
                  <Skeleton class="h-4 w-32" />
                  <Skeleton class="h-3 w-44" />
                </div>
              </div>
            </TableCell>
            <TableCell class="hidden md:table-cell">
              <Skeleton class="h-4 w-36" />
            </TableCell>
            <TableCell class="hidden md:table-cell">
              <div class="space-y-1.5">
                <Skeleton class="h-4 w-28" />
                <Skeleton class="h-3 w-36" />
              </div>
            </TableCell>
            <TableCell>
              <Skeleton class="h-5 w-16 rounded-full" />
            </TableCell>
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
      <Button variant="outline" size="sm" class="mt-2" @click="fetchPatients()">Try again</Button>
    </div>

    <!-- Empty -->
    <div
      v-else-if="patients.length === 0 && !hasActiveFilters && !filters.search"
      class="flex flex-1 flex-col items-center justify-center py-12 text-muted-foreground"
    >
      <Users class="mb-3 size-10 opacity-50" />
      <p>No patients yet.</p>
      <Button variant="link" class="mt-2" @click="showCreateDialog = true">
        Add your first patient
      </Button>
    </div>

    <!-- No results (with filters) -->
    <div
      v-else-if="patients.length === 0"
      class="flex flex-1 flex-col items-center justify-center py-12 text-muted-foreground"
    >
      <Search class="mb-3 size-10 opacity-50" />
      <p>No patients match your filters.</p>
      <Button variant="link" class="mt-2" @click="clearFilters">
        Clear filters
      </Button>
    </div>

    <!-- Data table -->
    <template v-else>
      <div class="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Patient</TableHead>
              <TableHead class="hidden md:table-cell">Date Registered</TableHead>
              <TableHead class="hidden md:table-cell">Contact</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow
              v-for="patient in patients"
              :key="patient.id"
              class="cursor-pointer hover:bg-muted/50"
              @click="router.push({ name: RouteNames.PATIENT_DETAIL, params: { id: patient.id } })"
            >
              <TableCell>
                <div class="flex items-center gap-3">
                  <div class="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {{ getInitials(patient.full_name) }}
                  </div>
                  <div class="min-w-0">
                    <p class="truncate font-medium">{{ patient.full_name }}</p>
                    <p class="truncate text-xs text-muted-foreground">{{ patient.address }}</p>
                  </div>
                </div>
              </TableCell>
              <TableCell class="hidden md:table-cell">
                <span class="text-sm text-muted-foreground">{{ formatDate(patient.created_at) }}</span>
              </TableCell>
              <TableCell class="hidden md:table-cell">
                <div v-if="patient.contact_number || patient.email" class="flex flex-col text-sm">
                  <span v-if="patient.contact_number">{{ patient.contact_number }}</span>
                  <span v-if="patient.email" class="text-muted-foreground">{{ patient.email }}</span>
                </div>
                <span v-else class="text-sm text-muted-foreground">&mdash;</span>
              </TableCell>
              <TableCell>
                <PatientStatusBadge :status="patient.status" />
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

    <!-- Create Dialog -->
    <CreatePatientDialog
      :open="showCreateDialog"
      @update:open="showCreateDialog = $event"
      @created="onPatientCreated"
    />
  </div>
</template>
