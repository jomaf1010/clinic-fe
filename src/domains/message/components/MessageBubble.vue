<script setup lang="ts">
import { computed } from 'vue'
import { Check, CheckCheck } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { RouteNames } from '@/router/routeNames'
import type { MessageResponse } from '../types/message.types'
import PatientMentionCard from './PatientMentionCard.vue'

const props = defineProps<{
  message: MessageResponse
  isOwn: boolean
  isRead: boolean
}>()

const router = useRouter()

interface BodyPart {
  type: 'text' | 'patient'
  text: string
  id?: string
  name?: string
}

const bodyParts = computed<BodyPart[]>(() => {
  const parts: BodyPart[] = []
  const regex = /\[@patient:([^:]+):([^\]]+)\]/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(props.message.body)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', text: props.message.body.substring(lastIndex, match.index) })
    }
    parts.push({ type: 'patient', text: match[0], id: match[1], name: match[2] })
    lastIndex = regex.lastIndex
  }

  if (lastIndex < props.message.body.length) {
    parts.push({ type: 'text', text: props.message.body.substring(lastIndex) })
  }

  return parts
})

const hasLinks = computed(() => bodyParts.value.some((p) => p.type === 'patient'))

const mentionedPatients = computed(() =>
  bodyParts.value.filter((p) => p.type === 'patient') as (BodyPart & { id: string; name: string })[],
)

function goToPatient(id: string) {
  router.push({ name: RouteNames.PATIENT_DETAIL, params: { id } })
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}
</script>

<template>
  <div class="flex" :class="isOwn ? 'justify-end' : 'justify-start'">
    <div class="max-w-[75%]">
      <div
        class="rounded-2xl px-3.5 py-2 text-sm"
        :class="isOwn
          ? 'bg-primary text-primary-foreground rounded-br-md'
          : 'bg-muted rounded-bl-md'"
      >
        <p v-if="!isOwn" class="mb-0.5 text-xs font-medium text-muted-foreground">
          {{ message.sender_name }}
        </p>
        <p class="whitespace-pre-wrap break-words">
          <template v-if="hasLinks">
            <template v-for="(part, i) in bodyParts" :key="i">
              <span v-if="part.type === 'text'">{{ part.text }}</span>
              <button
                v-else
                type="button"
                class="inline-flex items-center gap-0.5 rounded px-1 py-0.5 font-medium underline underline-offset-2 transition-colors"
                :class="isOwn
                  ? 'text-primary-foreground hover:text-primary-foreground/80 bg-primary-foreground/10'
                  : 'text-primary hover:text-primary/80 bg-primary/10'"
                @click="goToPatient(part.id!)"
              >
                {{ part.name }}
              </button>
            </template>
          </template>
          <template v-else>{{ message.body }}</template>
        </p>
        <div class="mt-1 flex items-center justify-end gap-1">
          <span class="text-[10px] opacity-70">{{ formatTime(message.created_at) }}</span>
          <template v-if="isOwn">
            <CheckCheck v-if="isRead" class="size-3.5 text-primary-foreground/70" />
            <Check v-else class="size-3.5 text-primary-foreground/50" />
          </template>
        </div>
      </div>

      <!-- Patient cards below the bubble -->
      <PatientMentionCard
        v-for="patient in mentionedPatients"
        :key="patient.id"
        :patient-id="patient.id!"
        :patient-name="patient.name!"
      />
    </div>
  </div>
</template>
