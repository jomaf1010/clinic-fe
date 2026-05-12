import { http } from '@/lib/http'
import type { User } from '../types/auth.types'

export interface RequestPhoneVerificationResponse {
  message: string
  expires_at: string
  phone_masked: string
}

export interface ConfirmPhoneVerificationResponse {
  user: User
}

export type ConfirmErrorCode = 'invalid_code' | 'expired' | 'too_many_attempts'

export interface ConfirmPhoneVerificationError {
  message: string
  error: ConfirmErrorCode
}

export const phoneVerificationApi = {
  async requestCode(phone: string): Promise<RequestPhoneVerificationResponse> {
    return http.post<RequestPhoneVerificationResponse>('/user/phone/verify/request', { phone })
  },

  async confirmCode(code: string): Promise<ConfirmPhoneVerificationResponse> {
    return http.post<ConfirmPhoneVerificationResponse>('/user/phone/verify/confirm', { code })
  },
}
