<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import MFDatePicker from '@/components/shared/MFDatePicker.vue'
import { useToothNumbering } from '../composables/useToothNumbering'
import type {
  StampedToothState,
  ToothSurface,
  CariesSeverity,
  FillingMaterial,
  CrownMaterial,
  FractureVariant,
  EndoType,
  PostMaterial,
  BruxismVariant,
  ImplantStage,
  BridgeMaterial,
  BridgeRole,
  ModKind,
  SpecialKind,
  ToothBase,
} from '../types/dental.types'

/**
 * Per-tooth editor on the canonical v2 stamped schema.
 *
 * The dialog lets the dentist toggle every clinical field on one tooth —
 * per-surface caries/fillings/sealants, plus tooth-level crown / endo /
 * post / fracture / pulpitis / bruxism / implant / bridge / missing, and
 * the `mods` / `specials` collections.
 *
 * Emits a *partial* `StampedToothState` with only the fields the user
 * actually set. The host merges that into the visit's
 * `assessment.odontogram_delta`; the backend OdontogramMergeService adds
 * the provenance stamp (visit + author + timestamps) before writing it
 * to the DentalProfile.
 *
 * `{ __remove: true }` sentinels clear a field that was previously set.
 */

const props = defineProps<{
  open: boolean
  fdi: string | null
  initial?: StampedToothState | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  save: [fdi: string, delta: Partial<StampedToothState>]
}>()

// ---- Local form state -------------------------------------------------

const SURFACES: ToothSurface[] = ['mesial', 'distal', 'occlusal', 'incisal', 'buccal', 'lingual']

// Per-surface caries severity (blank = no finding)
const cariesBySurface = ref<Record<ToothSurface, CariesSeverity | ''>>({
  mesial: '', distal: '', occlusal: '', incisal: '', buccal: '', lingual: '',
})
const fillingBySurface = ref<Record<ToothSurface, FillingMaterial | ''>>({
  mesial: '', distal: '', occlusal: '', incisal: '', buccal: '', lingual: '',
})
const sealantBySurface = ref<Record<ToothSurface, boolean>>({
  mesial: false, distal: false, occlusal: false, incisal: false, buccal: false, lingual: false,
})

const base = ref<ToothBase | ''>('')
const notes = ref('')

// Scalar stamped leaves (material/type/variant; blank = absent)
const crownMat = ref<CrownMaterial | ''>('')
const endoType = ref<EndoType | ''>('')
const postMat = ref<PostMaterial | ''>('')
const fractureVariant = ref<FractureVariant | ''>('')
const pulpitis = ref(false)
const bruxismVariant = ref<BruxismVariant | ''>('')
const implantStage = ref<ImplantStage | ''>('')
const bridgeMat = ref<BridgeMaterial | ''>('')
const bridgeRole = ref<BridgeRole | ''>('')

// Missing
const missingEnabled = ref(false)
const missingSince = ref('')
const missingCause = ref<'extraction' | 'congenital' | 'trauma' | ''>('')

// Mod/special collections toggled by kind
const modMobility = ref(false)
const modInflamInside = ref(false)
const modInflamOutside = ref(false)
const specExtractionPlan = ref(false)
const specCrownNeeded = ref(false)
const specCrownReplace = ref(false)
const specMissingClosed = ref(false)

watch(
  () => [props.open, props.fdi, props.initial] as const,
  () => {
    if (!props.open) return
    const s = props.initial ?? {}

    // Caries per surface
    for (const surf of SURFACES) {
      cariesBySurface.value[surf] = (s.caries?.[surf]?.severity ?? '') as CariesSeverity | ''
      fillingBySurface.value[surf] = (s.fillings?.[surf]?.material ?? '') as FillingMaterial | ''
      sealantBySurface.value[surf] = !!s.sealants?.[surf]
    }

    base.value = s.base ?? ''
    notes.value = s.notes ?? ''

    crownMat.value = s.crown?.material ?? ''
    endoType.value = s.endo?.type ?? ''
    postMat.value = s.post?.material ?? ''
    fractureVariant.value = s.fracture?.variant ?? ''
    pulpitis.value = s.pulpitis?.status === 'existing'
    bruxismVariant.value = s.bruxism?.variant ?? ''
    implantStage.value = s.implant?.stage ?? ''
    bridgeMat.value = s.bridge?.material ?? ''
    bridgeRole.value = s.bridge?.role ?? ''

    missingEnabled.value = !!s.missing
    missingSince.value = s.missing?.since ?? ''
    missingCause.value = (s.missing?.cause ?? '') as typeof missingCause.value

    const mods = s.mods ?? []
    modMobility.value = mods.some((m) => m.kind === 'mobility')
    modInflamInside.value = mods.some((m) => m.kind === 'inflammation-inside')
    modInflamOutside.value = mods.some((m) => m.kind === 'inflammation-outside')
    const specials = s.specials ?? []
    specExtractionPlan.value = specials.some((x) => x.kind === 'extraction-plan')
    specCrownNeeded.value = specials.some((x) => x.kind === 'crown-needed')
    specCrownReplace.value = specials.some((x) => x.kind === 'crown-replace')
    specMissingClosed.value = specials.some((x) => x.kind === 'missing-closed')
  },
  { immediate: true },
)

