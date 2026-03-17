import type {
  ConsultationTriage,
  ConsultationAssessment,
  ConsultationTreatmentPlan,
} from './consultation.types'
import type { PrescriptionResponse } from './prescription.types'
import type { LabOrderResponse } from './labOrder.types'

export interface ConsultationUpdatedEvent {
  type: 'consultation.updated'
  actor_id: string
  consultation_id: string
  timestamp: string
  data: {
    sections: ('triage' | 'assessment' | 'treatment_plan')[]
    triage?: ConsultationTriage
    assessment?: ConsultationAssessment
    treatment_plan?: ConsultationTreatmentPlan
    updated_at: string
  }
}

export interface ConsultationFinalizedEvent {
  type: 'consultation.finalized'
  actor_id: string
  consultation_id: string
  timestamp: string
  data: {
    status: 'finalized'
    finalized_at: string
    updated_at: string
  }
}

export interface PrescriptionRealtimeEvent {
  type: 'prescription.created' | 'prescription.item_added' | 'prescription.item_updated' | 'prescription.item_removed'
  actor_id: string
  consultation_id: string
  timestamp: string
  data: PrescriptionResponse
}

export interface LabOrderRealtimeEvent {
  type: 'lab_order.created' | 'lab_order.item_added' | 'lab_order.item_updated' | 'lab_order.item_removed' | 'lab_order.result_uploaded'
  actor_id: string
  consultation_id: string
  timestamp: string
  data: LabOrderResponse
}

export type ConsultationRealtimeEvent =
  | ConsultationUpdatedEvent
  | ConsultationFinalizedEvent
  | PrescriptionRealtimeEvent
  | LabOrderRealtimeEvent
