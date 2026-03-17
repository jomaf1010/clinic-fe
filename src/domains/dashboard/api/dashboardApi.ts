import { http } from '@/lib/http'

export interface DashboardStats {
  total_patients: number
  consultations_today: number
  draft_consultations: number
  total_medicines: number
}

interface DashboardStatsResponse {
  data: DashboardStats
}

export const dashboardApi = {
  stats(): Promise<DashboardStatsResponse> {
    return http.get<DashboardStatsResponse>('/dashboard/stats')
  },
}
