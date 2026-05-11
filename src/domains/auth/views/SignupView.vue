<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useForm, useField } from 'vee-validate'
import { Button } from '@/components/ui/button'
import { Input, PasswordInput } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useAuthStore } from '../stores/authStore'
import { Activity, Building2, Lock, LoaderCircle, Mail, Moon, ShieldCheck, Sun, User } from 'lucide-vue-next'
import AppLogo from '@/components/AppLogo.vue'
import { HttpError } from '@/lib/http'
import { signupSchema } from '@/lib/validationRules'
import { RouteNames } from '@/router/routeNames'
import { useTheme } from '@/composables/useTheme'
import { useRecaptcha } from '@/composables/useRecaptcha'
import { useNeuralNetwork } from '@/composables/useNeuralNetwork'
import type { GoogleLinkRequiredResponse, ValidationError } from '../types/auth.types'
import PasswordStrengthBar from '../components/PasswordStrengthBar.vue'
import GoogleSignInButton from '../components/GoogleSignInButton.vue'
import AuthFeedbackAlert from '../components/AuthFeedbackAlert.vue'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const { canvasRef } = useNeuralNetwork()
const { isDark, toggleTheme } = useTheme()
const hasGoogleSignIn = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID)

const { handleSubmit, setFieldError } = useForm({
  validationSchema: signupSchema,
})

const { value: firstName, errorMessage: firstNameError } = useField<string>('first_name')
const { value: lastName, errorMessage: lastNameError } = useField<string>('last_name')
const { value: email, errorMessage: emailError } = useField<string>('email')
const { value: password, errorMessage: passwordError } = useField<string>('password')

const { load: loadRecaptcha, execute: executeRecaptcha } = useRecaptcha()
const isLoading = ref(false)
const generalError = ref<string | null>(null)
const generalNotice = ref<string | null>(null)
const linkDialogOpen = ref(false)
const pendingGoogleCredential = ref<string | null>(null)
const pendingGoogleEmail = ref<string | null>(null)
const linkRequestLoading = ref(false)

const ready = ref(false)
onMounted(() => {
  void canvasRef.value
  loadRecaptcha()
  requestAnimationFrame(() => {
    ready.value = true
  })
  const prefillEmail = route.query.email
  if (typeof prefillEmail === 'string' && prefillEmail) {
    email.value = prefillEmail
  }
})

