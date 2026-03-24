<script setup lang="ts">
import { ref } from 'vue'
import { AlertTriangle } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useSubscriptionStore } from '../stores/subscriptionStore'

const open = ref(false)
const subscriptionStore = useSubscriptionStore()

async function handleCancel() {
  await subscriptionStore.cancelSubscription()
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogTrigger as-child>
      <Button variant="outline" size="sm" class="text-destructive">
        Cancel Subscription
      </Button>
    </DialogTrigger>
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <AlertTriangle class="size-5 text-destructive" />
          Cancel Subscription
        </DialogTitle>
        <DialogDescription>
          Are you sure you want to cancel your Pro subscription?
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-3 py-2 text-sm">
        <p>Your clinic will remain on the Pro plan until the end of your current billing period.</p>
        <p class="text-muted-foreground">
          After that, your clinic will be moved to the Free plan. Your data will be preserved,
          but Pro features like Messages, Appointments, and Lab Orders will be locked.
        </p>
      </div>

      <div class="flex justify-end gap-2 pt-2">
        <Button variant="outline" @click="open = false">
          Keep Pro
        </Button>
        <Button
          variant="destructive"
          :disabled="subscriptionStore.cancelLoading"
          @click="handleCancel"
        >
          Cancel Subscription
        </Button>
      </div>
    </DialogContent>
  </Dialog>
</template>
