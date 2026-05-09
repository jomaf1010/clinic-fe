<script setup lang="ts">
import {
  ArrowLeft,
  CheckCircle2,
  LoaderCircle,
  MoreVertical,
  Pencil,
  Plus,
} from 'lucide-vue-next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import RiskClassificationBadge from './RiskClassificationBadge.vue'
import type { Pregnancy } from '../types/obgyn.types'
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  patientName: string | null
  statusLabel: string
  statusClass: string
  riskLevel?: Pregnancy['risk_level'] | null
  riskFactors?: string[] | null
  edd?: string | null
  gestationalAgeWeeks?: number | null
  gestationalAgeDays?: number | null
  trimester?: string | null
  isActive: boolean
  canCreateVisit: boolean
  hasDraftVisit: boolean
  canCreatePostpartumVisit: boolean
  canClosePostpartum: boolean
  isClosingPostpartum: boolean
  canOpenDelivery: boolean
  canResolvePrimary: boolean
  canResolveMenu: boolean
  showActions?: boolean
}>(), {
  showActions: true,
})

const emit = defineEmits<{
  back: []
  newVisit: []
  continueVisit: []
  postpartumVisit: []
  closePostpartum: []
  openDelivery: []
  resolve: []
  editSetup: []
}>()

const ga = computed(() => {
  if (props.gestationalAgeWeeks !== undefined && props.gestationalAgeWeeks !== null) {
    return {
      weeks: props.gestationalAgeWeeks,
      days: props.gestationalAgeDays ?? 0,
    }
  }

  if (!props.edd) return null
  const eddDate = new Date(props.edd)
  const today = new Date()
  const totalDays = 280 - Math.round((eddDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
  if (totalDays < 0) return null
  return {
    weeks: Math.floor(totalDays / 7),
    days: totalDays % 7,
  }
})

const trimester = computed(() => {
  if (props.trimester) {
    switch (props.trimester) {
      case '1':
      case 'first':
      case '1st':
        return '1st'
      case '2':
      case 'second':
      case '2nd':
        return '2nd'
      case '3':
      case 'third':
      case '3rd':
        return '3rd'
      default:
        return props.trimester
    }
  }

  if (!ga.value) return null
  if (ga.value.weeks < 14) return '1st'
  if (ga.value.weeks < 28) return '2nd'
  return '3rd'
})

const weeksToEdd = computed(() => {
  if (!ga.value) return null
  return Math.max(0, 40 - ga.value.weeks)
})
</script>

<template>
  <header
    class="obgyn-pregnancy-topbar sticky top-2 z-50 mx-2 mb-2 flex w-[calc(100%-1rem)] items-center overflow-hidden rounded-2xl"
    style="height: calc(var(--header-height) + 0.5rem)"
  >
    <div class="flex h-full w-full items-center gap-3 p-3">
      <div class="flex min-w-0 flex-1 items-center gap-2">
        <button
          type="button"
          class="obgyn-pregnancy-topbar-icon shrink-0"
          aria-label="Back to patient profile"
          @click="emit('back')"
        >
          <ArrowLeft class="size-4" />
        </button>

        <div class="min-w-0">
          <div class="flex min-w-0 items-center">
            <p class="truncate text-base font-semibold sm:text-lg">
              {{ patientName ?? 'Pregnancy Dashboard' }}
            </p>
          </div>
        </div>

        <Badge
          variant="outline"
          class="hidden text-xs sm:inline-flex"
          :class="statusClass"
        >
          {{ statusLabel }}
        </Badge>
        <RiskClassificationBadge
          v-if="riskLevel"
          class="hidden lg:inline-flex"
          :level="riskLevel"
          :factors="riskFactors ?? []"
        />
        <div
          v-if="ga && isActive"
          class="obgyn-pregnancy-topbar-ga hidden items-center gap-2 lg:flex"
        >
          <span class="text-sm font-bold tabular-nums">{{ ga.weeks }}w {{ ga.days }}d</span>
          <span v-if="trimester" class="obgyn-pregnancy-topbar-trimester">
            {{ trimester }} tri
          </span>
          <span v-if="weeksToEdd !== null" class="obgyn-pregnancy-topbar-edd hidden text-xs text-muted-foreground xl:inline">
            {{ weeksToEdd }}w to EDD
          </span>
        </div>
      </div>

      <div v-if="showActions !== false" class="ml-auto flex items-center gap-2">
        <Button
          v-if="canCreateVisit"
          class="obgyn-pregnancy-topbar-action obgyn-pregnancy-topbar-action--primary"
          size="sm"
          @click="hasDraftVisit ? emit('continueVisit') : emit('newVisit')"
        >
          <Pencil v-if="hasDraftVisit" class="size-3.5" />
          <Plus v-else class="size-3.5" />
          <span class="hidden sm:inline">{{ hasDraftVisit ? 'Continue Visit' : 'New Visit' }}</span>
        </Button>
        <Button
          v-if="canCreatePostpartumVisit"
          class="obgyn-pregnancy-topbar-action obgyn-pregnancy-topbar-action--primary"
          size="sm"
          @click="emit('postpartumVisit')"
        >
          <Plus class="size-3.5" />
          <span class="hidden sm:inline">Postpartum Visit</span>
        </Button>
        <Button
          v-if="canOpenDelivery"
          class="obgyn-pregnancy-topbar-action"
          variant="outline"
          size="sm"
          @click="emit('openDelivery')"
        >
          <CheckCircle2 class="size-3.5" />
          <span class="hidden md:inline">Go to Delivery</span>
        </Button>
        <Button
          v-if="canResolvePrimary"
          class="obgyn-pregnancy-topbar-action"
          variant="outline"
          size="sm"
          @click="emit('resolve')"
        >
          <CheckCircle2 class="size-3.5" />
          <span class="hidden md:inline">Resolve</span>
        </Button>
        <Button
          v-if="canClosePostpartum"
          class="obgyn-pregnancy-topbar-action"
          variant="outline"
          size="sm"
          :disabled="isClosingPostpartum"
          @click="emit('closePostpartum')"
        >
          <LoaderCircle v-if="isClosingPostpartum" class="size-3.5 animate-spin" />
          <CheckCircle2 v-else class="size-3.5" />
          <span class="hidden md:inline">Close Postpartum</span>
        </Button>

        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger as-child>
              <DropdownMenuTrigger as-child>
                <Button
                  class="obgyn-pregnancy-topbar-action obgyn-pregnancy-topbar-action--icon"
                  variant="outline"
                  size="icon"
                  aria-label="Pregnancy actions"
                >
                  <MoreVertical class="size-4" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">Pregnancy actions</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end">
            <DropdownMenuItem @click="emit('editSetup')">
              <Pencil class="mr-2 size-3.5" />
              Edit Setup
            </DropdownMenuItem>
            <DropdownMenuItem
              v-if="canResolveMenu"
              @click="emit('resolve')"
            >
              <CheckCircle2 class="mr-2 size-3.5" />
              Resolve Pregnancy
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  </header>
</template>

<style scoped>
.obgyn-pregnancy-topbar {
  background:
    linear-gradient(135deg, rgb(255 255 255 / 0.32), rgb(255 255 255 / 0.1) 52%, rgb(255 255 255 / 0.2)),
    rgb(255 255 255 / 0.04);
  box-shadow: 0 22px 65px -36px rgb(15 23 42 / 0.55), 0 18px 45px rgb(15 23 42 / 0.1);
  backdrop-filter: blur(30px) saturate(1.35);
  -webkit-backdrop-filter: blur(30px) saturate(1.35);
}

.obgyn-pregnancy-topbar::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  border-radius: inherit;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.4);
}

