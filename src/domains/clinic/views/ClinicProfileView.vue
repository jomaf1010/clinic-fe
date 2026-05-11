<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useForm, useField } from 'vee-validate'
import { Building2, MapPin, Phone, Mail, LoaderCircle, Camera } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { HttpError } from '@/lib/http'
import { clinicApi } from '@/domains/clinic/api/clinicApi'
import { useAuthStore } from '@/domains/auth/stores/authStore'
import type { ValidationError } from '@/domains/auth/types/auth.types'
import type { PatientAddress } from '@/domains/patient/types/patient.types'
import ImageCropDialog from '@/components/ImageCropDialog.vue'
import AddressForm from '@/components/AddressForm.vue'

const authStore = useAuthStore()
const canManage = computed(() => authStore.hasPermission('clinic.manage'))
const isLoading = ref(false)
const isFetching = ref(true)
const generalError = ref<string | null>(null)
const logoUrl = ref<string | null>(null)
const cropDialogOpen = ref(false)
const isUploadingLogo = ref(false)

const address = ref<PatientAddress | null>(null)

const displayLogoUrl = computed(() => logoUrl.value ?? authStore.currentClinic?.logo_url ?? null)

const clinicInitials = computed(() => {
  const name = authStore.currentClinic?.clinic_name ?? ''
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('') || '?'
})

const { handleSubmit, setFieldError, setValues } = useForm({
  initialValues: {
    clinic_name: '',
    contact_number: '',
    email: '',
  },
})

const { value: clinicName, errorMessage: clinicNameError } = useField<string>('clinic_name')
const { value: contactNumber, errorMessage: contactNumberError } = useField<string>('contact_number')
const { value: email, errorMessage: emailError } = useField<string>('email')

onMounted(async () => {
  try {
    const res = await clinicApi.show()
    logoUrl.value = res.data.logo_url
    address.value = res.data.address
    setValues({
      clinic_name: res.data.clinic_name ?? '',
      contact_number: res.data.contact_number ?? '',
      email: res.data.email ?? '',
    })
  } catch {
    toast.error('Failed to load clinic details')
  } finally {
    isFetching.value = false
  }
})

async function handleLogoCrop(blob: Blob) {
  const file = new File([blob], 'logo.png', { type: 'image/png' })

  isUploadingLogo.value = true
  try {
    const res = await clinicApi.uploadLogo(file)
    logoUrl.value = res.data.logo_url
    await authStore.fetchUser()
    toast.success('Clinic logo updated')
  } catch (err) {
    if (err instanceof HttpError && err.status === 422) {
      toast.error('Invalid image. Use JPG, PNG, or WebP under 2 MB.')
    } else {
      toast.error('Failed to upload logo. Please try again.')
    }
  } finally {
    isUploadingLogo.value = false
  }
}

