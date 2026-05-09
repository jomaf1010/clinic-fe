import { beforeEach, describe, expect, it, vi } from 'vitest'

class FakeBroadcastChannel {
  static instances: FakeBroadcastChannel[] = []

  readonly name: string
  private listeners: Array<(event: MessageEvent) => void> = []

  constructor(name: string) {
    this.name = name
    FakeBroadcastChannel.instances.push(this)
  }

  addEventListener(_type: 'message', listener: (event: MessageEvent) => void): void {
    this.listeners.push(listener)
  }

  postMessage(): void {}

  close(): void {}

  emit(data: unknown): void {
    this.listeners.forEach((listener) => listener({ data } as MessageEvent))
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('http auth channel sync', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('VITE_API_URL', 'https://api.example.test')
    vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel)
    FakeBroadcastChannel.instances = []
  })

  it('reconciles the auth store after another tab changes the shared session', async () => {
    const syncExternalSession = vi.fn().mockResolvedValue(undefined)
    vi.doMock('@/domains/auth/stores/authStore', () => ({
      useAuthStore: () => ({ syncExternalSession }),
    }))
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: { access_token: 'new-tab-token' } }))
    vi.stubGlobal('fetch', fetchMock)

    const { getAuthToken } = await import('./http')
    FakeBroadcastChannel.instances[0]!.emit({ type: 'session_changed' })
    await vi.waitFor(() => expect(syncExternalSession).toHaveBeenCalled())

    expect(fetchMock).toHaveBeenCalledWith('https://api.example.test/auth/refresh', {
      method: 'POST',
      headers: { Accept: 'application/json' },
      credentials: 'include',
    })
    expect(getAuthToken()).toBe('new-tab-token')
    expect(syncExternalSession).toHaveBeenCalledWith('new-tab-token', { reloadOnAccountChange: true })
  })
})
