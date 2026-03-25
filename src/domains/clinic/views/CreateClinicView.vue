<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useForm, useField } from 'vee-validate'
import confetti from 'canvas-confetti'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Card,
  CardContent,
} from '@/components/ui/card'
import { useAuthStore } from '@/domains/auth/stores/authStore'
import { Building2, MapPin, Mail, LoaderCircle, Camera, Check, ArrowRight, ArrowLeft, Sparkles } from 'lucide-vue-next'
import AppLogo from '@/components/AppLogo.vue'
import ImageCropDialog from '@/components/ImageCropDialog.vue'
import AddressForm from '@/components/AddressForm.vue'
import { clinicApi } from '../api/clinicApi'
import { HttpError } from '@/lib/http'
import { createClinicSchema } from '@/lib/validationRules'
import { RouteNames } from '@/router/routeNames'
import { useNeuralNetwork } from '@/composables/useNeuralNetwork'
import type { ValidationError } from '@/domains/auth/types/auth.types'
import type { PatientAddress } from '@/domains/patient/types/patient.types'

const router = useRouter()
const authStore = useAuthStore()
const { canvasRef } = useNeuralNetwork()

const userName = computed(() => {
  return authStore.user?.first_name ?? null
})

const createdClinicName = ref('')

const { handleSubmit, setFieldError, validateField } = useForm({
  validationSchema: createClinicSchema,
})

const { value: clinicName, errorMessage: clinicNameError } = useField<string>('clinic_name')
const { value: email, errorMessage: emailError } = useField<string>('email')
const address = ref<PatientAddress | null>(null)
const isLoading = ref(false)
const generalError = ref<string | null>(null)

// Step wizard
const currentStep = ref(1)
const stepDirection = ref<'forward' | 'backward'>('forward')
const stepTransitioning = ref(false)

const steps = [
  { number: 1, label: 'Clinic Name' },
  { number: 2, label: 'Details' },
  { number: 3, label: 'Logo' },
]

async function goToStep(step: number) {
  if (stepTransitioning.value) return

  // Validate before going forward
  if (step > currentStep.value) {
    if (currentStep.value === 1) {
      const result = await validateField('clinic_name')
      if (!result.valid) return
    }
  }

  stepDirection.value = step > currentStep.value ? 'forward' : 'backward'
  stepTransitioning.value = true

  // Wait for exit animation
  await new Promise(r => setTimeout(r, 250))
  currentStep.value = step

  // Wait for enter animation
  await nextTick()
  await new Promise(r => setTimeout(r, 50))
  stepTransitioning.value = false
}

// Success animation states
const isCollapsing = ref(false)
const showSuccess = ref(false)
const showSuccessContent = ref(false)
const showCheckmark = ref(false)
const showProgressBar = ref(false)

const cropDialogOpen = ref(false)
const logoFile = ref<File | null>(null)
const logoPreview = ref<string | null>(null)

// Entrance animation
const ready = ref(false)
onMounted(() => {
  requestAnimationFrame(() => {
    ready.value = true
  })
})

function handleLogoCrop(blob: Blob) {
  logoFile.value = new File([blob], 'logo.png', { type: 'image/png' })
  logoPreview.value = URL.createObjectURL(blob)
}

function fireConfetti() {
  const duration = 2500
  const end = Date.now() + duration

  function frame() {
    confetti({
      particleCount: 4,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.65 },
      colors: ['#002954', '#00b2b2', '#f59e0b', '#10b981'],
    })
    confetti({
      particleCount: 4,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.65 },
      colors: ['#002954', '#00b2b2', '#f59e0b', '#10b981'],
    })
    if (Date.now() < end) requestAnimationFrame(frame)
  }

  frame()

  setTimeout(() => {
    confetti({
      particleCount: 80,
      spread: 100,
      origin: { x: 0.5, y: 0.5 },
      colors: ['#002954', '#00b2b2', '#f59e0b', '#10b981', '#8b5cf6'],
    })
  }, 300)
}