const { format: formatTooth } = useToothNumbering()
const title = computed(() => {
  if (!props.fdi) return 'Tooth'
  const n = Number(props.fdi)
  return Number.isFinite(n) ? `Tooth ${formatTooth(n)}` : `Tooth ${props.fdi}`
})

function close(): void {
  emit('update:open', false)
}

/**
 * Build the partial delta to emit. Uses `{ __remove: true }` sentinels so
 * fields that were cleared in the form actually get removed server-side
 * rather than silently ignored.
 */
function save(): void {
  if (!props.fdi) return
  const delta: Partial<StampedToothState> = {}

  // Base classification
  if (base.value) delta.base = base.value as ToothBase

  // Notes
  if (notes.value || props.initial?.notes) {
    delta.notes = notes.value || null
  }

  // Caries per surface
  const cariesChanged: Record<string, unknown> = {}
  for (const surf of SURFACES) {
    const next = cariesBySurface.value[surf]
    const prev = props.initial?.caries?.[surf]?.severity ?? ''
    if (next === prev) continue
    cariesChanged[surf] = next ? { severity: next } : { __remove: true }
  }
  if (Object.keys(cariesChanged).length > 0) delta.caries = cariesChanged as StampedToothState['caries']

  // Fillings per surface
  const fillingsChanged: Record<string, unknown> = {}
  for (const surf of SURFACES) {
    const next = fillingBySurface.value[surf]
    const prev = props.initial?.fillings?.[surf]?.material ?? ''
    if (next === prev) continue
    fillingsChanged[surf] = next ? { material: next } : { __remove: true }
  }
  if (Object.keys(fillingsChanged).length > 0) delta.fillings = fillingsChanged as StampedToothState['fillings']

  // Sealants per surface
  const sealantsChanged: Record<string, unknown> = {}
  for (const surf of SURFACES) {
    const next = sealantBySurface.value[surf]
    const prev = !!props.initial?.sealants?.[surf]
    if (next === prev) continue
    sealantsChanged[surf] = next ? { value: 'complete' } : { __remove: true }
  }
  if (Object.keys(sealantsChanged).length > 0) delta.sealants = sealantsChanged as StampedToothState['sealants']

  // Scalar stamped leaves — emit the leaf value, or __remove if cleared
  function scalar(currentValue: string, prev: unknown, field: keyof StampedToothState, fieldKey: string) {
    const hadPrev = prev != null
    if (currentValue && !hadPrev) {
      ;(delta as Record<string, unknown>)[field as string] = { [fieldKey]: currentValue }
    } else if (!currentValue && hadPrev) {
      ;(delta as Record<string, unknown>)[field as string] = { __remove: true }
    } else if (currentValue && hadPrev && (prev as Record<string, string>)[fieldKey] !== currentValue) {
      ;(delta as Record<string, unknown>)[field as string] = { [fieldKey]: currentValue }
    }
  }

  scalar(crownMat.value, props.initial?.crown, 'crown', 'material')
  scalar(endoType.value, props.initial?.endo, 'endo', 'type')
  scalar(postMat.value, props.initial?.post, 'post', 'material')
  scalar(fractureVariant.value, props.initial?.fracture, 'fracture', 'variant')
  scalar(bruxismVariant.value, props.initial?.bruxism, 'bruxism', 'variant')
  scalar(implantStage.value, props.initial?.implant, 'implant', 'stage')

  // Pulpitis — boolean, status-only stamp
  const prevPulp = props.initial?.pulpitis?.status === 'existing'
  if (pulpitis.value !== prevPulp) {
    delta.pulpitis = pulpitis.value ? { status: 'existing', source_visit_id: null, recorded_at: null, recorded_by: null } : { __remove: true } as never
  }

  // Bridge — both material + role together, or clear entirely
  const prevBridge = props.initial?.bridge
  if (bridgeMat.value && bridgeRole.value) {
    if (!prevBridge || prevBridge.material !== bridgeMat.value || prevBridge.role !== bridgeRole.value) {
      delta.bridge = { material: bridgeMat.value as BridgeMaterial, role: bridgeRole.value as BridgeRole } as StampedToothState['bridge']
    }
  } else if (prevBridge && (!bridgeMat.value || !bridgeRole.value)) {
    delta.bridge = { __remove: true } as never
  }

  // Pontic implies the natural tooth has been replaced — auto-flag the
  // slot as missing so the data layer stays consistent. Mirror the rule
  // applied in the sidebar's setBridgeMat / setBridgeRole.
  if (bridgeMat.value && bridgeRole.value === 'pontic' && !missingEnabled.value) {
    missingEnabled.value = true
  } else if (
    bridgeRole.value === 'abutment'
    && missingEnabled.value
    && prevBridge?.role === 'pontic'
    && props.initial?.base !== 'implant'
  ) {
    // Promoting a pontic to an abutment — the tooth becomes "present" again.
    missingEnabled.value = false
  }

  // Missing (re-evaluated after the pontic auto-sync above)
  if (missingEnabled.value) {
    delta.missing = {
      status: props.initial?.missing?.status ?? 'existing',
      since: missingSince.value || null,
      cause: (missingCause.value || null) as typeof missingCause.value | null,
    } as StampedToothState['missing']
  } else if (props.initial?.missing) {
    delta.missing = { __remove: true } as never
  }

  // Mods — diffed by kind
  const targetMods: { kind: ModKind }[] = []
  if (modMobility.value) targetMods.push({ kind: 'mobility' })
  if (modInflamInside.value) targetMods.push({ kind: 'inflammation-inside' })
  if (modInflamOutside.value) targetMods.push({ kind: 'inflammation-outside' })
  const prevModKinds = new Set((props.initial?.mods ?? []).map((m) => m.kind))
  const nextModKinds = new Set(targetMods.map((m) => m.kind))
  const modsDelta: { kind: ModKind; __remove?: boolean }[] = []
  for (const k of nextModKinds) if (!prevModKinds.has(k)) modsDelta.push({ kind: k })
  for (const k of prevModKinds) if (!nextModKinds.has(k)) modsDelta.push({ kind: k, __remove: true })
  if (modsDelta.length > 0) delta.mods = modsDelta as never

  // Specials — same diffing
  const targetSpecials: { kind: SpecialKind }[] = []
  if (specExtractionPlan.value) targetSpecials.push({ kind: 'extraction-plan' })
  if (specCrownNeeded.value) targetSpecials.push({ kind: 'crown-needed' })
  if (specCrownReplace.value) targetSpecials.push({ kind: 'crown-replace' })
  if (specMissingClosed.value) targetSpecials.push({ kind: 'missing-closed' })
  const prevSpecKinds = new Set((props.initial?.specials ?? []).map((s) => s.kind))
  const nextSpecKinds = new Set(targetSpecials.map((s) => s.kind))
  const specsDelta: { kind: SpecialKind; __remove?: boolean }[] = []
  for (const k of nextSpecKinds) if (!prevSpecKinds.has(k)) specsDelta.push({ kind: k })
  for (const k of prevSpecKinds) if (!nextSpecKinds.has(k)) specsDelta.push({ kind: k, __remove: true })
  if (specsDelta.length > 0) delta.specials = specsDelta as never

  emit('save', props.fdi, delta)
  close()
}

