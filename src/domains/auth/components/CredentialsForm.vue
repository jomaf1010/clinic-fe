<script setup lang="ts">
import { ref } from 'vue'
import { useForm, useField } from 'vee-validate'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { HttpError } from '@/lib/http'
import { toast } from 'vue-sonner'
import { Stethoscope, BadgeCheck, LoaderCircle } from 'lucide-vue-next'
import { useAuthStore } from '../stores/authStore'
import { authApi } from '../api/authApi'
import { credentialsSchema } from '@/lib/validationRules'
import type { ValidationError } from '../types/auth.types'

const authStore = useAuthStore()

const { handleSubmit, setFieldError } = useForm({
  validationSchema: credentialsSchema,
  initialValues: {
    prc_license_number: authStore.user?.prc_license_number ?? '',
    ptr_number: authStore.user?.ptr_number ?? '',
    s2_license_number: authStore.user?.s2_license_number ?? '',
    specialty: authStore.user?.specialty ?? '',
    sub_specialty: authStore.user?.sub_specialty ?? '',
  },
})

const { value: prcLicenseNumber, errorMessage: prcLicenseNumberError } = useField<string>('prc_license_number')
const { value: ptrNumber, errorMessage: ptrNumberError } = useField<string>('ptr_number')
const { value: s2LicenseNumber, errorMessage: s2LicenseNumberError } = useField<string>('s2_license_number')
const { value: specialty, errorMessage: specialtyError } = useField<string>('specialty')
const { value: subSpecialty, errorMessage: subSpecialtyError } = useField<string>('sub_specialty')

const isLoading = ref(false)
const generalError = ref<string | null>(null)

const onSubmit = handleSubmit(async (values) => {
  generalError.value = null
  isLoading.value = true
  try {
    await authApi.updateProfile({
      name: authStore.user?.name ?? '',
      prc_license_number: values.prc_license_number || null,
      ptr_number: values.ptr_number || null,
      s2_license_number: values.s2_license_number || null,
      specialty: values.specialty || null,
      sub_specialty: values.sub_specialty || null,
    })
    await authStore.fetchUser()
    toast.success('Credentials updated successfully.')
  } catch (err) {
    if (err instanceof HttpError && err.status === 422) {
      const body = err.data as ValidationError
      for (const [field, messages] of Object.entries(body.errors ?? {})) {
        setFieldError(field as keyof typeof credentialsSchema, messages[0])
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
        <Stethoscope class="size-4 text-muted-foreground" />
        <CardTitle class="text-base">Professional Credentials</CardTitle>
      </div>
      <CardDescription>Your license numbers appear on generated prescriptions and medical certificates</CardDescription>
    </CardHeader>

    <CardContent>
      <form id="credentials-form" class="flex flex-col gap-5" novalidate @submit.prevent="onSubmit">
        <div v-if="generalError" role="alert" class="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          {{ generalError }}
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <div class="flex flex-col gap-2">
            <Label for="cred-specialty" class="flex items-center gap-1.5">
              <Stethoscope class="size-3.5 text-muted-foreground" />
              Specialty
              <span class="ml-auto text-xs font-normal text-muted-foreground">Optional</span>
            </Label>
            <Input id="cred-specialty" v-model="specialty" type="text" placeholder="e.g. Internal Medicine" :disabled="isLoading" :aria-invalid="!!specialtyError" />
            <p v-if="specialtyError" class="text-xs text-destructive">{{ specialtyError }}</p>
          </div>

          <div class="flex flex-col gap-2">
            <Label for="cred-sub-specialty" class="flex items-center gap-1.5">
              <Stethoscope class="size-3.5 text-muted-foreground" />
              Sub-specialty
              <span class="ml-auto text-xs font-normal text-muted-foreground">Optional</span>
            </Label>
            <Input id="cred-sub-specialty" v-model="subSpecialty" type="text" placeholder="e.g. Cardiology" :disabled="isLoading" :aria-invalid="!!subSpecialtyError" />
            <p v-if="subSpecialtyError" class="text-xs text-destructive">{{ subSpecialtyError }}</p>
          </div>
        </div>

        <div class="grid gap-4 sm:grid-cols-3">
          <div class="flex flex-col gap-2">
            <Label for="cred-prc" class="flex items-center gap-1.5">
              <BadgeCheck class="size-3.5 text-muted-foreground" />
              PRC License No.
            </Label>
            <Input id="cred-prc" v-model="prcLicenseNumber" type="text" placeholder="0012345" :disabled="isLoading" :aria-invalid="!!prcLicenseNumberError" />
            <p v-if="prcLicenseNumberError" class="text-xs text-destructive">{{ prcLicenseNumberError }}</p>
          </div>

          <div class="flex flex-col gap-2">
            <Label for="cred-ptr" class="flex items-center gap-1.5">
              <BadgeCheck class="size-3.5 text-muted-foreground" />
              PTR No.
            </Label>
            <Input id="cred-ptr" v-model="ptrNumber" type="text" placeholder="1234567" :disabled="isLoading" :aria-invalid="!!ptrNumberError" />
            <p v-if="ptrNumberError" class="text-xs text-destructive">{{ ptrNumberError }}</p>
          </div>

          <div class="flex flex-col gap-2 sm:col-span-1">
            <Label for="cred-s2" class="flex items-center gap-1.5">
              <BadgeCheck class="size-3.5 text-muted-foreground" />
              S2 License No.
            </Label>
            <Input id="cred-s2" v-model="s2LicenseNumber" type="text" placeholder="For dangerous drugs" :disabled="isLoading" :aria-invalid="!!s2LicenseNumberError" />
            <p v-if="s2LicenseNumberError" class="text-xs text-destructive">{{ s2LicenseNumberError }}</p>
          </div>
        </div>
      </form>
    </CardContent>

    <Separator />

    <CardFooter class="flex flex-col items-stretch gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
      <p class="text-center text-xs text-muted-foreground sm:text-left">License numbers are printed on prescriptions you generate.</p>
      <Button type="submit" form="credentials-form" size="sm" class="w-full sm:w-auto" :disabled="isLoading">
        <LoaderCircle v-if="isLoading" class="mr-2 size-3.5 animate-spin" />
        {{ isLoading ? 'Saving...' : 'Save credentials' }}
      </Button>
    </CardFooter>
  </Card>
</template>
