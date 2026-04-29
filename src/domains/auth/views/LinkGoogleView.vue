<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import AppLogo from '@/components/AppLogo.vue'
import { HttpError } from '@/lib/http'
import { RouteNames } from '@/router/routeNames'
import { useAuthStore } from '../stores/authStore'
import { CheckCircle2, LoaderCircle, XCircle } from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const isLoading = ref(true)
const isSuccess = ref(false)
const errorMessage = ref<string | null>(null)

const email = computed(() => (typeof route.query.email === 'string' ? route.query.email : null))
const token = computed(() => (typeof route.query.token === 'string' ? route.query.token : null))

async function confirmLink(): Promise<void> {
  if (!email.value || !token.value) {
    errorMessage.value = 'This Google link is missing required data.'
    isLoading.value = false
    return
  }

  try {
    await authStore.confirmGoogleLink(email.value, token.value, true)
    isSuccess.value = true
    router.push({ name: RouteNames.HOME })
  } catch (err) {
    if (err instanceof HttpError && err.status === 422) {
      errorMessage.value = 'This Google link is invalid or expired.'
    } else {
      errorMessage.value = 'Unable to link Google sign-in. Please request a new link.'
    }
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  confirmLink()
})
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-background px-4">
    <div class="w-full max-w-sm">
      <div class="mb-4 flex justify-center">
        <AppLogo class="h-24 w-auto" />
      </div>

      <Card class="backdrop-blur-sm bg-card/90">
        <CardHeader class="text-center">
          <div class="mb-2 flex justify-center">
            <LoaderCircle v-if="isLoading" class="size-8 animate-spin text-primary" />
            <CheckCircle2 v-else-if="isSuccess" class="size-8 text-emerald-600" />
            <XCircle v-else class="size-8 text-destructive" />
          </div>
          <CardTitle class="text-xl">
            {{ isLoading ? 'Linking Google' : isSuccess ? 'Google linked' : 'Link expired' }}
          </CardTitle>
          <CardDescription>
            {{ isLoading ? 'Confirming your one-time link...' : isSuccess ? 'Taking you to MediFlow.' : errorMessage }}
          </CardDescription>
        </CardHeader>
        <CardContent v-if="!isLoading && !isSuccess" class="flex flex-col gap-3">
          <Button class="w-full" @click="router.push({ name: RouteNames.LOGIN, query: email ? { email } : {} })">
            Back to sign in
          </Button>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
