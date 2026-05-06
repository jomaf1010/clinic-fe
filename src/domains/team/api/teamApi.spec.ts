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
    post: vi.fn().mockResolvedValue({ data: { id: 'member-1' } }),
    patch: vi.fn().mockResolvedValue({ data: { id: 'member-1' } }),
    delete: vi.fn().mockResolvedValue(undefined),
  }
}

async function loadApi(http: MockHttp) {
  vi.doMock('@/lib/http', () => ({ http }))
  return await import('./teamApi')
}

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.doUnmock('@/lib/http')
})

describe('teamApi', () => {
  it('builds list query params for status and role filters', async () => {
    const http = makeHttp()
    const { teamApi } = await loadApi(http)

    await teamApi.list({ status: 'pending', role: 'staff nurse' })
    await teamApi.list()

    expect(http.get).toHaveBeenNthCalledWith(1, '/clinic/members?status=pending&role=staff+nurse')
    expect(http.get).toHaveBeenNthCalledWith(2, '/clinic/members')
  })

  it('delegates invitation and resend requests', async () => {
    const http = makeHttp()
    const { teamApi } = await loadApi(http)
    const invite = { email: 'staff@example.test', role: 'staff' }

    await teamApi.invite(invite)
    await teamApi.resendInvite('member-1')

    expect(http.post).toHaveBeenNthCalledWith(1, '/clinic/members/invite', invite)
    expect(http.post).toHaveBeenNthCalledWith(2, '/clinic/members/member-1/resend-invite')
  })

  it('delegates role and membership state changes', async () => {
    const http = makeHttp()
    const { teamApi } = await loadApi(http)

    await teamApi.changeRole('member-1', { role: 'doctor' })
    await teamApi.disable('member-1')
    await teamApi.enable('member-1')
    await teamApi.remove('member-1')

    expect(http.patch).toHaveBeenNthCalledWith(1, '/clinic/members/member-1/role', { role: 'doctor' })
    expect(http.patch).toHaveBeenNthCalledWith(2, '/clinic/members/member-1/disable')
    expect(http.patch).toHaveBeenNthCalledWith(3, '/clinic/members/member-1/enable')
    expect(http.delete).toHaveBeenCalledWith('/clinic/members/member-1')
  })
})
