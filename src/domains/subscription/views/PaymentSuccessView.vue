<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { CheckCircle, Loader2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { RouteNames } from '@/router/routeNames'
import { useAuthStore } from '@/domains/auth/stores/authStore'
import { subscriptionApi } from '../api/subscriptionApi'

const router = useRouter()
const authStore = useAuthStore()

const confirmed = ref(false)
const processing = ref(true)

async function pollForConfirmation() {
  const delays = [1000, 2000, 4000]

  for (const delay of delays) {
    await new Promise((r) => setTimeout(r, delay))

    try {
      await authStore.fetchUser()
      if (authStore.isPro && !authStore.isOnTrial) {
        confirmed.value = true
        processing.value = false
        return
      }
    } catch {
      // ignore, retry
    }

    try {
      const statusRes = await subscriptionApi.getStatus()
      if (statusRes.data.plan === 'pro' && !statusRes.data.is_trial) {
        confirmed.value = true
        processing.value = false
        await authStore.fetchUser()
        return
      }
    } catch {
      // ignore
    }
  }

  // After retries, still show success (webhook may be delayed)
  processing.value = false
}

onMounted(() => {
  pollForConfirmation()
})
</script>

<template>
  <div class="flex min-h-[60vh] items-center justify-center p-4">
    <div class="flex flex-col items-center gap-6 text-center max-w-md">
      <template v-if="processing">
        <Loader2 class="size-12 text-muted-foreground animate-spin" />
        <div>
          <h2 class="text-xl font-semibold">Processing payment...</h2>
          <p class="mt-1 text-sm text-muted-foreground">
            Please wait while we confirm your payment.
          </p>
        </div>
      </template>

      <template v-else>
        <div class="flex size-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
          <CheckCircle class="size-8 text-green-600 dark:text-green-400" />
        </div>
        <div>
          <h2 class="text-xl font-semibold">
            {{ confirmed ? 'Payment Successful!' : 'Payment Received' }}
          </h2>
          <p class="mt-1 text-sm text-muted-foreground">
            <template v-if="confirmed">
              Your clinic is now on the Pro plan. All premium features are unlocked.
            </template>
            <template v-else>
              Your payment is being processed. Your plan will be updated shortly.
            </template>
          </p>
        </div>
        <Button @click="router.push({ name: RouteNames.HOME })">
          Go to Dashboard
        </Button>
      </template>
    </div>
  </div>
</template>
