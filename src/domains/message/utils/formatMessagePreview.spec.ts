/**
 * Tests for `formatMessagePreview`.
 *
 * Strips `[@patient:UUID:Name]` mention markers down to the bare patient
 * name. Used in inbox previews and notification toasts. Bug here means
 * the raw marker leaks into the UI — visible regression.
 */

import { describe, expect, it } from 'vitest'
import { formatMessagePreview } from './formatMessagePreview'

describe('formatMessagePreview', () => {
  it('returns plain text untouched', () => {
    expect(formatMessagePreview('Hello, doctor.')).toBe('Hello, doctor.')
  })

  it('replaces a single mention marker with the name', () => {
    expect(
      formatMessagePreview('Reminder for [@patient:abc-123:Jane Cruz] tomorrow.'),
    ).toBe('Reminder for Jane Cruz tomorrow.')
  })

  it('replaces multiple mention markers in one body', () => {
    const body = '[@patient:1:Alice] and [@patient:2:Bob] arrived'
    expect(formatMessagePreview(body)).toBe('Alice and Bob arrived')
  })

  it('handles names with spaces and punctuation', () => {
    expect(
      formatMessagePreview('Ping [@patient:uid:Maria de la Cruz, Jr.] please'),
    ).toBe('Ping Maria de la Cruz, Jr. please')
  })

  it('returns empty string unchanged', () => {
    expect(formatMessagePreview('')).toBe('')
  })

  it('leaves a malformed marker (missing closing bracket) alone', () => {
    expect(formatMessagePreview('[@patient:1:Jane')).toBe('[@patient:1:Jane')
  })
})
