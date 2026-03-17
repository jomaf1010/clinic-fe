<script setup lang="ts">
import { ref, watch } from 'vue'
import { useForm, useField } from 'vee-validate'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ShieldCheck, LoaderCircle } from 'lucide-vue-next'
import { teamApi } from '../api/teamApi'
import { roleApi } from '@/domains/roles/api/roleApi'
import { HttpError } from '@/lib/http'
import type { TeamMember } from '../types/team.types'
import type { ClinicRole } from '@/domains/roles/types/role.types'

const props = defineProps<{
  open: boolean
  member: TeamMember | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  changed: []
}>()

const { handleSubmit, setFieldError, resetForm, setFieldValue } = useForm({
  validationSchema: {
    role: (val: string) => {
      if (!val || val.trim() === '') return 'Role is required.'
      return true
    },
  },
})

const { value: role, errorMessage: roleError } = useField<string>('role')

const isLoading = ref(false)
const generalError = ref<string | null>(null)
const availableRoles = ref<ClinicRole[]>([])
const rolesLoading = ref(false)

watch(
  () => props.open,
  async (open) => {
    if (open && props.member) {
      generalError.value = null
      resetForm()
      setFieldValue('role', props.member.role)
      rolesLoading.value = true
      try {
        const res = await roleApi.list()
        availableRoles.value = res.data
      } catch {
        availableRoles.value = []
      } finally {
        rolesLoading.value = false
      }
    }
  },
)

watch(
  () => props.member,
  (member) => {
    if (member && props.open) {
      setFieldValue('role', member.role)
    }
  },
)

const onSubmit = handleSubmit(async (values) => {
  if (!props.member) return

  generalError.value = null
  isLoading.value = true

  try {
    await teamApi.changeRole(props.member.id, {
      role: values.role as string,
    })

    emit('changed')
    emit('update:open', false)
  } catch (err) {
    if (err instanceof HttpError) {
      if (err.status === 422) {
        const body = err.data as { message: string; errors?: Record<string, string[]> }
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

function getMemberDisplayName(member: TeamMember): string {
  return member.user?.name ?? member.user?.email ?? member.invited_email ?? 'this member'
}
</script>

<template>
  <Dialog :open="open" @update:open="(val) => emit('update:open', val)">
    <DialogContent class="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>Change Role</DialogTitle>
        <DialogDescription v-if="member">
          Update the role for {{ getMemberDisplayName(member) }}.
        </DialogDescription>
      </DialogHeader>

      <form class="flex flex-col gap-4" novalidate @submit.prevent="onSubmit">
        <div
          v-if="generalError"
          role="alert"
          class="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
        >
          {{ generalError }}
        </div>

        <div class="flex flex-col gap-2">
          <Label for="change_role" class="flex items-center gap-1.5">
            <ShieldCheck class="size-3.5 text-muted-foreground" />
            New role
          </Label>
          <Select v-model="role" :disabled="isLoading || rolesLoading">
            <SelectTrigger id="change_role" :aria-invalid="!!roleError">
              <SelectValue :placeholder="rolesLoading ? 'Loading roles...' : 'Select a role'" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="r in availableRoles" :key="r.slug" :value="r.slug">
                {{ r.name }}
              </SelectItem>
            </SelectContent>
          </Select>
          <p v-if="roleError" class="text-xs text-destructive">{{ roleError }}</p>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" :disabled="isLoading" @click="emit('update:open', false)">
            Cancel
          </Button>
          <Button type="submit" :disabled="isLoading">
            <LoaderCircle v-if="isLoading" class="size-3.5 animate-spin" />
            <ShieldCheck v-else class="size-3.5" />
            {{ isLoading ? 'Saving...' : 'Save Role' }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
