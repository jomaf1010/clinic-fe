<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { FileText, LoaderCircle } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { clinicApi } from '@/domains/clinic/api/clinicApi'
import { useAuthStore } from '@/domains/auth/stores/authStore'

const authStore = useAuthStore()
const isFetching = ref(true)
const isSaving = ref(false)

const autoGeneratePdf = ref(true)
const prescriptionQtyMode = ref<'absolute' | 'adjusted'>('absolute')
const autoRegenOnQtyChange = ref(true)

onMounted(async () => {
  try {
    const res = await clinicApi.show()
    const settings = res.data.settings ?? {}
    autoGeneratePdf.value = settings.auto_generate_prescription_pdf !== false
    prescriptionQtyMode.value = (settings.prescription_quantity_mode as 'absolute' | 'adjusted') ?? 'absolute'
    autoRegenOnQtyChange.value = settings.auto_regenerate_pdf_on_qty_change !== false
  } catch {
    toast.error('Failed to load settings')
  } finally {
    isFetching.value = false
  }
})

async function saveSetting(key: string, value: unknown) {
  isSaving.value = true
  try {
    await clinicApi.update({
      settings: { [key]: value },
    })
    await authStore.fetchUser()
    toast.success('Setting saved')
  } catch {
    toast.error('Failed to save setting')
  } finally {
    isSaving.value = false
  }
}

function toggleAutoGenerate(val: boolean) {
  autoGeneratePdf.value = val
  saveSetting('auto_generate_prescription_pdf', val)
}

function toggleQtyMode(val: boolean) {
  prescriptionQtyMode.value = val ? 'adjusted' : 'absolute'
  saveSetting('prescription_quantity_mode', val ? 'adjusted' : 'absolute')
}

function toggleAutoRegen(val: boolean) {
  autoRegenOnQtyChange.value = val
  saveSetting('auto_regenerate_pdf_on_qty_change', val)
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <div v-if="isFetching" class="flex items-center justify-center py-12">
      <LoaderCircle class="size-5 animate-spin text-muted-foreground" />
    </div>

    <template v-else>
      <!-- Consultation Settings -->
      <Card>
        <CardHeader>
          <div class="flex items-center gap-2">
            <FileText class="size-4 text-muted-foreground" />
            <CardTitle class="text-base">Prescription Generation</CardTitle>
          </div>
          <CardDescription>Settings for prescription PDF generation and quantity handling</CardDescription>
        </CardHeader>

        <CardContent class="flex flex-col gap-6">
          <!-- Auto-generate prescription PDF -->
          <div class="flex items-start gap-4">
            <Switch
              :model-value="autoGeneratePdf"
              :disabled="isSaving"
              class="mt-0.5 shrink-0"
              @update:model-value="toggleAutoGenerate"
            />
            <div>
              <Label class="text-sm font-medium">Auto-generate prescription PDF</Label>
              <p class="mt-0.5 text-xs text-muted-foreground">
                Automatically generate a downloadable prescription PDF when a consultation is finalized. If disabled, doctors must manually generate the PDF from the consultation view.
              </p>
            </div>
          </div>

          <!-- Prescription quantity mode -->
          <div class="flex flex-col gap-4">
            <div class="flex items-start gap-4">
              <Switch
                :model-value="prescriptionQtyMode === 'adjusted'"
                :disabled="isSaving"
                class="mt-0.5 shrink-0"
                @update:model-value="toggleQtyMode"
              />
              <div>
                <Label class="text-sm font-medium">Auto-deduct purchased quantity from prescription</Label>
                <p class="mt-0.5 text-xs text-muted-foreground">
                  When enabled, the prescription PDF shows only the remaining quantity the patient still needs to purchase. For example, if the doctor prescribed #21 and the patient already bought 14, the PDF will show #7. When disabled, the prescription always shows the full prescribed quantity regardless of what was purchased.
                </p>
              </div>
            </div>

            <!-- Sub-setting: Auto-regenerate on quantity change -->
            <div v-if="prescriptionQtyMode === 'adjusted'" class="ml-12 flex items-start gap-4 border-l-2 border-border pl-4">
              <Switch
                :model-value="autoRegenOnQtyChange"
                :disabled="isSaving"
                class="mt-0.5 shrink-0"
                @update:model-value="toggleAutoRegen"
              />
              <div>
                <Label class="text-sm font-medium">Auto-regenerate PDF on quantity change</Label>
                <p class="mt-0.5 text-xs text-muted-foreground">
                  Automatically regenerate the prescription PDF whenever medicine quantities are modified in billing or the consultation payment tab. When disabled, a prompt will ask the user whether to regenerate.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </template>
  </div>
</template>
