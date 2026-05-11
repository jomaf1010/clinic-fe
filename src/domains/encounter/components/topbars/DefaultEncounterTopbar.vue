<script setup lang="ts">
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Eye,
  FileDown,
  FileText,
  LoaderCircle,
  Printer,
} from 'lucide-vue-next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export interface EncounterTopbarProps {
  patientName: string | null
  consultationType?: string | null
  isDraft: boolean
  isFinalized: boolean
  isSaving: boolean
  saveError: string | null
  canFinalize: boolean
  summaryReady: boolean
  isGeneratingSummary: boolean
  showPreviewAction?: boolean
}

withDefaults(defineProps<EncounterTopbarProps>(), {
  showPreviewAction: true,
})

const emit = defineEmits<{
  back: []
  preview: []
  save: []
  finalize: []
  printSummary: []
  downloadSummary: []
  generateSummary: []
}>()
</script>

<template>
  <header
    class="encounter-topbar encounter-topbar-shell sticky top-2 z-50 mx-2 mb-2 flex w-[calc(100%-1rem)] items-center overflow-hidden rounded-2xl"
    style="height: calc(var(--header-height) + 0.5rem)"
  >
    <div class="flex h-full w-full items-center gap-3 p-3">
      <div class="flex min-w-0 flex-wrap items-center gap-2">
        <button
          type="button"
          class="encounter-topbar-icon shrink-0"
          aria-label="Back"
          @click="emit('back')"
        >
          <ArrowLeft class="size-4" />
        </button>
        <p class="truncate text-sm font-semibold">
          {{ patientName ?? 'Encounter' }}
        </p>
        <Badge
          v-if="consultationType === 'follow_up'"
          variant="secondary"
        >
          Follow-up
        </Badge>
        <Badge
          v-if="isDraft"
          class="border-amber-300 bg-amber-100 text-amber-700 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-400"
          variant="outline"
        >
          Draft
        </Badge>
        <Badge
          v-else-if="isFinalized"
          class="border-green-300 bg-green-100 text-green-700 dark:border-green-700 dark:bg-green-950 dark:text-green-400"
          variant="outline"
        >
          <CheckCircle2 class="size-3" />
          Finalized
        </Badge>
      </div>

      <div v-if="isFinalized" class="ml-auto flex flex-wrap items-center gap-2">
        <Button
          v-if="summaryReady"
          class="encounter-topbar-action"
          variant="outline"
          size="sm"
          @click="emit('printSummary')"
        >
          <Printer class="size-3.5" />
          Print
        </Button>
        <Button
          v-if="summaryReady"
          class="encounter-topbar-action"
          variant="outline"
          size="sm"
          @click="emit('downloadSummary')"
        >
          <FileDown class="size-3.5" />
          Download
        </Button>
        <Button
          class="encounter-topbar-action"
          variant="outline"
          size="sm"
          :disabled="isGeneratingSummary"
          @click="emit('generateSummary')"
        >
          <LoaderCircle v-if="isGeneratingSummary" class="size-3.5 animate-spin" />
          <FileText v-else class="size-3.5" />
          {{ isGeneratingSummary ? 'Generating...' : summaryReady ? 'Regenerate' : 'Consultation Summary' }}
        </Button>
      </div>

      <div v-if="isDraft" class="ml-auto flex flex-wrap items-center gap-2">
        <p v-if="isSaving" class="text-xs text-muted-foreground">
          Saving...
        </p>
        <p v-if="saveError" class="text-xs text-destructive">
          {{ saveError }}
        </p>
        <Tooltip v-if="showPreviewAction">
          <TooltipTrigger as-child>
            <Button
              class="encounter-topbar-action encounter-topbar-action--icon"
              variant="outline"
              size="icon"
              aria-label="Preview"
              @click="emit('preview')"
            >
              <Eye class="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Preview</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              class="encounter-topbar-action encounter-topbar-action--icon"
              variant="outline"
              size="icon"
              :disabled="isSaving"
              :aria-label="isSaving ? 'Saving' : 'Save'"
              @click="emit('save')"
            >
              <LoaderCircle v-if="isSaving" class="size-4 animate-spin" />
              <ClipboardList v-else class="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{{ isSaving ? 'Saving...' : 'Save' }}</TooltipContent>
        </Tooltip>
        <Tooltip v-if="canFinalize">
          <TooltipTrigger as-child>
            <Button
              class="encounter-topbar-action encounter-topbar-action--icon encounter-topbar-action--primary"
              size="icon"
              aria-label="Finalize"
              @click="emit('finalize')"
            >
              <CheckCircle2 class="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Finalize</TooltipContent>
        </Tooltip>
      </div>
    </div>
  </header>
