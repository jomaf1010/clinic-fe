<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { toast } from 'vue-sonner'
import { LoaderCircle, CreditCard } from 'lucide-vue-next'
import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'
import Label from '@/components/ui/label/Label.vue'
import Textarea from '@/components/ui/textarea/Textarea.vue'
import Separator from '@/components/ui/separator/Separator.vue'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useBillingStore } from '../stores/billingStore'
import type { InvoiceResponse, PaymentMethod } from '../types/billing.types'

const props = defineProps<{
  open: boolean
  invoice: InvoiceResponse | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  recorded: []
}>()

const billingStore = useBillingStore()

const amount = ref('')
const method = ref<PaymentMethod>('cash')
const referenceNumber = ref('')
const notes = ref('')
const error = ref<string | null>(null)

const isGcash = computed(() => method.value === 'gcash')
const amountNum = computed(() => parseFloat(amount.value) || 0)
const maxBalance = computed(() => props.invoice?.balance ?? 0)

function formatCurrency(val: number): string {
  return '\u20B1' + val.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function reset() {
  amount.value = props.invoice ? String(props.invoice.balance) : ''
  method.value = 'cash'
  referenceNumber.value = ''
  notes.value = ''
  error.value = null
}

watch(
  () => props.open,
  (open) => {
    if (open) reset()
  },
)

async function handleSubmit() {
  if (!props.invoice || amountNum.value <= 0) return
  error.value = null

  try {
    await billingStore.recordPayment(props.invoice.id, {
      amount: amountNum.value,
      method: method.value,
      reference_number: referenceNumber.value.trim() || null,
      notes: notes.value.trim() || null,
    })
    emit('recorded')
    emit('update:open', false)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to record payment.'
    error.value = msg
    toast.error(msg)
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="(val) => emit('update:open', val)">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <CreditCard class="size-5 text-primary" />
          Record Payment
        </DialogTitle>
        <DialogDescription v-if="invoice">
          {{ invoice.invoice_number }}
        </DialogDescription>
      </DialogHeader>

      <div
        v-if="error"
        role="alert"
        class="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
      >
        {{ error }}
      </div>

      <form v-if="invoice" class="flex flex-col gap-4" @submit.prevent="handleSubmit">
        <!-- Total Amount (read-only) -->
        <div class="flex flex-col gap-1.5 rounded-md bg-muted/50 p-4">
          <div class="flex justify-between text-sm">
            <span class="text-muted-foreground">Invoice Total</span>
            <span class="tabular-nums font-medium">{{ formatCurrency(invoice.total) }}</span>
          </div>
          <div v-if="invoice.amount_paid > 0" class="flex justify-between text-sm">
            <span class="text-muted-foreground">Previously Paid</span>
            <span class="tabular-nums text-green-600">{{ formatCurrency(invoice.amount_paid) }}</span>
          </div>
          <Separator class="my-1" />
          <div class="flex justify-between text-sm font-semibold">
            <span>Balance Due</span>
            <span class="tabular-nums text-destructive">{{ formatCurrency(invoice.balance) }}</span>
          </div>
        </div>

        <!-- Payment Method -->
        <div class="flex flex-col gap-2">
          <Label>Payment Method</Label>
          <div class="flex gap-2">
            <Button
              type="button"
              size="sm"
              :variant="method === 'cash' ? 'default' : 'outline'"
              class="flex-1"
              @click="method = 'cash'"
            >
              Cash
            </Button>
            <Button
              type="button"
              size="sm"
              :variant="method === 'gcash' ? 'default' : 'outline'"
              class="flex-1"
              @click="method = 'gcash'"
            >
              GCash
            </Button>
          </div>
        </div>

        <!-- Reference number (GCash only) -->
        <div v-if="isGcash" class="flex flex-col gap-2">
          <Label for="pay_ref">Reference Number</Label>
          <Input
            id="pay_ref"
            v-model="referenceNumber"
            placeholder="GCash reference number"
            :disabled="billingStore.isSaving"
          />
        </div>

        <!-- Amount Received -->
        <div class="flex flex-col gap-2">
          <Label for="pay_amount">Amount Received (₱)</Label>
          <Input
            id="pay_amount"
            v-model="amount"
            type="number"
            step="0.01"
            min="0.01"
            :max="maxBalance"
            placeholder="0.00"
            :disabled="billingStore.isSaving"
          />
          <p v-if="amountNum > 0 && amountNum < maxBalance" class="text-xs text-amber-600 dark:text-amber-400">
            Partial payment — remaining balance will be {{ formatCurrency(maxBalance - amountNum) }}
          </p>
        </div>

        <!-- Notes -->
        <div class="flex flex-col gap-2">
          <Label for="pay_notes">Notes <span class="text-muted-foreground">(optional)</span></Label>
          <Textarea
            id="pay_notes"
            v-model="notes"
            placeholder="Any additional notes..."
            rows="2"
            :disabled="billingStore.isSaving"
          />
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            :disabled="billingStore.isSaving"
            @click="emit('update:open', false)"
          >
            Cancel
          </Button>
          <Button type="submit" :disabled="billingStore.isSaving || amountNum <= 0">
            <LoaderCircle v-if="billingStore.isSaving" class="size-3.5 animate-spin" />
            {{ billingStore.isSaving ? 'Recording...' : 'Record Payment' }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
