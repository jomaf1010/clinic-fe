<script setup lang="ts">
import { computed } from 'vue'
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
  ContextMenuSeparator,
  ContextMenuLabel,
  ContextMenuCheckboxItem,
} from '@/components/ui/context-menu'
import type {
  StampedToothState,
  ToothBase,
  CrownMaterial,
  EndoType,
  ImplantStage,
} from '../types/dental.types'

/**
 * Right-click quick-access for one tooth. Emits incremental
 * `Partial<StampedToothState>` deltas the parent merges into the
 * visit's `assessment.odontogram_delta` — same channel the sidebar
 * panel uses, so behaviour is consistent.
 *
 * Covers the high-frequency clinical states that benefit from a
 * one-gesture toggle. Anything more granular (per-surface caries,
 * fillings, mods, notes…) remains in the sidebar.
 */
interface Props {
  fdi: number
  state?: StampedToothState | null
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  state: null,
  disabled: false,
})

const emit = defineEmits<{
  apply: [delta: Partial<StampedToothState>]
  open: []
  'reset-tooth': []
  'open-detail': []
  /** Fired when base changes across the natural↔implant boundary, so the
   * parent can drop `perio_chart[fdi]` (PD / BOP / mobility-grade values
   * that belonged to a different physical structure). */
  'clear-perio': [fdi: number]
}>()

const isMissing = computed(() => !!props.state?.missing)
const isImplant = computed(() => props.state?.base === 'implant')
const isBridgePontic = computed(() => props.state?.bridge?.role === 'pontic')
// Hide tooth-substance findings (caries, fillings, RCT, fracture, pulpitis)
// when the slot has no natural tooth — missing, implanted, or replaced by
// a bridge pontic. Crown still applies to implants (prosthetic crown on
// top) and to abutment teeth.
const hideEndoPulp = computed(() =>
  isMissing.value || isImplant.value || isBridgePontic.value,
)
// Pulpitis specifically also hides once RCT is recorded — no pulp left.
const hasEndoTreatment = computed(() => !!props.state?.endo?.type)
const hidePulpitis = computed(() => hideEndoPulp.value || hasEndoTreatment.value)
// Implant stage is only meaningful when the slot is an implant fixture
// (or already has stage data recorded — legacy or mid-edit state).
const showImplantStage = computed(() => isImplant.value || !!props.state?.implant)

const baseOptions: { value: ToothBase; label: string }[] = [
  { value: 'tooth', label: 'Permanent' },
  { value: 'milktooth', label: 'Primary' },
  { value: 'implant', label: 'Implant' },
]
const crownOptions: { value: CrownMaterial; label: string }[] = [
  { value: 'zircon', label: 'Zircon' },
  { value: 'metal', label: 'Metal' },
  { value: 'pfm', label: 'PFM' },
  { value: 'porcelain', label: 'Porcelain' },
  { value: 'emax', label: 'e.max' },
  { value: 'resin', label: 'Resin' },
  { value: 'temporary', label: 'Temporary' },
]
const endoOptions: { value: EndoType; label: string }[] = [
  { value: 'endo-filling', label: 'RCT complete' },
  { value: 'endo-filling-incomplete', label: 'RCT partial' },
  { value: 'endo-resection', label: 'Resection' },
]
const implantOptions: { value: ImplantStage; label: string }[] = [
  { value: 'base', label: 'Base placed' },
  { value: 'healing-abutment', label: 'Healing abutment' },
  { value: 'bar', label: 'Bar' },
  { value: 'locator-screw', label: 'Locator' },
]

function setBase(value: ToothBase) {
  if (props.disabled) return
  // Type-aware cleanup — see DentalChartingPanel.setBase for the full
  // rationale. Cross-boundary (tooth↔implant) resets everything that
  // describes the structure in the socket: natural-tissue findings on
  // tooth→implant, implant fixture on the inverse, plus mods + perio
  // chart in either direction (apical/mobility belonged to that root).
  const delta: Partial<StampedToothState> = { base: value }
  const cur = props.state
  const wasImplant = cur?.base === 'implant'
  const willBeImplant = value === 'implant'
  const crossesBoundary = wasImplant !== willBeImplant
  if (willBeImplant) {
    if (cur?.missing) delta.missing = { __remove: true } as never
    for (const f of ['caries', 'fillings', 'sealants'] as const) {
      const surf = cur?.[f]
      if (!surf) continue
      const removed: Record<string, unknown> = {}
      for (const k of Object.keys(surf)) removed[k] = { __remove: true }
      delta[f] = removed as never
    }
    for (const f of ['endo', 'post', 'fracture', 'pulpitis', 'bruxism'] as const) {
      if (cur?.[f]) delta[f] = { __remove: true } as never
    }
  } else if (cur?.implant) {
    delta.implant = { __remove: true } as never
  }
  if (crossesBoundary && cur?.mods?.length) {
    delta.mods = cur.mods
      .filter((m) => m?.kind)
      .map((m) => ({ kind: m.kind, __remove: true })) as never
  }
  emit('apply', delta)
  if (crossesBoundary) emit('clear-perio', props.fdi)
}
function setCrown(material: CrownMaterial) {
  if (props.disabled) return
  const same = props.state?.crown?.material === material
  emit('apply', { crown: same ? ({ __remove: true } as never) : ({ material } as StampedToothState['crown']) })
}
function setEndo(type: EndoType) {
  if (props.disabled) return
  const same = props.state?.endo?.type === type
  emit('apply', { endo: same ? ({ __remove: true } as never) : ({ type } as StampedToothState['endo']) })
}
function setImplant(stage: ImplantStage) {
  if (props.disabled) return
  const same = props.state?.implant?.stage === stage
  emit('apply', { implant: same ? ({ __remove: true } as never) : ({ stage } as StampedToothState['implant']) })
}
function togglePulpitis() {
  if (props.disabled) return
  const on = props.state?.pulpitis?.status === 'existing'
  emit('apply', {
    pulpitis: on
      ? ({ __remove: true } as never)
      : ({ status: 'existing', source_visit_id: null, recorded_at: null, recorded_by: null } as StampedToothState['pulpitis']),
  })
}
function toggleMissing() {
  if (props.disabled) return
  const on = !!props.state?.missing
  const delta: Partial<StampedToothState> = {
    missing: on
      ? ({ __remove: true } as never)
      : ({ status: 'existing', source_visit_id: null, recorded_at: null, recorded_by: null, since: null, cause: null } as StampedToothState['missing']),
  }
  if (!on && props.state?.base === 'implant') delta.base = 'tooth'
  if (on && props.state?.bridge?.role === 'pontic') {
    delta.bridge = { __remove: true } as never
  }
  emit('apply', delta)
}
function toggleSpecial(kind: 'extraction-plan' | 'crown-needed' | 'crown-replace') {
  if (props.disabled) return
  const has = !!props.state?.specials?.some((s) => s.kind === kind)
  emit('apply', { specials: [{ kind, ...(has ? { __remove: true } : {}) }] as never })
}
</script>

