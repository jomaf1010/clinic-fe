import { computed, onUnmounted, ref, watch } from 'vue'
import type { Ref } from 'vue'
import type { PublicationContext } from 'centrifuge'
import { useCentrifugo } from '@/composables/useCentrifugo'
import { encounterApi } from '../api/encounterApi'
import { useEncounterStore } from '../stores/encounterStore'
import { SESSION_ID } from '@/lib/http'
import type { EncounterRealtimeEvent } from '../types/realtime.types'
import type { PrescriptionResponse } from '@/domains/consultation/types/prescription.types'
import type { LabOrderResponse } from '@/domains/consultation/types/labOrder.types'
import type { GeneratedDocumentResponse } from '@/domains/consultation/api/documentApi'

export function useEncounterSync(encounterId: Ref<string | undefined>, clinicId: Ref<string | undefined>) {
  const { connect, subscribe, unsubscribe } = useCentrifugo()
  const encounterStore = useEncounterStore()

  const prescriptionUpdate = ref<PrescriptionResponse | null>(null)
  const labOrderUpdate = ref<LabOrderResponse | null>(null)
  const documentUpdate = ref<GeneratedDocumentResponse | null>(null)

  function isSelf(event: EncounterRealtimeEvent): boolean {
    return !!event.session_id && event.session_id === SESSION_ID
  }

  function onEvent(ctx: PublicationContext) {
    const event = ctx.data as EncounterRealtimeEvent
    if (event.type.startsWith('encounter.')) {
      if (isSelf(event)) return
      encounterStore.handleRealtimeEvent(event)
    } else if (event.type.startsWith('prescription.')) {
      if (isSelf(event)) return
      prescriptionUpdate.value = event.data as PrescriptionResponse
    } else if (event.type.startsWith('lab_order.')) {
      if (isSelf(event)) return
      labOrderUpdate.value = event.data as LabOrderResponse
      // Silently refresh encounter to update lab_order_summary in the vitals card
      if (encounterId.value) {
        encounterApi.get(encounterId.value).then((res) => {
          if (encounterStore.current?.id === encounterId.value) {
            encounterStore.current = res.data
          }
        }).catch(() => {})
      }
    } else if (event.type.startsWith('document.')) {
      // Document events should be received by the same user (no self-echo prevention)
      documentUpdate.value = event.data as unknown as GeneratedDocumentResponse
    }
  }

  const channel = computed(() => {
    if (!encounterId.value || !clinicId.value) return null
    return `clinic:${clinicId.value}:encounter:${encounterId.value}`
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

  return { prescriptionUpdate, labOrderUpdate, documentUpdate }
}
