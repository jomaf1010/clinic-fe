import { describe, expect, it } from 'vitest'
import {
  buildQueueDisplayUrl,
  readQueueDisplayToken,
  storeQueueDisplayToken,
} from './displayTokenLaunch'

class MemoryStorage implements Storage {
  private values = new Map<string, string>()

  get length(): number {
    return this.values.size
  }

  clear(): void {
    this.values.clear()
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }
}

describe('queue display token launch handoff', () => {
  it('builds the public display URL without embedding the bearer token', () => {
    const url = buildQueueDisplayUrl('https://app.mediflow.ph', 'queue-token-123')

    expect(url).toBe('https://app.mediflow.ph/queue-display')
    expect(url).not.toContain('queue-token-123')
  })

  it('stores the bearer token in tab-scoped storage for same-browser launch', () => {
    const storage = new MemoryStorage()

    storeQueueDisplayToken('queue-token-123', storage)

    expect(readQueueDisplayToken(undefined, storage)).toBe('queue-token-123')
  })

  it('prefers a legacy route token only when it is a string', () => {
    const storage = new MemoryStorage()
    storeQueueDisplayToken('stored-token', storage)

    expect(readQueueDisplayToken('legacy-token', storage)).toBe('legacy-token')
    expect(readQueueDisplayToken(undefined, storage)).toBe('legacy-token')

    const fallbackStorage = new MemoryStorage()
    storeQueueDisplayToken('stored-token', fallbackStorage)
    expect(readQueueDisplayToken(['bad-token'], fallbackStorage)).toBe('stored-token')
  })
})
