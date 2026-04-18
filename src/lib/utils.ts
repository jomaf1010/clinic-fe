import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { http } from '@/lib/http'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a Date as `YYYY-MM-DD` in the user's local timezone — the canonical
 * shape the backend accepts on every `date_format:Y-m-d` validated field.
 *
 * Prefer this over `date.toISOString().slice(0, 10)`, which silently truncates
 * full ISO-8601 strings and reads as a timezone bug every time we revisit it.
 */
export function toYmd(date: Date): string {
  const y = String(date.getFullYear()).padStart(4, '0')
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Today as `YYYY-MM-DD`. */
export function todayYmd(): string {
  return toYmd(new Date())
}

export function formatRelativeTime(dateString: string): string {
  const now = Date.now()
  const date = new Date(dateString).getTime()
  const seconds = Math.floor((now - date) / 1000)

  if (seconds < 60) return 'Just now'

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`

  return new Date(dateString).toLocaleDateString()
}

export function timeAgo(dateString: string): string {
  const now = new Date()
  const date = new Date(dateString)
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (seconds < 60) return 'Just now'

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`

  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} day${days > 1 ? 's' : ''} ago`

  const months = Math.floor(days / 30)
  const remainingDays = days % 30
  const years = Math.floor(months / 12)
  const remainingMonths = months % 12

  if (years > 0) {
    if (remainingMonths > 0)
      return `${years} year${years > 1 ? 's' : ''} and ${remainingMonths} month${remainingMonths > 1 ? 's' : ''} ago`
    return `${years} year${years > 1 ? 's' : ''} ago`
  }

  if (remainingDays > 0)
    return `${months} month${months > 1 ? 's' : ''} and ${remainingDays} day${remainingDays > 1 ? 's' : ''} ago`
  return `${months} month${months > 1 ? 's' : ''} ago`
}

/**
 * Open a URL in a new tab, safe for mobile browsers.
 * Must be called synchronously from a user gesture — open the blank tab first,
 * then set the location after any async work (e.g. fetching a signed URL).
 */
export function openNewTab(): { navigate: (url: string) => void; close: () => void } {
  const win = window.open('', '_blank')
  return {
    navigate: (url: string) => {
      if (win && !win.closed) {
        win.location.href = url
      } else {
        // Fallback: popup was blocked, try direct navigation
        window.location.href = url
      }
    },
    close: () => {
      if (win && !win.closed) win.close()
    },
  }
}

export function printPdf(url: string): void {
  // In dev, backend asset() returns localhost but app runs on clinic.test
  // Only normalize when hosts share the same port (dev mismatch), not cross-subdomain (staging/prod)
  try {
    const parsed = new URL(url)
    const isSameHost = parsed.hostname === window.location.hostname
    const isDevMismatch = !isSameHost
      && parsed.port === window.location.port
      && (parsed.hostname === 'localhost' || window.location.hostname === 'localhost')
    if (isDevMismatch) {
      url = `${window.location.origin}${parsed.pathname}${parsed.search}`
    }
  } catch {
    // relative URL, keep as-is
  }

  http.download(url)
    .then((blob) => {
      const blobUrl = URL.createObjectURL(blob)
      const iframe = document.createElement('iframe')
      iframe.style.position = 'fixed'
      iframe.style.right = '0'
      iframe.style.bottom = '0'
      iframe.style.width = '0'
      iframe.style.height = '0'
      iframe.style.border = 'none'
      iframe.src = blobUrl
      document.body.appendChild(iframe)
      iframe.onload = () => {
        try {
          iframe.contentWindow?.focus()
          iframe.contentWindow?.print()
        } catch {
          window.open(url, '_blank')
        }
        setTimeout(() => {
          document.body.removeChild(iframe)
          URL.revokeObjectURL(blobUrl)
        }, 60000)
      }
    })
    .catch(() => {
      window.open(url, '_blank')
    })
}
