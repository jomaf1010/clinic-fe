<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useForm, useField } from 'vee-validate'
import { Building2, MapPin, Phone, Mail, Banknote, LoaderCircle, Camera } from 'lucide-vue-next'
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
import ImageCropDialog from '@/components/ImageCropDialog.vue'

const authStore = useAuthStore()
const isLoading = ref(false)
const isFetching = ref(true)
const generalError = ref<string | null>(null)
const logoUrl = ref<string | null>(null)
const cropDialogOpen = ref(false)
const isUploadingLogo = ref(false)

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
    address: '',
    contact_number: '',
    email: '',
    default_fee: '',
  },
})

const { value: clinicName, errorMessage: clinicNameError } = useField<string>('clinic_name')
const { value: address, errorMessage: addressError } = useField<string>('address')
const { value: contactNumber, errorMessage: contactNumberError } = useField<string>('contact_number')
const { value: email, errorMessage: emailError } = useField<string>('email')
const { value: defaultFee, errorMessage: defaultFeeError } = useField<string>('default_fee')

onMounted(async () => {
  try {
    const res = await clinicApi.show()
    logoUrl.value = res.data.logo_url
    setValues({
      clinic_name: res.data.clinic_name ?? '',
      address: res.data.address ?? '',
      contact_number: res.data.contact_number ?? '',
      email: res.data.email ?? '',
      default_fee: res.data.default_fee ?? '',
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
      address: values.address || null,
      contact_number: values.contact_number || null,
      email: values.email || null,
      default_fee: values.default_fee ? Number(values.default_fee) : null,
    })
    await authStore.fetchUser()
    toast.success('Clinic profile updated')
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
  <div class="flex flex-col gap-6">
    <!-- Logo + Name Card -->
    <Card>
      <CardContent class="pt-6">
        <div class="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-6">
          <!-- Logo upload zone -->
          <div class="group relative shrink-0">
            <Avatar class="size-20 rounded-lg ring-2 ring-border ring-offset-2 ring-offset-background">
              <AvatarImage v-if="displayLogoUrl" :src="displayLogoUrl" alt="Clinic logo" class="rounded-lg object-cover" />
              <AvatarFallback class="rounded-lg bg-primary/10 text-xl font-semibold text-primary">
                {{ clinicInitials }}
              </AvatarFallback>
            </Avatar>

            <button
              type="button"
              class="absolute inset-0 flex cursor-pointer items-center justify-center rounded-lg bg-black/50 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              :disabled="isUploadingLogo"
              aria-label="Upload clinic logo"
              @click="cropDialogOpen = true"
            >
              <LoaderCircle v-if="isUploadingLogo" class="size-5 animate-spin text-white" />
              <Camera v-else class="size-5 text-white" />
            </button>
          </div>

          <!-- Clinic identity text -->
          <div class="flex flex-col items-center gap-1.5 text-center sm:items-start sm:text-left">
            <span class="text-lg font-semibold leading-tight">
              {{ authStore.currentClinic?.clinic_name ?? 'Clinic' }}
            </span>
            <span v-if="authStore.currentClinic?.address" class="text-sm text-muted-foreground">
              {{ authStore.currentClinic.address }}
            </span>
            <p class="mt-0.5 text-xs text-muted-foreground">
              Click the logo to upload a new image. JPG, PNG, or WebP up to 2 MB.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- Clinic Details Form -->
    <Card>
      <CardHeader>
        <div class="flex items-center gap-2">
          <Building2 class="size-4 text-muted-foreground" />
          <CardTitle class="text-base">Clinic Information</CardTitle>
        </div>
        <CardDescription>Manage your clinic's name, address, and contact details</CardDescription>
      </CardHeader>

      <CardContent>
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
              <Input id="clinic-name" v-model="clinicName" type="text" placeholder="My Clinic" :disabled="isLoading" :aria-invalid="!!clinicNameError" />
              <p v-if="clinicNameError" class="text-xs text-destructive">{{ clinicNameError }}</p>
            </div>

            <div class="flex flex-col gap-2">
              <Label for="clinic-email" class="flex items-center gap-1.5">
                <Mail class="size-3.5 text-muted-foreground" />
                Email
                <span class="ml-auto text-xs font-normal text-muted-foreground">Optional</span>
              </Label>
              <Input id="clinic-email" v-model="email" type="email" placeholder="clinic@example.com" :disabled="isLoading" :aria-invalid="!!emailError" />
              <p v-if="emailError" class="text-xs text-destructive">{{ emailError }}</p>
            </div>
          </div>

          <div class="flex flex-col gap-2">
            <Label for="clinic-address" class="flex items-center gap-1.5">
              <MapPin class="size-3.5 text-muted-foreground" />
              Address
              <span class="ml-auto text-xs font-normal text-muted-foreground">Optional</span>
            </Label>
            <Input id="clinic-address" v-model="address" type="text" placeholder="123 Main Street, City" :disabled="isLoading" :aria-invalid="!!addressError" />
            <p v-if="addressError" class="text-xs text-destructive">{{ addressError }}</p>
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <div class="flex flex-col gap-2">
              <Label for="clinic-contact" class="flex items-center gap-1.5">
                <Phone class="size-3.5 text-muted-foreground" />
                Contact number
                <span class="ml-auto text-xs font-normal text-muted-foreground">Optional</span>
              </Label>
              <Input id="clinic-contact" v-model="contactNumber" type="tel" placeholder="(02) 123-4567" :disabled="isLoading" :aria-invalid="!!contactNumberError" />
              <p v-if="contactNumberError" class="text-xs text-destructive">{{ contactNumberError }}</p>
            </div>

            <div class="flex flex-col gap-2">
              <Label for="clinic-fee" class="flex items-center gap-1.5">
                <Banknote class="size-3.5 text-muted-foreground" />
                Default consultation fee
                <span class="ml-auto text-xs font-normal text-muted-foreground">Optional</span>
              </Label>
              <Input id="clinic-fee" v-model="defaultFee" type="number" placeholder="500" min="0" :disabled="isLoading" :aria-invalid="!!defaultFeeError" />
              <p v-if="defaultFeeError" class="text-xs text-destructive">{{ defaultFeeError }}</p>
            </div>
          </div>
        </form>
      </CardContent>

      <Separator />

      <CardFooter class="flex flex-col items-stretch gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p class="text-center text-xs text-muted-foreground sm:text-left">Changes are saved to your clinic immediately.</p>
        <Button type="submit" form="clinic-profile-form" size="sm" class="w-full sm:w-auto" :disabled="isLoading || isFetching">
          <LoaderCircle v-if="isLoading" class="mr-2 size-3.5 animate-spin" />
          {{ isLoading ? 'Saving...' : 'Save changes' }}
        </Button>
      </CardFooter>
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
