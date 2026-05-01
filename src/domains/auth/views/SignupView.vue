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
import { User, Mail, Lock, LoaderCircle } from 'lucide-vue-next'
import AppLogo from '@/components/AppLogo.vue'
import { HttpError } from '@/lib/http'
import { signupSchema } from '@/lib/validationRules'
import { RouteNames } from '@/router/routeNames'
import { useRecaptcha } from '@/composables/useRecaptcha'
import { useNeuralNetwork } from '@/composables/useNeuralNetwork'
import type { GoogleLinkRequiredResponse, ValidationError } from '../types/auth.types'
import PasswordStrengthBar from '../components/PasswordStrengthBar.vue'
import GoogleSignInButton from '../components/GoogleSignInButton.vue'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const { canvasRef } = useNeuralNetwork()
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
  <div class="auth-shell relative flex min-h-screen items-center justify-center overflow-hidden px-4">
    <canvas ref="canvasRef" class="pointer-events-none absolute inset-0" />

    <div
      class="relative z-10 w-full max-w-sm transition-all duration-700 ease-out"
      :class="ready ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'"
    >
      <div
        class="mb-4 flex justify-center transition-all delay-100 duration-700 ease-out"
        :class="ready ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'"
      >
        <AppLogo class="h-24 w-auto" />
      </div>

      <div
        class="transition-all delay-200 duration-700 ease-out"
        :class="ready ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'"
      >
        <Card class="border-primary/20 shadow-[0_28px_90px_-42px_oklch(0.28_0.09_245_/_0.65)]">
          <CardHeader class="text-center">
            <CardTitle class="text-xl">Create an account</CardTitle>
            <CardDescription>Get started with MediFlow</CardDescription>
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

              <div
                v-if="generalNotice"
                role="status"
                class="rounded-md border border-emerald-600/30 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700"
              >
                {{ generalNotice }}
              </div>

              <div
                v-if="hasGoogleSignIn"
                class="transition-all delay-300 duration-500 ease-out"
                :class="ready ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
              >
                <GoogleSignInButton :disabled="isLoading" text="signup_with" @credential="onGoogleCredential" />
              </div>

              <div
                v-if="hasGoogleSignIn"
                class="flex items-center gap-3 transition-all delay-300 duration-500 ease-out"
                :class="ready ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
              >
                <div class="h-px flex-1 bg-border" />
                <span class="text-xs text-muted-foreground">or</span>
                <div class="h-px flex-1 bg-border" />
              </div>

              <div
                class="grid grid-cols-2 gap-3 transition-all delay-300 duration-500 ease-out"
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
                <Button type="submit" class="w-full" :disabled="isLoading">
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