<template>
  <ContextMenu @update:open="(o) => o && emit('open')">
    <ContextMenuTrigger as-child>
      <slot />
    </ContextMenuTrigger>
    <ContextMenuContent class="w-56">
      <ContextMenuLabel>Tooth {{ fdi }}</ContextMenuLabel>
      <ContextMenuSeparator />

      <!-- Tooth base -->
      <ContextMenuSub>
        <ContextMenuSubTrigger :disabled="disabled">Tooth base</ContextMenuSubTrigger>
        <ContextMenuSubContent>
          <ContextMenuCheckboxItem
            v-for="b in baseOptions"
            :key="b.value"
            :model-value="state?.base === b.value"
            @select.prevent="setBase(b.value)"
          >{{ b.label }}</ContextMenuCheckboxItem>
        </ContextMenuSubContent>
      </ContextMenuSub>

      <!-- Missing toggle — hidden when base is implant (mutually exclusive). -->
      <ContextMenuCheckboxItem
        v-if="state?.base !== 'implant'"
        :model-value="!!state?.missing"
        :disabled="disabled"
        @select.prevent="toggleMissing"
      >Missing</ContextMenuCheckboxItem>

      <!-- Pulpitis toggle — hidden on missing / implant (no pulp) or after
           RCT has been completed (canal is filled, no pulp left). -->
      <ContextMenuCheckboxItem
        v-if="!hidePulpitis"
        :model-value="state?.pulpitis?.status === 'existing'"
        :disabled="disabled"
        @select.prevent="togglePulpitis"
      >Pulpitis</ContextMenuCheckboxItem>

      <ContextMenuSeparator v-if="!isMissing" />

      <!-- Crown — applies to natural teeth AND implants (implant crown). -->
      <ContextMenuSub v-if="!isMissing">
        <ContextMenuSubTrigger :disabled="disabled">Crown</ContextMenuSubTrigger>
        <ContextMenuSubContent>
          <ContextMenuCheckboxItem
            v-for="c in crownOptions"
            :key="c.value"
            :model-value="state?.crown?.material === c.value"
            @select.prevent="setCrown(c.value)"
          >{{ c.label }}</ContextMenuCheckboxItem>
        </ContextMenuSubContent>
      </ContextMenuSub>

      <!-- Endo — root canal / RCT — only on natural teeth. -->
      <ContextMenuSub v-if="!hideEndoPulp">
        <ContextMenuSubTrigger :disabled="disabled">Endo</ContextMenuSubTrigger>
        <ContextMenuSubContent>
          <ContextMenuCheckboxItem
            v-for="e in endoOptions"
            :key="e.value"
            :model-value="state?.endo?.type === e.value"
            @select.prevent="setEndo(e.value)"
          >{{ e.label }}</ContextMenuCheckboxItem>
        </ContextMenuSubContent>
      </ContextMenuSub>

      <!-- Implant stage — only when the tooth is an implant fixture. -->
      <ContextMenuSub v-if="showImplantStage">
        <ContextMenuSubTrigger :disabled="disabled">Implant stage</ContextMenuSubTrigger>
        <ContextMenuSubContent>
          <ContextMenuCheckboxItem
            v-for="i in implantOptions"
            :key="i.value"
            :model-value="state?.implant?.stage === i.value"
            @select.prevent="setImplant(i.value)"
          >{{ i.label }}</ContextMenuCheckboxItem>
        </ContextMenuSubContent>
      </ContextMenuSub>

      <ContextMenuSeparator />

      <!-- Plan flags -->
      <ContextMenuCheckboxItem
        :model-value="!!state?.specials?.some((s) => s.kind === 'extraction-plan')"
        :disabled="disabled"
        @select.prevent="toggleSpecial('extraction-plan')"
      >Plan extraction</ContextMenuCheckboxItem>
      <ContextMenuCheckboxItem
        :model-value="!!state?.specials?.some((s) => s.kind === 'crown-needed')"
        :disabled="disabled"
        @select.prevent="toggleSpecial('crown-needed')"
      >Plan crown</ContextMenuCheckboxItem>

      <ContextMenuSeparator />

      <ContextMenuItem :disabled="disabled" @select="emit('open-detail')">Open detail editor…</ContextMenuItem>
      <ContextMenuItem
        :disabled="disabled"
        class="text-destructive focus:text-destructive"
        @select="emit('reset-tooth')"
      >Reset tooth</ContextMenuItem>
    </ContextMenuContent>
  </ContextMenu>
</template>