.obgyn-pregnancy-topbar-icon,
.obgyn-pregnancy-topbar-action {
  border: 1px solid rgb(255 255 255 / 0.46);
  background: rgb(255 255 255 / 0.42);
  box-shadow: 0 10px 24px rgb(15 23 42 / 0.06);
  color: var(--foreground);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  transition: transform 120ms ease, background 120ms ease, box-shadow 120ms ease;
}

.obgyn-pregnancy-topbar-icon {
  display: inline-flex;
  height: 2.25rem;
  width: 2.25rem;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
}

.obgyn-pregnancy-topbar-action {
  height: 2.25rem;
  border-radius: 9999px;
}

.obgyn-pregnancy-topbar-action--icon {
  width: 2.25rem;
  padding: 0;
}

.obgyn-pregnancy-topbar-icon:hover,
.obgyn-pregnancy-topbar-action:hover {
  transform: translateY(-1px);
  background: rgb(255 255 255 / 0.58);
  box-shadow: 0 14px 30px rgb(15 23 42 / 0.1);
}

.obgyn-pregnancy-topbar-icon:active,
.obgyn-pregnancy-topbar-action:active {
  transform: translateY(0);
}

.obgyn-pregnancy-topbar-action--primary {
  border-color: rgb(255 255 255 / 0.26);
  background: linear-gradient(135deg, rgb(37 99 235), rgb(20 184 166));
  color: white;
  box-shadow: 0 18px 36px rgb(37 99 235 / 0.2);
}

