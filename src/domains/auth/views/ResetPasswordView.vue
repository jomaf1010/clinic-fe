<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useForm, useField } from 'vee-validate'
import { Button } from '@/components/ui/button'
import { PasswordInput } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Lock, LoaderCircle, CircleCheck, CircleX, ArrowRight } from 'lucide-vue-next'
import AppLogo from '@/components/AppLogo.vue'
import { HttpError } from '@/lib/http'
import { resetPasswordSchema } from '@/lib/validationRules'
import { RouteNames } from '@/router/routeNames'
import { useNeuralNetwork } from '@/composables/useNeuralNetwork'
import { authApi } from '../api/authApi'
import type { ValidationError } from '../types/auth.types'
import PasswordStrengthBar from '../components/PasswordStrengthBar.vue'

const route = useRoute()
const { canvasRef } = useNeuralNetwork()

const token = typeof route.query.token === 'string' ? route.query.token : null
const encodedEmail = typeof route.query.email === 'string' ? route.query.email : null
const decodedEmail = encodedEmail ? atob(encodedEmail) : null

const hasValidParams = !!(token && decodedEmail)

const { handleSubmit, setFieldError } = useForm({
  validationSchema: resetPasswordSchema,
})

const { value: password, errorMessage: passwordError } = useField<string>('password')
const { value: passwordConfirmation, errorMessage: passwordConfirmationError } = useField<string>('password_confirmation')

const isLoading = ref(false)
const generalError = ref<string | null>(null)
const succeeded = ref(false)

const ready = ref(false)
onMounted(() => {
  void canvasRef.value
  requestAnimationFrame(() => {
    ready.value = true
  })
})

const onSubmit = handleSubmit(async (values) => {
  if (values.password !== values.password_confirmation) {
    setFieldError('password_confirmation', 'Passwords do not match.')
    return
  }

  generalError.value = null
  isLoading.value = true

  try {
    await authApi.resetPassword({
      email: decodedEmail!,
      token: token!,
      password: values.password,
      password_confirmation: values.password_confirmation,
    })
    succeeded.value = true
  } catch (err) {
    if (err instanceof HttpError) {
      if (err.status === 422) {
        const body = err.data as ValidationError
        const serverErrors = body.errors ?? {}

        for (const [field, messages] of Object.entries(serverErrors)) {
          setFieldError(field, messages[0])
        }

        generalError.value = body.message ?? 'Validation failed.'
      } else if (err.status === 400) {
        generalError.value = 'This password reset link is invalid or has expired. Please request a new one.'
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
        <!-- Invalid params state -->
        <Card v-if="!hasValidParams" class="backdrop-blur-sm bg-card/90">
          <CardHeader class="text-center">
            <div class="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-destructive/10">
              <CircleX class="size-6 text-destructive" />
            </div>
            <CardTitle class="text-xl">Invalid reset link</CardTitle>
            <CardDescription>
              This password reset link is missing required parameters. Please request a new one.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RouterLink :to="{ name: RouteNames.FORGOT_PASSWORD }">
              <Button class="w-full">
                Request a new link
              </Button>
            </RouterLink>
          </CardContent>
        </Card>

        <!-- Success state -->
        <Card v-else-if="succeeded" class="backdrop-blur-sm bg-card/90">
          <CardHeader class="text-center">
            <div class="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-green-500/10">
              <CircleCheck class="size-6 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle class="text-xl">Password reset!</CardTitle>
            <CardDescription>
              Your password has been updated successfully. You can now sign in with your new password.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RouterLink :to="{ name: RouteNames.LOGIN }">
              <Button class="w-full">
                Continue to sign in
                <ArrowRight class="size-4" />
              </Button>
            </RouterLink>
          </CardContent>
        </Card>

        <!-- Form state -->
        <Card v-else class="backdrop-blur-sm bg-card/90">
          <CardHeader class="text-center">
            <CardTitle class="text-xl">Set new password</CardTitle>
            <CardDescription>Enter your new password below</CardDescription>
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
                class="flex flex-col gap-2 transition-all delay-300 duration-500 ease-out"
                :class="ready ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
              >
                <Label for="password" class="flex items-center gap-1.5">
                  <Lock class="size-3.5 text-muted-foreground" />
                  New password
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
                class="flex flex-col gap-2 transition-all delay-[350ms] duration-500 ease-out"
                :class="ready ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
              >
                <Label for="password-confirmation" class="flex items-center gap-1.5">
                  <Lock class="size-3.5 text-muted-foreground" />
                  Confirm password
                </Label>
                <PasswordInput
                  id="password-confirmation"
                  v-model="passwordConfirmation"
                  placeholder="••••••••"
                  autocomplete="new-password"
                  :disabled="isLoading"
                  :aria-invalid="!!passwordConfirmationError"
                  required
                />
                <p v-if="passwordConfirmationError" class="text-xs text-destructive">
                  {{ passwordConfirmationError }}
                </p>
              </div>

              <div
                class="transition-all delay-[400ms] duration-500 ease-out"
                :class="ready ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
              >
                <Button type="submit" class="w-full" :disabled="isLoading">
                  <LoaderCircle v-if="isLoading" class="size-4 animate-spin" />
                  {{ isLoading ? 'Resetting...' : 'Reset password' }}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  </div>
</template>
