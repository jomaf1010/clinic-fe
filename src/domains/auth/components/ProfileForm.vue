<script setup lang="ts">
import { computed, ref } from 'vue'
import { useForm, useField } from 'vee-validate'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { HttpError } from '@/lib/http'
import { toast } from 'vue-sonner'
import DateOfBirthPicker from '@/components/DateOfBirthPicker.vue'
import NameForm from '@/components/NameForm.vue'
import PhoneVerifyDialog from './PhoneVerifyDialog.vue'
import { User, Mail, Phone, CalendarDays, LoaderCircle, ShieldCheck } from 'lucide-vue-next'
import { useAuthStore } from '../stores/authStore'
import { authApi } from '../api/authApi'
import { updateProfileSchema } from '@/lib/validationRules'
import type { ValidationError } from '../types/auth.types'
import type { PatientName } from '@/domains/patient/types/patient.types'

const authStore = useAuthStore()

const { handleSubmit, setFieldError } = useForm({
  validationSchema: updateProfileSchema,
  initialValues: {
    title_prefix: authStore.user?.title_prefix ?? '',
    date_of_birth: authStore.user?.date_of_birth ?? '',
  },
})

const name = ref<PatientName | null>(
  authStore.user?.first_name ? {
    first_name: authStore.user.first_name,
    middle_name: authStore.user.middle_name,
    last_name: authStore.user.last_name ?? '',
    suffix: authStore.user.suffix,
  } : null
)

const { value: titlePrefix } = useField<string>('title_prefix')
const { value: dateOfBirth, errorMessage: dateOfBirthError } = useField<string>('date_of_birth')

const isLoading = ref(false)
const generalError = ref<string | null>(null)

const phoneDialogOpen = ref(false)
const phoneDialogMode = ref<'add' | 'change'>('add')

const phoneVerified = computed<boolean>(() => authStore.user?.contact_number_verified === true)
const hasPhone = computed<boolean>(() => !!authStore.user?.contact_number)

function openAddPhone(): void {
  phoneDialogMode.value = 'add'
  phoneDialogOpen.value = true
}

function openChangePhone(): void {
  phoneDialogMode.value = 'change'
  phoneDialogOpen.value = true
}

const onSubmit = handleSubmit(async (values) => {
  generalError.value = null

  if (!name.value?.first_name || !name.value?.last_name) {
    generalError.value = 'Please enter first and last name.'
    return
  }

  isLoading.value = true
  try {
    await authApi.updateProfile({
      first_name: name.value.first_name,
      middle_name: name.value.middle_name,
      last_name: name.value.last_name,
      suffix: name.value.suffix,
      title_prefix: values.title_prefix && values.title_prefix !== 'none' ? values.title_prefix : null,
      date_of_birth: values.date_of_birth || null,
    })
    await authStore.fetchUser()
    toast.success('Profile updated successfully.')
  } catch (err) {
    if (err instanceof HttpError && err.status === 422) {
      const body = err.data as ValidationError
      for (const [field, messages] of Object.entries(body.errors ?? {})) {
        setFieldError(field as keyof typeof updateProfileSchema, messages[0])
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
        <User class="size-4 text-muted-foreground" />
        <CardTitle class="text-base">Personal Information</CardTitle>
      </div>
      <CardDescription>Update your name and contact details</CardDescription>
    </CardHeader>

    <CardContent>
      <form id="profile-form" class="flex flex-col gap-5" novalidate @submit.prevent="onSubmit">
        <div v-if="generalError" role="alert" class="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          {{ generalError }}
        </div>

        <!-- Row 1: Name fields (full width) -->
        <div class="flex flex-col gap-2">
          <Label class="flex items-center gap-1.5">
            <User class="size-3.5 text-muted-foreground" />
            Name
          </Label>
          <NameForm v-model="name" :disabled="isLoading" />
        </div>

        <!-- Row 2: Title prefix + Email -->
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="flex flex-col gap-2">
            <Label class="flex items-center gap-1.5 text-xs text-muted-foreground">
              Title
              <span class="ml-auto text-xs font-normal text-muted-foreground">Optional</span>
            </Label>
            <Select v-model="titlePrefix" :disabled="isLoading">
              <SelectTrigger>
                <SelectValue placeholder="Select title" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="Dr.">Dr.</SelectItem>
                <SelectItem value="Dra.">Dra.</SelectItem>
                <SelectItem value="Prof.">Prof.</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="flex flex-col gap-2">
            <Label for="profile-email" class="flex items-center gap-1.5">
              <Mail class="size-3.5 text-muted-foreground" />
              Email address
            </Label>
            <Input id="profile-email" :model-value="authStore.user?.email ?? ''" type="email" disabled class="cursor-not-allowed opacity-60" />
            <p class="text-xs text-muted-foreground">Email cannot be changed here.</p>
          </div>
        </div>

        <!-- Row 3: Phone (verified flow) + DOB -->
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="flex flex-col gap-2">
            <Label class="flex items-center gap-1.5">
              <Phone class="size-3.5 text-muted-foreground" />
              Mobile number
            </Label>

            <div
              v-if="hasPhone && phoneVerified"
              class="flex flex-col gap-2 rounded-md border bg-muted/30 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div class="flex min-w-0 items-center gap-2">
                <span class="truncate text-sm font-medium">{{ authStore.user?.contact_number }}</span>
                <span class="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  <ShieldCheck class="size-3" />
                  Verified
                </span>
              </div>
              <button
                type="button"
                class="self-start text-sm text-primary underline-offset-4 hover:underline sm:self-auto"
                @click="openChangePhone"
              >
                Change
              </button>
            </div>

            <button
              v-else
              type="button"
              class="flex items-center justify-between gap-2 rounded-md border border-dashed bg-muted/20 px-3 py-2.5 text-left text-sm hover:bg-muted/40"
              @click="openAddPhone"
            >
              <span class="flex items-center gap-2 text-muted-foreground">
                <Phone class="size-4" />
                {{ hasPhone ? 'Verify phone number' : 'Add phone number' }}
              </span>
              <span class="text-xs font-medium text-primary">{{ hasPhone ? 'Verify' : 'Add' }}</span>
            </button>

            <p v-if="!hasPhone" class="text-xs text-muted-foreground">We verify your number by SMS.</p>
          </div>

          <div class="flex flex-col gap-2">
            <Label class="flex items-center gap-1.5">
              <CalendarDays class="size-3.5 text-muted-foreground" />
              Date of birth
              <span class="ml-auto text-xs font-normal text-muted-foreground">Optional</span>
            </Label>
            <DateOfBirthPicker v-model="dateOfBirth" :invalid="!!dateOfBirthError" />
            <p v-if="dateOfBirthError" class="text-xs text-destructive">{{ dateOfBirthError }}</p>
          </div>
        </div>
      </form>
    </CardContent>

    <Separator />

    <CardFooter class="flex flex-col items-stretch gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
      <p class="text-center text-xs text-muted-foreground sm:text-left">Changes are saved to your account immediately.</p>
      <Button type="submit" form="profile-form" size="sm" class="w-full sm:w-auto" :disabled="isLoading">
        <LoaderCircle v-if="isLoading" class="mr-2 size-3.5 animate-spin" />
        {{ isLoading ? 'Saving...' : 'Save changes' }}
      </Button>
    </CardFooter>

    <PhoneVerifyDialog
      v-model:open="phoneDialogOpen"
      :mode="phoneDialogMode"
      :current-phone="authStore.user?.contact_number ?? null"
    />
  </Card>
</template>
