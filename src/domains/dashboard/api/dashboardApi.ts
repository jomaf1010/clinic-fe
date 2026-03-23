import { http } from '@/lib/http'

export interface DashboardStats {
  total_patients: number
  consultations_today: number
  draft_consultations: number
  total_medicines: number
}

export interface OwnerAppointment {
  id: string
  patient_name: string
  patient_id: string
  doctor_name: string
  scheduled_at: string
  status: string
}

export interface OwnerQueueItem {
  id: string
  patient_name: string
  patient_id: string
  doctor_name: string
  status: string
  queued_at: string
}

export interface RecentConsultation {
  id: string
  patient_name: string
  patient_id: string
  doctor_name: string
  finalized_at: string
}

export interface TopMedicine {
  id: string
  name: string
  dosage: string | null
  prescription_count: number
  stock_quantity: number | null
}

export interface LowStockMedicine {
  id: string
  name: string
  dosage: string | null
  stock_quantity: number
}

export interface TeamMemberSummary {
  user_id: string
  name: string
  avatar_url: string | null
  role: string
  is_online: boolean
}

export interface OwnerDashboardStats {
  total_patients: number
  consultations_today: number
  draft_consultations: number
  total_medicines: number
  total_team_members: number
  online_team_members: number
  team_members: TeamMemberSummary[]
  pending_invites: number
  total_appointments_today: number
  total_revenue_today: number
  todays_appointments: OwnerAppointment[]
  queue_list: OwnerQueueItem[]
  recent_consultations: RecentConsultation[]
  top_medicines: TopMedicine[]
  low_stock_medicines: LowStockMedicine[]
}

export interface RecentPatient {
  id: string
  name: string
  last_visit: string
}

export interface DoctorAppointment {
  id: string
  patient_name: string
  patient_id: string
  scheduled_at: string
  date: string
  status: string
}

export interface DraftConsultation {
  id: string
  patient_name: string
  patient_id: string
  updated_at: string
  chief_complaint: string | null
}

export interface QueueItem {
  id: string
  patient_name: string
  patient_id: string
  consultation_id: string | null
  status: string
  queued_at: string
}

export interface DoctorDashboardStats {
  my_consultations_today: number
  my_draft_consultations: number
  my_patients_total: number
  queue_waiting: number
  my_appointments_today: number
  recent_patients: RecentPatient[]
  upcoming_appointments: DoctorAppointment[]
  draft_consultations_list: DraftConsultation[]
  queue_list: QueueItem[]
}

export interface StaffDashboardStats {
  consultations_today: number
  total_patients: number
  queue_waiting: number
  queue_serving: number
  appointments_today: number
  pending_checkins: number
  patients_registered_today: number
}

interface DashboardStatsResponse {
  data: DashboardStats
}

interface OwnerDashboardStatsResponse {
  data: OwnerDashboardStats
}

interface DoctorDashboardStatsResponse {
  data: DoctorDashboardStats
}

interface StaffDashboardStatsResponse {
  data: StaffDashboardStats
}

export interface RevenueChartPoint {
  date: string
  revenue: number
  invoiced: number
}

export const dashboardApi = {
  stats(): Promise<DashboardStatsResponse> {
    return http.get<DashboardStatsResponse>('/dashboard/stats')
  },

  ownerStats(): Promise<OwnerDashboardStatsResponse> {
    return http.get<OwnerDashboardStatsResponse>('/dashboard/owner')
  },

  doctorStats(): Promise<DoctorDashboardStatsResponse> {
    return http.get<DoctorDashboardStatsResponse>('/dashboard/doctor')
  },

  staffStats(): Promise<StaffDashboardStatsResponse> {
    return http.get<StaffDashboardStatsResponse>('/dashboard/staff')
  },

  doctorRevenueChart(): Promise<{ data: RevenueChartPoint[] }> {
    return http.get<{ data: RevenueChartPoint[] }>('/dashboard/doctor/revenue-chart')
  },

  ownerRevenueChart(): Promise<{ data: RevenueChartPoint[] }> {
    return http.get<{ data: RevenueChartPoint[] }>('/dashboard/owner/revenue-chart')
  },
}