const onSubmit = handleSubmit(async (values) => {
  generalError.value = null
  generalNotice.value = null
  isLoading.value = true

  try {
    const recaptchaToken = await executeRecaptcha('signup')
    await authStore.signup({
      email: values.email,
      password: values.password,
      ...(values.first_name ? { first_name: values.first_name } : {}),
      ...(values.last_name ? { last_name: values.last_name } : {}),
      recaptcha_token: recaptchaToken,
    })
    router.push({ name: RouteNames.VERIFY_EMAIL_NOTICE, query: { email: values.email } })
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

function handleGoogleError(err: unknown): void {
  if (err instanceof HttpError) {
    if (err.status === 409) {
      const body = err.data as GoogleLinkRequiredResponse
      if (body.status === 'link_required') {
        pendingGoogleEmail.value = body.email
        linkDialogOpen.value = true
        return
      }
    }

    if (err.status === 422) {
      const body = err.data as ValidationError
      generalError.value = body.message ?? 'Google sign-up could not be verified.'
      return
    }
  }

  generalError.value = 'Google sign-up failed. Please try again.'
}

async function onGoogleCredential(credential: string): Promise<void> {
  generalError.value = null
  generalNotice.value = null
  pendingGoogleCredential.value = credential
  isLoading.value = true

  try {
    await authStore.googleLogin(credential, true)
    router.push({ name: RouteNames.HOME })
  } catch (err) {
    handleGoogleError(err)
  } finally {
    isLoading.value = false
  }
}

async function requestGoogleLink(): Promise<void> {
  if (!pendingGoogleCredential.value) {
    return
  }

  linkRequestLoading.value = true
  generalError.value = null

  try {
    await authStore.requestGoogleLink(pendingGoogleCredential.value)
    linkDialogOpen.value = false
    generalNotice.value = `Check ${pendingGoogleEmail.value ?? 'your email'} to finish linking Google sign-in.`
  } catch {
    generalError.value = 'Unable to send the Google link email. Please try again.'
  } finally {
    linkRequestLoading.value = false
  }
}
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
        aria-label="MediFlow signup"
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
              Start your MediFlow clinic workspace.
            </h1>
            <p class="text-base leading-7 text-muted-foreground">
              Create your account, verify your email, then set up the clinic workspace your team will use.
            </p>
          </div>
        </div>

        <div class="grid gap-3">
          <div class="auth-status-row">
            <div class="auth-status-icon text-blue-600 dark:text-blue-300">
              <Building2 class="size-4" />
            </div>
            <div>
              <p class="text-sm font-semibold">Clinic-ready profile</p>
              <p class="text-xs text-muted-foreground">Use your real name for workspace invites</p>
            </div>
          </div>
          <div class="auth-status-row">
            <div class="auth-status-icon text-emerald-600 dark:text-emerald-300">
              <ShieldCheck class="size-4" />
            </div>
            <div>
              <p class="text-sm font-semibold">Protected identity</p>
              <p class="text-xs text-muted-foreground">Email verification keeps account access clean</p>
            </div>
          </div>
          <div class="auth-status-row">
            <div class="auth-status-icon text-teal-600 dark:text-teal-300">
              <Activity class="size-4" />
            </div>
            <div>
              <p class="text-sm font-semibold">Built for clinic flow</p>
              <p class="text-xs text-muted-foreground">Patients, schedules, billing, and care notes in one place</p>
            </div>
          </div>
        </div>
      </section>

      <div
        class="flex transition-all delay-200 duration-700 ease-out"
        :class="ready ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'"
      >
        <Card class="auth-signup-card mx-auto flex w-full min-w-0 max-w-lg justify-center rounded-2xl border-0 py-5 shadow-[0_32px_90px_-42px_oklch(0.22_0.08_245_/_0.62)] sm:min-h-[680px] sm:rounded-3xl sm:py-8 lg:h-full">
          <CardHeader class="px-4 pb-4 text-center sm:px-10 sm:pb-6">
            <div
              class="mb-2 flex justify-center transition-all delay-100 duration-700 ease-out lg:hidden"
              :class="ready ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'"
            >
              <div class="auth-logo-mark">
                <AppLogo class="h-11 w-auto" />
              </div>
            </div>
            <CardTitle class="text-xl sm:text-2xl">Create an account</CardTitle>
            <CardDescription>Get started with MediFlow</CardDescription>
          </CardHeader>

          <CardContent class="min-w-0 px-4 sm:px-10">
            <form class="mx-auto flex w-full max-w-[400px] flex-col gap-4 sm:gap-5" novalidate @submit.prevent="onSubmit">
              <AuthFeedbackAlert
                v-if="generalError"
                variant="danger"
                role="alert"
              >
                {{ generalError }}
              </AuthFeedbackAlert>

              <AuthFeedbackAlert
                v-if="generalNotice"
                variant="success"
                role="status"
              >
                {{ generalNotice }}
              </AuthFeedbackAlert>

              <div
                v-if="hasGoogleSignIn"
                class="transition-all delay-300 duration-500 ease-out"
                :class="ready ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
              >
                <GoogleSignInButton
                  :disabled="isLoading"
                  shape="pill"
                  text="signup_with"
                  @credential="onGoogleCredential"
                />
              </div>

              <div
                v-if="hasGoogleSignIn"
                class="flex items-center gap-3 px-1 transition-all delay-300 duration-500 ease-out"
                :class="ready ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
              >
                <div class="h-px flex-1 bg-white/60 dark:bg-white/10" />
                <span class="text-xs text-muted-foreground">or</span>
                <div class="h-px flex-1 bg-white/60 dark:bg-white/10" />
              </div>

              <div
                class="grid grid-cols-1 gap-3 transition-all delay-300 duration-500 ease-out sm:grid-cols-2"
                :class="ready ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
              >
                <div class="flex flex-col gap-2">
                  <Label for="first_name" class="flex items-center gap-1.5">
                    <User class="size-3.5 text-muted-foreground" />
                    First name
                  </Label>
                  <Input
                    id="first_name"
                    v-model="firstName"
                    type="text"
                    placeholder="Juan"
                    autocomplete="given-name"
                    :disabled="isLoading"
                    :aria-invalid="!!firstNameError"
                  />
                  <p v-if="firstNameError" class="text-xs text-destructive">
                    {{ firstNameError }}
                  </p>
                </div>
                <div class="flex flex-col gap-2">
                  <Label for="last_name" class="flex items-center gap-1.5">
                    <User class="size-3.5 text-muted-foreground" />
                    Last name
                  </Label>
                  <Input
                    id="last_name"
                    v-model="lastName"
                    type="text"
                    placeholder="Dela Cruz"
                    autocomplete="family-name"
                    :disabled="isLoading"
                    :aria-invalid="!!lastNameError"
                  />
                  <p v-if="lastNameError" class="text-xs text-destructive">
                    {{ lastNameError }}
                  </p>
                </div>
              </div>

              <div
                class="flex flex-col gap-2 transition-all delay-[350ms] duration-500 ease-out"
                :class="ready ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
              >
                <Label for="email" class="flex items-center gap-1.5">
                  <Mail class="size-3.5 text-muted-foreground" />
                  Email
                </Label>
                <Input
                  id="email"
                  v-model="email"
                  type="email"
                  placeholder="you@example.com"
                  autocomplete="email"
                  :disabled="isLoading"
                  :aria-invalid="!!emailError"
                  required
                />
                <p v-if="emailError" class="text-xs text-destructive">
                  {{ emailError }}
                </p>
              </div>

              <div
                class="flex flex-col gap-2 transition-all delay-[400ms] duration-500 ease-out"
                :class="ready ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
              >
                <Label for="password" class="flex items-center gap-1.5">
                  <Lock class="size-3.5 text-muted-foreground" />
                  Password
                </Label>
                <PasswordInput
                  id="password"
                  v-model="password"
                  placeholder="••••••••"
                  autocomplete="new-password"
                  :disabled="isLoading"
                  :aria-invalid="!!passwordError"
                  required
                />
                <p v-if="passwordError" class="text-xs text-destructive">
                  {{ passwordError }}
                </p>
                <PasswordStrengthBar :password="password ?? ''" />
              </div>

              <div
                class="transition-all delay-[450ms] duration-500 ease-out"
                :class="ready ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
              >
                <Button type="submit" class="h-10 w-full text-base" :disabled="isLoading">
                  <LoaderCircle v-if="isLoading" class="size-4 animate-spin" />
                  {{ isLoading ? 'Creating account...' : 'Create account' }}
                </Button>
              </div>

              <p
                class="text-center text-xs leading-relaxed text-muted-foreground transition-all delay-500 duration-500 ease-out"
                :class="ready ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
              >
                By signing up, you agree to our
                <a href="https://mediflow.ph/terms" target="_blank" rel="noopener noreferrer" class="font-medium text-primary underline-offset-4 hover:underline">Terms of Service</a>
                and
                <a href="https://mediflow.ph/privacy" target="_blank" rel="noopener noreferrer" class="font-medium text-primary underline-offset-4 hover:underline">Privacy Policy</a>.
                This site is protected by reCAPTCHA and the Google
                <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" class="font-medium text-primary underline-offset-4 hover:underline">Privacy Policy</a>
                and
                <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer" class="font-medium text-primary underline-offset-4 hover:underline">Terms of Service</a>
                apply.
              </p>

              <p
                class="text-center text-sm text-muted-foreground transition-all delay-[550ms] duration-500 ease-out"
                :class="ready ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
              >
                Already have an account?
                <RouterLink
                  :to="{ name: RouteNames.LOGIN }"
                  class="font-medium text-primary underline-offset-4 hover:underline"
                >
                  Sign in
                </RouterLink>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>

    <AlertDialog :open="linkDialogOpen" @update:open="linkDialogOpen = $event">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Link Google sign-in?</AlertDialogTitle>
          <AlertDialogDescription>
            {{ pendingGoogleEmail }} already has a MediFlow account. We will email a one-time confirmation link before enabling Google sign-in for that account.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="linkRequestLoading">Cancel</AlertDialogCancel>
          <AlertDialogAction :disabled="linkRequestLoading" @click.prevent="requestGoogleLink">
            <LoaderCircle v-if="linkRequestLoading" class="size-4 animate-spin" />
            Send link email
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
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

.auth-signup-card {
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

:global(.dark) .auth-side-panel {
  background:
    linear-gradient(135deg, rgb(15 23 42 / 0.58), rgb(15 23 42 / 0.28) 54%, rgb(15 23 42 / 0.42)),
    rgb(15 23 42 / 0.12);
  border-color: rgb(255 255 255 / 0.1);
  box-shadow: 0 24px 80px -38px rgb(0 0 0 / 0.82);
}

:global(.dark) .auth-signup-card {
  background:
    linear-gradient(145deg, rgb(15 23 42 / 0.66), rgb(15 23 42 / 0.42) 58%, rgb(15 23 42 / 0.52)),
    rgb(15 23 42 / 0.16);
}

:global(.dark) .auth-theme-toggle {
  border-color: rgb(255 255 255 / 0.1);
  background: rgb(255 255 255 / 0.08);
  color: rgb(226 232 240 / 0.86);
  box-shadow: 0 16px 38px rgb(0 0 0 / 0.28);
}

:global(.dark) .auth-theme-toggle:hover {
  background: rgb(255 255 255 / 0.12);
}

:global(.dark) .auth-logo-mark,
:global(.dark) .auth-status-row,
:global(.dark) .auth-status-icon {
  border-color: rgb(255 255 255 / 0.1);
  background: rgb(255 255 255 / 0.08);
}
</style>
