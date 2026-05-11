type RuntimeCacheMatch = {
  url: URL
  request: Request
}

type RuntimeCacheRule = {
  urlPattern: (match: RuntimeCacheMatch) => boolean
  handler: 'StaleWhileRevalidate'
  options: {
    cacheName: string
    expiration: {
      maxEntries: number
      maxAgeSeconds: number
    }
    cacheableResponse: {
      statuses: number[]
    }
  }
}

function isCatalogApiPath(pathname: string): boolean {
  return (
    pathname.startsWith('/api/icd10') ||
    pathname.startsWith('/api/system-medicines') ||
    pathname.startsWith('/api/specialties')
  )
}

export const runtimeCaching: RuntimeCacheRule[] = [
  {
    // Read-only public catalogs only. Authenticated clinic/PHI API responses
    // must not be persisted in Workbox Cache Storage.
    urlPattern: ({ url, request }) => request.method === 'GET' && isCatalogApiPath(url.pathname),
    handler: 'StaleWhileRevalidate',
    options: {
      cacheName: 'mediflow-catalogs',
      expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 },
      cacheableResponse: { statuses: [0, 200] },
    },
  },
]
