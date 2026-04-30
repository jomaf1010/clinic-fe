<script setup lang="ts">
import { computed } from 'vue'
import { Crown, Clock, AlertTriangle } from 'lucide-vue-next'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useSubscriptionStore } from '../stores/subscriptionStore'
import CancelSubscriptionDialog from './CancelSubscriptionDialog.vue'
import type { SubscriptionStatus as StatusType } from '../types/subscription.types'

const props = defineProps<{
  status: StatusType
}>()

const subscriptionStore = useSubscriptionStore()

const billingEndFormatted = computed(() => {
  if (!props.status.billing_period_ends_at) return null
  return new Date(props.status.billing_period_ends_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
})

const planLabel = computed(() => {
  if (props.status.is_trial) return 'Pro Trial'
  if (props.status.plan === 'pro') return 'Pro'
  return 'Free'
})
</script>

<template>
  <Card>
    <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle class="text-base font-semibold">Current Plan</CardTitle>
      <Badge
        :variant="status.plan === 'pro' ? 'default' : 'secondary'"
        class="gap-1"
      >
        <Crown v-if="status.plan === 'pro'" class="size-3" />
        {{ planLabel }}
      </Badge>
    </CardHeader>
    <CardContent class="space-y-3">
      <div v-if="status.is_trial && status.trial_days_left !== null" class="flex items-center gap-2 text-sm">
        <Clock class="size-4 text-blue-500" />
        <span>Trial ends in <strong>{{ status.trial_days_left }} day{{ status.trial_days_left === 1 ? '' : 's' }}</strong></span>
      </div>

      <div v-if="status.is_in_grace_period" class="flex items-center gap-2 text-sm text-destructive">
        <AlertTriangle class="size-4" />
        <span>Billing overdue — renew to keep Pro features</span>
      </div>

      <div v-if="billingEndFormatted && !status.is_trial" class="text-sm text-muted-foreground">
        <template v-if="status.cancel_at_period_end">
          Pro access until <strong>{{ billingEndFormatted }}</strong> (cancellation scheduled)
        </template>
        <template v-else>
          Next billing: <strong>{{ billingEndFormatted }}</strong> · PHP {{ status.next_billing_amount.toLocaleString() }}
        </template>
      </div>

      <div v-if="status.plan === 'pro' && !status.is_trial && billingEndFormatted" class="flex gap-2 pt-1">
        <template v-if="status.cancel_at_period_end">
          <Button
            variant="outline"
            size="sm"
            :disabled="subscriptionStore.cancelLoading"
            @click="subscriptionStore.reactivateSubscription()"
          >
            Reactivate
          </Button>
        </template>
        <template v-else>
          <CancelSubscriptionDialog />
        </template>
      </div>
    </CardContent>
  </Card>
</template>
