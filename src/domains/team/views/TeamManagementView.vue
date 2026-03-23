<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import OnlineDot from '@/components/OnlineDot.vue'
import { Skeleton } from '@/components/ui/skeleton'
import {
  UsersRound,
  UserPlus,
  Filter,
  X,
  MoreHorizontal,
  Ban,
  UserX,
  ShieldCheck,
  Mail,
  CheckCircle2,
  Search,
} from 'lucide-vue-next'
import { teamApi } from '../api/teamApi'
import { roleApi } from '@/domains/roles/api/roleApi'
import { useAuthStore } from '@/domains/auth/stores/authStore'
import type { ClinicRole } from '@/domains/roles/types/role.types'
import InviteMemberDialog from '../components/InviteMemberDialog.vue'
import ChangeRoleDialog from '../components/ChangeRoleDialog.vue'
import RemoveMemberDialog from '../components/RemoveMemberDialog.vue'
import type { TeamMember } from '../types/team.types'

const authStore = useAuthStore()

const members = ref<TeamMember[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)

const statusFilter = ref<string>('all')
const roleFilter = ref<string>('all')

const hasActiveFilters = computed(() => statusFilter.value !== 'all' || roleFilter.value !== 'all')

const showInviteDialog = ref(false)
const showChangeRoleDialog = ref(false)
const showRemoveDialog = ref(false)
const selectedMember = ref<TeamMember | null>(null)

const clinicRoles = ref<ClinicRole[]>([])

const resendSuccessId = ref<string | null>(null)
const resendLoadingId = ref<string | null>(null)

async function fetchMembers() {
  isLoading.value = true
  error.value = null

  try {
    const params: { status?: string; role?: string } = {}
    if (statusFilter.value !== 'all') params.status = statusFilter.value
    if (roleFilter.value !== 'all') params.role = roleFilter.value

    const response = await teamApi.list(params)
    members.value = response.data
  } catch {
    error.value = 'Failed to load team members. Please try again.'
  } finally {
    isLoading.value = false
  }
}

function clearFilters() {
  statusFilter.value = 'all'
  roleFilter.value = 'all'
}

function openChangeRole(member: TeamMember) {
  selectedMember.value = member
  showChangeRoleDialog.value = true
}

function openRemove(member: TeamMember) {
  selectedMember.value = member
  showRemoveDialog.value = true
}

async function handleDisable(member: TeamMember) {
  try {
    await teamApi.disable(member.id)
    await fetchMembers()
  } catch {
    // silently fail — could show a toast here
  }
}

async function handleEnable(member: TeamMember) {
  try {
    await teamApi.enable(member.id)
    await fetchMembers()
  } catch {
    // silently fail
  }
}

async function handleResendInvite(member: TeamMember) {
  resendLoadingId.value = member.id
  resendSuccessId.value = null
  try {
    await teamApi.resendInvite(member.id)
    resendSuccessId.value = member.id
    setTimeout(() => {
      resendSuccessId.value = null
    }, 3000)
  } catch {
    // silently fail
  } finally {
    resendLoadingId.value = null
  }
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function getMemberName(member: TeamMember): string {
  return member.user?.name ?? member.user?.email ?? member.invited_email ?? 'Unknown'
}

function getMemberEmail(member: TeamMember): string | null {
  return member.user?.email ?? member.invited_email ?? null
}

function getStatusVariant(status: TeamMember['status']): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'active':
      return 'default'
    case 'pending':
      return 'secondary'
    case 'disabled':
      return 'outline'
    case 'removed':
      return 'destructive'
    default:
      return 'secondary'
  }
}

watch([statusFilter, roleFilter], () => {
  fetchMembers()
})

onMounted(async () => {
  fetchMembers()
  try {
    const res = await roleApi.list()
    clinicRoles.value = res.data
  } catch {
    // fallback — keep hardcoded roles
  }
})
</script>