async function playSuccessSequence() {
  isCollapsing.value = true

  await new Promise(r => setTimeout(r, 600))
  showSuccess.value = true

  await nextTick()
  await new Promise(r => setTimeout(r, 50))
  showSuccessContent.value = true

  await new Promise(r => setTimeout(r, 300))
  showCheckmark.value = true
  fireConfetti()

  await new Promise(r => setTimeout(r, 500))
  showProgressBar.value = true

  redirectTimeout = setTimeout(() => {
    router.push({ name: RouteNames.HOME })
  }, 3000)
}

let redirectTimeout: ReturnType<typeof setTimeout> | undefined
onUnmounted(() => {
  if (redirectTimeout) clearTimeout(redirectTimeout)
})

const onSubmit = handleSubmit(async (values) => {
  generalError.value = null
  isLoading.value = true

  try {
    const response = await clinicApi.create({
      clinic_name: values.clinic_name,
      ...(address.value ? { address: address.value } : {}),
      ...(values.email ? { email: values.email } : {}),
    })

    authStore.setToken(response.meta.access_token)
    createdClinicName.value = values.clinic_name

    if (logoFile.value) {
      try {
        await clinicApi.uploadLogo(logoFile.value)
      } catch {
        // Non-blocking
      }
    }

    await authStore.fetchUser()
    playSuccessSequence()
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
  <div class="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
    <!-- Neural network background -->
    <canvas
      ref="canvasRef"
      class="pointer-events-none absolute inset-0"
    />

    <div class="relative z-10 w-full max-w-lg">
      <!-- Logo -->
      <div
        class="mb-4 flex justify-center transition-all delay-100 duration-700 ease-out"
        :class="ready ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'"
      >
        <AppLogo class="h-24 w-auto" />
      </div>

      <!-- ===== FORM STATE ===== -->
      <div
        class="transition-all duration-600 ease-in-out"
        :class="isCollapsing ? 'scale-95 opacity-0 max-h-0 overflow-hidden' : 'scale-100 opacity-100 max-h-[1200px]'"
      >
        <!-- Welcome message -->
        <div
          class="mb-6 text-center transition-all delay-200 duration-700 ease-out"
          :class="ready ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'"
        >
          <h1 class="text-2xl font-bold tracking-tight text-foreground">
            Welcome{{ userName ? `, ${userName}` : '' }}!
          </h1>
          <p class="mt-1 text-sm text-muted-foreground">Let's set up your clinic in just a few steps</p>
        </div>

        <!-- Progress steps -->
        <div
          class="mb-6 flex items-center justify-center gap-2 transition-all delay-300 duration-700 ease-out"
          :class="ready ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'"
        >
          <template v-for="(step, i) in steps" :key="step.number">
            <button
              type="button"
              class="flex items-center gap-2"
              :disabled="step.number > currentStep"
              @click="step.number < currentStep && goToStep(step.number)"
            >
              <div
                class="flex size-7 items-center justify-center rounded-full text-xs font-semibold transition-all duration-300"
                :class="
                  step.number === currentStep
                    ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/25 scale-110'
                    : step.number < currentStep
                      ? 'bg-secondary text-secondary-foreground'
                      : 'bg-muted text-muted-foreground'
                "
              >
                <Check v-if="step.number < currentStep" class="size-3.5" />
                <span v-else>{{ step.number }}</span>
              </div>
              <span
                class="hidden text-sm sm:inline transition-colors duration-300"
                :class="step.number === currentStep ? 'font-medium text-foreground' : 'text-muted-foreground'"
              >
                {{ step.label }}
              </span>
            </button>
            <div
              v-if="i < steps.length - 1"
              class="h-px w-8 sm:w-12 transition-colors duration-500"
              :class="step.number < currentStep ? 'bg-secondary' : step.number === currentStep ? 'bg-primary/30' : 'bg-border'"
            />
          </template>
        </div>

        <!-- Form card -->
        <div
          class="transition-all delay-[400ms] duration-700 ease-out"
          :class="ready ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'"
        >
          <Card class="backdrop-blur-sm bg-card/90">
            <CardContent class="pt-6">
              <form novalidate @submit.prevent="onSubmit">
                <div
                  v-if="generalError"
                  role="alert"
                  class="mb-5 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
                >
                  {{ generalError }}
                </div>

                <!-- Step content wrapper with animation -->
                <div class="relative overflow-hidden">
                  <!-- Step 1: Clinic Name -->
                  <div
                    v-if="currentStep === 1"
                    class="flex flex-col gap-5 transition-all duration-300 ease-out"
                    :class="stepTransitioning
                      ? (stepDirection === 'forward' ? '-translate-x-8 opacity-0' : 'translate-x-8 opacity-0')
                      : 'translate-x-0 opacity-100'"
                  >
                    <div class="text-center">
                      <h2 class="text-lg font-semibold">First things first!</h2>
                      <p class="mt-1 text-sm text-muted-foreground">Give your clinic a name - don't worry, you can change it anytime</p>
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

                    <Button type="button" class="w-full" @click="goToStep(2)">
                      Continue
                      <ArrowRight class="size-4" />
                    </Button>
                  </div>

                  <!-- Step 2: Address & Email -->
                  <div
                    v-if="currentStep === 2"
                    class="flex flex-col gap-5 transition-all duration-300 ease-out"
                    :class="stepTransitioning
                      ? (stepDirection === 'forward' ? '-translate-x-8 opacity-0' : 'translate-x-8 opacity-0')
                      : 'translate-x-0 opacity-100'"
                  >
                    <div class="text-center">
                      <h2 class="text-lg font-semibold">Almost there!</h2>
                      <p class="mt-1 text-sm text-muted-foreground">Add your address and email so patients can find you - or skip for now</p>
                    </div>

                    <div>
                      <Label class="mb-2 flex items-center gap-1.5">
                        <MapPin class="size-3.5 text-muted-foreground" />
                        Address
                      </Label>
                      <AddressForm v-model="address" :disabled="isLoading" />
                    </div>

                    <div class="flex flex-col gap-2">
                      <Label for="email" class="flex items-center gap-1.5">
                        <Mail class="size-3.5 text-muted-foreground" />
                        Email
                      </Label>
                      <Input
                        id="email"
                        v-model="email"
                        type="email"
                        placeholder="clinic@example.com"
                        :disabled="isLoading"
                        :aria-invalid="!!emailError"
                      />
                      <p v-if="emailError" class="text-xs text-destructive">
                        {{ emailError }}
                      </p>
                    </div>

                    <div class="flex gap-3">
                      <Button type="button" variant="outline" class="flex-1" @click="goToStep(1)">
                        <ArrowLeft class="size-4" />
                        Back
                      </Button>
                      <Button type="button" class="flex-1" @click="goToStep(3)">
                        Continue
                        <ArrowRight class="size-4" />
                      </Button>
                    </div>
                  </div>

                  <!-- Step 3: Logo -->
                  <div
                    v-if="currentStep === 3"
                    class="flex flex-col gap-5 transition-all duration-300 ease-out"
                    :class="stepTransitioning
                      ? (stepDirection === 'forward' ? '-translate-x-8 opacity-0' : 'translate-x-8 opacity-0')
                      : 'translate-x-0 opacity-100'"
                  >
                    <div class="text-center">
                      <h2 class="text-lg font-semibold">Looking good!</h2>
                      <p class="mt-1 text-sm text-muted-foreground">Give your clinic a face - upload a logo or skip and add one later</p>
                    </div>

                    <div class="flex flex-col items-center gap-3 py-4">
                      <div class="group relative">
                        <Avatar class="size-28 ring-2 ring-border ring-offset-4 ring-offset-background">
                          <AvatarImage v-if="logoPreview" :src="logoPreview" alt="Clinic logo preview" class="object-cover" />
                          <AvatarFallback class="bg-primary/10 text-3xl font-semibold text-primary">
                            <Building2 class="size-10" />
                          </AvatarFallback>
                        </Avatar>

                        <button
                          type="button"
                          class="absolute inset-0 flex cursor-pointer items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                          :disabled="isLoading"
                          aria-label="Upload clinic logo"
                          @click="cropDialogOpen = true"
                        >
                          <Camera class="size-6 text-white" />
                        </button>
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        class="text-muted-foreground"
                        @click="cropDialogOpen = true"
                      >
                        <Camera class="size-3.5" />
                        {{ logoPreview ? 'Change logo' : 'Upload logo' }}
                      </Button>
                    </div>

                    <div class="flex gap-3">
                      <Button type="button" variant="outline" class="flex-1" @click="goToStep(2)">
                        <ArrowLeft class="size-4" />
                        Back
                      </Button>
                      <Button type="submit" class="flex-1" :disabled="isLoading">
                        <LoaderCircle v-if="isLoading" class="size-4 animate-spin" />
                        {{ isLoading ? 'Creating...' : 'Create clinic' }}
                      </Button>
                    </div>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>

      <!-- ===== SUCCESS STATE ===== -->
      <div
        v-if="showSuccess"
        class="flex flex-col items-center"
      >
        <Card class="w-full backdrop-blur-sm bg-card/90 overflow-hidden">
          <CardContent class="py-12">
            <div
              class="flex flex-col items-center gap-6 transition-all duration-700 ease-out"
              :class="showSuccessContent ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'"
            >
              <!-- Animated checkmark circle -->
              <div class="relative">
                <div
                  class="absolute inset-0 rounded-full transition-all duration-700 ease-out"
                  :class="showCheckmark ? 'scale-100 opacity-100' : 'scale-0 opacity-0'"
                >
                  <svg class="size-24 -rotate-90" viewBox="0 0 96 96">
                    <circle cx="48" cy="48" r="44" fill="none" stroke="currentColor" stroke-width="3" class="text-green-500/20" />
                    <circle
                      cx="48" cy="48" r="44" fill="none" stroke="currentColor" stroke-width="3"
                      class="text-green-500"
                      :stroke-dasharray="276.46"
                      :stroke-dashoffset="showCheckmark ? 0 : 276.46"
                      style="transition: stroke-dashoffset 0.8s ease-out 0.2s"
                    />
                  </svg>
                </div>

                <div
                  class="flex size-24 items-center justify-center rounded-full bg-green-500/10 transition-all duration-500 ease-out"
                  :class="showCheckmark ? 'scale-100' : 'scale-50'"
                >
                  <Check
                    class="size-10 text-green-600 dark:text-green-400 transition-all duration-500 ease-out"
                    :class="showCheckmark ? 'scale-100 opacity-100' : 'scale-0 opacity-0'"
                    :style="{ transitionDelay: '0.4s' }"
                  />
                </div>
              </div>

              <div class="flex flex-col items-center gap-2 text-center">
                <div class="flex items-center gap-2">
                  <Sparkles class="size-5 text-secondary" />
                  <h2 class="text-2xl font-bold tracking-tight">You're all set!</h2>
                  <Sparkles class="size-5 text-secondary" />
                </div>
                <p class="text-base text-muted-foreground">
                  <span class="font-semibold text-foreground">{{ createdClinicName || 'Your clinic' }}</span> has been created successfully
                </p>
              </div>

              <Button class="mt-2" @click="router.push({ name: RouteNames.HOME })">
                Go to Dashboard
                <ArrowRight class="size-4" />
              </Button>

              <div
                class="mt-2 w-48 overflow-hidden rounded-full bg-muted transition-opacity duration-300"
                :class="showProgressBar ? 'opacity-100' : 'opacity-0'"
              >
                <div class="h-1 rounded-full bg-secondary" :class="showProgressBar ? 'progress-fill' : 'w-0'" />
              </div>
              <p
                class="text-xs text-muted-foreground transition-opacity duration-300"
                :class="showProgressBar ? 'opacity-100' : 'opacity-0'"
              >
                Redirecting to dashboard...
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  </div>

  <ImageCropDialog
    v-model:open="cropDialogOpen"
    title="Upload Clinic Logo"
    description="Position your logo within the circle."
    :output-size="256"
    @crop="handleLogoCrop"
  />
</template>

<style scoped>
.progress-fill {
  animation: fill-progress 3s linear forwards;
}

@keyframes fill-progress {
  from { width: 0%; }
  to { width: 100%; }
}

.duration-600 {
  transition-duration: 600ms;
}
</style>
