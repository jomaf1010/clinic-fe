import type { QueueDisplayTokenStatus } from '../types/queue.types'

export function hasLaunchableDisplayToken(status: QueueDisplayTokenStatus): status is QueueDisplayTokenStatus & { token: string } {
  return typeof status.token === 'string' && status.token.length > 0
}

export function hasActiveDisplayToken(status: QueueDisplayTokenStatus): boolean {
  return status.active === true || hasLaunchableDisplayToken(status)
}
