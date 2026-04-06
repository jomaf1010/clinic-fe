import { computed, onUnmounted, ref, watch } from 'vue'
import type { Ref } from 'vue'
import type { PublicationContext } from 'centrifuge'
import { useCentrifugo } from '@/composables/useCentrifugo'
import { consultationApi } from '../api/consultationApi'
import { useConsultationStore } from '../stores/consultationStore'
import { SESSION_ID } from '@/lib/http'
import type { ConsultationRealtimeEvent } from '../types/realtime.types'
import type { PrescriptionResponse } from '../types/prescription.types'
import type { LabOrderResponse } from '../types/labOrder.types'
import type { GeneratedDocumentResponse } from '../api/documentApi'

export function useConsultationSync(consultationId: Ref<string | undefined>, clinicId: Ref<string | undefined>) {
  const { connect, subscribe, unsubscribe } = useCentrifugo()
  const consultationStore = useConsultationStore()

  const prescriptionUpdate = ref<PrescriptionResponse | null>(null)
  const labOrderUpdate = ref<LabOrderResponse | null>(null)
  const documentUpdate = ref<GeneratedDocumentResponse | null>(null)

  function isSelf(event: ConsultationRealtimeEvent): boolean {
    return !!event.session_id && event.session_id === SESSION_ID
  }

  function onEvent(ctx: PublicationContext) {
    const event = ctx.data as ConsultationRealtimeEvent
    if (event.type.startsWith('consultation.')) {
      if (isSelf(event)) return
      consultationStore.handleRealtimeEvent(event)
    } else if (event.type.startsWith('prescription.')) {
      if (isSelf(event)) return
      prescriptionUpdate.value = event.data as PrescriptionResponse
    } else if (event.type.startsWith('lab_order.')) {
      if (isSelf(event)) return
      labOrderUpdate.value = event.data as LabOrderResponse
      // Silently refresh consultation to update lab_order_summary in the vitals card
      if (consultationId.value) {
        consultationApi.get(consultationId.value).then((res) => {
          if (consultationStore.current?.id === consultationId.value) {
            consultationStore.current = res.data
          }
        }).catch(() => {})
      }
    } else if (event.type.startsWith('document.')) {
      // Document events should be received by the same user (no self-echo prevention)
      documentUpdate.value = event.data as GeneratedDocumentResponse
    }
  }

  const channel = computed(() => {
    if (!consultationId.value || !clinicId.value) return null
    return `clinic:${clinicId.value}:consultation:${consultationId.value}`
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
