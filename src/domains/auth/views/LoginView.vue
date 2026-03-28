<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useForm, useField } from 'vee-validate'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useAuthStore } from '../stores/authStore'
import { Mail, Lock, LoaderCircle } from 'lucide-vue-next'
import AppLogo from '@/components/AppLogo.vue'
import { HttpError } from '@/lib/http'
import { loginSchema } from '@/lib/validationRules'
import { RouteNames } from '@/router/routeNames'
import { useNeuralNetwork } from '@/composables/useNeuralNetwork'
import type { ValidationError } from '../types/auth.types'

const router = useRouter()
const authStore = useAuthStore()
const { canvasRef } = useNeuralNetwork()

const { handleSubmit, setFieldError } = useForm({
  validationSchema: loginSchema,
})

const { value: email, errorMessage: emailError } = useField<string>('email')
const { value: password, errorMessage: passwordError } = useField<string>('password')

const isLoading = ref(false)
const generalError = ref<string | null>(null)
const showResendLink = ref(false)
const rememberMe = ref(true)

const ready = ref(false)
onMounted(() => {
  requestAnimationFrame(() => {
    ready.value = true
  })
})

const onSubmit = handleSubmit(async (values) => {
  generalError.value = null
  showResendLink.value = false
  isLoading.value = true

  try {
    await authStore.login({ email: values.email, password: values.password, remember_me: rememberMe.value })
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
      } else if (err.status === 401) {
        generalError.value = 'Invalid email or password.'
      } else if (err.status === 403) {
        const body = err.data as { message?: string; error_code?: string }
        if (body.error_code === 'email_not_verified') {
          generalError.value = 'Please verify your email address before signing in.'
          showResendLink.value = true
        } else {
          generalError.value = body.message || 'Access denied.'
        }
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
        <Card class="backdrop-blur-sm bg-card/90">
          <CardHeader class="text-center">
            <CardTitle class="text-xl">Welcome back!</CardTitle>
            <CardDescription>Sign in to your account</CardDescription>
          </CardHeader>

          <CardContent>
            <form class="flex flex-col gap-5" novalidate @submit.prevent="onSubmit">
              <div
                v-if="generalError"
                role="alert"
                class="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
              >
                {{ generalError }}
                <RouterLink
                  v-if="showResendLink"
                  :to="{ name: RouteNames.VERIFY_EMAIL_NOTICE, query: { email: email } }"
                  class="mt-1 block font-medium underline underline-offset-4 hover:text-destructive/80"
                >
                  Resend verification email
                </RouterLink>
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
                class="flex flex-col gap-2 transition-all delay-[350ms] duration-500 ease-out"
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
                  autocomplete="current-password"
                  :disabled="isLoading"
                  :aria-invalid="!!passwordError"
                  required
                />
                <p v-if="passwordError" class="text-xs text-destructive">
                  {{ passwordError }}
                </p>
              </div>

              <div
                class="transition-all delay-[400ms] duration-500 ease-out"
                :class="ready ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
              >
                <div class="flex justify-end">
                  <RouterLink
                    :to="{ name: RouteNames.FORGOT_PASSWORD }"
                    class="text-xs text-muted-foreground hover:text-primary underline-offset-4 hover:underline"
                  >
                    Forgot password?
                  </RouterLink>
                </div>
              </div>

              <div
                class="flex items-center gap-2 transition-all delay-[450ms] duration-500 ease-out"
                :class="ready ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
              >
                <Checkbox id="remember-me" :checked="rememberMe" @update:checked="rememberMe = $event" :disabled="isLoading" />
                <Label for="remember-me" class="text-sm font-normal cursor-pointer">Remember me</Label>
              </div>

              <div
                class="transition-all delay-[500ms] duration-500 ease-out"
                :class="ready ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
              >
                <Button type="submit" class="w-full" :disabled="isLoading">
                  <LoaderCircle v-if="isLoading" class="size-4 animate-spin" />
                  {{ isLoading ? 'Signing in...' : 'Sign in' }}
                </Button>
              </div>

              <p
                class="text-center text-sm text-muted-foreground transition-all delay-[550ms] duration-500 ease-out"
                :class="ready ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
              >
                Don't have an account?
                <RouterLink
                  :to="{ name: RouteNames.SIGNUP }"
                  class="font-medium text-primary underline-offset-4 hover:underline"
                >
                  Sign up
                </RouterLink>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  </div>
</template>
