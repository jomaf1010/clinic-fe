<script setup lang="ts">
import { useRouter } from 'vue-router'
import { XCircle } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { RouteNames } from '@/router/routeNames'

const router = useRouter()
</script>

<template>
  <div class="flex min-h-[60vh] items-center justify-center p-4">
    <div class="flex flex-col items-center gap-6 text-center max-w-md">
      <div class="flex size-16 items-center justify-center rounded-full bg-muted">
        <XCircle class="size-8 text-muted-foreground" />
      </div>
      <div>
        <h2 class="text-xl font-semibold">Payment Cancelled</h2>
        <p class="mt-1 text-sm text-muted-foreground">
          Your payment was cancelled. No charges were made. You can try again anytime.
        </p>
      </div>
      <div class="flex gap-3">
        <Button variant="outline" @click="router.push({ name: RouteNames.HOME })">
          Back to Dashboard
        </Button>
        <Button @click="router.push({ name: RouteNames.SUBSCRIPTION })">
          Try Again
        </Button>
      </div>
    </div>
  </div>
</template>