// ---- Option lists -----------------------------------------------------

const baseOptions: ToothBase[] = ['tooth', 'milktooth', 'implant']
const cariesOptions: CariesSeverity[] = ['early', 'moderate', 'severe']
const fillingOptions: FillingMaterial[] = ['composite', 'amalgam', 'glass_ionomer', 'rmgi', 'temporary']
const crownOptions: CrownMaterial[] = ['zircon', 'metal', 'pfm', 'porcelain', 'emax', 'resin', 'temporary']
const endoOptions: EndoType[] = ['endo-filling', 'endo-filling-incomplete', 'endo-resection']
const postOptions: PostMaterial[] = ['glass', 'metal']
const fractureOptions: FractureVariant[] = [
  'mesial', 'distal', 'incisal',
  'mesial-distal', 'mesial-incisal', 'distal-incisal', 'mesial-distal-incisal',
]
const bruxismOptions: BruxismVariant[] = ['wear', 'neck-wear', 'both']
const implantOptions: ImplantStage[] = ['base', 'healing-abutment', 'bar', 'locator-screw']
const bridgeMatOptions: BridgeMaterial[] = ['zircon', 'metal', 'telescope', 'temporary', 'prosthesis']
const bridgeRoleOptions: BridgeRole[] = ['abutment', 'pontic']
</script>

