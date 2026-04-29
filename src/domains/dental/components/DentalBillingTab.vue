<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { LoaderCircle, Search, Stethoscope } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { HttpError } from '@/lib/http'
import { useDentalServices } from '../composables/useDentalServices'
import type { DentalServiceCategory } from '../types/dental.types'

const { services, groupedByCategory, loaded, loading, error, ensureLoaded, updateService } = useDentalServices()

const search = ref('')
const openCategories = ref<Set<DentalServiceCategory>>(new Set(['preventive', 'restorative', 'endodontic']))
const priceDrafts = ref<Record<string, string>>({})
const saving = ref<Set<string>>(new Set())

onMounted(async () => {
  try {
    await ensureLoaded()
  } catch {
    // error exposed via `error` ref
  }
})

// Sync drafts whenever catalog arrives/refreshes
watch(services, (next) => {
  const drafts: Record<string, string> = {}
  for (const s of next) {
    if (s.clinic_service_uuid) drafts[s.clinic_service_uuid] = String(s.clinic_price)
  }
  priceDrafts.value = drafts
}, { immediate: true })

const CATEGORY_ORDER: DentalServiceCategory[] = [
  'preventive', 'restorative', 'endodontic', 'periodontal',
  'surgical', 'prosthodontic', 'implant', 'orthodontic', 'occlusal', 'other',
]

const CATEGORY_LABELS: Record<DentalServiceCategory, string> = {
  preventive: 'Preventive & Diagnostic',
  restorative: 'Restorative',
  endodontic: 'Endodontic',
  periodontal: 'Periodontal',
  surgical: 'Surgical / Extraction',
  prosthodontic: 'Prosthodontic',
  implant: 'Implants',
  orthodontic: 'Orthodontic',
  occlusal: 'Occlusal / Night Guards',
  other: 'Other',
}

const filteredGroups = computed(() => {
  const q = search.value.trim().toLowerCase()
  const out: { category: DentalServiceCategory; label: string; items: typeof services.value }[] = []
  for (const cat of CATEGORY_ORDER) {
    const items = groupedByCategory.value[cat] ?? []
    const filtered = q
      ? items.filter((s) =>
          s.name.toLowerCase().includes(q)
          || s.cdt_code.toLowerCase().includes(q)
          || (s.material ?? '').toLowerCase().includes(q),
        )
      : items
    if (filtered.length > 0) out.push({ category: cat, label: CATEGORY_LABELS[cat], items: filtered })
  }
  return out
})

const activeCount = computed(() => services.value.filter((s) => s.is_active).length)

function toggleCategory(cat: DentalServiceCategory) {
  const next = new Set(openCategories.value)
  next.has(cat) ? next.delete(cat) : next.add(cat)
  openCategories.value = next
}

async function savePrice(clinicServiceUuid: string) {
  const raw = priceDrafts.value[clinicServiceUuid] ?? ''
  const parsed = raw === '' ? null : Number(raw)
  if (parsed !== null && (Number.isNaN(parsed) || parsed < 0)) {
    toast.error('Enter a valid non-negative amount.')
    return
  }
  saving.value.add(clinicServiceUuid)
  try {
    await updateService(clinicServiceUuid, { price: parsed })
    toast.success('Price updated.')
  } catch (err) {
    const msg = err instanceof HttpError ? err.message : 'Failed to save price.'
    toast.error(msg)
  } finally {
    saving.value.delete(clinicServiceUuid)
    saving.value = new Set(saving.value)
  }
}

async function toggleActive(clinicServiceUuid: string, next: boolean) {
  saving.value.add(clinicServiceUuid)
  try {
    await updateService(clinicServiceUuid, { is_active: next })
  } catch {
    toast.error('Failed to update service.')
  } finally {
    saving.value.delete(clinicServiceUuid)
    saving.value = new Set(saving.value)
  }
}
</script>

<template>
  <Card>
    <CardHeader>
      <div class="flex items-center gap-2">
        <Stethoscope class="size-4 text-muted-foreground" />
        <CardTitle class="text-base">Dental Fee Schedule</CardTitle>
      </div>
      <CardDescription>
        Enable or disable the procedures you offer, and set your price per service. CDT-aligned codes with Philippine-market defaults.
        <span v-if="loaded" class="text-foreground">{{ activeCount }} of {{ services.length }} active.</span>
      </CardDescription>
    </CardHeader>

    <CardContent>
      <div v-if="!loaded && loading" class="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
        <LoaderCircle class="size-4 animate-spin" />
        Loading fee schedule…
      </div>

      <div v-else-if="error" role="alert" class="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
        {{ error }}
      </div>

      <div v-else>
        <div class="relative mb-3">
          <Search class="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            v-model="search"
            placeholder="Search by name, code, or material…"
            class="pl-8"
          />
        </div>

        <div class="flex flex-col gap-4">
          <section
            v-for="group in filteredGroups"
            :key="group.category"
            class="rounded-lg border bg-card"
          >
            <button
              type="button"
              class="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
              @click="toggleCategory(group.category)"
            >
              <div class="flex items-center gap-2">
                <span class="text-sm font-semibold">{{ group.label }}</span>
                <span class="text-xs text-muted-foreground">({{ group.items.length }})</span>
              </div>
              <span class="text-xs text-muted-foreground">{{ openCategories.has(group.category) ? 'Hide' : 'Show' }}</span>
            </button>

            <div v-if="openCategories.has(group.category)" class="flex flex-col">
              <Separator />
              <div
                v-for="item in group.items"
                :key="item.uuid"
                class="grid grid-cols-[1fr_auto_140px_auto] items-center gap-3 px-3 py-2 text-sm"
              >
                <div class="min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="truncate font-medium">{{ item.name }}</span>
                    <span class="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wide text-muted-foreground">
                      {{ item.cdt_code }}
                    </span>
                    <span v-if="item.surfaces_required" class="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {{ item.surfaces_required }}-surf
                    </span>
                  </div>
                  <div v-if="item.material || item.description" class="mt-0.5 truncate text-xs text-muted-foreground">
                    <span v-if="item.material">{{ item.material }}</span>
                    <span v-if="item.material && item.description"> · </span>
                    <span>{{ item.description ?? '' }}</span>
                  </div>
                </div>

                <div class="text-right text-xs text-muted-foreground">
                  <span v-if="item.price_min != null && item.price_max != null">
                    ₱{{ item.price_min.toLocaleString() }}–{{ item.price_max.toLocaleString() }}
                  </span>
                </div>

                <div class="flex items-center gap-1.5">
                  <span class="text-xs text-muted-foreground">₱</span>
                  <Input
                    v-model="priceDrafts[item.clinic_service_uuid ?? '']"
                    type="number"
                    step="0.01"
                    min="0"
                    class="h-8"
                    :disabled="!item.is_active || saving.has(item.clinic_service_uuid ?? '')"
                    @blur="item.clinic_service_uuid && savePrice(item.clinic_service_uuid)"
                    @keyup.enter="item.clinic_service_uuid && savePrice(item.clinic_service_uuid)"
                  />
                </div>

                <Switch
                  :model-value="item.is_active"
                  :disabled="saving.has(item.clinic_service_uuid ?? '')"
                  @update:model-value="item.clinic_service_uuid && toggleActive(item.clinic_service_uuid, $event)"
                />
              </div>
            </div>
          </section>

          <p v-if="filteredGroups.length === 0" class="py-6 text-center text-sm text-muted-foreground">
            No services match your search.
          </p>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
