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
import { CircleCheck, CircleX, LoaderCircle, ArrowRight, UserPlus, ArrowLeft } from 'lucide-vue-next'

const route = useRoute()

const status = ref<'verifying' | 'success' | 'error'>('verifying')
const errorMessage = ref<string | null>(null)

onMounted(async () => {
  const token = typeof route.query.token === 'string' ? route.query.token : null
  const email = typeof route.query.email === 'string' ? route.query.email : null

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
  <div class="flex min-h-screen items-center justify-center bg-background px-4">
    <div class="w-full max-w-sm">
      <div class="mb-8 text-center">
        <h1 class="text-2xl font-bold tracking-tight text-foreground">Clinic App</h1>
        <p class="mt-1 text-sm text-muted-foreground">Patient management system</p>
      </div>

      <Card>
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
            <RouterLink :to="{ name: RouteNames.SIGNUP }">
              <Button variant="outline" class="w-full">
                <UserPlus class="size-4" />
                Sign up again
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
</template>
