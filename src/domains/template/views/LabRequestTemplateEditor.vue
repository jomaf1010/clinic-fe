<script setup lang="ts">
import { reactive, computed, ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, LoaderCircle } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { useAuthStore } from '@/domains/auth/stores/authStore'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RouteNames } from '@/router/routeNames'
import { defaultLabRequestTemplate } from '@/domains/template/types/template.types'
import { templateApi } from '@/domains/template/api/templateApi'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const category = computed(() => route.params.category as string)
const variation = computed(() => route.params.variation as string)

const template = reactive({ ...defaultLabRequestTemplate })
const templateName = ref('Default')
const isLoading = ref(false)
const isSaving = ref(false)

const clinicName = computed(() => authStore.currentClinic?.clinic_name ?? 'Clinic Name')
const clinicAddress = computed(() => authStore.currentClinic?.formatted_address ?? '')
const clinicContact = computed(() => authStore.currentClinic?.contact_number ?? '')
const clinicEmail = computed(() => authStore.currentClinic?.email ?? '')
const clinicLogoUrl = computed(() => authStore.currentClinic?.logo_url ?? null)
const doctorName = computed(() => [authStore.user?.title_prefix, authStore.user?.name].filter(Boolean).join(' ') || 'Doctor Name')
const specialty = computed(() => authStore.user?.specialty ?? '')
const subSpecialty = computed(() => authStore.user?.sub_specialty ?? '')
const prcLicense = computed(() => authStore.user?.prc_license_number ?? '')
const ptrNumber = computed(() => authStore.user?.ptr_number ?? '')
const s2License = computed(() => authStore.user?.s2_license_number ?? '')

function goBack() {
  router.push({ name: RouteNames.CLINIC_TEMPLATES })
}

onMounted(async () => {
  isLoading.value = true
  try {
    const res = await templateApi.show(category.value, variation.value)
    if (res.data) {
      templateName.value = res.data.name
      Object.assign(template, res.data.config)
    }
  } catch {
    // No saved template yet — use defaults
  } finally {
    isLoading.value = false
  }
})

