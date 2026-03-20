import { computed, onUnmounted, ref, watch } from 'vue'
import type { Ref } from 'vue'
import type { PublicationContext } from 'centrifuge'
import { useCentrifugo } from '@/composables/useCentrifugo'
import { consultationApi } from '../api/consultationApi'
import { useConsultationStore } from '../stores/consultationStore'
import { useAuthStore } from '@/domains/auth/stores/authStore'
import type { ConsultationRealtimeEvent } from '../types/realtime.types'
import type { PrescriptionResponse } from '../types/prescription.types'
import type { LabOrderResponse } from '../types/labOrder.types'

export function useConsultationSync(consultationId: Ref<string | undefined>, clinicId: Ref<string | undefined>) {
  const { connect, subscribe, unsubscribe } = useCentrifugo()
  const consultationStore = useConsultationStore()
  const authStore = useAuthStore()

  const prescriptionUpdate = ref<PrescriptionResponse | null>(null)
  const labOrderUpdate = ref<LabOrderResponse | null>(null)

  function onEvent(ctx: PublicationContext) {
    const event = ctx.data as ConsultationRealtimeEvent

    // Self-echo prevention
    if (event.actor_id === authStore.user?.id) return

    if (event.type.startsWith('consultation.')) {
      consultationStore.handleRealtimeEvent(event)
    } else if (event.type.startsWith('prescription.')) {
      prescriptionUpdate.value = event.data as PrescriptionResponse
    } else if (event.type.startsWith('lab_order.')) {
      labOrderUpdate.value = event.data as LabOrderResponse
      // Silently refresh consultation to update lab_order_summary in the vitals card
      if (consultationId.value) {
        consultationApi.get(consultationId.value).then((res) => {
          if (consultationStore.current?.id === consultationId.value) {
            consultationStore.current = res.data
          }
        }).catch(() => {})
      }
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

  return { prescriptionUpdate, labOrderUpdate }
}
