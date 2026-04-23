<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Banknote, Stethoscope, LoaderCircle, Baby, HeartPulse, Users, Activity, Bone } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { useAuthStore } from '../stores/authStore'
import { authApi } from '../api/authApi'
import { HttpError } from '@/lib/http'
import type { ValidationError } from '../types/auth.types'

const authStore = useAuthStore()

const open = computed(() => !!authStore.user && !authStore.user.specialty)

const specialties = [
  { key: 'general', label: 'General Medicine', icon: Stethoscope, color: 'text-slate-500 bg-slate-500/10' },
  { key: 'family_medicine', label: 'Family Medicine', icon: Users, color: 'text-teal-500 bg-teal-500/10' },
  { key: 'internal_medicine', label: 'Internal Medicine', icon: Activity, color: 'text-blue-500 bg-blue-500/10' },
  { key: 'pediatrics', label: 'Pediatrics', icon: Baby, color: 'text-pink-500 bg-pink-500/10' },
  { key: 'obgyn', label: 'OB-GYN', icon: HeartPulse, color: 'text-rose-500 bg-rose-500/10' },
  { key: 'dental', label: 'Dental', icon: Bone, color: 'text-cyan-500 bg-cyan-500/10' },
] as const

type SpecialtyKey = typeof specialties[number]['key']

const selected = ref<SpecialtyKey | null>(null)
const consultationFee = ref('')
const followUpFee = ref('')
const nsdFee = ref('')
const cesareanFee = ref('')
const vacuumFee = ref('')
const forcepsFee = ref('')

const isLoading = ref(false)
const error = ref<string | null>(null)
const fieldErrors = ref<Record<string, string>>({})

// Reset form when dialog opens
watch(open, (o) => {
  if (o) {
    selected.value = null
    consultationFee.value = ''
    followUpFee.value = ''
    nsdFee.value = ''
    cesareanFee.value = ''
    vacuumFee.value = ''
    forcepsFee.value = ''
    error.value = null
    fieldErrors.value = {}
  }
})

async function onSubmit() {
  if (!selected.value) return
  error.value = null
  fieldErrors.value = {}
  isLoading.value = true

  try {
    const payload: Record<string, unknown> = {
      specialty: selected.value,
      consultation_fee: consultationFee.value ? parseFloat(consultationFee.value) : null,
      follow_up_fee: followUpFee.value ? parseFloat(followUpFee.value) : null,
    }

    if (selected.value === 'obgyn') {
      payload.specialty_fees = {
        nsd: nsdFee.value ? parseFloat(nsdFee.value) : null,
        cesarean_section: cesareanFee.value ? parseFloat(cesareanFee.value) : null,
        vacuum_assisted: vacuumFee.value ? parseFloat(vacuumFee.value) : null,
        forceps_assisted: forcepsFee.value ? parseFloat(forcepsFee.value) : null,
      }
    }

    await authApi.updateProfile(payload)
    await authStore.fetchUser()
    toast.success('Specialty saved.')
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
  <Dialog :open="open">
    <DialogContent
      class="sm:max-w-2xl max-h-[90vh] flex flex-col overflow-y-auto"
      :show-close-button="false"
      @escape-key-down="(e: Event) => e.preventDefault()"
      @pointer-down-outside="(e: Event) => e.preventDefault()"
      @interact-outside="(e: Event) => e.preventDefault()"
    >
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <Stethoscope class="size-5" />
          Set Your Specialty
        </DialogTitle>
        <DialogDescription>
          Pick your primary specialty so the right forms, vitals, and sections show up for every consultation. You can update this later in your account settings.
        </DialogDescription>
      </DialogHeader>

      <form class="flex flex-col gap-5" novalidate @submit.prevent="onSubmit">
        <div v-if="error" role="alert" class="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          {{ error }}
        </div>

        <!-- Specialty picker -->
        <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            v-for="s in specialties"
            :key="s.key"
            type="button"
            class="flex items-center gap-3 rounded-xl border p-3 text-left transition-colors"
            :class="selected === s.key ? 'border-primary bg-primary/5 ring-2 ring-primary/30' : 'hover:bg-muted/40'"
            @click="selected = s.key"
          >
            <div class="flex size-10 shrink-0 items-center justify-center rounded-lg" :class="s.color">
              <component :is="s.icon" class="size-5" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-sm font-semibold">{{ s.label }}</p>
            </div>
          </button>
        </div>

        <!-- Fees (optional) -->
        <div class="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3">
          <div class="flex items-center gap-2">
            <Banknote class="size-4 text-muted-foreground" />
            <p class="text-sm font-semibold">Default Fees <span class="font-normal text-muted-foreground">(optional)</span></p>
          </div>
          <p class="text-xs text-muted-foreground">You can skip this now and set them from Account &rsaquo; Billing later.</p>

          <div class="grid gap-3 sm:grid-cols-2">
            <div class="flex flex-col gap-1.5">
              <Label for="setup-consult-fee" class="text-xs">Consultation (₱)</Label>
              <Input
                id="setup-consult-fee"
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
            <div class="flex flex-col gap-1.5">
              <Label for="setup-followup-fee" class="text-xs">Follow-up (₱)</Label>
              <Input
                id="setup-followup-fee"
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

          <!-- OB-GYN specialty fees -->
          <div v-if="selected === 'obgyn'" class="flex flex-col gap-2 border-t pt-3">
            <p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Delivery Fees</p>
            <div class="grid gap-3 sm:grid-cols-2">
              <div class="flex flex-col gap-1.5">
                <Label for="setup-nsd-fee" class="text-xs">NSD (₱)</Label>
                <Input id="setup-nsd-fee" v-model="nsdFee" type="number" step="0.01" min="0" placeholder="0.00" :disabled="isLoading" />
              </div>
              <div class="flex flex-col gap-1.5">
                <Label for="setup-cs-fee" class="text-xs">Cesarean Section (₱)</Label>
                <Input id="setup-cs-fee" v-model="cesareanFee" type="number" step="0.01" min="0" placeholder="0.00" :disabled="isLoading" />
              </div>
              <div class="flex flex-col gap-1.5">
                <Label for="setup-vacuum-fee" class="text-xs">Vacuum-Assisted (₱)</Label>
                <Input id="setup-vacuum-fee" v-model="vacuumFee" type="number" step="0.01" min="0" placeholder="0.00" :disabled="isLoading" />
              </div>
              <div class="flex flex-col gap-1.5">
                <Label for="setup-forceps-fee" class="text-xs">Forceps-Assisted (₱)</Label>
                <Input id="setup-forceps-fee" v-model="forcepsFee" type="number" step="0.01" min="0" placeholder="0.00" :disabled="isLoading" />
              </div>
            </div>
          </div>
        </div>

        <div class="flex justify-end">
          <Button type="submit" :disabled="isLoading || !selected">
            <LoaderCircle v-if="isLoading" class="size-3.5 animate-spin" />
            Save
          </Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>
</template>
