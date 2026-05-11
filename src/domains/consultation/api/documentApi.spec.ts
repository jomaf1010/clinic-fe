import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface MockHttp {
  get: ReturnType<typeof vi.fn>
  post: ReturnType<typeof vi.fn>
}

function makeHttp(): MockHttp {
  return {
    get: vi.fn().mockResolvedValue({ data: { url: 'https://signed.example.test/document.pdf' } }),
    post: vi.fn().mockResolvedValue({ data: { id: 'document-1' } }),
  }
}

async function loadApi(http: MockHttp) {
  vi.doMock('@/lib/http', () => ({ http }))
  return await import('./documentApi')
}

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.doUnmock('@/lib/http')
})

describe('documentApi', () => {
  it('generates documents with and without metadata', async () => {
    const http = makeHttp()
    const { documentApi } = await loadApi(http)

    await documentApi.generate('encounter-1', 'prescription')
    await documentApi.generate('encounter-1', 'lab-request', { copy: 'patient' })

    expect(http.post).toHaveBeenNthCalledWith(1, '/encounters/encounter-1/documents', { type: 'prescription' })
    expect(http.post).toHaveBeenNthCalledWith(2, '/encounters/encounter-1/documents', { type: 'lab-request', meta: { copy: 'patient' } })
  })

  it('lists generated encounter documents', async () => {
    const http = makeHttp()
    const { documentApi } = await loadApi(http)

    await documentApi.list('encounter-1')

    expect(http.get).toHaveBeenCalledWith('/encounters/encounter-1/documents')
  })

  it('unwraps signed document URLs', async () => {
    const http = makeHttp()
    const { documentApi } = await loadApi(http)

    await expect(documentApi.getSignedUrl('document-1')).resolves.toBe('https://signed.example.test/document.pdf')

    expect(http.get).toHaveBeenCalledWith('/documents/document-1/signed-url')
  })
})
