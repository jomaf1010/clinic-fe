<script setup lang="ts">
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'
import type { PaymentRecord } from '../types/subscription.types'

defineProps<{
  payments: PaymentRecord[]
  currentPage: number
  totalPages: number
}>()

const emit = defineEmits<{
  pageChange: [page: number]
}>()

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'paid': return 'default'
    case 'pending': return 'secondary'
    case 'failed': return 'destructive'
    default: return 'outline'
  }
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle class="text-base font-semibold">Billing History</CardTitle>
    </CardHeader>
    <CardContent>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b text-left text-muted-foreground">
              <th class="pb-2 font-medium">Date</th>
              <th class="pb-2 font-medium">Amount</th>
              <th class="pb-2 font-medium">Status</th>
              <th class="pb-2 font-medium hidden sm:table-cell">Method</th>
              <th class="pb-2 font-medium hidden md:table-cell">Period</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="payment in payments" :key="payment.id" class="border-b last:border-0">
              <td class="py-2.5">{{ formatDate(payment.paid_at || payment.created_at) }}</td>
              <td class="py-2.5">{{ payment.currency }} {{ payment.amount.toLocaleString() }}</td>
              <td class="py-2.5">
                <Badge :variant="statusVariant(payment.status)" class="capitalize">
                  {{ payment.status }}
                </Badge>
              </td>
              <td class="py-2.5 capitalize hidden sm:table-cell">{{ payment.payment_method || '—' }}</td>
              <td class="py-2.5 hidden md:table-cell">
                {{ formatDate(payment.billing_period_start) }} — {{ formatDate(payment.billing_period_end) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="totalPages > 1" class="flex items-center justify-end gap-2 pt-4">
        <Button
          variant="outline"
          size="icon"
          :disabled="currentPage <= 1"
          @click="emit('pageChange', currentPage - 1)"
        >
          <ChevronLeft class="size-4" />
        </Button>
        <span class="text-sm text-muted-foreground">{{ currentPage }} / {{ totalPages }}</span>
        <Button
          variant="outline"
          size="icon"
          :disabled="currentPage >= totalPages"
          @click="emit('pageChange', currentPage + 1)"
        >
          <ChevronRight class="size-4" />
        </Button>
      </div>
    </CardContent>
  </Card>
</template>
