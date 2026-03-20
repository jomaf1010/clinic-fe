<script setup lang="ts">
import { ref, watch } from 'vue'
import { LoaderCircle, CheckCircle2 } from 'lucide-vue-next'
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
import type { ClinicConsumable, CreateConsumablePayload, UpdateConsumablePayload } from '../types/consumable.types'

const props = defineProps<{
  open: boolean
  consumable: ClinicConsumable | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  save: [payload: CreateConsumablePayload | UpdateConsumablePayload]
}>()

const isSaving = ref(false)

const form = ref(emptyForm())

function emptyForm() {
  return {
    name: '',
    description: '',
    price: '',
    stock_quantity: '0',
  }
}

watch(
  () => props.open,
  (open) => {
    if (!open) return
    if (props.consumable) {
      form.value = {
        name: props.consumable.name ?? '',
        description: props.consumable.description ?? '',
        price: props.consumable.price != null ? String(props.consumable.price) : '',
        stock_quantity: String(props.consumable.stock_quantity ?? 0),
      }
    } else {
      form.value = emptyForm()
    }
  },
)

function handleSubmit() {
  if (!form.value.name.trim()) return

  const payload: CreateConsumablePayload | UpdateConsumablePayload = {
    name: form.value.name.trim(),
    description: form.value.description.trim() || null,
    price: form.value.price ? parseFloat(form.value.price) : null,
    stock_quantity: parseInt(form.value.stock_quantity) || 0,
  }

  emit('save', payload)
}

defineExpose({ isSaving })
</script>

<template>
  <Dialog :open="open" @update:open="(val) => emit('update:open', val)">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ consumable ? 'Edit Consumable' : 'Add Consumable' }}</DialogTitle>
        <DialogDescription>
          {{ consumable ? 'Update consumable details.' : 'Add a new consumable to the clinic catalog.' }}
        </DialogDescription>
      </DialogHeader>

      <form class="flex flex-col gap-4" @submit.prevent="handleSubmit">
        <div class="flex flex-col gap-1">
          <label class="text-xs text-muted-foreground">Name *</label>
          <Input v-model="form.name" placeholder="e.g. Surgical Gloves (Medium)" />
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-xs text-muted-foreground">Description</label>
          <Textarea v-model="form.description" placeholder="Optional description..." :rows="2" />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div class="flex flex-col gap-1">
            <label class="text-xs text-muted-foreground">Price</label>
            <Input v-model="form.price" type="number" step="0.01" min="0" placeholder="0.00" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-xs text-muted-foreground">Stock Quantity</label>
            <Input v-model="form.stock_quantity" type="number" min="0" placeholder="0" />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" :disabled="isSaving" @click="emit('update:open', false)">
            Cancel
          </Button>
          <Button :disabled="isSaving || !form.name.trim()">
            <LoaderCircle v-if="isSaving" class="size-3.5 animate-spin" />
            <CheckCircle2 v-else class="size-3.5" />
            {{ consumable ? 'Save Changes' : 'Add Consumable' }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
