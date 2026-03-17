import { http } from '@/lib/http'

interface TokenResponse {
  token: string
}

export const centrifugoApi = {
  getConnectionToken(): Promise<TokenResponse> {
    return http.get<TokenResponse>('/centrifugo/connection-token')
  },

  getSubscriptionToken(channel: string): Promise<TokenResponse> {
    return http.post<TokenResponse>('/centrifugo/subscription-token', { channel })
  },
}
