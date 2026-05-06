import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface MockHttp {
  get: ReturnType<typeof vi.fn>
}

function makeHttp(): MockHttp {
  return {
    get: vi.fn().mockResolvedValue({ data: [] }),
  }
}

async function loadApi(http: MockHttp) {
  vi.doMock('@/lib/http', () => ({ http }))
  return await import('./auditLogApi')
}

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.doUnmock('@/lib/http')
})

describe('auditLogApi', () => {
  it('builds paginated audit log list requests', async () => {
    const http = makeHttp()
    const { auditLogApi } = await loadApi(http)

    await auditLogApi.list()
    await auditLogApi.list(3, 50)

    expect(http.get).toHaveBeenNthCalledWith(1, '/audit-logs?page=1&per_page=15')
    expect(http.get).toHaveBeenNthCalledWith(2, '/audit-logs?page=3&per_page=50')
  })

  it('loads an audit log detail by uuid', async () => {
    const http = makeHttp()
    const { auditLogApi } = await loadApi(http)

    await auditLogApi.get('audit-1')

    expect(http.get).toHaveBeenCalledWith('/audit-logs/audit-1')
  })
})
