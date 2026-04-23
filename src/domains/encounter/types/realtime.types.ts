import type {
  ConsultationTriage,
  ConsultationAssessment,
  ConsultationTreatmentPlan,
} from '@/domains/consultation/types/consultation.types'
import type { PrescriptionResponse } from '@/domains/consultation/types/prescription.types'
import type { LabOrderResponse } from '@/domains/consultation/types/labOrder.types'

export interface EncounterUpdatedEvent {
  type: 'encounter.updated'
  actor_id: string
  session_id?: string
  encounter_id: string
  timestamp: string
  data: {
    sections: ('triage' | 'assessment' | 'treatment_plan')[]
    triage?: ConsultationTriage
    assessment?: ConsultationAssessment
    treatment_plan?: ConsultationTreatmentPlan
    updated_at: string
  }
}

export interface EncounterFinalizedEvent {
  type: 'encounter.finalized'
  actor_id: string
  session_id?: string
  encounter_id: string
  timestamp: string
  data: {
    status: 'finalized'
    finalized_at: string
    updated_at: string
  }
}

export interface PrescriptionEncounterRealtimeEvent {
  type: 'prescription.created' | 'prescription.item_added' | 'prescription.item_updated' | 'prescription.item_removed'
  actor_id: string
  session_id?: string
  encounter_id: string
  timestamp: string
  data: PrescriptionResponse
}

export interface LabOrderEncounterRealtimeEvent {
  type: 'lab_order.created' | 'lab_order.item_added' | 'lab_order.item_updated' | 'lab_order.item_removed' | 'lab_order.result_uploaded'
  actor_id: string
  session_id?: string
  encounter_id: string
  timestamp: string
  data: LabOrderResponse
}

export type EncounterRealtimeEvent =
  | EncounterUpdatedEvent
  | EncounterFinalizedEvent
  | PrescriptionEncounterRealtimeEvent
  | LabOrderEncounterRealtimeEvent
