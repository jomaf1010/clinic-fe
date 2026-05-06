import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface MockHttp {
  get: ReturnType<typeof vi.fn>
  post: ReturnType<typeof vi.fn>
  patch: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
}

function makeHttp(): MockHttp {
  return {
    get: vi.fn().mockResolvedValue({ data: [] }),
    post: vi.fn().mockResolvedValue({ data: { id: 'role-1' } }),
    patch: vi.fn().mockResolvedValue({ data: { id: 'role-1' } }),
    delete: vi.fn().mockResolvedValue(undefined),
  }
}

async function loadApi(http: MockHttp) {
  vi.doMock('@/lib/http', () => ({ http }))
  return await import('./roleApi')
}

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.doUnmock('@/lib/http')
})

describe('roleApi', () => {
  it('loads clinic roles and permission groups', async () => {
    const http = makeHttp()
    const { roleApi } = await loadApi(http)

    await roleApi.list()
    await roleApi.permissions()

    expect(http.get).toHaveBeenNthCalledWith(1, '/clinic/roles')
    expect(http.get).toHaveBeenNthCalledWith(2, '/clinic/roles/permissions')
  })

  it('delegates create, update, and remove requests', async () => {
    const http = makeHttp()
    const { roleApi } = await loadApi(http)
    const payload = { name: 'Front Desk', permissions: ['patients.view'] }

    await roleApi.create(payload)
    await roleApi.update('role-1', { ...payload, permissions: ['patients.view', 'queue.manage'] })
    await roleApi.remove('role-1')

    expect(http.post).toHaveBeenCalledWith('/clinic/roles', payload)
    expect(http.patch).toHaveBeenCalledWith('/clinic/roles/role-1', { name: 'Front Desk', permissions: ['patients.view', 'queue.manage'] })
    expect(http.delete).toHaveBeenCalledWith('/clinic/roles/role-1')
  })
})
