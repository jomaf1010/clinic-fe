<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { authApi } from '../api/authApi'
import { RouteNames } from '@/router/routeNames'
import { CircleCheck, CircleX, LoaderCircle, ArrowRight, ArrowLeft, RefreshCw } from 'lucide-vue-next'
import AppLogo from '@/components/AppLogo.vue'
import { useNeuralNetwork } from '@/composables/useNeuralNetwork'

const route = useRoute()
const { canvasRef } = useNeuralNetwork()

const status = ref<'verifying' | 'success' | 'error'>('verifying')
const errorMessage = ref<string | null>(null)
const userEmail = ref<string | null>(null)

const ready = ref(false)
onMounted(() => {
  void canvasRef.value
  requestAnimationFrame(() => {
    ready.value = true
  })
})

onMounted(async () => {
  const token = typeof route.query.token === 'string' ? route.query.token : null
  const encodedEmail = typeof route.query.email === 'string' ? route.query.email : null

  let email: string | null = null
  try {
    email = encodedEmail ? atob(encodedEmail) : null
  } catch {
    status.value = 'error'
    errorMessage.value = 'Invalid verification link. Please check your email and try again.'
    return
  }
  userEmail.value = email

  if (!token || !email) {
    status.value = 'error'
    errorMessage.value = 'Invalid verification link. Please check your email and try again.'
    return
  }

  try {
    await authApi.verifyEmail({ email, token })
    status.value = 'success'
  } catch {
    status.value = 'error'
    errorMessage.value = 'The verification link is invalid or has expired. Please request a new one.'
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
        <Card class="border-primary/20 shadow-[0_28px_90px_-42px_oklch(0.28_0.09_245_/_0.65)]">
          <!-- Verifying state -->
          <template v-if="status === 'verifying'">
            <CardHeader class="text-center">
              <div class="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-primary/10">
                <LoaderCircle class="size-6 animate-spin text-primary" />
              </div>
              <CardTitle class="text-xl">Verifying your email</CardTitle>
              <CardDescription>Please wait while we verify your email address...</CardDescription>
            </CardHeader>
          </template>

          <!-- Success state -->
          <template v-else-if="status === 'success'">
            <CardHeader class="text-center">
              <div class="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-green-500/10">
                <CircleCheck class="size-6 text-green-600 dark:text-green-400" />
              </div>
              <CardTitle class="text-xl">Email verified</CardTitle>
              <CardDescription>Your email has been verified successfully. You can now sign in to your account.</CardDescription>
            </CardHeader>
            <CardContent>
              <RouterLink :to="{ name: RouteNames.LOGIN }">
                <Button class="w-full">
                  Continue to sign in
                  <ArrowRight class="size-4" />
                </Button>
              </RouterLink>
            </CardContent>
          </template>

          <!-- Error state -->
          <template v-else>
            <CardHeader class="text-center">
              <div class="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-destructive/10">
                <CircleX class="size-6 text-destructive" />
              </div>
              <CardTitle class="text-xl">Verification failed</CardTitle>
              <CardDescription>{{ errorMessage }}</CardDescription>
            </CardHeader>
            <CardContent class="flex flex-col gap-3">
              <RouterLink v-if="userEmail" :to="{ name: RouteNames.VERIFY_EMAIL_NOTICE, query: { email: userEmail } }">
                <Button class="w-full">
                  <RefreshCw class="size-4" />
                  Resend verification email
                </Button>
              </RouterLink>
              <RouterLink :to="{ name: RouteNames.LOGIN }">
                <Button variant="ghost" class="w-full">
                  <ArrowLeft class="size-4" />
                  Back to sign in
                </Button>
              </RouterLink>
            </CardContent>
          </template>
        </Card>
      </div>
    </div>
  </div>
</template>
