<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Pencil, Check } from 'lucide-vue-next'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RouteNames } from '@/router/routeNames'
import { templateApi, type ClinicTemplateResponse } from '@/domains/template/api/templateApi'
import TemplateMiniPreview from '@/domains/template/components/TemplateMiniPreview.vue'
import type { PrescriptionTemplate } from '@/domains/template/types/template.types'

const router = useRouter()
const savedTemplates = ref<ClinicTemplateResponse[]>([])

const templateSections = [
  {
    key: 'prescription',
    title: 'Prescription',
    description: 'Layout used when printing or exporting patient prescriptions',
    variations: [
      { key: 'default', name: 'Default', active: true },
    ],
  },
  {
    key: 'medical-certificate',
    title: 'Medical Certificate',
    description: 'Format for issuing medical certificates and fitness-to-work documents',
    variations: [
      { key: 'default', name: 'Default', active: true },
    ],
  },
  {
    key: 'lab-request',
    title: 'Lab Request',
    description: 'Template for laboratory test request forms',
    variations: [
      { key: 'default', name: 'Default', active: true },
    ],
  },
  {
    key: 'consultation-summary',
    title: 'Consultation Summary',
    description: 'Summary document given to patients after a consultation',
    variations: [
      { key: 'default', name: 'Default', active: true },
    ],
  },
  {
    key: 'invoice',
    title: 'Invoice',
    description: 'Billing invoice with line items, totals, and payment history',
    variations: [
      { key: 'default', name: 'Default', active: true },
    ],
  },
]

function getTemplateConfig(category: string, variation: string): PrescriptionTemplate | null {
  const found = savedTemplates.value.find(
    (t) => t.category === category && t.variation === variation,
  )
  return found?.config ?? null
}

function openTemplateEditor(category: string, variation: string) {
  router.push({ name: RouteNames.TEMPLATE_EDITOR, params: { category, variation } })
}

onMounted(async () => {
  try {
    const res = await templateApi.list()
    savedTemplates.value = res.data
  } catch {
    // Failed to load — will show default previews
  }
})
</script>

<template>
  <div class="flex flex-col gap-8">
    <div v-for="section in templateSections" :key="section.key">
      <div class="mb-3 flex items-center gap-3">
        <div class="shrink-0">
          <h3 class="text-sm font-semibold">{{ section.title }}</h3>
          <p class="text-xs text-muted-foreground">{{ section.description }}</p>
        </div>
        <div class="h-px flex-1 bg-border" />
      </div>

      <div class="flex flex-wrap gap-4">
        <Card
          v-for="variation in section.variations"
          :key="variation.key"
          class="w-48 cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-md"
          :class="variation.active ? 'ring-2 ring-secondary' : ''"
          @click="openTemplateEditor(section.key, variation.key)"
        >
          <div class="flex flex-col">
            <!-- Header -->
            <div class="flex items-center justify-between p-3">
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium">{{ variation.name }}</span>
                <Badge v-if="variation.active" variant="secondary" class="gap-1 text-xs">
                  <Check class="size-3" />
                  Active
                </Badge>
              </div>
              <Button variant="ghost" size="icon" class="size-7">
                <Pencil class="size-3.5" />
              </Button>
            </div>

            <!-- Mini preview -->
            <div class="flex h-40 items-center justify-center rounded-b-xl bg-muted/50 p-3">
              <TemplateMiniPreview :config="getTemplateConfig(section.key, variation.key)" />
            </div>
          </div>
        </Card>
      </div>
    </div>
  </div>
</template>
