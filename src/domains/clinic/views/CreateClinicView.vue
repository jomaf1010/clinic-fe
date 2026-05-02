<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
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
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Building2,
  Camera,
  Check,
  LoaderCircle,
  Mail,
  MapPin,
  Moon,
  ShieldCheck,
  Sparkles,
  Sun,
} from 'lucide-vue-next'
import AppLogo from '@/components/AppLogo.vue'
import ImageCropDialog from '@/components/ImageCropDialog.vue'
import AddressForm from '@/components/AddressForm.vue'
import AuthFeedbackAlert from '@/domains/auth/components/AuthFeedbackAlert.vue'
import { clinicApi } from '../api/clinicApi'
import { HttpError } from '@/lib/http'
import { createClinicSchema } from '@/lib/validationRules'
import { RouteNames } from '@/router/routeNames'
import { useTheme } from '@/composables/useTheme'
import { useNeuralNetwork } from '@/composables/useNeuralNetwork'
import type { ValidationError } from '@/domains/auth/types/auth.types'
import type { PatientAddress } from '@/domains/patient/types/patient.types'

const router = useRouter()
const authStore = useAuthStore()
const { canvasRef } = useNeuralNetwork()
const { isDark, toggleTheme } = useTheme()

const userName = computed(() => authStore.user?.first_name ?? null)
const createdClinicName = ref('')

const { handleSubmit, setFieldError, validateField } = useForm({
  validationSchema: createClinicSchema,
})

const { value: clinicName, errorMessage: clinicNameError } = useField<string>('clinic_name')
const { value: email, errorMessage: emailError } = useField<string>('email')
const address = ref<PatientAddress | null>(null)
const isLoading = ref(false)
const generalError = ref<string | null>(null)

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

  if (step > currentStep.value && currentStep.value === 1) {
    const result = await validateField('clinic_name')
    if (!result.valid) return
  }

  stepDirection.value = step > currentStep.value ? 'forward' : 'backward'
  stepTransitioning.value = true

  await new Promise(r => setTimeout(r, 250))
  currentStep.value = step

  await nextTick()
  await new Promise(r => setTimeout(r, 50))
  stepTransitioning.value = false
}

const isCollapsing = ref(false)
const showSuccess = ref(false)
const showSuccessContent = ref(false)
const showCheckmark = ref(false)
const showProgressBar = ref(false)

const cropDialogOpen = ref(false)
const logoFile = ref<File | null>(null)
const logoPreview = ref<string | null>(null)

