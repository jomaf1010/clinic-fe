<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { toast } from 'vue-sonner'
import { Pill, Plus, Pencil, Trash2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import MFDatePicker from '@/components/shared/MFDatePicker.vue'
import { usePatientDetailStore } from '@/stores/patientDetailStore'
import type { ContraceptiveEntry } from '../types/obgyn.types'
import { CONTRACEPTION_OPTIONS, contraceptionLabel } from '../types/obgyn.types'

defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const pdStore = usePatientDetailStore()
const gynProfile = computed(() => pdStore.gynProfile)

function formatDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

// ── Add flow ─────────────────────────────────────────────────────────────
const showAddContraceptionForm = ref(false)
const newContraception = reactive<{ method: string[]; start_date: string; end_date: string; notes: string }>({
  method: [], start_date: '', end_date: '', notes: '',
})

function toggleNewContraMethod(m: string) {
  const idx = newContraception.method.indexOf(m)
  if (idx === -1) newContraception.method.push(m)
  else newContraception.method.splice(idx, 1)
}

function resetNewContraception() {
  newContraception.method = []
  newContraception.start_date = ''
  newContraception.end_date = ''
  newContraception.notes = ''
  showAddContraceptionForm.value = false
}

async function addContraception() {
  if (!newContraception.method.length || !newContraception.start_date) return
  const current = gynProfile.value?.contraception ?? []
  const updated = [...current, {
    method: newContraception.method,
    start_date: newContraception.start_date,
    end_date: newContraception.end_date || null,
    notes: newContraception.notes || null,
  }]
  updated.sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime())
  try {
    await pdStore.updateGynProfile({ contraception: updated })
    resetNewContraception()
  } catch {
    toast.error('Failed to add record')
  }
}

// ── Edit flow ────────────────────────────────────────────────────────────
const editingContraceptionIndex = ref<number | null>(null)
const editContraception = reactive<{ end_date: string; notes: string }>({ end_date: '', notes: '' })

function startEditContraception(index: number) {
  const entry = gynProfile.value?.contraception?.[index]
  if (!entry) return
  editContraception.end_date = entry.end_date ?? ''
  editContraception.notes = entry.notes ?? ''
  editingContraceptionIndex.value = index
}

function cancelEditContraception() {
  editingContraceptionIndex.value = null
}

async function saveEditContraception() {
  const idx = editingContraceptionIndex.value
  if (idx === null) return
  const current = gynProfile.value?.contraception ?? []
  const updated = current.map((e: ContraceptiveEntry, i: number) =>
    i === idx ? { ...e, end_date: editContraception.end_date || null, notes: editContraception.notes || null } : e,
  )
  try {
    await pdStore.updateGynProfile({ contraception: updated })
    editingContraceptionIndex.value = null
  } catch {
    toast.error('Failed to update')
  }
}