<template>
  <Dialog :open="props.open" @update:open="emit('update:open', $event)">
    <DialogContent class="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{{ title }}</DialogTitle>
        <DialogDescription>Toggle clinical findings on this tooth. Only changed fields are saved.</DialogDescription>
      </DialogHeader>

      <form class="flex flex-col gap-4" @submit.prevent="save">
        <!-- Base classification -->
        <section class="flex flex-wrap items-center gap-3">
          <Label class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Base</Label>
          <label v-for="b in baseOptions" :key="b" class="flex items-center gap-1 text-sm capitalize">
            <input type="radio" :checked="base === b" @change="base = b" />
            {{ b === 'milktooth' ? 'Milk tooth' : b }}
          </label>
        </section>

        <Separator />

        <!-- Per-surface caries + fillings + sealants -->
        <section class="space-y-2">
          <p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Per-surface findings</p>
          <div class="grid grid-cols-[80px_repeat(3,1fr)] gap-2 items-center text-sm">
            <div />
            <div class="text-xs font-medium">Caries</div>
            <div class="text-xs font-medium">Filling material</div>
            <div class="text-xs font-medium text-center">Sealant</div>
            <template v-for="surf in SURFACES" :key="surf">
              <div class="text-xs capitalize font-medium">{{ surf }}</div>
              <NativeSelect v-model="cariesBySurface[surf]" class="h-8 rounded-xl px-2 text-xs">
                <NativeSelectOption value="">—</NativeSelectOption>
                <NativeSelectOption v-for="o in cariesOptions" :key="o" :value="o">{{ o }}</NativeSelectOption>
              </NativeSelect>
              <NativeSelect v-model="fillingBySurface[surf]" class="h-8 rounded-xl px-2 text-xs">
                <NativeSelectOption value="">—</NativeSelectOption>
                <NativeSelectOption v-for="o in fillingOptions" :key="o" :value="o">{{ o }}</NativeSelectOption>
              </NativeSelect>
              <div class="flex justify-center">
                <input type="checkbox" v-model="sealantBySurface[surf]" />
              </div>
            </template>
          </div>
        </section>

        <Separator />

        <!-- Restorations / structural -->
        <section class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div class="flex flex-col gap-1">
            <Label class="text-xs">Crown</Label>
            <NativeSelect v-model="crownMat" class="h-9 rounded-xl px-3 text-sm">
              <NativeSelectOption value="">None</NativeSelectOption>
              <NativeSelectOption v-for="o in crownOptions" :key="o" :value="o">{{ o }}</NativeSelectOption>
            </NativeSelect>
          </div>

          <div class="flex flex-col gap-1">
            <Label class="text-xs">Endo</Label>
            <NativeSelect v-model="endoType" class="h-9 rounded-xl px-3 text-sm">
              <NativeSelectOption value="">None</NativeSelectOption>
              <NativeSelectOption v-for="o in endoOptions" :key="o" :value="o">{{ o }}</NativeSelectOption>
            </NativeSelect>
          </div>

          <div class="flex flex-col gap-1">
            <Label class="text-xs">Post</Label>
            <NativeSelect v-model="postMat" class="h-9 rounded-xl px-3 text-sm">
              <NativeSelectOption value="">None</NativeSelectOption>
              <NativeSelectOption v-for="o in postOptions" :key="o" :value="o">{{ o }}</NativeSelectOption>
            </NativeSelect>
          </div>

          <div class="flex flex-col gap-1">
            <Label class="text-xs">Fracture</Label>
            <NativeSelect v-model="fractureVariant" class="h-9 rounded-xl px-3 text-sm">
              <NativeSelectOption value="">None</NativeSelectOption>
              <NativeSelectOption v-for="o in fractureOptions" :key="o" :value="o">{{ o }}</NativeSelectOption>
            </NativeSelect>
          </div>

          <div class="flex flex-col gap-1">
            <Label class="text-xs">Bruxism</Label>
            <NativeSelect v-model="bruxismVariant" class="h-9 rounded-xl px-3 text-sm">
              <NativeSelectOption value="">None</NativeSelectOption>
              <NativeSelectOption v-for="o in bruxismOptions" :key="o" :value="o">{{ o }}</NativeSelectOption>
            </NativeSelect>
          </div>

          <div class="flex flex-col gap-1">
            <Label class="text-xs">Implant stage</Label>
            <NativeSelect v-model="implantStage" class="h-9 rounded-xl px-3 text-sm" :disabled="base !== 'implant'">
              <NativeSelectOption value="">None</NativeSelectOption>
              <NativeSelectOption v-for="o in implantOptions" :key="o" :value="o">{{ o }}</NativeSelectOption>
            </NativeSelect>
          </div>
        </section>

        <!-- Bridge -->
        <section class="grid grid-cols-2 gap-3">
          <div class="flex flex-col gap-1">
            <Label class="text-xs">Bridge material</Label>
            <NativeSelect v-model="bridgeMat" class="h-9 rounded-xl px-3 text-sm">
              <NativeSelectOption value="">None</NativeSelectOption>
              <NativeSelectOption v-for="o in bridgeMatOptions" :key="o" :value="o">{{ o }}</NativeSelectOption>
            </NativeSelect>
          </div>
          <div class="flex flex-col gap-1">
            <Label class="text-xs">Bridge role</Label>
            <NativeSelect v-model="bridgeRole" class="h-9 rounded-xl px-3 text-sm" :disabled="!bridgeMat">
              <NativeSelectOption value="">—</NativeSelectOption>
              <NativeSelectOption v-for="o in bridgeRoleOptions" :key="o" :value="o">{{ o }}</NativeSelectOption>
            </NativeSelect>
          </div>
        </section>

        <Separator />

        <!-- Missing -->
        <section class="grid grid-cols-1 gap-2 sm:grid-cols-3 items-end">
          <label class="flex items-center gap-2 text-sm">
            <input type="checkbox" v-model="missingEnabled" />
            Tooth missing
          </label>
          <div v-if="missingEnabled" class="flex flex-col gap-1">
            <Label class="text-xs">Since</Label>
            <MFDatePicker
              :model-value="missingSince"
              disable-future
              @update:model-value="(value) => missingSince = value ?? ''"
            />
          </div>
          <div v-if="missingEnabled" class="flex flex-col gap-1">
            <Label class="text-xs">Cause</Label>
            <NativeSelect v-model="missingCause" class="h-9 rounded-xl px-3 text-sm">
              <NativeSelectOption value="">—</NativeSelectOption>
              <NativeSelectOption value="extraction">Extraction</NativeSelectOption>
              <NativeSelectOption value="congenital">Congenital</NativeSelectOption>
              <NativeSelectOption value="trauma">Trauma</NativeSelectOption>
            </NativeSelect>
          </div>
        </section>

        <!-- Pulpitis + mods + specials -->
        <section class="grid grid-cols-2 gap-2">
          <label class="flex items-center gap-2 text-sm">
            <input type="checkbox" v-model="pulpitis" /> Pulpitis
          </label>
          <label class="flex items-center gap-2 text-sm">
            <input type="checkbox" v-model="modMobility" /> Mobility
          </label>
          <label class="flex items-center gap-2 text-sm">
            <input type="checkbox" v-model="modInflamInside" /> Inflammation — inside
          </label>
          <label class="flex items-center gap-2 text-sm">
            <input type="checkbox" v-model="modInflamOutside" /> Inflammation — outside
          </label>
          <label class="flex items-center gap-2 text-sm">
            <input type="checkbox" v-model="specExtractionPlan" /> Plan: extract
          </label>
          <label class="flex items-center gap-2 text-sm">
            <input type="checkbox" v-model="specCrownNeeded" /> Plan: crown needed
          </label>
          <label class="flex items-center gap-2 text-sm">
            <input type="checkbox" v-model="specCrownReplace" /> Plan: crown replace
          </label>
          <label class="flex items-center gap-2 text-sm">
            <input type="checkbox" v-model="specMissingClosed" /> Missing (closed)
          </label>
        </section>

        <Separator />

        <div class="flex flex-col gap-1">
          <Label for="tooth-notes" class="text-xs">Notes</Label>
          <Textarea id="tooth-notes" v-model="notes" rows="2" placeholder="Optional clinical note" />
        </div>

        <div class="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" @click="close">Cancel</Button>
          <Button type="submit">Save</Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>
</template>