const onSubmit = handleSubmit(async (values) => {
  generalError.value = null
  isLoading.value = true
  try {
    await clinicApi.update({
      clinic_name: values.clinic_name,
      address: address.value || null,
      contact_number: values.contact_number || null,
      email: values.email || null,
    })
    await authStore.fetchUser()
    toast.success('Clinic profile updated')
  } catch (err) {
    if (err instanceof HttpError && err.status === 422) {
      const body = err.data as ValidationError
      for (const [field, messages] of Object.entries(body.errors ?? {})) {
        setFieldError(field as 'email' | 'contact_number' | 'clinic_name', messages[0])
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
  <div class="clinic-profile-view flex flex-col gap-5">
    <Card class="clinic-card clinic-identity-card overflow-hidden rounded-2xl border-0 py-0">
      <CardContent class="p-5 sm:p-6">
        <div class="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-6">
          <div class="group relative shrink-0">
            <Avatar class="clinic-logo size-24 rounded-3xl">
              <AvatarImage v-if="displayLogoUrl" :src="displayLogoUrl" alt="Clinic logo" class="rounded-3xl object-cover" />
              <AvatarFallback class="rounded-3xl bg-gradient-to-br from-blue-500 to-teal-500 text-2xl font-semibold text-white">
                {{ clinicInitials }}
              </AvatarFallback>
            </Avatar>

            <button
              v-if="canManage"
              type="button"
              class="absolute inset-0 flex cursor-pointer items-center justify-center rounded-3xl bg-slate-950/55 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              :disabled="isUploadingLogo"
              aria-label="Upload clinic logo"
              @click="cropDialogOpen = true"
            >
              <LoaderCircle v-if="isUploadingLogo" class="size-5 animate-spin text-white" />
              <Camera v-else class="size-5 text-white" />
            </button>
          </div>

          <div class="flex min-w-0 flex-col items-center gap-2 text-center sm:items-start sm:text-left">
            <span class="truncate text-2xl font-semibold leading-tight">
              {{ authStore.currentClinic?.clinic_name ?? 'Clinic' }}
            </span>
            <span v-if="authStore.currentClinic?.formatted_address" class="max-w-2xl text-sm text-muted-foreground">
              {{ authStore.currentClinic.formatted_address }}
            </span>
            <p v-if="canManage" class="surface-muted mt-2 rounded-full px-3 py-1.5 text-xs text-muted-foreground">
              Click the logo to upload a new image. JPG, PNG, or WebP up to 2 MB.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>

    <Card class="clinic-card overflow-hidden rounded-2xl border-0 py-0">
      <CardHeader class="px-5 pt-5 sm:px-6 sm:pt-6">
        <div class="flex items-center gap-2">
          <span class="clinic-section-icon flex size-9 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <Building2 class="size-4" />
          </span>
          <CardTitle class="text-base">Clinic Information</CardTitle>
        </div>
        <CardDescription>Manage your clinic's name, address, and contact details</CardDescription>
      </CardHeader>

      <CardContent class="px-5 pb-5 sm:px-6 sm:pb-6">
        <div v-if="isFetching" class="flex items-center justify-center py-8">
          <LoaderCircle class="size-5 animate-spin text-muted-foreground" />
        </div>

        <form v-else id="clinic-profile-form" class="flex flex-col gap-5" novalidate @submit.prevent="onSubmit">
          <div v-if="generalError" role="alert" class="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
            {{ generalError }}
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <div class="flex flex-col gap-2">
              <Label for="clinic-name" class="flex items-center gap-1.5">
                <Building2 class="size-3.5 text-muted-foreground" />
                Clinic name
              </Label>
              <Input id="clinic-name" v-model="clinicName" class="h-11 rounded-full px-4" type="text" placeholder="My Clinic" :disabled="isLoading || !canManage" :aria-invalid="!!clinicNameError" />
              <p v-if="clinicNameError" class="text-xs text-destructive">{{ clinicNameError }}</p>
            </div>

            <div class="flex flex-col gap-2">
              <Label for="clinic-email" class="flex items-center gap-1.5">
                <Mail class="size-3.5 text-muted-foreground" />
                Email
                <span class="ml-auto text-xs font-normal text-muted-foreground">Optional</span>
              </Label>
              <Input id="clinic-email" v-model="email" class="h-11 rounded-full px-4" type="email" placeholder="clinic@example.com" :disabled="isLoading || !canManage" :aria-invalid="!!emailError" />
              <p v-if="emailError" class="text-xs text-destructive">{{ emailError }}</p>
            </div>
          </div>

          <div>
            <Label class="mb-2 flex items-center gap-1.5">
              <MapPin class="size-3.5 text-muted-foreground" />
              Address
              <span class="ml-auto text-xs font-normal text-muted-foreground">Optional</span>
            </Label>
            <AddressForm v-model="address" :disabled="isLoading || !canManage" />
          </div>

          <div class="flex flex-col gap-2">
            <Label for="clinic-contact" class="flex items-center gap-1.5">
              <Phone class="size-3.5 text-muted-foreground" />
              Contact number
              <span class="ml-auto text-xs font-normal text-muted-foreground">Optional</span>
            </Label>
            <Input id="clinic-contact" v-model="contactNumber" class="h-11 rounded-full px-4" type="tel" placeholder="(02) 123-4567" :disabled="isLoading || !canManage" :aria-invalid="!!contactNumberError" />
            <p v-if="contactNumberError" class="text-xs text-destructive">{{ contactNumberError }}</p>
          </div>
        </form>
      </CardContent>

      <template v-if="canManage">
        <Separator class="opacity-40" />

        <CardFooter class="flex flex-col items-stretch gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p class="text-center text-xs text-muted-foreground sm:text-left">Changes are saved to your clinic immediately.</p>
          <Button type="submit" form="clinic-profile-form" size="sm" class="h-10 w-full rounded-full px-5 sm:w-auto" :disabled="isLoading || isFetching">
            <LoaderCircle v-if="isLoading" class="mr-2 size-3.5 animate-spin" />
            {{ isLoading ? 'Saving...' : 'Save changes' }}
          </Button>
        </CardFooter>
      </template>
    </Card>

    <ImageCropDialog
      v-model:open="cropDialogOpen"
      title="Upload Clinic Logo"
      description="Position your logo within the circle. It will be displayed as a square."
      :output-size="256"
      @crop="handleLogoCrop"
    />
  </div>
</template>

<style scoped>
.clinic-card {
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.5),
    0 24px 70px -42px rgb(15 23 42 / 0.42);
}

.clinic-identity-card {
  background:
    radial-gradient(circle at 18% 18%, rgb(37 99 235 / 0.14), transparent 34%),
    radial-gradient(circle at 88% 18%, rgb(20 184 166 / 0.13), transparent 34%),
    var(--surface-panel-strong);
}

.clinic-logo {
  box-shadow:
    0 18px 42px rgb(37 99 235 / 0.18),
    0 16px 34px rgb(20 184 166 / 0.13),
    inset 0 1px 0 rgb(255 255 255 / 0.42);
}

.clinic-section-icon {
  box-shadow:
    0 16px 32px rgb(37 99 235 / 0.22),
    inset 0 1px 0 rgb(255 255 255 / 0.28);
}

:global(.dark .clinic-card) {
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.05),
    0 28px 78px -44px rgb(0 0 0 / 0.82);
}
</style>
