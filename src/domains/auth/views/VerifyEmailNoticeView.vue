<script setup lang="ts">
import { ref, computed } from 'vue'
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
import { HttpError } from '@/lib/http'
import { RouteNames } from '@/router/routeNames'
import { MailCheck, RefreshCw, LoaderCircle, ArrowLeft } from 'lucide-vue-next'

const route = useRoute()
const email = computed(() =>
  typeof route.query.email === 'string' ? route.query.email : '',
)

const isResending = ref(false)
const resendMessage = ref<string | null>(null)
const resendError = ref<string | null>(null)

async function resend() {
  if (!email.value) return

  resendMessage.value = null
  resendError.value = null
  isResending.value = true

  try {
    const response = await authApi.resendVerification({ email: email.value })
    resendMessage.value = response.message
  } catch (err) {
    if (err instanceof HttpError && err.status === 429) {
      resendError.value = 'Too many requests. Please wait a moment before trying again.'
    } else {
      resendError.value = 'An error occurred. Please try again.'
    }
  } finally {
    isResending.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-background px-4">
    <div class="w-full max-w-sm">
      <div class="mb-8 text-center">
        <h1 class="text-2xl font-bold tracking-tight text-foreground">Clinic App</h1>
        <p class="mt-1 text-sm text-muted-foreground">Patient management system</p>
      </div>

      <Card>
        <CardHeader class="text-center">
          <div class="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-primary/10">
            <MailCheck class="size-6 text-primary" />
          </div>
          <CardTitle class="text-xl">Check your email</CardTitle>
          <CardDescription>
            We've sent a verification link to
            <span v-if="email" class="font-medium text-foreground">{{ email }}</span>
          </CardDescription>
        </CardHeader>

        <CardContent class="flex flex-col gap-4">
          <p class="text-center text-sm text-muted-foreground">
            Click the link in the email to verify your account. If you don't see it, check your spam folder.
          </p>

          <div
            v-if="resendMessage"
            role="status"
            class="rounded-md border border-green-500/30 bg-green-500/10 px-3 py-2.5 text-center text-sm text-green-700 dark:text-green-400"
          >
            {{ resendMessage }}
          </div>

          <div
            v-if="resendError"
            role="alert"
            class="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-center text-sm text-destructive"
          >
            {{ resendError }}
          </div>

          <Button variant="outline" class="w-full" :disabled="isResending" @click="resend">
            <LoaderCircle v-if="isResending" class="size-4 animate-spin" />
            <RefreshCw v-else class="size-4" />
            {{ isResending ? 'Resending...' : 'Resend verification email' }}
          </Button>

          <p class="text-center text-sm text-muted-foreground">
            <RouterLink
              :to="{ name: RouteNames.LOGIN }"
              class="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
            >
              <ArrowLeft class="size-3.5" />
              Back to sign in
            </RouterLink>
          </p>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
