<script setup lang="ts">
import { ref } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { HttpError } from '@/lib/http'
import { toast } from 'vue-sonner'
import { Banknote, LoaderCircle } from 'lucide-vue-next'
import { useAuthStore } from '../stores/authStore'
import { authApi } from '../api/authApi'
import type { ValidationError } from '../types/auth.types'

const authStore = useAuthStore()

const consultationFee = ref(
  authStore.user?.consultation_fee != null ? String(authStore.user.consultation_fee) : '',
)
const followUpFee = ref(
  authStore.user?.follow_up_fee != null ? String(authStore.user.follow_up_fee) : '',
)
const isLoading = ref(false)
const error = ref<string | null>(null)
const fieldErrors = ref<Record<string, string>>({})

async function onSubmit() {
  error.value = null
  fieldErrors.value = {}
  isLoading.value = true

  try {
    await authApi.updateProfile({
      consultation_fee: consultationFee.value ? parseFloat(consultationFee.value) : null,
      follow_up_fee: followUpFee.value ? parseFloat(followUpFee.value) : null,
    })
    await authStore.fetchUser()
    toast.success('Billing settings updated successfully.')
  } catch (err) {
    if (err instanceof HttpError && err.status === 422) {
      const body = err.data as ValidationError
      for (const [field, messages] of Object.entries(body.errors ?? {})) {
        fieldErrors.value[field] = messages[0]
      }
      error.value = body.message ?? 'Validation failed.'
    } else {
      error.value = 'An unexpected error occurred. Please try again.'
    }
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <Card>
    <CardHeader>
      <div class="flex items-center gap-2">
        <Banknote class="size-4 text-muted-foreground" />
        <CardTitle class="text-base">Financial / Billing</CardTitle>
      </div>
      <CardDescription>Set your default professional fees. These will be used as defaults when processing consultation payments.</CardDescription>
    </CardHeader>

    <CardContent>
      <form id="billing-form" class="flex flex-col gap-4" novalidate @submit.prevent="onSubmit">
        <div v-if="error" role="alert" class="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          {{ error }}
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <div class="flex flex-col gap-2">
            <Label for="consultation-fee" class="flex items-center gap-1.5">
              <Banknote class="size-3.5 text-muted-foreground" />
              Consultation Fee (₱)
            </Label>
            <Input
              id="consultation-fee"
              v-model="consultationFee"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              :disabled="isLoading"
              :aria-invalid="!!fieldErrors.consultation_fee"
            />
            <p v-if="fieldErrors.consultation_fee" class="text-xs text-destructive">{{ fieldErrors.consultation_fee }}</p>
          </div>

          <div class="flex flex-col gap-2">
            <Label for="follow-up-fee" class="flex items-center gap-1.5">
              <Banknote class="size-3.5 text-muted-foreground" />
              Follow-up Fee (₱)
            </Label>
            <Input
              id="follow-up-fee"
              v-model="followUpFee"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              :disabled="isLoading"
              :aria-invalid="!!fieldErrors.follow_up_fee"
            />
            <p v-if="fieldErrors.follow_up_fee" class="text-xs text-destructive">{{ fieldErrors.follow_up_fee }}</p>
          </div>

        </div>
      </form>
    </CardContent>

    <Separator />

    <CardFooter class="flex flex-col items-stretch gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
      <p class="text-center text-xs text-muted-foreground sm:text-left">These fees are used as defaults for consultation payments.</p>
      <Button type="submit" form="billing-form" size="sm" class="w-full sm:w-auto" :disabled="isLoading">
        <LoaderCircle v-if="isLoading" class="mr-2 size-3.5 animate-spin" />
        {{ isLoading ? 'Saving...' : 'Save changes' }}
      </Button>
    </CardFooter>
  </Card>
</template>