<template>
  <div class="flex flex-1 flex-col gap-4 pt-4">
    <!-- Header -->
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div class="flex items-center gap-3">
        <h1 class="text-lg font-semibold">Team</h1>
        <Badge variant="secondary" class="text-xs">
          {{ members.length }}
        </Badge>
      </div>

      <div class="flex items-center gap-2">
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
          <PopoverContent class="w-52" align="end">
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
                <Select v-model="statusFilter">
                  <SelectTrigger>
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="disabled">Disabled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div class="flex flex-col gap-1.5">
                <label class="text-xs text-muted-foreground">Role</label>
                <Select v-model="roleFilter">
                  <SelectTrigger>
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem v-for="r in clinicRoles" :key="r.slug" :value="r.slug">
                      {{ r.name }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <Button
          v-if="authStore.hasPermission('team.manage')"
          class="shrink-0"
          @click="showInviteDialog = true"
        >
          <UserPlus class="size-4" />
          <span class="hidden sm:inline">Invite Member</span>
        </Button>
      </div>
    </div>

    <!-- Loading skeleton -->
    <div v-if="isLoading" class="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Member</TableHead>
            <TableHead class="hidden sm:table-cell">Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead class="hidden md:table-cell">Joined</TableHead>
            <TableHead class="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="i in 5" :key="i">
            <TableCell>
              <div class="flex items-center gap-3">
                <Skeleton class="size-8 shrink-0 rounded-full" />
                <div class="flex-1 space-y-1.5">
                  <Skeleton class="h-4 w-32" />
                  <Skeleton class="h-3 w-44" />
                </div>
              </div>
            </TableCell>
            <TableCell class="hidden sm:table-cell">
              <Skeleton class="h-5 w-20 rounded-full" />
            </TableCell>
            <TableCell>
              <Skeleton class="h-5 w-16 rounded-full" />
            </TableCell>
            <TableCell class="hidden md:table-cell">
              <Skeleton class="h-4 w-24" />
            </TableCell>
            <TableCell>
              <Skeleton class="h-7 w-7 rounded" />
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
      <Button variant="outline" size="sm" class="mt-2" @click="fetchMembers()">Try again</Button>
    </div>

    <!-- Empty (no members at all) -->
    <div
      v-else-if="members.length === 0 && !hasActiveFilters"
      class="flex flex-1 flex-col items-center justify-center py-12 text-muted-foreground"
    >
      <UsersRound class="mb-3 size-10 opacity-50" />
      <p>No team members yet.</p>
      <Button
        v-if="authStore.hasPermission('team.manage')"
        variant="link"
        class="mt-2"
        @click="showInviteDialog = true"
      >
        Invite your first team member
      </Button>
    </div>

    <!-- No results (with filters) -->
    <div
      v-else-if="members.length === 0"
      class="flex flex-1 flex-col items-center justify-center py-12 text-muted-foreground"
    >
      <Search class="mb-3 size-10 opacity-50" />
      <p>No members match your filters.</p>
      <Button variant="link" class="mt-2" @click="clearFilters">
        Clear filters
      </Button>
    </div>

    <!-- Data table -->
    <div v-else class="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Member</TableHead>
            <TableHead class="hidden sm:table-cell">Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead class="hidden md:table-cell">Joined</TableHead>
            <TableHead
              v-if="authStore.hasPermission('team.manage')"
              class="w-10"
            />
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="member in members" :key="member.id">
            <TableCell>
              <div class="flex items-center gap-3">
                <div class="relative shrink-0">
                  <Avatar class="size-8">
                    <AvatarImage v-if="member.user?.avatar_url" :src="member.user.avatar_url" :alt="getMemberName(member)" />
                    <AvatarFallback class="bg-primary/10 text-xs font-semibold text-primary">
                      {{ getInitials(getMemberName(member)) }}
                    </AvatarFallback>
                  </Avatar>
                  <OnlineDot v-if="member.status === 'active'" :user-id="member.user_id" />
                </div>
                <div class="min-w-0">
                  <p class="truncate font-medium">{{ getMemberName(member) }}</p>
                  <p v-if="getMemberEmail(member)" class="truncate text-xs text-muted-foreground">
                    {{ getMemberEmail(member) }}
                  </p>
                </div>
              </div>
            </TableCell>
            <TableCell class="hidden sm:table-cell">
              <Badge variant="secondary" class="capitalize">{{ member.role }}</Badge>
            </TableCell>
            <TableCell>
              <div class="flex items-center gap-2">
                <Badge :variant="getStatusVariant(member.status)" class="capitalize">
                  {{ member.status }}
                </Badge>
                <CheckCircle2
                  v-if="resendSuccessId === member.id"
                  class="size-3.5 text-green-600"
                />
              </div>
            </TableCell>
            <TableCell class="hidden md:table-cell">
              <span class="text-sm text-muted-foreground">{{ formatDate(member.created_at) }}</span>
            </TableCell>
            <TableCell v-if="authStore.hasPermission('team.manage')">
              <DropdownMenu>
                <DropdownMenuTrigger as-child>
                  <Button variant="ghost" size="icon" class="size-7">
                    <MoreHorizontal class="size-4" />
                    <span class="sr-only">Member actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem @click="openChangeRole(member)">
                    <ShieldCheck class="mr-2 size-4" />
                    Change Role
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    v-if="member.status === 'active'"
                    @click="handleDisable(member)"
                  >
                    <Ban class="mr-2 size-4" />
                    Disable
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    v-if="member.status === 'disabled'"
                    @click="handleEnable(member)"
                  >
                    <CheckCircle2 class="mr-2 size-4" />
                    Enable
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    v-if="member.status === 'pending'"
                    :disabled="resendLoadingId === member.id"
                    @click="handleResendInvite(member)"
                  >
                    <Mail class="mr-2 size-4" />
                    {{ resendLoadingId === member.id ? 'Sending...' : 'Resend Invite' }}
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    class="text-destructive focus:text-destructive"
                    @click="openRemove(member)"
                  >
                    <UserX class="mr-2 size-4" />
                    Remove
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <!-- Dialogs -->
    <InviteMemberDialog
      :open="showInviteDialog"
      @update:open="showInviteDialog = $event"
      @invited="fetchMembers"
    />

    <ChangeRoleDialog
      :open="showChangeRoleDialog"
      :member="selectedMember"
      @update:open="showChangeRoleDialog = $event"
      @changed="fetchMembers"
    />

    <RemoveMemberDialog
      :open="showRemoveDialog"
      :member="selectedMember"
      @update:open="showRemoveDialog = $event"
      @removed="fetchMembers"
    />
  </div>
</template>
