/**
 * Mock for `@/lib/http`.
 *
 * Default: every method returns `{ data: {} }`. Override per-call with
 * `mockResolvedValueOnce`. The mock object is the same reference each
 * call to `createMockHttp()` so test code can assert on it directly.
 *
 * Usage:
 *   import { vi } from 'vitest'
 *   import { createMockHttp } from '@/__tests__/helpers/mockHttp'
 *
 *   const http = createMockHttp()
 *   vi.doMock('@/lib/http', () => ({ http, HttpError: ActualHttpError }))
 *   // then dynamic-import the module under test
 */

import { vi } from 'vitest'

export interface MockHttp {
  get: ReturnType<typeof vi.fn>
  post: ReturnType<typeof vi.fn>
  put: ReturnType<typeof vi.fn>
  patch: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
  upload: ReturnType<typeof vi.fn>
  getBlob: ReturnType<typeof vi.fn>
  download: ReturnType<typeof vi.fn>
}

export function createMockHttp(): MockHttp {
  return {
    get: vi.fn().mockResolvedValue({ data: {} }),
    post: vi.fn().mockResolvedValue({ data: {} }),
    put: vi.fn().mockResolvedValue({ data: {} }),
    patch: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({ data: {} }),
    upload: vi.fn().mockResolvedValue({ data: {} }),
    getBlob: vi.fn().mockResolvedValue(new Blob()),
    download: vi.fn().mockResolvedValue(new Blob()),
  }
}

/**
 * Lightweight HttpError stub for tests that need to throw one (e.g.,
 * `mockRejectedValueOnce(new MockHttpError(404, 'Not found'))`).
 * The real one lives in `@/lib/http`; this avoids the module-mock
 * chicken-and-egg when a test mocks the http module itself.
 */
export class MockHttpError extends Error {
  readonly status: number
  readonly data?: unknown

  constructor(status: number, message: string, data?: unknown) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.data = data
  }
}
