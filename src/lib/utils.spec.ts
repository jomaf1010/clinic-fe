/**
 * Tests for `lib/utils.ts`.
 *
 * Why these tests exist:
 *   - `toYmd`/`todayYmd` are the canonical pre-API date formatters. Every
 *     `Y-m-d`-validated request leans on them; a timezone bug here turns
 *     into "wrong date saved" silently. The padding logic in particular
 *     (years < 1000, single-digit months/days) is easy to regress.
 *   - `formatRelativeTime` and `timeAgo` are subtly different — one is
 *     compact, one is verbose. We lock both in here so a future "let's
 *     consolidate" refactor doesn't silently change UI copy in one of
 *     them.
 *   - `cn` is the ubiquitous tailwind-merge wrapper. We sanity-check
 *     dedup/override behaviour so a bad clsx upgrade is caught.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { cn, toYmd, todayYmd, formatRelativeTime, timeAgo, openNewTab } from './utils'

const downloadMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/http', () => ({
  http: {
    download: downloadMock,
  },
}))

describe('cn', () => {
  it('merges plain classes', () => {
    expect(cn('a', 'b')).toBe('a b')
  })

  it('drops falsy values', () => {
    expect(cn('a', false, null, undefined, '')).toBe('a')
  })

  it('respects tailwind-merge override semantics', () => {
    // tailwind-merge keeps the latest conflicting class
    expect(cn('p-2', 'p-4')).toBe('p-4')
  })

  it('flattens arrays/objects per clsx contract', () => {
    expect(cn(['a', 'b'], { c: true, d: false })).toBe('a b c')
  })
})

describe('toYmd', () => {
  it('formats a regular date', () => {
    expect(toYmd(new Date(2026, 0, 15))).toBe('2026-01-15')
  })

  it('zero-pads single-digit month and day', () => {
    expect(toYmd(new Date(2026, 4, 7))).toBe('2026-05-07')
  })

  it('handles Dec 31 (boundary)', () => {
    expect(toYmd(new Date(2026, 11, 31))).toBe('2026-12-31')
  })

  it('handles a leap-year Feb 29 correctly', () => {
    expect(toYmd(new Date(2024, 1, 29))).toBe('2024-02-29')
  })

  it('uses local timezone, not UTC (regression guard for old toISOString().slice bug)', () => {
    // Regardless of TZ, getDate/getMonth/getFullYear are local — we just
    // verify the helper returns the LOCAL parts, not UTC. Picking
    // midnight local + asserting the year/month/day match the input
    // does this without coupling the test to the host machine's TZ.
    const d = new Date(2025, 5, 10, 0, 0, 0)
    const ymd = toYmd(d)
    expect(ymd.startsWith('2025-')).toBe(true)
    expect(ymd).toBe(`2025-06-10`)
  })

  it('pads years < 1000 to 4 digits', () => {
    const d = new Date(0, 0, 1)
    d.setFullYear(42)
    expect(toYmd(d)).toBe('0042-01-01')
  })
})

describe('todayYmd', () => {
  it('returns todays date as YYYY-MM-DD', () => {
    const result = todayYmd()
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    // Sanity: matches `toYmd(new Date())` at least to the day. We can't
    // assert exact equality (the second-boundary may have crossed), but
    // both calls happen on the same day.
    expect(result).toBe(toYmd(new Date()))
  })
})

describe('formatRelativeTime', () => {
  beforeEach(() => {
    // Pin "now" to a deterministic instant so the seconds/minutes/hours
    // arithmetic is testable.
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-29T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns "Just now" for < 60s', () => {
    expect(formatRelativeTime('2026-04-29T11:59:30Z')).toBe('Just now')
  })

  it('returns minutes for under an hour', () => {
    expect(formatRelativeTime('2026-04-29T11:55:00Z')).toBe('5m ago')
  })

  it('returns hours for under a day', () => {
    expect(formatRelativeTime('2026-04-29T09:00:00Z')).toBe('3h ago')
  })

  it('returns days for under a week', () => {
    expect(formatRelativeTime('2026-04-26T12:00:00Z')).toBe('3d ago')
  })

  it('falls back to a locale date string for >= 7 days', () => {
    const result = formatRelativeTime('2026-04-15T12:00:00Z')
    // We don't assert the exact format (locale-sensitive), only that
    // it's not the relative form.
    expect(result).not.toMatch(/(Just now|m ago|h ago|d ago)/)
    expect(result.length).toBeGreaterThan(0)
  })
})

describe('timeAgo', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-29T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('uses singular forms for 1 unit', () => {
    expect(timeAgo('2026-04-29T11:59:00Z')).toBe('1 minute ago')
    expect(timeAgo('2026-04-29T11:00:00Z')).toBe('1 hour ago')
    expect(timeAgo('2026-04-28T12:00:00Z')).toBe('1 day ago')
  })

  it('pluralises units > 1', () => {
    expect(timeAgo('2026-04-29T11:55:00Z')).toBe('5 minutes ago')
    expect(timeAgo('2026-04-29T09:00:00Z')).toBe('3 hours ago')
    expect(timeAgo('2026-04-26T12:00:00Z')).toBe('3 days ago')
  })

  it('returns months and remaining days', () => {
    // 70 days ago → 2 months and 10 days
    expect(timeAgo('2026-02-18T12:00:00Z')).toBe('2 months and 10 days ago')
  })

  it('returns months alone when the day-remainder is 0', () => {
    // exactly 60 days ago
    expect(timeAgo('2026-02-28T12:00:00Z')).toBe('2 months ago')
  })

  it('returns years and remaining months', () => {
    // ~13 months in days = 390 → 1 year and 1 month
    expect(timeAgo('2025-03-30T12:00:00Z')).toBe('1 year and 1 month ago')
  })

  it('returns years alone when the month-remainder is 0', () => {
    // ~24 months → 2 years
    expect(timeAgo('2024-04-30T12:00:00Z')).toBe('2 years ago')
  })

  it('returns "Just now" for < 60s', () => {
    expect(timeAgo('2026-04-29T11:59:30Z')).toBe('Just now')
  })
})

describe('openNewTab', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    downloadMock.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('downloads signed URLs and navigates only to a blob URL', async () => {
    const blob = new Blob(['pdf'], { type: 'application/pdf' })
    const openedWindow = { closed: false, location: { href: '' }, close: vi.fn() }
    downloadMock.mockResolvedValue(blob)
    vi.spyOn(window, 'open').mockReturnValue(openedWindow as unknown as Window)
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:document-1')
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    const tab = openNewTab()
    await tab.navigate('https://signed.example.test/private.pdf?token=secret')

    expect(downloadMock).toHaveBeenCalledWith('https://signed.example.test/private.pdf?token=secret')
    expect(openedWindow.location.href).toBe('blob:document-1')
    expect(openedWindow.location.href).not.toContain('signed.example.test')
    expect(createObjectURL).toHaveBeenCalledWith(blob)

    await vi.advanceTimersByTimeAsync(60000)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:document-1')
  })
})
