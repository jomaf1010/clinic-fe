export type BlockType = 'leave' | 'meeting' | 'holiday' | 'personal' | 'unavailable'

export interface Break {
  label: string
  start_time: string // HH:mm
  end_time: string // HH:mm
}

export interface DaySchedule {
  day: number // 0=Sun..6=Sat
  enabled: boolean
  start_time: string // HH:mm
  end_time: string // HH:mm
  breaks: Break[]
}

export interface WorkingSchedule {
  id: string
  clinic_id: string
  user_id: string
  timezone: string
  slot_duration: number
  days: DaySchedule[]
  created_at: string
  updated_at: string
}

export interface CalendarBlock {
  id: string
  clinic_id: string
  user_id: string
  title: string
  type: BlockType
  all_day: boolean
  recurring: boolean
  start: string // ISO date
  end: string // ISO date
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Slot {
  start: string // ISO datetime
  end: string // ISO datetime
  available: boolean
  reason?: 'break' | 'block' | 'appointment'
  label?: string
  block_title?: string
}

// Request payloads
export interface UpsertWorkingSchedulePayload {
  timezone: string
  slot_duration: number
  days: DaySchedule[]
}

export interface StoreCalendarBlockPayload {
  user_id: string
  title: string
  type: BlockType
  all_day: boolean
  recurring: boolean
  start: string
  end: string
  notes?: string | null
}

export interface UpdateCalendarBlockPayload {
  title?: string
  type?: BlockType
  all_day?: boolean
  recurring?: boolean
  start?: string
  end?: string
  notes?: string | null
}

// Response types
export interface WorkingScheduleResponse {
  data: WorkingSchedule
}

export interface CalendarBlockListResponse {
  data: CalendarBlock[]
}

export interface CalendarBlockResponse {
  data: CalendarBlock
}

export interface AvailabilityResponse {
  data: {
    slots: Slot[]
    blocks: CalendarBlock[]
    schedule: WorkingSchedule
  }
}
