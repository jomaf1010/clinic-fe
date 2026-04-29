import { computed, onUnmounted, ref, watch } from 'vue'
import type { Ref } from 'vue'
import type { PublicationContext } from 'centrifuge'
import { useCentrifugo } from '@/composables/useCentrifugo'
import { SESSION_ID } from '@/lib/http'
import type { PatientRealtimeEvent } from '../types/patientRealtime.types'
import type { PatientResponse } from '../types/patient.types'

export function usePatientSync(
  patientId: Ref<string | undefined>,
  clinicId: Ref<string | undefined>,
  onPatientUpdated?: (patient: PatientResponse) => void,
  onTimelineUpdated?: (data: { encounter_id: string; auto_display_line: string; auto_display_summary: string | null; updated_at: string }) => void,
) {
  const { connect, subscribe, unsubscribe } = useCentrifugo()

  const patientUpdate = ref<PatientResponse | null>(null)

  function isSelf(event: PatientRealtimeEvent): boolean {
    return !!event.session_id && event.session_id === SESSION_ID
  }

  function onEvent(ctx: PublicationContext) {
    const event = ctx.data as PatientRealtimeEvent
    if (isSelf(event)) return

    if (event.type === 'patient.updated') {
      patientUpdate.value = event.data
      onPatientUpdated?.(event.data)
    } else if (event.type === 'patient.avatar_updated') {
      if (patientUpdate.value) {
        patientUpdate.value = { ...patientUpdate.value, avatar_url: event.data.avatar_url }
      }
    } else if (event.type === 'encounter.timeline_updated') {
      onTimelineUpdated?.(event.data)
    }
  }

  const channel = computed(() => {
    if (!patientId.value || !clinicId.value) return null
    return `clinic:${clinicId.value}:patient:${patientId.value}`
  })

  let currentChannel: string | null = null

  watch(channel, (newCh) => {
    if (newCh === currentChannel) return
    if (currentChannel) unsubscribe(currentChannel)
    currentChannel = newCh
    if (newCh) {
      connect()
      subscribe(newCh, onEvent)
    }
  }, { immediate: true })

  onUnmounted(() => {
    if (currentChannel) unsubscribe(currentChannel)
  })

  return { patientUpdate }
}
