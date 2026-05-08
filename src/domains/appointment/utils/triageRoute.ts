import { RouteNames } from '@/router/routeNames'

export function buildAppointmentTriageRoute(patientId: string, encounterId: string | null) {
  if (encounterId) {
    return {
      name: RouteNames.ENCOUNTER_DETAIL,
      params: {
        patientId,
        id: encounterId,
      },
    }
  }

  return {
    name: RouteNames.ENCOUNTER_NEW,
    params: { patientId },
  }
}
