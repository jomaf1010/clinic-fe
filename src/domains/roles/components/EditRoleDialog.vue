<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useForm, useField } from 'vee-validate'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { LoaderCircle, Save, ShieldAlert } from 'lucide-vue-next'
import { roleApi } from '../api/roleApi'
import { HttpError } from '@/lib/http'
import type { ValidationError } from '@/domains/auth/types/auth.types'
import type { ClinicRole, PermissionGroupMap } from '../types/role.types'

const props = defineProps<{
  open: boolean
  role: ClinicRole | null
  permissionGroups: PermissionGroupMap
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  updated: []
}>()

const { handleSubmit, setFieldError, resetForm, setFieldValue } = useForm({
  validationSchema: {
    name: (val: string) => {
      if (!val || val.trim() === '') return 'Name is required.'
      if (val.length > 50) return 'Name must be 50 characters or less.'
      return true
    },
  },
})

const { value: name, errorMessage: nameError } = useField<string>('name')

const isLoading = ref(false)
const generalError = ref<string | null>(null)
const selectedPermissions = ref<string[]>([])

const isOwner = computed(() => props.role?.slug === 'owner')
const isDefault = computed(() => props.role?.is_default === true)
const isNameDisabled = computed(() => isOwner.value || isDefault.value || isLoading.value)

const allPermissionKeys = computed(() => {
  const keys: string[] = []
  for (const group of Object.values(props.permissionGroups)) {
    for (const p of group.permissions) {
      keys.push(p.key)
    }
  }
  return keys
})

watch(
  () => props.open,
  (open) => {
    if (open && props.role) {
      generalError.value = null
      resetForm()
      setFieldValue('name', props.role.name)
      selectedPermissions.value = [...props.role.permissions]
    }
  },
)

function hasPermission(key: string): boolean {
  return selectedPermissions.value.includes(key)
}

function togglePermission(key: string) {
  if (isOwner.value) return
  if (hasPermission(key)) {
    selectedPermissions.value = selectedPermissions.value.filter((p) => p !== key)
  } else {
    selectedPermissions.value = [...selectedPermissions.value, key]
  }
}

function isGroupAllSelected(groupKey: string): boolean {
  const group = props.permissionGroups[groupKey]
  if (!group) return false
  return group.permissions.every((p) => hasPermission(p.key))
}

function toggleGroup(groupKey: string) {
  if (isOwner.value) return
  const group = props.permissionGroups[groupKey]
  if (!group) return
  const groupKeys = group.permissions.map((p) => p.key)
  if (isGroupAllSelected(groupKey)) {
    selectedPermissions.value = selectedPermissions.value.filter((p) => !groupKeys.includes(p))
  } else {
    const toAdd = groupKeys.filter((k) => !hasPermission(k))
    selectedPermissions.value = [...selectedPermissions.value, ...toAdd]
  }
}

const onSubmit = handleSubmit(async (values) => {
  if (!props.role || isOwner.value) return

  generalError.value = null
  isLoading.value = true

  try {
    await roleApi.update(props.role.id, {
      name: isDefault.value ? props.role.name : values.name,
      permissions: selectedPermissions.value,
    })

    emit('updated')
    emit('update:open', false)
  } catch (err) {
    if (err instanceof HttpError) {
      if (err.status === 422) {
        const body = err.data as ValidationError
        const serverErrors = body.errors ?? {}
        for (const [field, messages] of Object.entries(serverErrors)) {
          setFieldError(field, messages[0])
        }
        generalError.value = body.message ?? 'Validation failed.'
      } else if (err.status === 403) {
        generalError.value = 'You do not have permission to modify this role.'
      } else {
        generalError.value = 'An unexpected error occurred. Please try again.'
      }
    } else {
      generalError.value = 'Unable to connect to the server. Please try again.'
    }
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <Dialog :open="open" @update:open="(val) => emit('update:open', val)">
    <DialogContent class="sm:max-w-lg max-h-[85vh] flex flex-col">
      <DialogHeader>
        <DialogTitle>Edit Role</DialogTitle>
        <DialogDescription v-if="role">
          {{ isOwner ? 'The owner role has all permissions and cannot be modified.' : `Update permissions for ${role.name}.` }}
        </DialogDescription>
      </DialogHeader>

      <div v-if="isOwner" class="flex items-center gap-3 rounded-md border border-primary/20 bg-primary/5 p-3 text-sm">
        <ShieldAlert class="size-5 shrink-0 text-primary" />
        <p>The owner role automatically has all permissions and cannot be edited.</p>
      </div>

      <form v-else class="flex flex-col gap-4 overflow-hidden" novalidate @submit.prevent="onSubmit">
        <div
          v-if="generalError"
          role="alert"
          class="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
        >
          {{ generalError }}
        </div>

        <div class="flex flex-col gap-2">
          <Label for="edit_role_name">Role name</Label>
          <Input
            id="edit_role_name"
            v-model="name"
            :disabled="isNameDisabled"
            :aria-invalid="!!nameError"
          />
          <p v-if="isDefault" class="text-xs text-muted-foreground">Default role names cannot be changed.</p>
          <p v-if="nameError" class="text-xs text-destructive">{{ nameError }}</p>
        </div>

        <div class="flex flex-col gap-3 overflow-y-auto pr-1">
          <Label>Permissions ({{ selectedPermissions.length }} of {{ allPermissionKeys.length }})</Label>

          <div
            v-for="(group, groupKey) in permissionGroups"
            :key="groupKey"
            class="rounded-md border p-3"
          >
            <div class="flex items-center gap-2 mb-2">
              <Checkbox
                :id="`edit-group-${groupKey}`"
                :model-value="isGroupAllSelected(groupKey as string)"
                @update:model-value="toggleGroup(groupKey as string)"
              />
              <Label :for="`edit-group-${groupKey}`" class="text-sm font-medium cursor-pointer">
                {{ group.label }}
              </Label>
            </div>
            <div class="ml-6 flex flex-col gap-1.5">
              <div
                v-for="perm in group.permissions"
                :key="perm.key"
                class="flex items-center gap-2"
              >
                <Checkbox
                  :id="`edit-perm-${perm.key}`"
                  :model-value="hasPermission(perm.key)"
                  @update:model-value="togglePermission(perm.key)"
                />
                <Label :for="`edit-perm-${perm.key}`" class="text-sm font-normal cursor-pointer">
                  {{ perm.label }}
                </Label>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" :disabled="isLoading" @click="emit('update:open', false)">
            Cancel
          </Button>
          <Button type="submit" :disabled="isLoading">
            <LoaderCircle v-if="isLoading" class="size-3.5 animate-spin" />
            <Save v-else class="size-3.5" />
            {{ isLoading ? 'Saving...' : 'Save Changes' }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
