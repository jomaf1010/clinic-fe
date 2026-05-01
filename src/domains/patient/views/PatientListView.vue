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
  Phone,
  Mail,
  MapPin,
  CalendarDays,
  CheckCircle2,
  AlertTriangle,
  LayoutList,
  Grid3X3,
  RefreshCw,
  FlaskConical,
  FilePenLine,
  ClipboardCheck,
  ClipboardList,
  CalendarClock,
  Droplet,
  MapPinned,
  PhoneOff,
  Stethoscope,
  UserRoundPlus,
} from 'lucide-vue-next'
import PatientAvatar from '@/components/PatientAvatar.vue'
import { patientApi } from '../api/patientApi'
import { RouteNames } from '@/router/routeNames'
import PatientStatusBadge from '../components/PatientStatusBadge.vue'
import CreatePatientDialog from '../components/CreatePatientDialog.vue'
import PatientCompletenessRing from '../components/PatientCompletenessRing.vue'
import { calculatePatientProfileCompleteness } from '../utils/profileCompleteness'
import type { PatientResponse, PatientListFilters, PatientStatus, PatientSortField, SortDirection, PatientAttentionItem, PatientAttentionSummary } from '../types/patient.types'

const router = useRouter()
const route = useRoute()

const patients = ref<PatientResponse[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)
const attentionSummary = ref<PatientAttentionSummary | null>(null)
const isAttentionLoading = ref(false)
const attentionError = ref<string | null>(null)
const pagination = ref({
  page: 1,
  per_page: 10,
  total: 0,
  last_page: 1,
})

const currentPage = ref(Number(route.query.page) || 1)
const showCreateDialog = ref(false)
const viewMode = ref<'list' | 'grid'>('list')

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

const newPatientCount = computed(() => patients.value.filter((patient) => patient.status === 'new').length)

const missingContactCount = computed(() => patients.value.filter((patient) => !patient.contact_number).length)
const emailOnFileCount = computed(() => patients.value.filter((patient) => !!patient.email).length)
const addressOnFileCount = computed(() => patients.value.filter((patient) => !!patient.formatted_address).length)
const bloodTypeOnFileCount = computed(() => patients.value.filter((patient) => !!patient.blood_type).length)
const followUpReviewCount = computed(() => patients.value.filter((patient) => patient.status === 'returning').length)

const registrationQuality = computed(() => {
  if (patients.value.length === 0) return 0
  const completedChecks = patients.value.reduce((sum, patient) => {
    return sum
      + (patient.contact_number ? 1 : 0)
      + (patient.email ? 1 : 0)
      + (patient.date_of_birth ? 1 : 0)
      + (patient.formatted_address ? 1 : 0)
      + (patient.blood_type ? 1 : 0)
  }, 0)
  return Math.round((completedChecks / (patients.value.length * 5)) * 100)
})

const registryChecks = computed(() => [
  {
    label: 'Complete contact info',
    value: patients.value.length - missingContactCount.value,
    tone: missingContactCount.value === 0 ? 'good' : 'warning',
  },
  {
    label: 'Email on file',
    value: emailOnFileCount.value,
    tone: 'good',
  },
  {
    label: 'Date of birth',
    value: patients.value.filter((patient) => !!patient.date_of_birth).length,
    tone: 'good',
  },
  {
    label: 'Address on file',
    value: addressOnFileCount.value,
    tone: 'good',
  },
  {
    label: 'Blood type',
    value: bloodTypeOnFileCount.value,
    tone: bloodTypeOnFileCount.value === patients.value.length ? 'good' : 'warning',
  },
])

const attentionItems = computed(() => attentionSummary.value?.items ?? [])
const attentionCount = computed(() => attentionSummary.value?.counts.total ?? attentionItems.value.length)

const currentDateLabel = computed(() => {
  return new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
})

function formatDateOnly(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatAge(dateOfBirth: string): string {
  const birthDate = new Date(dateOfBirth)
  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDelta = today.getMonth() - birthDate.getMonth()
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1
  }

  if (age >= 3) return `${age}y`

  let totalMonths = (today.getFullYear() - birthDate.getFullYear()) * 12
    + today.getMonth()
    - birthDate.getMonth()
  if (today.getDate() < birthDate.getDate()) totalMonths -= 1
  totalMonths = Math.max(totalMonths, 0)

  const years = Math.floor(totalMonths / 12)
  const months = totalMonths % 12

  if (years === 0) return `${months}m`
  return months > 0 ? `${years}y${months}m` : `${years}y`
}

