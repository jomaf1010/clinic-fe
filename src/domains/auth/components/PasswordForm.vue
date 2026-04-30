<script setup lang="ts">
import { ref } from 'vue'
import { useForm, useField } from 'vee-validate'
import { Button } from '@/components/ui/button'
import { PasswordInput } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { HttpError } from '@/lib/http'
import { toast } from 'vue-sonner'
import { Lock, KeyRound, LoaderCircle } from 'lucide-vue-next'
import { authApi } from '../api/authApi'
import { changePasswordSchema } from '@/lib/validationRules'
import type { ValidationError } from '../types/auth.types'
import PasswordStrengthBar from './PasswordStrengthBar.vue'

const { handleSubmit, setFieldError, resetForm } = useForm({
  validationSchema: changePasswordSchema,
})

const { value: currentPassword, errorMessage: currentPasswordError } = useField<string>('current_password')
const { value: newPassword, errorMessage: newPasswordError } = useField<string>('new_password')
const { value: newPasswordConfirmation, errorMessage: newPasswordConfirmationError } = useField<string>('new_password_confirmation')

const isLoading = ref(false)
const generalError = ref<string | null>(null)

const onSubmit = handleSubmit(async (values) => {
  generalError.value = null

  if (values.new_password !== values.new_password_confirmation) {
    setFieldError('new_password_confirmation', 'Passwords do not match.')
    return
  }

  isLoading.value = true
  try {
    await authApi.changePassword({
      current_password: btoa(values.current_password),
      new_password: btoa(values.new_password),
      new_password_confirmation: btoa(values.new_password_confirmation),
    })
    toast.success('Password changed successfully.')
    resetForm()
  } catch (err) {
    if (err instanceof HttpError && err.status === 422) {
      const body = err.data as ValidationError
      for (const [field, messages] of Object.entries(body.errors ?? {})) {
        setFieldError(field, messages[0])
      }
      generalError.value = body.message ?? 'Validation failed.'
    } else {
      generalError.value = 'An unexpected error occurred. Please try again.'
    }
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <Card>
    <CardHeader>
      <div class="flex items-center gap-2">
        <Lock class="size-4 text-muted-foreground" />
        <CardTitle class="text-base">Password</CardTitle>
      </div>
      <CardDescription>Use a strong password you don't use elsewhere</CardDescription>
    </CardHeader>

    <CardContent>
      <form id="password-form" class="flex flex-col gap-5" novalidate @submit.prevent="onSubmit">
        <div v-if="generalError" role="alert" class="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          {{ generalError }}
        </div>

        <div class="flex flex-col gap-2">
          <Label for="current-password" class="flex items-center gap-1.5">
            <Lock class="size-3.5 text-muted-foreground" />
            Current password
          </Label>
          <PasswordInput id="current-password" v-model="currentPassword" placeholder="Enter your current password" autocomplete="current-password" :disabled="isLoading" :aria-invalid="!!currentPasswordError" />
          <p v-if="currentPasswordError" class="text-xs text-destructive">{{ currentPasswordError }}</p>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <div class="flex flex-col gap-2">
            <Label for="new-password" class="flex items-center gap-1.5">
              <KeyRound class="size-3.5 text-muted-foreground" />
              New password
            </Label>
            <PasswordInput id="new-password" v-model="newPassword" placeholder="Minimum 10 characters" autocomplete="new-password" :disabled="isLoading" :aria-invalid="!!newPasswordError" />
            <p v-if="newPasswordError" class="text-xs text-destructive">{{ newPasswordError }}</p>
            <PasswordStrengthBar :password="newPassword ?? ''" />
          </div>

          <div class="flex flex-col gap-2">
            <Label for="new-password-confirmation" class="flex items-center gap-1.5">
              <KeyRound class="size-3.5 text-muted-foreground" />
              Confirm new password
            </Label>
            <PasswordInput id="new-password-confirmation" v-model="newPasswordConfirmation" placeholder="Repeat your new password" autocomplete="new-password" :disabled="isLoading" :aria-invalid="!!newPasswordConfirmationError" />
            <p v-if="newPasswordConfirmationError" class="text-xs text-destructive">{{ newPasswordConfirmationError }}</p>
          </div>
        </div>
      </form>
    </CardContent>

    <Separator />

    <CardFooter class="flex flex-col items-stretch gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
      <p class="text-center text-xs text-muted-foreground sm:text-left">You'll remain logged in on this device after changing.</p>
      <Button type="submit" form="password-form" size="sm" class="w-full sm:w-auto" :disabled="isLoading">
        <LoaderCircle v-if="isLoading" class="mr-2 size-3.5 animate-spin" />
        {{ isLoading ? 'Updating...' : 'Update password' }}
      </Button>
    </CardFooter>
  </Card>
</template>
