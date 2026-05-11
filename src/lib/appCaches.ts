export const APP_CACHE_NAMES = [
  'mediflow-catalogs',
  // Legacy broad API cache. Keep deleting it so upgraded clients purge PHI
  // that may have been stored by older service workers.
  'mediflow-api',
] as const

export async function clearAppCaches(): Promise<void> {
  if (!('caches' in globalThis) || !globalThis.caches) return

  await Promise.all(APP_CACHE_NAMES.map((cacheName) => globalThis.caches.delete(cacheName)))
}
