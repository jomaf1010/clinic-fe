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
import { LoaderCircle, Plus } from 'lucide-vue-next'
import { roleApi } from '../api/roleApi'
import { HttpError } from '@/lib/http'
import type { ValidationError } from '@/domains/auth/types/auth.types'
import type { PermissionGroupMap } from '../types/role.types'

const props = defineProps<{
  open: boolean
  permissionGroups: PermissionGroupMap
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  created: []
}>()

const { handleSubmit, setFieldError, resetForm } = useForm({
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
    if (open) {
      generalError.value = null
      resetForm()
      selectedPermissions.value = []
    }
  },
)

function hasPermission(key: string): boolean {
  return selectedPermissions.value.includes(key)
}

function togglePermission(key: string) {
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
  generalError.value = null
  isLoading.value = true

  try {
    await roleApi.create({
      name: values.name,
      permissions: selectedPermissions.value,
    })

    emit('created')
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
        <DialogTitle>Create Role</DialogTitle>
        <DialogDescription>Create a custom role with specific permissions.</DialogDescription>
      </DialogHeader>

      <form class="flex flex-col gap-4 overflow-hidden" novalidate @submit.prevent="onSubmit">
        <div
          v-if="generalError"
          role="alert"
          class="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
        >
          {{ generalError }}
        </div>

        <div class="flex flex-col gap-2">
          <Label for="role_name">Role name</Label>
          <Input
            id="role_name"
            v-model="name"
            placeholder="e.g. Nurse, Receptionist"
            :disabled="isLoading"
            :aria-invalid="!!nameError"
          />
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
                :id="`group-${groupKey}`"
                :model-value="isGroupAllSelected(groupKey as string)"
                @update:model-value="toggleGroup(groupKey as string)"
              />
              <Label :for="`group-${groupKey}`" class="text-sm font-medium cursor-pointer">
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
                  :id="`perm-${perm.key}`"
                  :model-value="hasPermission(perm.key)"
                  @update:model-value="togglePermission(perm.key)"
                />
                <Label :for="`perm-${perm.key}`" class="text-sm font-normal cursor-pointer">
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
            <Plus v-else class="size-3.5" />
            {{ isLoading ? 'Creating...' : 'Create Role' }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
