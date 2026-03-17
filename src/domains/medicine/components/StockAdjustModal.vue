<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { LoaderCircle, CheckCircle2, Package } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { ClinicMedicine } from '../types/medicine.types'

const props = defineProps<{
  open: boolean
  medicine: ClinicMedicine | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  adjust: [payload: { adjustment: number; reason: string }]
}>()

const isSaving = ref(false)
const adjustment = ref('')
const reason = ref('')

watch(
  () => props.open,
  (open) => {
    if (open) {
      adjustment.value = ''
      reason.value = ''
    }
  },
)

const resultingStock = computed(() => {
  if (!props.medicine) return 0
  const adj = parseInt(adjustment.value) || 0
  return (props.medicine.stock_quantity ?? 0) + adj
})

const isNegativeResult = computed(() => resultingStock.value < 0)

function handleSubmit() {
  const adj = parseInt(adjustment.value)
  if (!adj || !reason.value.trim()) return
  emit('adjust', { adjustment: adj, reason: reason.value.trim() })
}

defineExpose({ isSaving })
</script>

<template>
  <Dialog :open="open" @update:open="(val) => emit('update:open', val)">
    <DialogContent class="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>Adjust Stock</DialogTitle>
        <DialogDescription>
          {{ medicine?.name }}{{ medicine?.strength ? ` ${medicine.strength}` : '' }}
        </DialogDescription>
      </DialogHeader>

      <form class="flex flex-col gap-4" @submit.prevent="handleSubmit">
        <div class="flex items-center justify-center gap-3 rounded-md border bg-muted/20 p-3">
          <Package class="size-5 text-muted-foreground" />
          <div class="text-center">
            <div class="text-2xl font-bold">{{ medicine?.stock_quantity ?? 0 }}</div>
            <div class="text-xs text-muted-foreground">Current Stock</div>
          </div>
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-xs text-muted-foreground">Adjustment (+/-)</label>
          <Input v-model="adjustment" type="number" placeholder="e.g. +10 or -5" />
          <div v-if="adjustment" class="text-xs" :class="isNegativeResult ? 'text-destructive' : 'text-muted-foreground'">
            Resulting stock: <span class="font-medium">{{ resultingStock }}</span>
            <span v-if="isNegativeResult"> (cannot be negative)</span>
          </div>
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-xs text-muted-foreground">Reason *</label>
          <Textarea v-model="reason" placeholder="e.g. Restocked from supplier" :rows="2" />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" :disabled="isSaving" @click="emit('update:open', false)">
            Cancel
          </Button>
          <Button :disabled="isSaving || !adjustment || isNegativeResult || !reason.trim()">
            <LoaderCircle v-if="isSaving" class="size-3.5 animate-spin" />
            <CheckCircle2 v-else class="size-3.5" />
            Adjust Stock
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
