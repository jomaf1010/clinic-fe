<script setup lang="ts">
import { ref } from 'vue'
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
import type { ValidationError } from '../types/auth.types'

const router = useRouter()
const authStore = useAuthStore()

const { handleSubmit, setFieldError } = useForm({
  validationSchema: loginSchema,
})

const { value: email, errorMessage: emailError } = useField<string>('email')
const { value: password, errorMessage: passwordError } = useField<string>('password')

const isLoading = ref(false)
const generalError = ref<string | null>(null)
const rememberMe = ref(true)

const onSubmit = handleSubmit(async (values) => {
  generalError.value = null
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
        generalError.value = 'Please verify your email address before signing in.'
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
  <div class="flex min-h-screen items-center justify-center bg-background px-4">
    <div class="w-full max-w-sm">
      <div class="mb-4 flex justify-center">
        <AppLogo class="h-24 w-auto" />
      </div>

      <Card>
        <CardHeader class="text-center">
          <CardTitle class="text-xl">Sign in</CardTitle>
          <CardDescription>Enter your credentials to access your account</CardDescription>
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

            <div class="flex flex-col gap-2">
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

            <div class="flex flex-col gap-2">
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

            <div class="flex items-center gap-2">
              <Checkbox id="remember-me" :checked="rememberMe" @update:checked="rememberMe = $event" :disabled="isLoading" />
              <Label for="remember-me" class="text-sm font-normal cursor-pointer">Remember me</Label>
            </div>

            <Button type="submit" class="w-full" :disabled="isLoading">
              <LoaderCircle v-if="isLoading" class="size-4 animate-spin" />
              {{ isLoading ? 'Signing in...' : 'Sign in' }}
            </Button>

            <p class="text-center text-sm text-muted-foreground">
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
</template>
