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
import { Mail, LoaderCircle, CircleCheck, ArrowLeft } from 'lucide-vue-next'
import AppLogo from '@/components/AppLogo.vue'
import { HttpError } from '@/lib/http'
import { forgotPasswordSchema } from '@/lib/validationRules'
import { RouteNames } from '@/router/routeNames'
import { useNeuralNetwork } from '@/composables/useNeuralNetwork'
import { authApi } from '../api/authApi'
import type { ValidationError } from '../types/auth.types'

const { canvasRef } = useNeuralNetwork()

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
        <!-- Success state -->
        <Card v-if="submitted" class="border-primary/20 shadow-[0_28px_90px_-42px_oklch(0.28_0.09_245_/_0.65)]">
          <CardHeader class="text-center">
            <div class="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-green-500/10">
              <CircleCheck class="size-6 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle class="text-xl">Check your email</CardTitle>
            <CardDescription>
              If an account exists with that email, we've sent a password reset link.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RouterLink :to="{ name: RouteNames.LOGIN }">
              <Button variant="outline" class="w-full">
                <ArrowLeft class="size-4" />
                Back to sign in
              </Button>
            </RouterLink>
          </CardContent>
        </Card>

        <!-- Form state -->
        <Card v-else class="border-primary/20 shadow-[0_28px_90px_-42px_oklch(0.28_0.09_245_/_0.65)]">
          <CardHeader class="text-center">
            <CardTitle class="text-xl">Forgot password?</CardTitle>
            <CardDescription>Enter your email and we'll send you a reset link</CardDescription>
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
                <Button type="submit" class="w-full" :disabled="isLoading">
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