async function save() {
  isSaving.value = true
  try {
    await templateApi.upsert(category.value, variation.value, {
      name: templateName.value,
      config: { ...template },
      is_active: true,
    })
    toast.success('Template saved')
  } catch {
    toast.error('Failed to save template')
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <div class="flex flex-1 flex-col gap-4 pt-4">
    <!-- Header -->
    <div class="flex items-center gap-3">
      <Button variant="ghost" size="icon" class="size-8" @click="goBack">
        <ArrowLeft class="size-4" />
      </Button>
      <div>
        <h1 class="text-lg font-semibold">Edit Lab Request Template</h1>
        <p class="text-sm text-muted-foreground">Customize the layout for laboratory request forms</p>
      </div>
      <div class="ml-auto flex gap-2">
        <Button variant="outline" @click="goBack" :disabled="isSaving">Cancel</Button>
        <Button @click="save" :disabled="isSaving || isLoading">
          <LoaderCircle v-if="isSaving" class="size-4 animate-spin" />
          {{ isSaving ? 'Saving...' : 'Save Template' }}
        </Button>
      </div>
    </div>

    <Separator />

    <!-- Editor + Preview -->
    <div class="grid flex-1 gap-6 lg:grid-cols-[1fr_1fr]">
      <!-- Form -->
      <div class="flex flex-col gap-4 overflow-y-auto">
        <!-- Page Setup -->
        <Card>
          <CardHeader>
            <CardTitle class="text-sm">Page Setup</CardTitle>
          </CardHeader>
          <CardContent class="grid gap-4 sm:grid-cols-2">
            <div class="flex flex-col gap-2">
              <Label>Paper Size</Label>
              <Select v-model="template.paperSize">
                <SelectTrigger><SelectValue placeholder="Select size" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="a4">A4</SelectItem>
                  <SelectItem value="a5">A5</SelectItem>
                  <SelectItem value="letter">Letter</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div class="flex flex-col gap-2">
              <Label>Orientation</Label>
              <Select v-model="template.orientation">
                <SelectTrigger><SelectValue placeholder="Select orientation" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="portrait">Portrait</SelectItem>
                  <SelectItem value="landscape">Landscape</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div class="flex flex-col gap-2">
              <Label>Font Family</Label>
              <Select v-model="template.fontFamily">
                <SelectTrigger><SelectValue placeholder="Select font" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sans-serif">Sans Serif</SelectItem>
                  <SelectItem value="serif">Serif</SelectItem>
                  <SelectItem value="monospace">Monospace</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div class="col-span-full flex flex-col gap-2">
              <div class="flex items-center justify-between">
                <Label>Font Size (px)</Label>
                <span class="text-xs tabular-nums text-muted-foreground">{{ template.fontSize }}</span>
              </div>
              <Slider :model-value="[template.fontSize]" :min="8" :max="24" :step="1" @update:model-value="template.fontSize = $event[0]" />
            </div>

            <div class="col-span-full flex flex-col gap-3">
              <Label>Margins (mm)</Label>
              <div class="grid grid-cols-2 gap-4">
                <div class="flex flex-col gap-1.5">
                  <div class="flex items-center justify-between">
                    <span class="text-xs text-muted-foreground">Top</span>
                    <span class="text-xs tabular-nums text-muted-foreground">{{ template.margins.top }}</span>
                  </div>
                  <Slider :model-value="[template.margins.top]" :min="0" :max="50" :step="1" @update:model-value="template.margins.top = $event[0]" />
                </div>
                <div class="flex flex-col gap-1.5">
                  <div class="flex items-center justify-between">
                    <span class="text-xs text-muted-foreground">Bottom</span>
                    <span class="text-xs tabular-nums text-muted-foreground">{{ template.margins.bottom }}</span>
                  </div>
                  <Slider :model-value="[template.margins.bottom]" :min="0" :max="50" :step="1" @update:model-value="template.margins.bottom = $event[0]" />
                </div>
                <div class="flex flex-col gap-1.5">
                  <div class="flex items-center justify-between">
                    <span class="text-xs text-muted-foreground">Left</span>
                    <span class="text-xs tabular-nums text-muted-foreground">{{ template.margins.left }}</span>
                  </div>
                  <Slider :model-value="[template.margins.left]" :min="0" :max="50" :step="1" @update:model-value="template.margins.left = $event[0]" />
                </div>
                <div class="flex flex-col gap-1.5">
                  <div class="flex items-center justify-between">
                    <span class="text-xs text-muted-foreground">Right</span>
                    <span class="text-xs tabular-nums text-muted-foreground">{{ template.margins.right }}</span>
                  </div>
                  <Slider :model-value="[template.margins.right]" :min="0" :max="50" :step="1" @update:model-value="template.margins.right = $event[0]" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <!-- Header -->
        <Card>
          <CardHeader>
            <CardTitle class="text-sm">Header</CardTitle>
          </CardHeader>
          <CardContent class="flex flex-col gap-4">
            <div class="flex flex-col gap-3">
              <div class="flex items-center gap-2">
                <Checkbox id="lr-show-logo" :model-value="template.header.showLogo" @update:model-value="template.header.showLogo = !!$event" />
                <Label for="lr-show-logo" class="font-normal">Show clinic logo</Label>
              </div>
              <div v-if="template.header.showLogo" class="flex items-center gap-3 pl-6">
                <Label class="shrink-0 text-xs text-muted-foreground">Logo size</Label>
                <Slider
                  :model-value="[template.header.logoSize ?? 40]"
                  :min="20"
                  :max="100"
                  :step="5"
                  class="w-32"
                  @update:model-value="template.header.logoSize = $event[0]"
                />
                <span class="w-6 text-center text-xs tabular-nums text-muted-foreground">{{ template.header.logoSize ?? 40 }}</span>
              </div>
              <div class="flex items-center gap-2">
                <Checkbox id="lr-show-clinic-name" :model-value="template.header.showClinicName" @update:model-value="template.header.showClinicName = !!$event" />
                <Label for="lr-show-clinic-name" class="font-normal">Show clinic name</Label>
              </div>
              <div class="flex items-center gap-2">
                <Checkbox id="lr-show-clinic-address" :model-value="template.header.showClinicAddress" @update:model-value="template.header.showClinicAddress = !!$event" />
                <Label for="lr-show-clinic-address" class="font-normal">Show clinic address</Label>
              </div>
              <div class="flex items-center gap-2">
                <Checkbox id="lr-show-clinic-contact" :model-value="template.header.showClinicContact" @update:model-value="template.header.showClinicContact = !!$event" />
                <Label for="lr-show-clinic-contact" class="font-normal">Show clinic contact</Label>
              </div>
            </div>
            <div class="flex flex-col gap-2">
              <Label>Custom Header Text</Label>
              <Textarea v-model="template.header.customText" placeholder="Optional text to display in the header" rows="2" />
            </div>
          </CardContent>
        </Card>

        <!-- Body -->
        <Card>
          <CardHeader>
            <CardTitle class="text-sm">Body</CardTitle>
          </CardHeader>
          <CardContent class="flex flex-col gap-3">
            <div class="flex items-center gap-2">
              <Checkbox id="lr-show-patient-name" :model-value="template.body.showPatientName" @update:model-value="template.body.showPatientName = !!$event" />
              <Label for="lr-show-patient-name" class="font-normal">Show patient name</Label>
            </div>
            <div class="flex items-center gap-2">
              <Checkbox id="lr-show-patient-age" :model-value="template.body.showPatientAge" @update:model-value="template.body.showPatientAge = !!$event" />
              <Label for="lr-show-patient-age" class="font-normal">Show patient age</Label>
            </div>
            <div class="flex items-center gap-2">
              <Checkbox id="lr-show-patient-gender" :model-value="template.body.showPatientGender" @update:model-value="template.body.showPatientGender = !!$event" />
              <Label for="lr-show-patient-gender" class="font-normal">Show patient sex</Label>
            </div>
            <div class="flex items-center gap-2">
              <Checkbox id="lr-show-date" :model-value="template.body.showDate" @update:model-value="template.body.showDate = !!$event" />
              <Label for="lr-show-date" class="font-normal">Show date</Label>
            </div>
            <div class="flex items-center gap-2">
              <Checkbox id="lr-show-doctor-name" :model-value="template.body.showDoctorName" @update:model-value="template.body.showDoctorName = !!$event" />
              <Label for="lr-show-doctor-name" class="font-normal">Show requesting physician</Label>
            </div>
            <div class="flex items-center gap-2">
              <Checkbox id="lr-show-lab-name" :model-value="template.body.showLaboratoryName" @update:model-value="template.body.showLaboratoryName = !!$event" />
              <Label for="lr-show-lab-name" class="font-normal">Show laboratory name (if provided)</Label>
            </div>
            <div class="flex items-center gap-2">
              <Checkbox id="lr-show-instructions" :model-value="template.body.showInstructions" @update:model-value="template.body.showInstructions = !!$event" />
              <Label for="lr-show-instructions" class="font-normal">Show special instructions per test</Label>
            </div>
          </CardContent>
        </Card>

        <!-- Footer -->
        <Card>
          <CardHeader>
            <CardTitle class="text-sm">Footer</CardTitle>
          </CardHeader>
          <CardContent class="flex flex-col gap-4">
            <div class="flex flex-col gap-3">
              <div class="flex items-center gap-2">
                <Checkbox id="lr-show-signature" :model-value="template.footer.showDoctorSignature" @update:model-value="template.footer.showDoctorSignature = !!$event" />
                <Label for="lr-show-signature" class="font-normal">Show doctor signature line</Label>
              </div>
              <div class="flex items-center gap-2">
                <Checkbox id="lr-show-specialty" :model-value="template.footer.showSpecialty" @update:model-value="template.footer.showSpecialty = !!$event" />
                <Label for="lr-show-specialty" class="font-normal">Show specialty</Label>
              </div>
              <div class="flex items-center gap-2">
                <Checkbox id="lr-show-sub-specialty" :model-value="template.footer.showSubSpecialty" @update:model-value="template.footer.showSubSpecialty = !!$event" />
                <Label for="lr-show-sub-specialty" class="font-normal">Show sub-specialty</Label>
              </div>
              <div class="flex items-center gap-2">
                <Checkbox id="lr-show-prc" :model-value="template.footer.showPrcLicense" @update:model-value="template.footer.showPrcLicense = !!$event" />
                <Label for="lr-show-prc" class="font-normal">Show PRC License No.</Label>
              </div>
              <div class="flex items-center gap-2">
                <Checkbox id="lr-show-ptr" :model-value="template.footer.showPtrNumber" @update:model-value="template.footer.showPtrNumber = !!$event" />
                <Label for="lr-show-ptr" class="font-normal">Show PTR No.</Label>
              </div>
              <div class="flex items-center gap-2">
                <Checkbox id="lr-show-s2" :model-value="template.footer.showS2License" @update:model-value="template.footer.showS2License = !!$event" />
                <Label for="lr-show-s2" class="font-normal">Show S2 License No.</Label>
              </div>
              <div class="flex items-center gap-2">
                <Checkbox id="lr-show-page-number" :model-value="template.footer.showPageNumber" @update:model-value="template.footer.showPageNumber = !!$event" />
                <Label for="lr-show-page-number" class="font-normal">Show page number</Label>
              </div>
              <div class="flex items-center gap-2">
                <Checkbox id="lr-show-watermark" :model-value="template.footer.showWatermark" @update:model-value="template.footer.showWatermark = !!$event" />
                <Label for="lr-show-watermark" class="font-normal text-muted-foreground">Show watermark <span class="text-xs">(Pro accounts can hide this)</span></Label>
              </div>
            </div>
            <div class="flex flex-col gap-2">
              <Label>Custom Footer Text</Label>
              <Textarea v-model="template.footer.customText" placeholder="Optional text to display in the footer" rows="2" />
            </div>
          </CardContent>
        </Card>
      </div>

      <!-- Live Preview -->
      <div class="sticky top-4 flex flex-col gap-2">
        <h3 class="text-sm font-medium text-muted-foreground">Preview</h3>
        <div class="flex items-start justify-center rounded-lg border bg-muted/30 p-6">
          <div
            class="relative w-full overflow-hidden bg-white shadow-lg"
            :class="template.orientation === 'landscape' ? 'aspect-[1.414/1] max-w-[500px]' : 'aspect-[1/1.414] max-w-[360px]'"
            :style="{
              fontFamily: template.fontFamily,
              fontSize: `${template.fontSize * 0.6}px`,
              padding: `${template.margins.top * 0.8}px ${template.margins.right * 0.8}px ${template.margins.bottom * 0.8}px ${template.margins.left * 0.8}px`,
            }"
          >
            <div class="flex h-full flex-col">
              <!-- Preview Header -->
              <div v-if="template.header.showClinicName || template.header.showLogo || template.header.showClinicAddress || template.header.showClinicContact" class="mb-3 flex items-start gap-2 border-b pb-2">
                <div v-if="template.header.showLogo" class="shrink-0" :style="{ width: `${(template.header.logoSize ?? 40) * 0.6}px`, height: `${(template.header.logoSize ?? 40) * 0.6}px` }">
                  <img v-if="clinicLogoUrl" :src="clinicLogoUrl" alt="Logo" class="size-full rounded object-cover" />
                  <div v-else class="flex size-full items-center justify-center rounded bg-muted text-[7px] text-muted-foreground">Logo</div>
                </div>
                <div>
                  <div v-if="template.header.showClinicName" class="font-bold" :style="{ fontSize: `${template.fontSize * 0.8}px` }">
                    {{ clinicName }}
                  </div>
                  <div v-if="template.header.showClinicAddress" class="text-muted-foreground" :style="{ fontSize: `${template.fontSize * 0.5}px` }">
                    {{ clinicAddress || 'No address set' }}
                  </div>
                  <div v-if="template.header.showClinicContact" class="text-muted-foreground" :style="{ fontSize: `${template.fontSize * 0.5}px` }">
                    {{ [clinicContact, clinicEmail].filter(Boolean).join(' | ') || 'No contact set' }}
                  </div>
                  <div v-if="template.header.customText" class="mt-0.5 text-muted-foreground" :style="{ fontSize: `${template.fontSize * 0.5}px` }">
                    {{ template.header.customText }}
                  </div>
                </div>
              </div>

              <!-- Title -->
              <div class="mb-3 text-center font-bold uppercase" :style="{ fontSize: `${template.fontSize * 0.8}px`, letterSpacing: '2px' }">
                Laboratory Request
              </div>

              <!-- Preview Body -->
              <div class="flex-1 flex flex-col gap-1.5">
                <!-- Patient Info -->
                <div class="flex flex-wrap gap-x-4 gap-y-0.5">
                  <span v-if="template.body.showPatientName"><strong>Patient:</strong> Juan Dela Cruz</span>
                  <span v-if="template.body.showPatientAge"><strong>Age:</strong> 32</span>
                  <span v-if="template.body.showPatientGender"><strong>Sex:</strong> Male</span>
                  <span v-if="template.body.showDate"><strong>Date:</strong> Mar 25, 2026</span>
                </div>

                <div v-if="template.body.showDoctorName" class="mt-1">
                  <strong>Requesting Physician:</strong> {{ doctorName }}
                </div>

                <div v-if="template.body.showLaboratoryName" class="mt-1">
                  <strong>To:</strong> <span class="text-muted-foreground italic">Sample Laboratory Name</span>
                </div>

                <!-- Lab Items -->
                <div class="mt-2">
                  <div class="font-bold" :style="{ fontSize: `${template.fontSize * 0.65}px` }">Requested Tests:</div>
                  <div class="mt-1 pl-3 flex flex-col gap-1">
                    <div>
                      <span class="font-medium">1. Complete Blood Count (CBC)</span>
                      <div v-if="template.body.showInstructions" class="pl-3 italic text-muted-foreground" :style="{ fontSize: `${template.fontSize * 0.5}px` }">Fasting required</div>
                    </div>
                    <div>
                      <span class="font-medium">2. Urinalysis</span>
                    </div>
                    <div>
                      <span class="font-medium">3. Lipid Profile</span>
                      <div v-if="template.body.showInstructions" class="pl-3 italic text-muted-foreground" :style="{ fontSize: `${template.fontSize * 0.5}px` }">12-hour fasting</div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Preview Footer -->
              <div v-if="template.footer.showDoctorSignature || template.footer.showPrcLicense || template.footer.showPtrNumber || template.footer.showS2License || template.footer.customText" class="mt-auto border-t pt-2">
                <div v-if="template.footer.showDoctorSignature" class="mt-4 flex flex-col items-end gap-0.5">
                  <div class="w-32 border-b" />
                  <span>{{ doctorName }}</span>
                  <div v-if="template.footer.showSpecialty && specialty" class="text-muted-foreground" :style="{ fontSize: `${template.fontSize * 0.45}px` }">
                    {{ specialty }}
                  </div>
                  <div v-if="template.footer.showSubSpecialty && subSpecialty" class="text-muted-foreground" :style="{ fontSize: `${template.fontSize * 0.45}px` }">
                    {{ subSpecialty }}
                  </div>
                </div>
                <div v-if="template.footer.showPrcLicense" class="text-right text-muted-foreground" :style="{ fontSize: `${template.fontSize * 0.45}px` }">
                  PRC Lic. No. {{ prcLicense || '---' }}
                </div>
                <div v-if="template.footer.showPtrNumber" class="text-right text-muted-foreground" :style="{ fontSize: `${template.fontSize * 0.45}px` }">
                  PTR No. {{ ptrNumber || '---' }}
                </div>
                <div v-if="template.footer.showS2License" class="text-right text-muted-foreground" :style="{ fontSize: `${template.fontSize * 0.45}px` }">
                  S2 Lic. No. {{ s2License || '---' }}
                </div>
                <div v-if="template.footer.customText" class="mt-1 text-center text-muted-foreground" :style="{ fontSize: `${template.fontSize * 0.45}px` }">
                  {{ template.footer.customText }}
                </div>
                <div v-if="template.footer.showPageNumber" class="mt-1 text-center text-muted-foreground" :style="{ fontSize: `${template.fontSize * 0.4}px` }">
                  Page 1 of 1
                </div>
              </div>

              <!-- Watermark -->
              <div v-if="template.footer.showWatermark" class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 opacity-[0.12]">
                <img src="/favicon.svg" alt="" class="size-36 select-none" />
                <span class="select-none text-lg font-bold uppercase tracking-widest text-foreground">MediFlow</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