.obgyn-pregnancy-topbar-action--primary:hover {
  background: linear-gradient(135deg, rgb(37 99 235), rgb(20 184 166));
  box-shadow: 0 20px 42px rgb(37 99 235 / 0.24);
}

.obgyn-pregnancy-topbar-ga {
  border-radius: 9999px;
  background: rgb(255 255 255 / 0.34);
  box-shadow: 0 10px 24px rgb(15 23 42 / 0.05);
  padding: 0.35rem 0.75rem;
}

.obgyn-pregnancy-topbar-trimester {
  border-radius: 9999px;
  background: linear-gradient(135deg, rgb(37 99 235), rgb(20 184 166));
  color: white;
  padding: 0.15rem 0.55rem;
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1.15;
}

:global(.dark) .obgyn-pregnancy-topbar {
  color: rgb(248 250 252);
  background:
    radial-gradient(circle at 10% 0%, rgb(37 99 235 / 0.2), transparent 32%),
    radial-gradient(circle at 92% 0%, rgb(20 184 166 / 0.18), transparent 36%),
    linear-gradient(135deg, rgb(15 23 42 / 0.86), rgb(2 6 23 / 0.64) 56%, rgb(15 23 42 / 0.74)),
    rgb(2 6 23 / 0.7);
  box-shadow:
    0 24px 80px -38px rgb(0 0 0 / 0.86),
    0 18px 48px rgb(0 0 0 / 0.32);
}

:global(.dark) .obgyn-pregnancy-topbar::before {
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.12),
    inset 0 0 0 1px rgb(148 163 184 / 0.14);
}

:global(.dark) .obgyn-pregnancy-topbar-icon,
:global(.dark) .obgyn-pregnancy-topbar-action {
  color: rgb(226 232 240);
  border-color: rgb(148 163 184 / 0.2);
  background:
    linear-gradient(135deg, rgb(15 23 42 / 0.78), rgb(2 6 23 / 0.44)),
    rgb(15 23 42 / 0.5);
  box-shadow:
    0 12px 30px rgb(0 0 0 / 0.32),
    inset 0 1px 0 rgb(255 255 255 / 0.08);
}

:global(.dark) .obgyn-pregnancy-topbar-icon:hover,
:global(.dark) .obgyn-pregnancy-topbar-action:hover {
  border-color: rgb(96 165 250 / 0.36);
  background:
    radial-gradient(circle at 0% 0%, rgb(37 99 235 / 0.22), transparent 42%),
    linear-gradient(135deg, rgb(15 23 42 / 0.86), rgb(2 6 23 / 0.56)),
    rgb(15 23 42 / 0.56);
}

:global(.dark) .obgyn-pregnancy-topbar-action--primary {
  border-color: rgb(255 255 255 / 0.12);
  background: linear-gradient(135deg, rgb(37 99 235), rgb(20 184 166));
  box-shadow: 0 18px 42px rgb(37 99 235 / 0.18);
}

:global(.dark) .obgyn-pregnancy-topbar-ga {
  border: 1px solid rgb(148 163 184 / 0.14);
  background:
    linear-gradient(135deg, rgb(15 23 42 / 0.74), rgb(2 6 23 / 0.42)),
    rgb(15 23 42 / 0.5);
  box-shadow:
    0 12px 28px rgb(0 0 0 / 0.22),
    inset 0 1px 0 rgb(255 255 255 / 0.08);
}

:global(.dark) .obgyn-pregnancy-topbar-edd {
  color: rgb(203 213 225 / 0.78);
}
</style>
