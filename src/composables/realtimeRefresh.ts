export function createDebouncedRefresh(refresh: () => void, delayMs: number): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null

  return () => {
    if (timer !== null) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      refresh()
    }, delayMs)
  }
}

export function shouldRunFallbackRefresh(isRealtimeConnected: boolean): boolean {
  return !isRealtimeConnected
}
