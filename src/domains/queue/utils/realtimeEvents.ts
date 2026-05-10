import type { QueueVisitResponse } from '../types/queue.types'

export interface QueueRealtimeEvent {
  type: string
  data: QueueVisitResponse
}

export function mergeQueueRealtimeEvent(
  visits: QueueVisitResponse[],
  event: QueueRealtimeEvent,
): QueueVisitResponse[] {
  const { type, data } = event
  const index = visits.findIndex((visit) => visit.id === data.id)

  switch (type) {
    case 'queue.visit.created':
    case 'queue.visit.called':
    case 'queue.visit.completed':
    case 'queue.visit.cancelled':
      if (index === -1) {
        return [...visits, data]
      }
      return visits.map((visit, visitIndex) => (visitIndex === index ? data : visit))
    default:
      return visits
  }
}
