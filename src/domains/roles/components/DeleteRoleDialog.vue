<script setup lang="ts">
import { ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { LoaderCircle, Trash2 } from 'lucide-vue-next'
import { roleApi } from '../api/roleApi'
import { HttpError } from '@/lib/http'
import type { ClinicRole } from '../types/role.types'

const props = defineProps<{
  open: boolean
  role: ClinicRole | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  deleted: []
}>()

const isLoading = ref(false)
const error = ref<string | null>(null)

watch(
  () => props.open,
  (open) => {
    if (open) {
      error.value = null
    }
  },
)

async function handleDelete() {
  if (!props.role) return

  error.value = null
  isLoading.value = true

  try {
    await roleApi.remove(props.role.id)
    emit('deleted')
    emit('update:open', false)
  } catch (err) {
    if (err instanceof HttpError) {
      if (err.status === 422) {
        const body = err.data as { message?: string; errors?: Record<string, string[]> }
        const roleErrors = body.errors?.role
        error.value = roleErrors?.[0] ?? body.message ?? 'Cannot delete this role.'
      } else {
        error.value = 'An unexpected error occurred. Please try again.'
      }
    } else {
      error.value = 'Unable to connect to the server. Please try again.'
    }
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="(val) => emit('update:open', val)">
    <DialogContent class="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>Delete Role</DialogTitle>
        <DialogDescription v-if="role">
          Are you sure you want to delete the "{{ role.name }}" role? This action cannot be undone.
        </DialogDescription>
      </DialogHeader>

      <div
        v-if="error"
        role="alert"
        class="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
      >
        {{ error }}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" :disabled="isLoading" @click="emit('update:open', false)">
          Cancel
        </Button>
        <Button variant="destructive" :disabled="isLoading" @click="handleDelete">
          <LoaderCircle v-if="isLoading" class="size-3.5 animate-spin" />
          <Trash2 v-else class="size-3.5" />
          {{ isLoading ? 'Deleting...' : 'Delete Role' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