const ready = ref(false)
onMounted(() => {
  void canvasRef.value
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
        // Logo import is non-blocking.
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
  <div class="auth-shell relative flex min-h-dvh items-center justify-center overflow-x-hidden overflow-y-auto px-4 py-16 sm:px-6 sm:py-6">
    <canvas ref="canvasRef" class="pointer-events-none absolute inset-0 opacity-55" />
    <button
      type="button"
      class="auth-theme-toggle"
      :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
      @click="toggleTheme"
    >
      <Sun v-if="isDark" class="size-4" />
      <Moon v-else class="size-4" />
    </button>

    <div
      class="relative z-10 grid w-full max-w-5xl items-stretch gap-4 transition-all duration-700 ease-out sm:gap-6 lg:grid-cols-[0.92fr_1fr]"
      :class="ready ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'"
    >
      <section
        class="auth-side-panel hidden min-h-[680px] flex-col justify-between overflow-hidden rounded-3xl p-8 lg:flex"
        aria-label="Clinic onboarding"
      >
        <div>
          <div class="mb-10 flex justify-center">
            <AppLogo class="h-20 w-auto drop-shadow-[0_18px_38px_rgba(37,99,235,0.14)]" />
          </div>

          <div class="max-w-sm space-y-4">
            <p class="text-sm font-medium uppercase tracking-[0.16em] text-blue-600/80 dark:text-blue-300/80">
              Clinic onboarding
            </p>
            <h1 class="text-4xl font-semibold leading-tight text-foreground">
              Build the workspace your clinic will run on.
            </h1>
            <p class="text-base leading-7 text-muted-foreground">
              Add the essentials now, then refine profile details once the dashboard is ready.
            </p>
          </div>
        </div>

        <div class="grid gap-3">
          <div class="auth-status-row">
            <div class="auth-status-icon text-blue-600 dark:text-blue-300">
              <Building2 class="size-4" />
            </div>
            <div>
              <p class="text-sm font-semibold">Clinic identity</p>
              <p class="text-xs text-muted-foreground">Name the workspace your team will use</p>
            </div>
          </div>
          <div class="auth-status-row">
            <div class="auth-status-icon text-emerald-600 dark:text-emerald-300">
              <ShieldCheck class="size-4" />
            </div>
            <div>
              <p class="text-sm font-semibold">Owner access</p>
              <p class="text-xs text-muted-foreground">Your account becomes the clinic owner</p>
            </div>
          </div>
          <div class="auth-status-row">
            <div class="auth-status-icon text-teal-600 dark:text-teal-300">
              <Activity class="size-4" />
            </div>
            <div>
              <p class="text-sm font-semibold">Ready for workflows</p>
              <p class="text-xs text-muted-foreground">Patients, queues, billing, and schedules follow next</p>
            </div>
          </div>
        </div>
      </section>

      <div
        class="flex transition-all delay-200 duration-600 ease-in-out"
        :class="isCollapsing ? 'max-h-0 scale-95 overflow-hidden opacity-0' : 'max-h-[1200px] scale-100 opacity-100'"
      >
        <Card class="auth-onboarding-card mx-auto flex w-full min-w-0 max-w-lg justify-center rounded-2xl border-0 py-5 shadow-[0_32px_90px_-42px_oklch(0.22_0.08_245_/_0.62)] sm:min-h-[680px] sm:rounded-3xl sm:py-8 lg:h-full">
          <CardContent class="flex w-full min-w-0 flex-col justify-center px-4 sm:px-10">
            <div
              class="mb-4 flex justify-center transition-all delay-100 duration-700 ease-out lg:hidden"
              :class="ready ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'"
            >
              <div class="auth-logo-mark">
                <AppLogo class="h-11 w-auto" />
              </div>
            </div>

            <div
              class="mb-6 text-center transition-all delay-200 duration-700 ease-out"
              :class="ready ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'"
            >
              <h1 class="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                Welcome{{ userName ? `, ${userName}` : '' }}!
              </h1>
              <p class="mt-1 text-sm text-muted-foreground">Set up your clinic in a few steps</p>
            </div>

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
                    class="auth-step-dot"
                    :class="{
                      'is-active': step.number === currentStep,
                      'is-complete': step.number < currentStep,
                    }"
                  >
                    <Check v-if="step.number < currentStep" class="size-3.5" />
                    <span v-else>{{ step.number }}</span>
                  </div>
                  <span
                    class="hidden text-sm transition-colors duration-300 sm:inline"
                    :class="step.number === currentStep ? 'font-medium text-foreground' : 'text-muted-foreground'"
                  >
                    {{ step.label }}
                  </span>
                </button>
                <div
                  v-if="i < steps.length - 1"
                  class="h-px w-8 transition-colors duration-500 sm:w-12"
                  :class="step.number < currentStep ? 'bg-secondary' : step.number === currentStep ? 'bg-primary/30' : 'bg-border'"
                />
              </template>
            </div>

            <form class="mx-auto flex w-full max-w-[400px] flex-col" novalidate @submit.prevent="onSubmit">
              <AuthFeedbackAlert v-if="generalError" variant="danger" role="alert" class="mb-5">
                {{ generalError }}
              </AuthFeedbackAlert>

              <div class="relative overflow-hidden">
                <div
                  v-if="currentStep === 1"
                  class="flex flex-col gap-5 transition-all duration-300 ease-out"
                  :class="stepTransitioning
                    ? (stepDirection === 'forward' ? '-translate-x-8 opacity-0' : 'translate-x-8 opacity-0')
                    : 'translate-x-0 opacity-100'"
                >
                  <div class="text-center">
                    <h2 class="text-lg font-semibold">First things first</h2>
                    <p class="mt-1 text-sm text-muted-foreground">Give your clinic a name. You can change it later.</p>
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
                      class="auth-form-input"
                      required
                    />
                    <p v-if="clinicNameError" class="text-xs text-destructive">
                      {{ clinicNameError }}
                    </p>
                  </div>

                  <Button type="button" class="h-10 w-full text-base" @click="goToStep(2)">
                    Continue
                    <ArrowRight class="size-4" />
                  </Button>
                </div>

                <div
                  v-if="currentStep === 2"
                  class="flex flex-col gap-5 transition-all duration-300 ease-out"
                  :class="stepTransitioning
                    ? (stepDirection === 'forward' ? '-translate-x-8 opacity-0' : 'translate-x-8 opacity-0')
                    : 'translate-x-0 opacity-100'"
                >
                  <div class="text-center">
                    <h2 class="text-lg font-semibold">Almost there</h2>
                    <p class="mt-1 text-sm text-muted-foreground">Add contact details now, or skip and finish later.</p>
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
                      class="auth-form-input"
                    />
                    <p v-if="emailError" class="text-xs text-destructive">
                      {{ emailError }}
                    </p>
                  </div>

                  <div class="flex gap-3">
                    <Button type="button" variant="outline" class="h-10 flex-1" @click="goToStep(1)">
                      <ArrowLeft class="size-4" />
                      Back
                    </Button>
                    <Button type="button" class="h-10 flex-1" @click="goToStep(3)">
                      Continue
                      <ArrowRight class="size-4" />
                    </Button>
                  </div>
                </div>

                <div
                  v-if="currentStep === 3"
                  class="flex flex-col gap-5 transition-all duration-300 ease-out"
                  :class="stepTransitioning
                    ? (stepDirection === 'forward' ? '-translate-x-8 opacity-0' : 'translate-x-8 opacity-0')
                    : 'translate-x-0 opacity-100'"
                >
                  <div class="text-center">
                    <h2 class="text-lg font-semibold">Looking good</h2>
                    <p class="mt-1 text-sm text-muted-foreground">Upload a logo or add one later.</p>
                  </div>

                  <div class="flex flex-col items-center gap-3 py-4">
                    <div class="group relative">
                      <Avatar class="auth-clinic-logo size-28">
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
                    <Button type="button" variant="outline" class="h-10 flex-1" @click="goToStep(2)">
                      <ArrowLeft class="size-4" />
                      Back
                    </Button>
                    <Button type="submit" class="h-10 flex-1" :disabled="isLoading">
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

      <div v-if="showSuccess" class="flex w-full flex-col items-center">
        <Card class="auth-onboarding-card mx-auto flex w-full min-w-0 max-w-lg justify-center overflow-hidden rounded-2xl border-0 py-5 shadow-[0_32px_90px_-42px_oklch(0.22_0.08_245_/_0.62)] sm:min-h-[520px] sm:rounded-3xl sm:py-8">
          <CardContent class="flex w-full min-w-0 flex-col justify-center px-4 py-8 sm:px-10">
            <div
              class="flex flex-col items-center gap-6 transition-all duration-700 ease-out"
              :class="showSuccessContent ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'"
            >
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
                    class="size-10 text-green-600 transition-all duration-500 ease-out dark:text-green-400"
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

              <Button class="mt-2 h-10 w-full max-w-[400px] text-base" @click="router.push({ name: RouteNames.HOME })">
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
.auth-side-panel {
  background:
    linear-gradient(135deg, rgb(255 255 255 / 0.54), rgb(255 255 255 / 0.2) 54%, rgb(255 255 255 / 0.34)),
    rgb(255 255 255 / 0.08);
  border: 1px solid rgb(255 255 255 / 0.5);
  box-shadow: 0 32px 90px -42px oklch(0.22 0.08 245 / 0.62);
  backdrop-filter: blur(30px) saturate(1.22);
  -webkit-backdrop-filter: blur(30px) saturate(1.22);
}

.auth-onboarding-card {
  background:
    linear-gradient(145deg, rgb(255 255 255 / 0.72), rgb(255 255 255 / 0.38) 58%, rgb(255 255 255 / 0.5)),
    rgb(255 255 255 / 0.14);
  border: 0;
  backdrop-filter: blur(30px) saturate(1.2);
  -webkit-backdrop-filter: blur(30px) saturate(1.2);
}

.auth-theme-toggle {
  position: absolute;
  right: 0.875rem;
  top: 0.875rem;
  z-index: 20;
  display: inline-flex;
  height: 2.25rem;
  width: 2.25rem;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  border: 1px solid rgb(255 255 255 / 0.48);
  background: rgb(255 255 255 / 0.42);
  color: rgb(15 23 42 / 0.72);
  box-shadow: 0 14px 34px rgb(15 23 42 / 0.08);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  transition: transform 120ms ease, background 120ms ease, box-shadow 120ms ease;
}

.auth-theme-toggle:hover {
  transform: translateY(-1px);
  background: rgb(255 255 255 / 0.58);
  box-shadow: 0 18px 42px rgb(15 23 42 / 0.12);
}

.auth-theme-toggle:active {
  transform: translateY(0);
}

.auth-theme-toggle:focus-visible {
  outline: 2px solid rgb(37 99 235 / 0.45);
  outline-offset: 3px;
}

.auth-logo-mark {
  display: inline-flex;
  min-height: 3.25rem;
  min-width: 3.25rem;
  align-items: center;
  justify-content: center;
  border-radius: 1.5rem;
  border: 1px solid rgb(255 255 255 / 0.5);
  background: rgb(255 255 255 / 0.58);
  box-shadow: 0 18px 45px rgb(37 99 235 / 0.12);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}

@media (min-width: 640px) {
  .auth-theme-toggle {
    right: 1.5rem;
    top: 1.5rem;
    height: 2.5rem;
    width: 2.5rem;
  }

  .auth-logo-mark {
    min-height: 4rem;
    min-width: 4rem;
  }
}

.auth-status-row {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  border-radius: 1.25rem;
  border: 1px solid rgb(255 255 255 / 0.45);
  background: rgb(255 255 255 / 0.36);
  padding: 0.875rem;
  box-shadow: 0 14px 34px rgb(15 23 42 / 0.06);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}

.auth-status-icon {
  display: inline-flex;
  height: 2.5rem;
  width: 2.5rem;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  border: 1px solid rgb(255 255 255 / 0.5);
  background: rgb(255 255 255 / 0.58);
  box-shadow: 0 10px 24px rgb(15 23 42 / 0.06);
}

.auth-step-dot {
  display: flex;
  width: 1.75rem;
  height: 1.75rem;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  border: 1px solid rgb(255 255 255 / 0.45);
  background: rgb(255 255 255 / 0.36);
  color: var(--muted-foreground);
  font-size: 0.75rem;
  font-weight: 700;
  box-shadow: 0 10px 24px rgb(15 23 42 / 0.06);
  transition: transform 180ms ease, background 180ms ease, color 180ms ease, box-shadow 180ms ease;
}

.auth-step-dot.is-active {
  transform: scale(1.08);
  background: linear-gradient(135deg, #2f6fed, #19b8ad);
  color: white;
  box-shadow: 0 14px 32px rgb(37 99 235 / 0.2);
}

.auth-step-dot.is-complete {
  background: rgb(20 184 166 / 0.16);
  color: rgb(15 118 110);
}

.auth-clinic-logo {
  border: 1px solid rgb(255 255 255 / 0.5);
  box-shadow: 0 18px 45px rgb(37 99 235 / 0.12);
}

:deep(.auth-form-input),
:deep(input[data-slot='input']) {
  height: 2.75rem;
  border-radius: 1rem;
  border-color: rgb(255 255 255 / 0.55);
  background: rgb(255 255 255 / 0.62);
  box-shadow: 0 10px 26px rgb(15 23 42 / 0.06);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}

:deep(.auth-form-input:focus-visible),
:deep(input[data-slot='input']:focus-visible) {
  border-color: rgb(255 255 255 / 0.75);
  background: rgb(255 255 255 / 0.75);
}

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

:global(.dark .auth-step-dot) {
  border-color: rgb(148 163 184 / 0.14);
  background: rgb(15 23 42 / 0.56);
  color: rgb(203 213 225 / 0.78);
  box-shadow: 0 14px 30px rgb(0 0 0 / 0.22);
}

:global(.dark .auth-step-dot.is-complete) {
  background: rgb(20 184 166 / 0.18);
  color: rgb(125 245 228);
}

:global(.dark .auth-clinic-logo) {
  border-color: rgb(148 163 184 / 0.14);
  box-shadow: 0 18px 45px rgb(0 0 0 / 0.28);
}
</style>
