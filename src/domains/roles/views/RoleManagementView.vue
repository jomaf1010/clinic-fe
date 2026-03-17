<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ShieldCheck,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  ShieldAlert,
} from 'lucide-vue-next'
import { roleApi } from '../api/roleApi'
import { useAuthStore } from '@/domains/auth/stores/authStore'
import CreateRoleDialog from '../components/CreateRoleDialog.vue'
import EditRoleDialog from '../components/EditRoleDialog.vue'
import DeleteRoleDialog from '../components/DeleteRoleDialog.vue'
import type { ClinicRole, PermissionGroupMap } from '../types/role.types'

const authStore = useAuthStore()

const roles = ref<ClinicRole[]>([])
const permissionGroups = ref<PermissionGroupMap>({})
const isLoading = ref(false)
const error = ref<string | null>(null)

const showCreateDialog = ref(false)
const showEditDialog = ref(false)
const showDeleteDialog = ref(false)
const selectedRole = ref<ClinicRole | null>(null)

const totalPermissionCount = computed(() => {
  let count = 0
  for (const group of Object.values(permissionGroups.value)) {
    count += group.permissions.length
  }
  return count
})

async function fetchData() {
  isLoading.value = true
  error.value = null

  try {
    const [rolesRes, permsRes] = await Promise.all([roleApi.list(), roleApi.permissions()])
    roles.value = rolesRes.data
    permissionGroups.value = permsRes.data
  } catch {
    error.value = 'Failed to load roles. Please try again.'
  } finally {
    isLoading.value = false
  }
}

async function handleCreated() {
  const res = await roleApi.list()
  roles.value = res.data
}

async function handleUpdated() {
  const res = await roleApi.list()
  roles.value = res.data
}

async function handleDeleted() {
  const res = await roleApi.list()
  roles.value = res.data
}

function openEdit(role: ClinicRole) {
  selectedRole.value = role
  showEditDialog.value = true
}

function openDelete(role: ClinicRole) {
  selectedRole.value = role
  showDeleteDialog.value = true
}

onMounted(() => {
  fetchData()
})
</script>

<template>
  <div class="flex flex-1 flex-col gap-4 pt-4">
    <!-- Header -->
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div class="flex items-center gap-3">
        <h1 class="text-lg font-semibold">Roles</h1>
        <Badge variant="secondary" class="text-xs">
          {{ roles.length }}
        </Badge>
      </div>

      <Button
        v-if="authStore.hasPermission('roles.manage')"
        class="shrink-0"
        @click="showCreateDialog = true"
      >
        <Plus class="size-4" />
        <span class="hidden sm:inline">Create Role</span>
      </Button>
    </div>

    <!-- Loading skeleton -->
    <div v-if="isLoading" class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      <Card v-for="i in 4" :key="i">
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <Skeleton class="h-5 w-24" />
          <Skeleton class="h-5 w-5 rounded" />
        </CardHeader>
        <CardContent>
          <Skeleton class="mb-2 h-4 w-20" />
          <Skeleton class="h-3 w-32" />
        </CardContent>
      </Card>
    </div>

    <!-- Error -->
    <div
      v-else-if="error"
      role="alert"
      class="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
    >
      {{ error }}
      <Button variant="outline" size="sm" class="mt-2" @click="fetchData()">Try again</Button>
    </div>

    <!-- Empty -->
    <div
      v-else-if="roles.length === 0"
      class="flex flex-1 flex-col items-center justify-center py-12 text-muted-foreground"
    >
      <ShieldAlert class="mb-3 size-10 opacity-50" />
      <p>No roles configured yet.</p>
    </div>

    <!-- Role grid -->
    <div v-else class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      <Card v-for="role in roles" :key="role.id">
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium flex items-center gap-2">
            <ShieldCheck class="size-4 text-muted-foreground" />
            {{ role.name }}
          </CardTitle>
          <div class="flex items-center gap-1.5">
            <Badge v-if="role.is_default" variant="outline" class="text-xs">
              Default
            </Badge>
            <DropdownMenu v-if="authStore.hasPermission('roles.manage') && role.slug !== 'owner'">
              <DropdownMenuTrigger as-child>
                <Button variant="ghost" size="icon" class="size-7">
                  <MoreHorizontal class="size-4" />
                  <span class="sr-only">Role actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem @click="openEdit(role)">
                  <Pencil class="mr-2 size-4" />
                  Edit
                </DropdownMenuItem>
                <template v-if="!role.is_default">
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    class="text-destructive focus:text-destructive"
                    @click="openDelete(role)"
                  >
                    <Trash2 class="mr-2 size-4" />
                    Delete
                  </DropdownMenuItem>
                </template>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent>
          <p class="text-xs text-muted-foreground mb-1">
            {{ role.slug }}
          </p>
          <p class="text-sm text-muted-foreground">
            {{ role.slug === 'owner' ? 'All' : role.permissions.length }} of {{ totalPermissionCount }} permissions
          </p>
        </CardContent>
      </Card>
    </div>

    <!-- Dialogs -->
    <CreateRoleDialog
      :open="showCreateDialog"
      :permission-groups="permissionGroups"
      @update:open="showCreateDialog = $event"
      @created="handleCreated"
    />

    <EditRoleDialog
      :open="showEditDialog"
      :role="selectedRole"
      :permission-groups="permissionGroups"
      @update:open="showEditDialog = $event"
      @updated="handleUpdated"
    />

    <DeleteRoleDialog
      :open="showDeleteDialog"
      :role="selectedRole"
      @update:open="showDeleteDialog = $event"
      @deleted="handleDeleted"
    />
  </div>
</template>
