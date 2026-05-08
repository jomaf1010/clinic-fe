const QUEUE_DISPLAY_TOKEN_STORAGE_KEY = 'mediflow.queueDisplay.token'

export function buildQueueDisplayUrl(origin: string, _token?: string | null): string {
  return `${origin}/queue-display`
}

export function storeQueueDisplayToken(token: string, storage: Storage = window.sessionStorage): void {
  storage.setItem(QUEUE_DISPLAY_TOKEN_STORAGE_KEY, token)
}

export function readQueueDisplayToken(
  routeToken: string | string[] | undefined,
  storage: Storage = window.sessionStorage,
): string | null {
  if (typeof routeToken === 'string' && routeToken.trim() !== '') {
    return routeToken
  }

  return storage.getItem(QUEUE_DISPLAY_TOKEN_STORAGE_KEY)
}