function formatSex(sex: string): string {
  const value = sex.toLowerCase()
  if (value.startsWith('f')) return 'Female'
  if (value.startsWith('m')) return 'Male'
  return sex
}

function maskContact(value: string | null): string {
  if (!value) return 'No phone'
  const last = value.slice(-3)
  return `09•• ••• •${last}`
}

function maskEmail(value: string | null): string {
  if (!value) return 'No email'
  const [name = '', domain] = value.split('@')
  if (!domain) return 'Email on file'
  return `${name.slice(0, 1)}•••@${domain}`
}

function contactCompleteness(patient: PatientResponse): string {
  if (patient.contact_number && patient.email) return 'Complete'
  if (patient.contact_number || patient.email) return 'Partial'
  return 'Missing'
}

function formatAttentionTime(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function attentionTone(item: PatientAttentionItem): string {
  if (item.type === 'pending_lab_order_today') return 'text-amber-700'
  return 'text-blue-700'
}

function profileCompleteness(patient: PatientResponse): number {
  return calculatePatientProfileCompleteness(patient)
}

async function fetchPatients() {
  isLoading.value = true
  error.value = null

  try {
    const response = await patientApi.list(currentPage.value, 10, filters.value)
    patients.value = response.data
    pagination.value = response.meta.pagination
  } catch (err) {
    console.error('[PatientListView] fetchPatients failed:', err)
    error.value = 'Failed to load patients. Please try again.'
  } finally {
    isLoading.value = false
  }
}

async function fetchAttentionSummary() {
  isAttentionLoading.value = true
  attentionError.value = null

  try {
    const response = await patientApi.attentionSummary(6)
    attentionSummary.value = response.data
  } catch (err) {
    console.error('[PatientListView] fetchAttentionSummary failed:', err)
    attentionError.value = 'Failed to load attention items.'
  } finally {
    isAttentionLoading.value = false
  }
}

async function refreshPatientData() {
  await Promise.all([
    fetchPatients(),
    fetchAttentionSummary(),
  ])
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

function setStatusFilter(val: unknown) {
  const v = String(val)
  if (v === 'all') {
    const { status: _, ...rest } = filters.value
    filters.value = rest
  } else {
    filters.value = { ...filters.value, status: v as PatientStatus }
  }
}

function setSexFilter(val: unknown) {
  const v = String(val)
  if (v === 'all') {
    const { sex: _, ...rest } = filters.value
    filters.value = rest
  } else {
    filters.value = { ...filters.value, sex: v }
  }
}

function setSortField(val: unknown) {
  const v = String(val) as PatientSortField
  filters.value = { ...filters.value, sort_by: v }
}

function setSortDir(val: unknown) {
  const v = String(val) as SortDirection
  filters.value = { ...filters.value, sort_dir: v }
}

function goToPatient(patientId: string) {
  router.push({ name: RouteNames.PATIENT_DETAIL, params: { id: patientId } })
}

function goToAttentionItem(item: PatientAttentionItem) {
  goToPatient(item.patient.id)
}

function onPatientCreated() {
  currentPage.value = 1
  router.replace({ query: buildQuery(1, filters.value) })
  refreshPatientData()
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
  refreshPatientData()
  if (route.query.create === '1') {
    showCreateDialog.value = true
    router.replace({ query: { ...route.query, create: undefined } })
  }
})
</script>

<template>
  <div class="grid flex-1 gap-6 pt-4 xl:grid-cols-[minmax(0,1fr)_340px]">
    <section class="flex min-w-0 flex-col gap-4">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-3">
            <h1 class="text-2xl font-semibold tracking-normal">Patients</h1>
            <Badge variant="secondary" class="rounded-full px-2.5 text-sm tabular-nums">
              {{ pagination.total }}
            </Badge>
          </div>
        </div>

        <Button class="w-full shrink-0 sm:w-auto" @click="showCreateDialog = true">
          <UserPlus class="size-4" />
          Add Patient
        </Button>
      </div>

      <div class="flex flex-col gap-3 xl:flex-row xl:items-center">
        <div class="relative min-w-0 flex-1">
          <Search class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            :model-value="searchQuery"
            aria-label="Find patients by name, phone, or barangay"
            placeholder="Find by name, phone, barangay..."
            class="h-10 pl-9"
            @update:model-value="onSearchInput"
          />
        </div>

        <div class="flex items-center gap-2">
          <Popover>
            <PopoverTrigger as-child>
              <Button variant="outline" class="relative h-10 shrink-0" aria-label="Filter patients">
                <Filter class="size-4" />
                Filters
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
                  <label class="text-xs text-muted-foreground">Sex</label>
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
                      <SelectItem value="last_name">Last Name</SelectItem>
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

          <Select :model-value="filters.sort_by ?? 'updated_at'" @update:model-value="setSortField">
            <SelectTrigger class="h-10 w-[132px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="updated_at">Last activity</SelectItem>
              <SelectItem value="created_at">Registered</SelectItem>
              <SelectItem value="full_name">Name</SelectItem>
              <SelectItem value="last_name">Last name</SelectItem>
            </SelectContent>
          </Select>

          <div class="surface-muted hidden items-center rounded-md border p-1 sm:flex">
            <Button
              :variant="viewMode === 'list' ? 'secondary' : 'ghost'"
              type="button"
              size="icon-sm"
              aria-label="List view"
              :aria-pressed="viewMode === 'list'"
              @click="viewMode = 'list'"
            >
              <LayoutList class="size-4" />
            </Button>
            <Button
              :variant="viewMode === 'grid' ? 'secondary' : 'ghost'"
              type="button"
              size="icon-sm"
              aria-label="Grid view"
              :aria-pressed="viewMode === 'grid'"
              @click="viewMode = 'grid'"
            >
              <Grid3X3 class="size-4" />
            </Button>
          </div>
        </div>
      </div>

      <div
        v-if="hasActiveFilters || filters.search"
        class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
      >
        <span>Active view:</span>
        <Badge v-if="filters.search" variant="secondary" class="rounded-full">
          Search: {{ filters.search }}
        </Badge>
        <Badge v-if="filters.status" variant="secondary" class="rounded-full">
          Status: {{ filters.status }}
        </Badge>
        <Badge v-if="filters.sex" variant="secondary" class="rounded-full">
          Sex: {{ filters.sex }}
        </Badge>
        <Button variant="ghost" size="sm" class="h-7 px-2 text-xs" @click="clearFilters">
          <X class="size-3" />
          Clear
        </Button>
      </div>

      <div class="surface-card hidden overflow-hidden rounded-xl md:grid md:grid-cols-2 xl:grid-cols-4">
        <div class="flex items-center gap-4 p-4">
          <span class="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-[0_12px_28px_rgba(37,99,235,0.24)]">
            <ClipboardList class="size-5" />
          </span>
          <div>
            <p class="text-xs text-muted-foreground">Total patients</p>
            <p class="text-2xl font-semibold tabular-nums">{{ pagination.total }}</p>
            <p class="text-xs text-muted-foreground">Across all statuses</p>
          </div>
        </div>
        <div class="flex items-center gap-4 p-4">
          <span class="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-[0_12px_28px_rgba(16,185,129,0.24)]">
            <UserRoundPlus class="size-5" />
          </span>
          <div>
            <p class="text-xs text-muted-foreground">New patients</p>
            <p class="text-2xl font-semibold tabular-nums">{{ newPatientCount }}</p>
            <p class="text-xs text-green-700">Status: new</p>
          </div>
        </div>
        <div class="flex items-center gap-4 p-4">
          <span class="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-[0_12px_28px_rgba(245,158,11,0.24)]">
            <PhoneOff class="size-5" />
          </span>
          <div>
            <p class="text-xs text-muted-foreground">Missing contact</p>
            <p class="text-2xl font-semibold tabular-nums">{{ missingContactCount }}</p>
            <p class="text-xs text-amber-700">Current page</p>
          </div>
        </div>
        <div class="flex items-center gap-4 p-4">
          <span class="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 text-white shadow-[0_12px_28px_rgba(139,92,246,0.24)]">
            <CalendarClock class="size-5" />
          </span>
          <div>
            <p class="text-xs text-muted-foreground">Returning</p>
            <p class="text-2xl font-semibold tabular-nums">{{ followUpReviewCount }}</p>
            <p class="text-xs text-muted-foreground">Needs review</p>
          </div>
        </div>
      </div>

      <!-- Loading skeleton -->
      <div v-if="isLoading" class="surface-card overflow-hidden rounded-xl">
        <Table class="min-w-[42rem] border-collapse">
          <TableHeader>
            <TableRow class="border-white/40 bg-white/40 hover:bg-white/40">
              <TableHead class="px-4 py-3.5 text-muted-foreground">Patient</TableHead>
              <TableHead class="hidden px-4 py-3.5 text-muted-foreground lg:table-cell">Age / Sex / DOB</TableHead>
              <TableHead class="hidden px-4 py-3.5 text-muted-foreground xl:table-cell">Location</TableHead>
              <TableHead class="hidden px-4 py-3.5 text-muted-foreground md:table-cell">Contact</TableHead>
              <TableHead class="hidden px-4 py-3.5 text-muted-foreground lg:table-cell">Last activity</TableHead>
              <TableHead class="px-4 py-3.5 text-muted-foreground">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="i in 8" :key="i" class="border-white/40">
              <TableCell class="px-4 py-4">
                <div class="flex items-center gap-3">
                  <Skeleton class="size-14 shrink-0 rounded-full" />
                  <div class="flex-1 space-y-1.5">
                    <Skeleton class="h-4 w-32" />
                    <Skeleton class="h-3 w-20" />
                  </div>
                </div>
              </TableCell>
              <TableCell class="hidden px-4 py-4 lg:table-cell"><Skeleton class="h-4 w-24" /></TableCell>
              <TableCell class="hidden px-4 py-4 xl:table-cell"><Skeleton class="h-4 w-32" /></TableCell>
              <TableCell class="hidden px-4 py-4 md:table-cell"><Skeleton class="h-4 w-28" /></TableCell>
              <TableCell class="hidden px-4 py-4 lg:table-cell"><Skeleton class="h-4 w-28" /></TableCell>
              <TableCell class="px-4 py-4"><Skeleton class="h-5 w-16 rounded-full" /></TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <!-- Error -->
      <div
        v-else-if="error"
        role="alert"
        class="surface-card rounded-xl bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
      >
        {{ error }}
        <Button variant="outline" size="sm" class="mt-2" @click="fetchPatients()">Try again</Button>
      </div>

      <!-- Empty -->
      <div
        v-else-if="patients.length === 0 && !hasActiveFilters && !filters.search"
        class="surface-card flex flex-1 flex-col items-center justify-center rounded-xl py-14 text-muted-foreground"
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
        class="surface-card flex flex-1 flex-col items-center justify-center rounded-xl py-14 text-muted-foreground"
      >
        <Search class="mb-3 size-10 opacity-50" />
        <p>No patients match your filters.</p>
        <Button variant="link" class="mt-2" @click="clearFilters">
          Clear filters
        </Button>
      </div>

      <!-- Data table -->
      <template v-else>
        <div v-if="viewMode === 'list'" class="surface-card overflow-hidden rounded-xl">
          <Table class="min-w-[42rem] border-collapse">
            <TableHeader>
              <TableRow class="border-white/40 bg-white/40 hover:bg-white/40">
                <TableHead class="px-4 py-3.5 text-muted-foreground">Patient</TableHead>
                <TableHead class="hidden px-4 py-3.5 text-muted-foreground lg:table-cell">Age / Sex / DOB</TableHead>
                <TableHead class="hidden px-4 py-3.5 text-muted-foreground xl:table-cell">Location</TableHead>
                <TableHead class="hidden px-4 py-3.5 text-muted-foreground md:table-cell">Contact</TableHead>
                <TableHead class="hidden px-4 py-3.5 text-muted-foreground lg:table-cell">Last activity</TableHead>
                <TableHead class="px-4 py-3.5 text-muted-foreground">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow
                v-for="patient in patients"
                :key="patient.id"
                class="cursor-pointer border-white/40 transition-colors hover:bg-white/35"
                @click="goToPatient(patient.id)"
              >
                <TableCell class="px-4 py-4">
                  <div class="flex items-center gap-3">
                    <PatientCompletenessRing :completeness="profileCompleteness(patient)">
                      <PatientAvatar
                        :avatar-url="patient.avatar_url"
                        :sex="patient.sex"
                        :name="patient.full_name"
                        class="size-12 ring-2 ring-background ring-offset-0"
                      />
                    </PatientCompletenessRing>
                    <div class="min-w-0">
                      <p class="truncate font-medium">{{ patient.full_name }}</p>
                      <p class="mt-1 flex items-center gap-1 text-xs text-muted-foreground md:hidden">
                        <MapPin class="size-3" />
                        {{ patient.formatted_address || 'No address' }}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell class="hidden px-4 py-4 lg:table-cell">
                  <div class="text-sm">
                    <p>{{ formatAge(patient.date_of_birth) }} · {{ formatSex(patient.sex) }}</p>
                    <p class="text-xs text-muted-foreground">{{ formatDateOnly(patient.date_of_birth) }}</p>
                  </div>
                </TableCell>
                <TableCell class="hidden px-4 py-4 xl:table-cell">
                  <div class="max-w-44 text-sm">
                    <p class="truncate">{{ patient.address?.barangay_name || 'No barangay' }}</p>
                    <p class="truncate text-xs text-muted-foreground">{{ patient.address?.city_name || patient.formatted_address || 'No city' }}</p>
                  </div>
                </TableCell>
                <TableCell class="hidden px-4 py-4 md:table-cell">
                  <div class="space-y-1 text-sm">
                    <p class="flex items-center gap-2">
                      <Phone class="size-3.5 text-muted-foreground" />
                      {{ maskContact(patient.contact_number) }}
                    </p>
                    <p
                      class="flex items-center gap-2 text-xs"
                      :class="contactCompleteness(patient) === 'Missing' ? 'text-amber-700' : 'text-green-700'"
                    >
                      <span class="size-1.5 rounded-full" :class="contactCompleteness(patient) === 'Missing' ? 'bg-amber-500' : 'bg-green-600'" />
                      {{ contactCompleteness(patient) }}
                    </p>
                    <p class="flex items-center gap-2 text-xs text-muted-foreground">
                      <Mail class="size-3.5" />
                      {{ maskEmail(patient.email) }}
                    </p>
                  </div>
                </TableCell>
                <TableCell class="hidden px-4 py-4 lg:table-cell">
                  <div class="text-sm">
                    <p>{{ formatDateOnly(patient.updated_at) }}</p>
                  </div>
                </TableCell>
                <TableCell class="px-4 py-4">
                  <PatientStatusBadge :status="patient.status" />
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        <div v-else class="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          <button
            v-for="patient in patients"
            :key="patient.id"
            type="button"
            class="surface-card rounded-xl p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md"
            @click="goToPatient(patient.id)"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="flex min-w-0 items-center gap-3">
                <PatientCompletenessRing :completeness="profileCompleteness(patient)">
                  <PatientAvatar
                    :avatar-url="patient.avatar_url"
                    :sex="patient.sex"
                    :name="patient.full_name"
                    class="size-12 ring-2 ring-background ring-offset-0"
                  />
                </PatientCompletenessRing>
                <div class="min-w-0">
                  <p class="truncate font-medium">{{ patient.full_name }}</p>
                  <p class="text-xs text-muted-foreground">
                    {{ formatAge(patient.date_of_birth) }} · {{ formatSex(patient.sex) }} · {{ formatDateOnly(patient.date_of_birth) }}
                  </p>
                </div>
              </div>
              <PatientStatusBadge :status="patient.status" />
            </div>

            <div class="mt-4 space-y-2 text-sm">
              <p class="flex items-center gap-2 text-muted-foreground">
                <MapPin class="size-3.5" />
                <span class="truncate">{{ patient.formatted_address || 'No address' }}</span>
              </p>
              <p class="flex items-center gap-2">
                <Phone class="size-3.5 text-muted-foreground" />
                {{ maskContact(patient.contact_number) }}
              </p>
              <p class="flex items-center gap-2 text-muted-foreground">
                <Mail class="size-3.5" />
                {{ maskEmail(patient.email) }}
              </p>
            </div>
          </button>
        </div>

        <div class="flex flex-col gap-3 text-sm text-muted-foreground lg:flex-row lg:items-center lg:justify-between">
          <p>
            Showing {{ ((pagination.page - 1) * pagination.per_page) + 1 }} to
            {{ Math.min(pagination.page * pagination.per_page, pagination.total) }}
            of {{ pagination.total }} patients
          </p>

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
        </div>
      </template>
    </section>

    <aside class="flex flex-col gap-4 xl:pt-1">
      <section class="surface-card space-y-4 rounded-xl p-5">
        <div class="flex items-center justify-between">
          <h2 class="flex items-center gap-2 text-lg font-semibold">
            <Stethoscope class="size-4 text-primary" />
            Today
          </h2>
          <Badge variant="secondary" class="rounded-full bg-amber-100 text-amber-700">
            {{ attentionCount }}
          </Badge>
        </div>

        <div class="space-y-3">
          <div class="flex items-center justify-between text-sm">
            <p class="font-medium">Needs attention</p>
            <Button
              variant="ghost"
              size="sm"
              class="h-7 px-1.5"
              aria-label="Refresh attention items"
              :disabled="isAttentionLoading"
              @click="fetchAttentionSummary"
            >
              <RefreshCw class="size-3.5" :class="{ 'animate-spin': isAttentionLoading }" />
            </Button>
          </div>

          <div v-if="isAttentionLoading" class="space-y-3">
            <div v-for="i in 3" :key="i" class="flex items-start gap-3 rounded-md px-1 py-1.5">
              <Skeleton class="mt-1 size-7 rounded-md" />
              <div class="min-w-0 flex-1 space-y-1.5">
                <Skeleton class="h-3.5 w-28" />
                <Skeleton class="h-3 w-40" />
              </div>
            </div>
          </div>

          <div
            v-else-if="attentionError"
            role="alert"
            class="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-xs text-destructive"
          >
            {{ attentionError }}
          </div>

          <div v-else-if="attentionItems.length" class="space-y-3">
            <button
              v-for="item in attentionItems"
              :key="item.id"
              type="button"
              class="surface-interactive flex w-full items-start gap-3 rounded-lg border border-transparent px-2 py-2 text-left text-sm hover:bg-muted/60"
              @click="goToAttentionItem(item)"
            >
              <span class="surface-muted mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border">
                <FlaskConical v-if="item.type === 'pending_lab_order_today'" class="size-4 text-amber-700" />
                <FilePenLine v-else class="size-4 text-blue-700" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="flex items-center justify-between gap-2">
                  <span class="truncate font-medium">{{ item.patient.full_name }}</span>
                  <span class="shrink-0 text-xs text-muted-foreground">{{ formatAttentionTime(item.occurred_at) }}</span>
                </span>
                <span class="mt-0.5 block truncate text-xs" :class="attentionTone(item)">
                  {{ item.title }}
                </span>
                <span class="block truncate text-xs text-muted-foreground">
                  {{ item.description }}
                </span>
              </span>
            </button>
          </div>
          <p v-else class="text-sm text-muted-foreground">No clinical attention items for today.</p>
        </div>
      </section>

      <section class="surface-card space-y-4 rounded-xl p-5">
        <h2 class="flex items-center gap-2 text-sm font-semibold">
          <ClipboardCheck class="size-4 text-primary" />
          Registration quality
        </h2>
        <div class="flex items-center gap-3">
          <div class="grid size-14 place-items-center rounded-full border-4 border-green-600 text-sm font-semibold text-green-700">
            {{ registrationQuality }}%
          </div>
          <div>
            <p class="text-sm font-medium">{{ registrationQuality >= 80 ? 'Good' : 'Needs cleanup' }}</p>
            <p class="text-xs text-muted-foreground">Current page</p>
          </div>
        </div>

        <div class="space-y-3">
          <div
            v-for="check in registryChecks"
            :key="check.label"
            class="flex items-center justify-between gap-3 text-sm"
          >
            <span class="flex min-w-0 items-center gap-2">
              <Phone v-if="check.label === 'Complete contact info' && check.tone === 'good'" class="size-4 shrink-0 text-green-600" />
              <PhoneOff v-else-if="check.label === 'Complete contact info'" class="size-4 shrink-0 text-amber-600" />
              <Mail v-else-if="check.label === 'Email on file'" class="size-4 shrink-0 text-green-600" />
              <CalendarDays v-else-if="check.label === 'Date of birth'" class="size-4 shrink-0 text-green-600" />
              <MapPinned v-else-if="check.label === 'Address on file'" class="size-4 shrink-0 text-green-600" />
              <Droplet v-else-if="check.label === 'Blood type' && check.tone === 'good'" class="size-4 shrink-0 text-green-600" />
              <Droplet v-else-if="check.label === 'Blood type'" class="size-4 shrink-0 text-amber-600" />
              <CheckCircle2 v-else-if="check.tone === 'good'" class="size-4 shrink-0 text-green-600" />
              <AlertTriangle v-else class="size-4 shrink-0 text-amber-600" />
              <span class="truncate text-muted-foreground">{{ check.label }}</span>
            </span>
            <span class="tabular-nums">{{ check.value }}</span>
          </div>
        </div>

        <div class="space-y-2 pt-2 text-xs text-muted-foreground">
          <p>Data as of {{ currentDateLabel }}</p>
          <Button variant="ghost" size="sm" class="h-7 px-0 text-primary" @click="refreshPatientData">
            <RefreshCw class="size-3.5" />
            Refresh
          </Button>
        </div>
      </section>
    </aside>

    <!-- Create Dialog -->
    <CreatePatientDialog
      :open="showCreateDialog"
      @update:open="showCreateDialog = $event"
      @created="onPatientCreated"
    />
  </div>
</template>