</template>

<style scoped>
.encounter-topbar-shell {
  background:
    linear-gradient(135deg, rgb(255 255 255 / 0.32), rgb(255 255 255 / 0.1) 52%, rgb(255 255 255 / 0.2)),
    rgb(255 255 255 / 0.04);
  box-shadow: 0 22px 65px -36px rgb(15 23 42 / 0.55), 0 18px 45px rgb(15 23 42 / 0.1);
  backdrop-filter: blur(30px) saturate(1.35);
  -webkit-backdrop-filter: blur(30px) saturate(1.35);
}

.encounter-topbar-shell::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  border-radius: inherit;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.4);
}

.encounter-topbar-icon {
  display: inline-flex;
  height: 2.25rem;
  width: 2.25rem;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  border: 1px solid rgb(255 255 255 / 0.46);
  background: rgb(255 255 255 / 0.42);
  box-shadow: 0 10px 24px rgb(15 23 42 / 0.06);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  transition: transform 120ms ease, background 120ms ease, box-shadow 120ms ease;
}

.encounter-topbar-icon:hover {
  transform: translateY(-1px);
  background: rgb(255 255 255 / 0.58);
  box-shadow: 0 14px 30px rgb(15 23 42 / 0.1);
}

.encounter-topbar-icon:active {
  transform: translateY(0);
}

.encounter-topbar-action {
  height: 2.25rem;
  border-radius: 9999px;
  border-color: rgb(255 255 255 / 0.46);
  background: rgb(255 255 255 / 0.42);
  box-shadow: 0 10px 24px rgb(15 23 42 / 0.06);
  color: var(--foreground);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  transition: transform 120ms ease, background 120ms ease, box-shadow 120ms ease;
}

.encounter-topbar-action:hover {
  transform: translateY(-1px);
  background: rgb(255 255 255 / 0.58);
  box-shadow: 0 14px 30px rgb(15 23 42 / 0.1);
}

.encounter-topbar-action:active {
  transform: translateY(0);
}

.encounter-topbar-action--icon {
  padding: 0;
}

.encounter-topbar-action--primary {
  border-color: rgb(255 255 255 / 0.26);
  background: linear-gradient(135deg, rgb(37 99 235), rgb(20 184 166));
  color: white;
  box-shadow: 0 18px 36px rgb(37 99 235 / 0.2);
}

.encounter-topbar-action--primary:hover {
  background: linear-gradient(135deg, rgb(37 99 235), rgb(20 184 166));
  box-shadow: 0 20px 42px rgb(37 99 235 / 0.24);
}

:global(.dark) .encounter-topbar-icon {
  border-color: rgb(255 255 255 / 0.1);
  background: rgb(255 255 255 / 0.08);
  box-shadow: 0 12px 28px rgb(0 0 0 / 0.24);
}

:global(.dark) .encounter-topbar-icon:hover {
  background: rgb(255 255 255 / 0.12);
}

:global(.dark) .encounter-topbar-action {
  border-color: rgb(255 255 255 / 0.1);
  background: rgb(255 255 255 / 0.08);
  box-shadow: 0 12px 28px rgb(0 0 0 / 0.24);
}

:global(.dark) .encounter-topbar-action:hover {
  background: rgb(255 255 255 / 0.12);
}

:global(.dark) .encounter-topbar-action--primary {
  border-color: rgb(255 255 255 / 0.12);
  background: linear-gradient(135deg, rgb(37 99 235), rgb(20 184 166));
  box-shadow: 0 18px 42px rgb(37 99 235 / 0.18);
}

:global(.dark) .encounter-topbar-action--primary:hover {
  background: linear-gradient(135deg, rgb(37 99 235), rgb(20 184 166));
}

:global(.dark) .encounter-topbar-shell {
  background:
    linear-gradient(135deg, rgb(15 23 42 / 0.38), rgb(15 23 42 / 0.16) 52%, rgb(15 23 42 / 0.28)),
    rgb(15 23 42 / 0.08);
  box-shadow: 0 18px 50px -30px rgb(0 0 0 / 0.72), 0 18px 45px rgb(0 0 0 / 0.28);
}
</style>