async function removeContraception(index: number) {
  const current = gynProfile.value?.contraception ?? []
  const updated = current.filter((_: ContraceptiveEntry, i: number) => i !== index)
  try {
    await pdStore.updateGynProfile({ contraception: updated })
  } catch {
    toast.error('Failed to remove record')
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="max-w-md max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <Pill class="size-4 text-blue-600" />
          Contraception
        </DialogTitle>
      </DialogHeader>

      <div class="flex flex-col gap-3">
        <!-- Add form -->
        <div v-if="showAddContraceptionForm" class="rounded-lg border bg-muted/30 p-3 space-y-3">
          <div class="flex flex-col gap-1.5">
            <Label class="text-xs">Methods</Label>
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="opt in CONTRACEPTION_OPTIONS.filter(o => o.value !== 'none')"
                :key="opt.value"
                type="button"
                class="rounded-full border px-2.5 py-1 text-xs transition-colors"
                :class="newContraception.method.includes(opt.value) ? 'border-blue-300 bg-blue-50 text-blue-700 font-medium' : 'hover:bg-muted/50'"
                @click="toggleNewContraMethod(opt.value)"
              >
                {{ opt.label }}
              </button>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col gap-1.5">
              <Label class="text-xs">Start Date</Label>
              <MFDatePicker v-model="newContraception.start_date" placeholder="Start date" disable-future class="h-8 text-sm" />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label class="text-xs">End Date <span class="text-muted-foreground">(empty = current)</span></Label>
              <MFDatePicker v-model="newContraception.end_date" placeholder="Still using" disable-future class="h-8 text-sm" />
            </div>
          </div>
          <div class="flex flex-col gap-1.5">
            <Label class="text-xs">Notes</Label>
            <Input v-model="newContraception.notes" placeholder="e.g. Side effects, reason stopped..." class="h-8 text-sm" />
          </div>
          <div class="flex justify-end gap-2">
            <Button variant="ghost" size="sm" @click="resetNewContraception">Cancel</Button>
            <Button size="sm" :disabled="!newContraception.method.length || !newContraception.start_date" @click="addContraception">Save</Button>
          </div>
        </div>

        <!-- Empty state -->
        <div v-if="!gynProfile?.contraception?.length && !showAddContraceptionForm" class="py-8 text-center text-sm text-muted-foreground">
          No contraception recorded
        </div>

        <!-- Entry list -->
        <div v-for="(c, i) in (gynProfile?.contraception ?? [])" :key="i" class="rounded-lg border bg-card p-2.5">
          <!-- Viewing mode -->
          <template v-if="editingContraceptionIndex !== i">
            <div class="flex items-start gap-2">
              <div class="flex-1 min-w-0">
                <div class="flex flex-wrap items-center gap-1 mb-0.5">
                  <Badge
                    v-for="m in c.method"
                    :key="m"
                    variant="outline"
                    class="text-[10px] px-1.5 py-0"
                    :class="!c.end_date ? 'border-blue-200 bg-blue-50 text-blue-700' : ''"
                  >
                    {{ contraceptionLabel(m) }}
                  </Badge>
                  <span v-if="!c.end_date" class="text-[10px] font-medium text-blue-600">Active</span>
                </div>
                <p class="text-xs text-muted-foreground">
                  {{ formatDate(c.start_date) }} — {{ c.end_date ? formatDate(c.end_date) : 'Present' }}
                </p>
                <p v-if="c.notes" class="text-xs text-muted-foreground mt-0.5">{{ c.notes }}</p>
              </div>
              <Button variant="ghost" size="icon" class="size-6 shrink-0" @click="startEditContraception(i)">
                <Pencil class="size-3.5 text-muted-foreground" />
              </Button>
            </div>
          </template>

          <!-- Editing mode -->
          <template v-else>
            <div class="flex flex-col gap-2.5">
              <div class="flex flex-wrap items-center gap-1">
                <Badge v-for="m in c.method" :key="m" variant="outline" class="text-[10px] px-1.5 py-0">
                  {{ contraceptionLabel(m) }}
                </Badge>
                <span class="text-xs text-muted-foreground">from {{ formatDate(c.start_date) }}</span>
              </div>
              <div class="grid grid-cols-2 gap-2">
                <div class="flex flex-col gap-1">
                  <Label class="text-xs">End Date</Label>
                  <MFDatePicker v-model="editContraception.end_date" placeholder="Still using" disable-future class="h-8 text-sm" />
                </div>
                <div class="flex flex-col gap-1">
                  <Label class="text-xs">Notes</Label>
                  <Input v-model="editContraception.notes" placeholder="Reason stopped..." class="h-8 text-sm" />
                </div>
              </div>
              <div class="flex items-center justify-between">
                <Button variant="ghost" size="sm" class="text-destructive hover:text-destructive" @click="removeContraception(i)">
                  <Trash2 class="size-3.5 mr-1" />
                  Delete
                </Button>
                <div class="flex gap-2">
                  <Button variant="ghost" size="sm" @click="cancelEditContraception">Cancel</Button>
                  <Button size="sm" @click="saveEditContraception">Save</Button>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>

      <DialogFooter>
        <Button v-if="!showAddContraceptionForm" variant="secondary" size="sm" @click="showAddContraceptionForm = true">
          <Plus class="size-4 mr-1" />
          Add Record
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
