<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useForm, useField } from 'vee-validate'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ArrowLeft, CircleCheck, Clock3, LoaderCircle, Mail, MailCheck, Moon, ShieldCheck, Sun } from 'lucide-vue-next'
import AppLogo from '@/components/AppLogo.vue'
import { HttpError } from '@/lib/http'
import { forgotPasswordSchema } from '@/lib/validationRules'
import { RouteNames } from '@/router/routeNames'
import { useTheme } from '@/composables/useTheme'
import { useNeuralNetwork } from '@/composables/useNeuralNetwork'
import { authApi } from '../api/authApi'
import type { ValidationError } from '../types/auth.types'
import AuthFeedbackAlert from '../components/AuthFeedbackAlert.vue'

const { canvasRef } = useNeuralNetwork()
const { isDark, toggleTheme } = useTheme()

const { handleSubmit, setFieldError } = useForm({
  validationSchema: forgotPasswordSchema,
})

const { value: email, errorMessage: emailError } = useField<string>('email')

const isLoading = ref(false)
const generalError = ref<string | null>(null)
const submitted = ref(false)

const ready = ref(false)
onMounted(() => {
  void canvasRef.value
  requestAnimationFrame(() => {
    ready.value = true
  })
})

const onSubmit = handleSubmit(async (values) => {
  generalError.value = null
  isLoading.value = true

  try {
    await authApi.forgotPassword(values.email)
    submitted.value = true
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
        class="auth-side-panel hidden min-h-[520px] flex-col justify-between overflow-hidden rounded-3xl p-8 lg:flex"
        aria-label="MediFlow account recovery"
      >
        <div>
          <div class="mb-10 flex justify-center">
            <AppLogo class="h-20 w-auto drop-shadow-[0_18px_38px_rgba(37,99,235,0.14)]" />
          </div>

          <div class="max-w-sm space-y-4">
            <p class="text-sm font-medium uppercase tracking-[0.16em] text-blue-600/80 dark:text-blue-300/80">
              Account recovery
            </p>
            <h1 class="text-4xl font-semibold leading-tight text-foreground">
              Recover access without breaking clinic flow.
            </h1>
            <p class="text-base leading-7 text-muted-foreground">
              We will send a secure reset link if the email belongs to a MediFlow account.
            </p>
          </div>
        </div>

        <div class="grid gap-3">
          <div class="auth-status-row">
            <div class="auth-status-icon text-blue-600 dark:text-blue-300">
              <MailCheck class="size-4" />
            </div>
            <div>
              <p class="text-sm font-semibold">Email check</p>
              <p class="text-xs text-muted-foreground">No account details are exposed on this screen</p>
            </div>
          </div>
          <div class="auth-status-row">
            <div class="auth-status-icon text-emerald-600 dark:text-emerald-300">
              <ShieldCheck class="size-4" />
            </div>
            <div>
              <p class="text-sm font-semibold">Secure reset</p>
              <p class="text-xs text-muted-foreground">Only the email link can continue the recovery</p>
            </div>
          </div>
          <div class="auth-status-row">
            <div class="auth-status-icon text-teal-600 dark:text-teal-300">
              <Clock3 class="size-4" />
            </div>
            <div>
              <p class="text-sm font-semibold">Return to work</p>
              <p class="text-xs text-muted-foreground">Set a new password and continue sign-in</p>
            </div>
          </div>
        </div>
      </section>

      <div
        class="flex transition-all delay-200 duration-700 ease-out"
        :class="ready ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'"
      >
        <Card class="auth-recovery-card mx-auto flex w-full min-w-0 max-w-lg justify-center rounded-2xl border-0 py-5 shadow-[0_32px_90px_-42px_oklch(0.22_0.08_245_/_0.62)] sm:min-h-[520px] sm:rounded-3xl sm:py-8 lg:h-full">
          <CardHeader class="px-4 pb-4 text-center sm:px-10 sm:pb-6">
            <div
              class="mb-2 flex justify-center transition-all delay-100 duration-700 ease-out lg:hidden"
              :class="ready ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'"
            >
              <div class="auth-logo-mark">
                <AppLogo class="h-11 w-auto" />
              </div>
            </div>
            <template v-if="submitted">
              <div class="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-[var(--feedback-success-bg)] text-[var(--feedback-success-fg)]">
                <CircleCheck class="size-6" />
              </div>
              <CardTitle class="text-xl sm:text-2xl">Check your email</CardTitle>
              <CardDescription>
                If an account exists with that email, we sent a password reset link.
              </CardDescription>
            </template>
            <template v-else>
              <CardTitle class="text-xl sm:text-2xl">Forgot password?</CardTitle>
              <CardDescription>Enter your email and we will send you a reset link</CardDescription>
            </template>
          </CardHeader>

          <CardContent class="min-w-0 px-4 sm:px-10">
            <div v-if="submitted" class="mx-auto flex w-full max-w-[400px] flex-col gap-5">
              <AuthFeedbackAlert variant="success" role="status">
                The link may take a minute to arrive. Check spam if it does not show in your inbox.
              </AuthFeedbackAlert>
              <RouterLink :to="{ name: RouteNames.LOGIN }">
                <Button class="h-10 w-full text-base">
                  <ArrowLeft class="size-4" />
                  Back to sign in
                </Button>
              </RouterLink>
            </div>

            <form v-else class="mx-auto flex w-full max-w-[400px] flex-col gap-4 sm:gap-5" novalidate @submit.prevent="onSubmit">
              <AuthFeedbackAlert
                v-if="generalError"
                variant="danger"
                role="alert"
              >
                {{ generalError }}
              </AuthFeedbackAlert>

              <div
                class="flex flex-col gap-2 transition-all delay-300 duration-500 ease-out"
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
                class="transition-all delay-[350ms] duration-500 ease-out"
                :class="ready ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
              >
                <Button type="submit" class="h-10 w-full text-base" :disabled="isLoading">
                  <LoaderCircle v-if="isLoading" class="size-4 animate-spin" />
                  {{ isLoading ? 'Sending...' : 'Send reset link' }}
                </Button>
              </div>

              <p
                class="text-center text-sm text-muted-foreground transition-all delay-[400ms] duration-500 ease-out"
                :class="ready ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
              >
                Remember your password?
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

.auth-recovery-card {
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

:global(.dark) .auth-recovery-card {
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
