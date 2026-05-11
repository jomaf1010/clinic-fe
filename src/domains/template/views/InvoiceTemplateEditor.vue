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
import { defaultInvoiceTemplate } from '@/domains/template/types/template.types'
import { templateApi } from '@/domains/template/api/templateApi'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const canHideWatermark = computed(() => authStore.hasFeature('remove_watermark'))

const category = computed(() => route.params.category as string)
const variation = computed(() => route.params.variation as string)

const template = reactive({ ...defaultInvoiceTemplate })
const templateName = ref('Default')
const isLoading = ref(false)
const isSaving = ref(false)

const clinicName = computed(() => authStore.currentClinic?.clinic_name ?? 'Clinic Name')
const clinicAddress = computed(() => authStore.currentClinic?.formatted_address ?? '')
const clinicContact = computed(() => authStore.currentClinic?.contact_number ?? '')
const clinicEmail = computed(() => authStore.currentClinic?.email ?? '')
const clinicLogoUrl = computed(() => authStore.currentClinic?.logo_url ?? null)

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
        <h1 class="text-lg font-semibold">Edit Invoice Template</h1>
        <p class="text-sm text-muted-foreground">Customize the layout for billing invoices</p>
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
              <Slider :model-value="[template.fontSize]" :min="8" :max="16" :step="1" @update:model-value="(e) => { if (e?.[0] != null) template.fontSize = e[0] }" />
            </div>

            <div class="col-span-full flex flex-col gap-3">
              <Label>Margins (mm)</Label>
              <div class="grid grid-cols-2 gap-4">
                <div class="flex flex-col gap-1.5">
                  <div class="flex items-center justify-between">
                    <span class="text-xs text-muted-foreground">Top</span>
                    <span class="text-xs tabular-nums text-muted-foreground">{{ template.margins.top }}</span>
                  </div>
                  <Slider :model-value="[template.margins.top]" :min="0" :max="50" :step="1" @update:model-value="(e) => { if (e?.[0] != null) template.margins.top = e[0] }" />
                </div>
                <div class="flex flex-col gap-1.5">
                  <div class="flex items-center justify-between">
                    <span class="text-xs text-muted-foreground">Bottom</span>
                    <span class="text-xs tabular-nums text-muted-foreground">{{ template.margins.bottom }}</span>
                  </div>
                  <Slider :model-value="[template.margins.bottom]" :min="0" :max="50" :step="1" @update:model-value="(e) => { if (e?.[0] != null) template.margins.bottom = e[0] }" />
                </div>
                <div class="flex flex-col gap-1.5">
                  <div class="flex items-center justify-between">
                    <span class="text-xs text-muted-foreground">Left</span>
                    <span class="text-xs tabular-nums text-muted-foreground">{{ template.margins.left }}</span>
                  </div>
                  <Slider :model-value="[template.margins.left]" :min="0" :max="50" :step="1" @update:model-value="(e) => { if (e?.[0] != null) template.margins.left = e[0] }" />
                </div>
                <div class="flex flex-col gap-1.5">
                  <div class="flex items-center justify-between">
                    <span class="text-xs text-muted-foreground">Right</span>
                    <span class="text-xs tabular-nums text-muted-foreground">{{ template.margins.right }}</span>
                  </div>
                  <Slider :model-value="[template.margins.right]" :min="0" :max="50" :step="1" @update:model-value="(e) => { if (e?.[0] != null) template.margins.right = e[0] }" />
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
                <Checkbox id="inv-show-logo" :model-value="template.header.showLogo" @update:model-value="template.header.showLogo = !!$event" />
                <Label for="inv-show-logo" class="font-normal">Show clinic logo</Label>
              </div>
              <div v-if="template.header.showLogo" class="flex items-center gap-3 pl-6">
                <Label class="shrink-0 text-xs text-muted-foreground">Logo size</Label>
                <Slider
                  :model-value="[template.header.logoSize ?? 40]"
                  :min="20"
                  :max="100"
                  :step="5"
                  class="w-32"
                  @update:model-value="(e) => { if (e?.[0] != null) template.header.logoSize = e[0] }"
                />
                <span class="w-6 text-center text-xs tabular-nums text-muted-foreground">{{ template.header.logoSize ?? 40 }}</span>
              </div>
              <div class="flex items-center gap-2">
                <Checkbox id="inv-show-clinic-name" :model-value="template.header.showClinicName" @update:model-value="template.header.showClinicName = !!$event" />
                <Label for="inv-show-clinic-name" class="font-normal">Show clinic name</Label>
              </div>
              <div class="flex items-center gap-2">
                <Checkbox id="inv-show-clinic-address" :model-value="template.header.showClinicAddress" @update:model-value="template.header.showClinicAddress = !!$event" />
                <Label for="inv-show-clinic-address" class="font-normal">Show clinic address</Label>
              </div>
              <div class="flex items-center gap-2">
                <Checkbox id="inv-show-clinic-contact" :model-value="template.header.showClinicContact" @update:model-value="template.header.showClinicContact = !!$event" />
                <Label for="inv-show-clinic-contact" class="font-normal">Show clinic contact</Label>
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
              <Checkbox id="inv-show-invoice-number" :model-value="template.body.showInvoiceNumber" @update:model-value="template.body.showInvoiceNumber = !!$event" />
              <Label for="inv-show-invoice-number" class="font-normal">Show invoice number</Label>
            </div>
            <div class="flex items-center gap-2">
              <Checkbox id="inv-show-status" :model-value="template.body.showStatus" @update:model-value="template.body.showStatus = !!$event" />
              <Label for="inv-show-status" class="font-normal">Show payment status badge</Label>
            </div>
            <Separator />
            <div class="flex items-center gap-2">
              <Checkbox id="inv-show-patient-name" :model-value="template.body.showPatientName" @update:model-value="template.body.showPatientName = !!$event" />
              <Label for="inv-show-patient-name" class="font-normal">Show patient name</Label>
            </div>
            <div class="flex items-center gap-2">
              <Checkbox id="inv-show-patient-age" :model-value="template.body.showPatientAge" @update:model-value="template.body.showPatientAge = !!$event" />
              <Label for="inv-show-patient-age" class="font-normal">Show patient age</Label>
            </div>
            <div class="flex items-center gap-2">
              <Checkbox id="inv-show-patient-gender" :model-value="template.body.showPatientGender" @update:model-value="template.body.showPatientGender = !!$event" />
              <Label for="inv-show-patient-gender" class="font-normal">Show patient sex</Label>
            </div>
            <div class="flex items-center gap-2">
              <Checkbox id="inv-show-date" :model-value="template.body.showDate" @update:model-value="template.body.showDate = !!$event" />
              <Label for="inv-show-date" class="font-normal">Show date</Label>
            </div>
            <Separator />
            <div class="flex items-center gap-2">
              <Checkbox id="inv-show-price-breakdown" :model-value="template.body.showPriceBreakdown" @update:model-value="template.body.showPriceBreakdown = !!$event" />
              <Label for="inv-show-price-breakdown" class="font-normal">Show medicine price breakdown</Label>
            </div>
            <div class="flex items-center gap-2">
              <Checkbox id="inv-show-discount" :model-value="template.body.showDiscount" @update:model-value="template.body.showDiscount = !!$event" />
              <Label for="inv-show-discount" class="font-normal">Show discount</Label>
            </div>
            <div class="flex items-center gap-2">
              <Checkbox id="inv-show-balance" :model-value="template.body.showBalance" @update:model-value="template.body.showBalance = !!$event" />
              <Label for="inv-show-balance" class="font-normal">Show amount paid &amp; balance</Label>
            </div>
            <div class="flex items-center gap-2">
              <Checkbox id="inv-show-payment-history" :model-value="template.body.showPaymentHistory" @update:model-value="template.body.showPaymentHistory = !!$event" />
              <Label for="inv-show-payment-history" class="font-normal">Show payment history</Label>
            </div>
            <div class="flex items-center gap-2">
              <Checkbox id="inv-show-notes" :model-value="template.body.showNotes" @update:model-value="template.body.showNotes = !!$event" />
              <Label for="inv-show-notes" class="font-normal">Show notes</Label>
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
                <Checkbox id="inv-show-signature" :model-value="template.footer.showDoctorSignature" @update:model-value="template.footer.showDoctorSignature = !!$event" />
                <Label for="inv-show-signature" class="font-normal">Show prepared by signature line</Label>
              </div>
              <div class="flex items-center gap-2">
                <Checkbox id="inv-show-page-number" :model-value="template.footer.showPageNumber" @update:model-value="template.footer.showPageNumber = !!$event" />
                <Label for="inv-show-page-number" class="font-normal">Show page number</Label>
              </div>
              <div class="flex items-center gap-2">
                <Checkbox id="inv-show-watermark" :model-value="canHideWatermark ? template.footer.showWatermark : true" :disabled="!canHideWatermark" @update:model-value="template.footer.showWatermark = canHideWatermark ? !!$event : true" />
                <Label for="inv-show-watermark" class="font-normal text-muted-foreground">Show watermark <span class="text-xs">({{ canHideWatermark ? 'Pro feature' : 'Upgrade to Pro to hide' }})</span></Label>
              </div>
            </div>
            <div class="flex flex-col gap-2">
              <Label>Custom Footer Text</Label>
              <Textarea v-model="template.footer.customText" placeholder="Optional text to display in the footer (e.g. payment instructions, thank you message)" rows="2" />
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
              fontSize: `${template.fontSize * 0.55}px`,
              padding: `${template.margins.top * 0.8}px ${template.margins.right * 0.8}px ${template.margins.bottom * 0.8}px ${template.margins.left * 0.8}px`,
            }"
          >
            <div class="flex h-full flex-col">
              <!-- Preview Header -->
              <div v-if="template.header.showClinicName || template.header.showLogo || template.header.showClinicAddress || template.header.showClinicContact" class="mb-2 flex items-start gap-2 border-b pb-2">
                <div v-if="template.header.showLogo" class="shrink-0" :style="{ width: `${(template.header.logoSize ?? 40) * 0.6}px`, height: `${(template.header.logoSize ?? 40) * 0.6}px` }">
                  <img v-if="clinicLogoUrl" :src="clinicLogoUrl" alt="Logo" class="size-full rounded object-cover" />
                  <div v-else class="flex size-full items-center justify-center rounded bg-muted text-[7px] text-muted-foreground">Logo</div>
                </div>
                <div>
                  <div v-if="template.header.showClinicName" class="font-bold" :style="{ fontSize: `${template.fontSize * 0.75}px` }">
                    {{ clinicName }}
                  </div>
                  <div v-if="template.header.showClinicAddress" class="text-muted-foreground" :style="{ fontSize: `${template.fontSize * 0.45}px` }">
                    {{ clinicAddress || 'No address set' }}
                  </div>
                  <div v-if="template.header.showClinicContact" class="text-muted-foreground" :style="{ fontSize: `${template.fontSize * 0.45}px` }">
                    {{ [clinicContact, clinicEmail].filter(Boolean).join(' | ') || 'No contact set' }}
                  </div>
                  <div v-if="template.header.customText" class="mt-0.5 text-muted-foreground" :style="{ fontSize: `${template.fontSize * 0.45}px` }">
                    {{ template.header.customText }}
                  </div>
                </div>
              </div>

              <!-- Title -->
              <div class="mb-0.5 text-center font-bold uppercase" :style="{ fontSize: `${template.fontSize * 0.75}px`, letterSpacing: '2px' }">
                Invoice
              </div>
              <div v-if="template.body.showInvoiceNumber" class="mb-2 text-center text-muted-foreground" :style="{ fontSize: `${template.fontSize * 0.45}px` }">
                INV-202603-0001
              </div>

              <!-- Preview Body -->
              <div class="flex flex-1 flex-col gap-1">
                <!-- Patient Info -->
                <div class="flex flex-wrap gap-x-3 gap-y-0.5">
                  <span v-if="template.body.showPatientName"><strong>Patient:</strong> Juan Dela Cruz</span>
                  <span v-if="template.body.showPatientAge"><strong>Age:</strong> 32</span>
                  <span v-if="template.body.showPatientGender"><strong>Sex:</strong> Male</span>
                  <span v-if="template.body.showDate"><strong>Date:</strong> Mar 25, 2026</span>
                </div>

                <!-- Status badge -->
                <div v-if="template.body.showStatus" class="mt-1">
                  <span class="rounded bg-green-100 px-1.5 py-0.5 font-semibold uppercase text-green-800" :style="{ fontSize: `${template.fontSize * 0.4}px` }">Paid</span>
                </div>

                <!-- Line items table -->
                <div class="mt-2">
                  <table class="w-full" :style="{ fontSize: `${template.fontSize * 0.45}px` }">
                    <thead>
                      <tr class="border-b">
                        <th class="pb-0.5 text-left font-semibold">Description</th>
                        <th class="pb-0.5 text-center font-semibold">Qty</th>
                        <th class="pb-0.5 text-right font-semibold">Price</th>
                        <th class="pb-0.5 text-right font-semibold">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr class="border-b border-border/30">
                        <td class="py-0.5">Consultation Fee</td>
                        <td class="text-center">1</td>
                        <td class="text-right">500.00</td>
                        <td class="text-right">500.00</td>
                      </tr>
                      <tr class="border-b border-border/30">
                        <td class="py-0.5">
                          <div>Amoxicillin 500mg</div>
                          <div v-if="template.body.showPriceBreakdown" class="italic text-muted-foreground" :style="{ fontSize: `${template.fontSize * 0.35}px` }">1 pack x 250 + 3 pcs x 15</div>
                        </td>
                        <td class="text-center">1</td>
                        <td class="text-right">295.00</td>
                        <td class="text-right">295.00</td>
                      </tr>
                      <tr class="border-b border-border/30">
                        <td class="py-0.5">CBC</td>
                        <td class="text-center">1</td>
                        <td class="text-right">350.00</td>
                        <td class="text-right">350.00</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <!-- Totals -->
                <div class="mt-1.5 flex justify-end">
                  <div class="flex w-28 flex-col gap-0.5" :style="{ fontSize: `${template.fontSize * 0.45}px` }">
                    <div class="flex justify-between">
                      <span>Subtotal</span>
                      <span>1,145.00</span>
                    </div>
                    <div v-if="template.body.showDiscount" class="flex justify-between text-green-600">
                      <span>Discount (10%)</span>
                      <span>-114.50</span>
                    </div>
                    <div class="flex justify-between border-t border-foreground pt-0.5 font-bold" :style="{ fontSize: `${template.fontSize * 0.5}px` }">
                      <span>Total</span>
                      <span>1,030.50</span>
                    </div>
                    <template v-if="template.body.showBalance">
                      <div class="flex justify-between text-muted-foreground">
                        <span>Paid</span>
                        <span>1,030.50</span>
                      </div>
                      <div class="flex justify-between border-t pt-0.5 font-bold">
                        <span>Balance</span>
                        <span>0.00</span>
                      </div>
                    </template>
                  </div>
                </div>

                <!-- Payment History -->
                <div v-if="template.body.showPaymentHistory" class="mt-2">
                  <div class="font-semibold" :style="{ fontSize: `${template.fontSize * 0.45}px` }">Payment History</div>
                  <div class="mt-0.5 flex items-center justify-between border-b border-border/30 py-0.5" :style="{ fontSize: `${template.fontSize * 0.4}px` }">
                    <div class="flex items-center gap-1">
                      <span class="rounded bg-muted px-1 uppercase" :style="{ fontSize: `${template.fontSize * 0.3}px` }">Cash</span>
                    </div>
                    <div class="flex items-center gap-1">
                      <span>1,030.50</span>
                      <span class="text-muted-foreground">Mar 25, 2026</span>
                    </div>
                  </div>
                </div>

                <!-- Notes -->
                <div v-if="template.body.showNotes" class="mt-2 border-l-2 border-border bg-muted/30 px-1.5 py-0.5" :style="{ fontSize: `${template.fontSize * 0.4}px` }">
                  <strong>Notes:</strong> <span class="text-muted-foreground">Senior citizen discount applied</span>
                </div>
              </div>

              <!-- Preview Footer -->
              <div v-if="template.footer.showDoctorSignature || template.footer.customText" class="mt-auto border-t pt-2">
                <div v-if="template.footer.showDoctorSignature" class="mt-3 flex flex-col items-end gap-0.5">
                  <div class="w-24 border-b" />
                  <span :style="{ fontSize: `${template.fontSize * 0.45}px` }">Staff Name</span>
                </div>
                <div v-if="template.footer.customText" class="mt-1 text-center text-muted-foreground" :style="{ fontSize: `${template.fontSize * 0.4}px` }">
                  {{ template.footer.customText }}
                </div>
                <div v-if="template.footer.showPageNumber" class="mt-1 text-center text-muted-foreground" :style="{ fontSize: `${template.fontSize * 0.35}px` }">
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
