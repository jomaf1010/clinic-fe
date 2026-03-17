<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useForm, useField } from 'vee-validate'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useAuthStore } from '@/domains/auth/stores/authStore'
import { Building2, MapPin, DollarSign, FileText, LoaderCircle } from 'lucide-vue-next'
import { clinicApi } from '../api/clinicApi'
import { HttpError } from '@/lib/http'
import { createClinicSchema } from '@/lib/validationRules'
import { RouteNames } from '@/router/routeNames'
import type { ValidationError } from '@/domains/auth/types/auth.types'

const router = useRouter()
const authStore = useAuthStore()

const { handleSubmit, setFieldError } = useForm({
  validationSchema: createClinicSchema,
})

const { value: clinicName, errorMessage: clinicNameError } = useField<string>('clinic_name')
const { value: address, errorMessage: addressError } = useField<string>('address')
const { value: defaultFee, errorMessage: defaultFeeError } = useField<string>('default_fee')
const { value: rxHeader, errorMessage: rxHeaderError } = useField<string>('rx_header')
const { value: rxFooter, errorMessage: rxFooterError } = useField<string>('rx_footer')

const isLoading = ref(false)
const generalError = ref<string | null>(null)

const onSubmit = handleSubmit(async (values) => {
  generalError.value = null
  isLoading.value = true

  try {
    const response = await clinicApi.create({
      clinic_name: values.clinic_name,
      ...(values.address ? { address: values.address } : {}),
      ...(values.default_fee ? { default_fee: values.default_fee } : {}),
      ...(values.rx_header ? { rx_header: values.rx_header } : {}),
      ...(values.rx_footer ? { rx_footer: values.rx_footer } : {}),
    })

    authStore.setToken(response.meta.access_token)
    await authStore.fetchUser()
    router.push({ name: RouteNames.HOME })
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
  <div class="flex min-h-screen items-center justify-center bg-background px-4">
    <div class="w-full max-w-lg">
      <div class="mb-8 text-center">
        <h1 class="text-2xl font-bold tracking-tight text-foreground">Clinic App</h1>
        <p class="mt-1 text-sm text-muted-foreground">Patient management system</p>
      </div>

      <Card>
        <CardHeader class="text-center">
          <div class="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-primary/10">
            <Building2 class="size-6 text-primary" />
          </div>
          <CardTitle class="text-xl">Set up your clinic</CardTitle>
          <CardDescription>Enter your clinic details to get started</CardDescription>
        </CardHeader>

        <CardContent>
          <form class="flex flex-col gap-5" novalidate @submit.prevent="onSubmit">
            <div
              v-if="generalError"
              role="alert"
              class="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
            >
              {{ generalError }}
            </div>

            <div class="flex flex-col gap-2">
              <Label for="clinic_name" class="flex items-center gap-1.5">
                <Building2 class="size-3.5 text-muted-foreground" />
                Clinic name
              </Label>
              <Input
                id="clinic_name"
                v-model="clinicName"
                type="text"
                placeholder="My Clinic"
                :disabled="isLoading"
                :aria-invalid="!!clinicNameError"
                required
              />
              <p v-if="clinicNameError" class="text-xs text-destructive">
                {{ clinicNameError }}
              </p>
            </div>

            <div class="flex flex-col gap-2">
              <Label for="address" class="flex items-center gap-1.5">
                <MapPin class="size-3.5 text-muted-foreground" />
                Address <span class="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="address"
                v-model="address"
                type="text"
                placeholder="123 Main St, City"
                :disabled="isLoading"
                :aria-invalid="!!addressError"
              />
              <p v-if="addressError" class="text-xs text-destructive">
                {{ addressError }}
              </p>
            </div>

            <div class="flex flex-col gap-2">
              <Label for="default_fee" class="flex items-center gap-1.5">
                <DollarSign class="size-3.5 text-muted-foreground" />
                Default fee <span class="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="default_fee"
                v-model="defaultFee"
                type="number"
                placeholder="500"
                :disabled="isLoading"
                :aria-invalid="!!defaultFeeError"
              />
              <p v-if="defaultFeeError" class="text-xs text-destructive">
                {{ defaultFeeError }}
              </p>
            </div>

            <div class="flex flex-col gap-2">
              <Label for="rx_header" class="flex items-center gap-1.5">
                <FileText class="size-3.5 text-muted-foreground" />
                Prescription header <span class="text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="rx_header"
                v-model="rxHeader"
                placeholder="Clinic name, doctor credentials, etc."
                :disabled="isLoading"
                :aria-invalid="!!rxHeaderError"
                rows="3"
              />
              <p v-if="rxHeaderError" class="text-xs text-destructive">
                {{ rxHeaderError }}
              </p>
            </div>

            <div class="flex flex-col gap-2">
              <Label for="rx_footer" class="flex items-center gap-1.5">
                <FileText class="size-3.5 text-muted-foreground" />
                Prescription footer <span class="text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="rx_footer"
                v-model="rxFooter"
                placeholder="Clinic address, phone number, etc."
                :disabled="isLoading"
                :aria-invalid="!!rxFooterError"
                rows="3"
              />
              <p v-if="rxFooterError" class="text-xs text-destructive">
                {{ rxFooterError }}
              </p>
            </div>

            <Button type="submit" class="w-full" :disabled="isLoading">
              <LoaderCircle v-if="isLoading" class="size-4 animate-spin" />
              {{ isLoading ? 'Creating clinic...' : 'Create clinic' }}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
