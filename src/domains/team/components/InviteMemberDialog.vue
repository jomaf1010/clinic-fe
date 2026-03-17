<script setup lang="ts">
import { ref, watch } from 'vue'
import { useForm, useField } from 'vee-validate'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { Mail, Shield, LoaderCircle, UserPlus } from 'lucide-vue-next'
import { teamApi } from '../api/teamApi'
import { roleApi } from '@/domains/roles/api/roleApi'
import { HttpError } from '@/lib/http'
import type { ValidationError } from '@/domains/auth/types/auth.types'
import type { ClinicRole } from '@/domains/roles/types/role.types'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  invited: []
}>()

const { handleSubmit, setFieldError, resetForm } = useForm({
  validationSchema: {
    email: (val: string) => {
      if (!val || val.trim() === '') return 'Email is required.'
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return 'Must be a valid email address.'
      return true
    },
    role: (val: string) => {
      if (!val || val.trim() === '') return 'Role is required.'
      return true
    },
  },
})

const { value: email, errorMessage: emailError } = useField<string>('email')
const { value: role, errorMessage: roleError } = useField<string>('role')

const isLoading = ref(false)
const generalError = ref<string | null>(null)
const availableRoles = ref<ClinicRole[]>([])
const rolesLoading = ref(false)

watch(
  () => props.open,
  async (open) => {
    if (open) {
      generalError.value = null
      resetForm()
      rolesLoading.value = true
      try {
        const res = await roleApi.list()
        availableRoles.value = res.data.filter((r) => r.slug !== 'owner')
      } catch {
        // fallback — will show empty select
        availableRoles.value = []
      } finally {
        rolesLoading.value = false
      }
    }
  },
)

const onSubmit = handleSubmit(async (values) => {
  generalError.value = null
  isLoading.value = true

  try {
    await teamApi.invite({
      email: values.email,
      role: values.role as string,
    })

    resetForm()
    emit('invited')
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
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Invite Team Member</DialogTitle>
        <DialogDescription>Send an invitation to join your clinic.</DialogDescription>
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
          <Label for="invite_email" class="flex items-center gap-1.5">
            <Mail class="size-3.5 text-muted-foreground" />
            Email address
          </Label>
          <Input
            id="invite_email"
            v-model="email"
            type="email"
            placeholder="colleague@example.com"
            :disabled="isLoading"
            :aria-invalid="!!emailError"
            required
          />
          <p v-if="emailError" class="text-xs text-destructive">{{ emailError }}</p>
        </div>

        <div class="flex flex-col gap-2">
          <Label for="invite_role" class="flex items-center gap-1.5">
            <Shield class="size-3.5 text-muted-foreground" />
            Role
          </Label>
          <Select v-model="role" :disabled="isLoading || rolesLoading">
            <SelectTrigger id="invite_role" :aria-invalid="!!roleError">
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
            <UserPlus v-else class="size-3.5" />
            {{ isLoading ? 'Sending...' : 'Send Invitation' }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
