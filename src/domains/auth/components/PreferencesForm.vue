<script setup lang="ts">
import { computed, ref } from 'vue'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Stethoscope } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { useAuthStore } from '../stores/authStore'
import { authApi } from '../api/authApi'
import type { ToothNumberingPreference } from '../types/auth.types'

/**
 * Per-doctor preferences. Today this only houses dental tooth-numbering
 * override; other specialties append a tab here as they grow user-level
 * settings. Clinic-wide defaults live in Clinic Settings → Specialties.
 *
 * Layered fallback (handled by `useToothNumbering`):
 *   user override → clinic default → 'fdi'
 */

const authStore = useAuthStore()

const specialty = computed(() => authStore.user?.specialty ?? null)
const clinicDefault = computed<ToothNumberingPreference | null>(
  () => authStore.currentClinic?.settings?.tooth_numbering ?? null,
)
const userOverride = computed<ToothNumberingPreference | null>(
  () => authStore.user?.preferences?.tooth_numbering ?? null,
)

// Tab visibility tracks the doctor's own specialty — a pediatrician
// shouldn't see the Dental tab here, even though the clinic-settings
// page exposes all specialties for clinic-wide defaults. Each entry
// also carries the specialty values that should match.
type SpecialtyTab = { value: 'dental'; label: string; matches: (s: string | null) => boolean }
const ALL_SPECIALTY_TABS: SpecialtyTab[] = [
  { value: 'dental', label: 'Dental', matches: (s) => s === 'dental' },
]
const availableSpecialtyTabs = computed<SpecialtyTab[]>(
  () => ALL_SPECIALTY_TABS.filter((t) => t.matches(specialty.value)),
)
const activeTab = computed(() => availableSpecialtyTabs.value[0]?.value ?? null)

const toothNumberingOptions: { value: ToothNumberingPreference; label: string; full: string }[] = [
  { value: 'fdi',       label: 'FDI',    full: 'FDI / ISO-3950 (international)' },
  { value: 'universal', label: 'US',     full: 'Universal Numbering System (1–32)' },
  { value: 'palmer',    label: 'Palmer', full: 'Palmer notation (UR/UL/LL/LR + position)' },
]

const saving = ref<ToothNumberingPreference | 'reset' | null>(null)

const inheritedLabel = computed(() => {
  const v = clinicDefault.value ?? 'fdi'
  return toothNumberingOptions.find((o) => o.value === v)?.label ?? v
})

async function setOverride(v: ToothNumberingPreference): Promise<void> {
  if (saving.value || userOverride.value === v) return
  saving.value = v
  try {
    await authApi.updatePreferences({ tooth_numbering: v })
    await authStore.fetchUser()
    toast.success('Preference saved')
  } catch {
    toast.error('Failed to save preference')
  } finally {
    saving.value = null
  }
}

async function clearOverride(): Promise<void> {
  if (saving.value || userOverride.value === null) return
  saving.value = 'reset'
  try {
    // null tells the backend to remove the user's override and inherit the
    // clinic default again. UpdatePreferencesAction handles the merge.
    await authApi.updatePreferences({ tooth_numbering: null })
    await authStore.fetchUser()
    toast.success('Reset to clinic default')
  } catch {
    toast.error('Failed to reset preference')
  } finally {
    saving.value = null
  }
}
</script>

<template>
  <Card>
    <CardHeader>
      <div class="flex items-center gap-2">
        <Stethoscope class="size-4 text-muted-foreground" />
        <CardTitle class="text-base">Specialty Preferences</CardTitle>
      </div>
      <CardDescription>
        Override clinic-wide defaults for your own account. Each specialty has its own tab.
      </CardDescription>
    </CardHeader>

    <CardContent>
      <!-- No tabs to show when the doctor's specialty has no overridable
           preferences yet. As more specialties grow settings, ALL_SPECIALTY_TABS
           in the script picks them up and they appear automatically. -->
      <div
        v-if="availableSpecialtyTabs.length === 0"
        class="rounded-md border border-dashed bg-muted/30 px-4 py-3 text-sm text-muted-foreground"
      >
        No specialty-specific preferences are available for your current
        specialty (<span class="font-medium text-foreground">{{ specialty ?? 'unset' }}</span>).
      </div>

      <Tabs v-else :default-value="activeTab ?? undefined" class="w-full">
        <TabsList>
          <TabsTrigger
            v-for="t in availableSpecialtyTabs"
            :key="t.value"
            :value="t.value"
          >{{ t.label }}</TabsTrigger>
        </TabsList>

        <TabsContent v-if="availableSpecialtyTabs.some((t) => t.value === 'dental')" value="dental" class="mt-4 flex flex-col gap-6">
          <div class="flex flex-col gap-2">
            <Label class="text-sm font-medium">Tooth numbering system</Label>
            <p class="text-xs text-muted-foreground">
              Display-only — odontogram data is always stored in FDI / ISO-3950
              regardless of this choice. Your override applies wherever you view
              charts; staff continue to see the clinic default.
            </p>
            <p class="text-xs text-muted-foreground">
              Clinic default: <span class="font-medium text-foreground">{{ inheritedLabel }}</span>
            </p>

            <div class="mt-1 flex flex-wrap items-center gap-2">
              <div
                role="group"
                aria-label="Tooth numbering system"
                class="inline-flex w-fit items-center gap-0.5 rounded-md border border-border bg-muted/40 p-0.5 text-[12px] font-semibold"
              >
                <button
                  v-for="opt in toothNumberingOptions"
                  :key="opt.value"
                  type="button"
                  :aria-pressed="userOverride === opt.value"
                  :title="opt.full"
                  :disabled="saving !== null"
                  :class="[
                    'rounded px-3 py-1.5 transition focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-wait',
                    userOverride === opt.value
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  ]"
                  @click="setOverride(opt.value)"
                >{{ opt.label }}</button>
              </div>

              <button
                v-if="userOverride !== null"
                type="button"
                class="rounded-md border border-border bg-background px-3 py-1.5 text-[12px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-wait"
                :disabled="saving !== null"
                @click="clearOverride"
              >Reset to clinic default</button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </CardContent>
  </Card>
</template>
