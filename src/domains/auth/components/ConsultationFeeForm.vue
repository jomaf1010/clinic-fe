<script setup lang="ts">
import { ref, computed } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { HttpError } from '@/lib/http'
import { toast } from 'vue-sonner'
import { Banknote, LoaderCircle, Baby } from 'lucide-vue-next'
import { useAuthStore } from '../stores/authStore'
import { useSpecialtyConfigStore } from '@/stores/specialtyConfigStore'
import { authApi } from '../api/authApi'
import type { ValidationError } from '../types/auth.types'
import DentalBillingTab from '@/domains/dental/components/DentalBillingTab.vue'

const authStore = useAuthStore()
const specialtyConfigStore = useSpecialtyConfigStore()

const isObgyn = computed(() => specialtyConfigStore.config?.key === 'obgyn')
const isDental = computed(() => specialtyConfigStore.config?.key === 'dental')

const consultationFee = ref(
  authStore.user?.consultation_fee != null ? String(authStore.user.consultation_fee) : '',
)
const followUpFee = ref(
  authStore.user?.follow_up_fee != null ? String(authStore.user.follow_up_fee) : '',
)

// Specialty (delivery) fees
const fees = authStore.user?.specialty_fees ?? {}
const nsdFee = ref(fees.nsd != null ? String(fees.nsd) : '')
const cesareanFee = ref(fees.cesarean_section != null ? String(fees.cesarean_section) : '')
const vacuumFee = ref(fees.vacuum_assisted != null ? String(fees.vacuum_assisted) : '')
const forcepsFee = ref(fees.forceps_assisted != null ? String(fees.forceps_assisted) : '')

const isLoading = ref(false)
const error = ref<string | null>(null)
const fieldErrors = ref<Record<string, string>>({})

async function onSubmit() {
  error.value = null
  fieldErrors.value = {}
  isLoading.value = true

  try {
    const payload: Record<string, unknown> = {
      consultation_fee: consultationFee.value ? parseFloat(consultationFee.value) : null,
      follow_up_fee: followUpFee.value ? parseFloat(followUpFee.value) : null,
    }

    if (isObgyn.value) {
      payload.specialty_fees = {
        nsd: nsdFee.value ? parseFloat(nsdFee.value) : null,
        cesarean_section: cesareanFee.value ? parseFloat(cesareanFee.value) : null,
        vacuum_assisted: vacuumFee.value ? parseFloat(vacuumFee.value) : null,
        forceps_assisted: forcepsFee.value ? parseFloat(forcepsFee.value) : null,
      }
    }

    await authApi.updateProfile(payload)
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
      <form id="billing-form" class="flex flex-col gap-6" novalidate @submit.prevent="onSubmit">
        <div v-if="error" role="alert" class="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          {{ error }}
        </div>

        <!-- Consultation Fees -->
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

        <!-- Delivery Fees (OB-GYN only) -->
        <div v-if="isObgyn" class="flex flex-col gap-4">
          <Separator />
          <div class="flex items-center gap-2">
            <Baby class="size-4 text-muted-foreground" />
            <span class="text-sm font-medium">Delivery Fees</span>
          </div>
          <p class="text-xs text-muted-foreground">Set your fees per delivery method. These are used when finalizing delivery encounters.</p>

          <div class="grid gap-4 sm:grid-cols-2">
            <div class="flex flex-col gap-2">
              <Label for="nsd-fee">Normal Spontaneous Delivery (₱)</Label>
              <Input
                id="nsd-fee"
                v-model="nsdFee"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                :disabled="isLoading"
              />
              <p v-if="fieldErrors['specialty_fees.nsd']" class="text-xs text-destructive">{{ fieldErrors['specialty_fees.nsd'] }}</p>
            </div>

            <div class="flex flex-col gap-2">
              <Label for="cesarean-fee">Cesarean Section (₱)</Label>
              <Input
                id="cesarean-fee"
                v-model="cesareanFee"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                :disabled="isLoading"
              />
              <p v-if="fieldErrors['specialty_fees.cesarean_section']" class="text-xs text-destructive">{{ fieldErrors['specialty_fees.cesarean_section'] }}</p>
            </div>

            <div class="flex flex-col gap-2">
              <Label for="vacuum-fee">Vacuum-Assisted Delivery (₱)</Label>
              <Input
                id="vacuum-fee"
                v-model="vacuumFee"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                :disabled="isLoading"
              />
              <p v-if="fieldErrors['specialty_fees.vacuum_assisted']" class="text-xs text-destructive">{{ fieldErrors['specialty_fees.vacuum_assisted'] }}</p>
            </div>

            <div class="flex flex-col gap-2">
              <Label for="forceps-fee">Forceps-Assisted Delivery (₱)</Label>
              <Input
                id="forceps-fee"
                v-model="forcepsFee"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                :disabled="isLoading"
              />
              <p v-if="fieldErrors['specialty_fees.forceps_assisted']" class="text-xs text-destructive">{{ fieldErrors['specialty_fees.forceps_assisted'] }}</p>
            </div>
          </div>
        </div>
      </form>
    </CardContent>

    <Separator />

    <!-- Dental fee schedule (dental only) -->
    <CardContent v-if="isDental" class="pt-6">
      <DentalBillingTab scope="doctor" />
    </CardContent>

    <Separator v-if="isDental" />

    <CardFooter class="flex flex-col items-stretch gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
      <p class="text-center text-xs text-muted-foreground sm:text-left">These fees are used as defaults for consultation payments.</p>
      <Button type="submit" form="billing-form" size="sm" class="w-full sm:w-auto" :disabled="isLoading">
        <LoaderCircle v-if="isLoading" class="mr-2 size-3.5 animate-spin" />
        {{ isLoading ? 'Saving...' : 'Save changes' }}
      </Button>
    </CardFooter>
  </Card>
</template>
