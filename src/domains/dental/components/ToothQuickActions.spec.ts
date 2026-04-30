/**
 * Tests for ToothQuickActions.
 *
 * The component teleports a floating panel anchored to a tooth-cell DOM
 * node. The full behaviour involves scroll listeners, BoundingClientRect
 * math, and three modes (caries / perio / note). To keep the spec focused
 * we cover the highest-value contracts:
 *
 *   - The panel only renders when both `fdi` and `anchor` are set.
 *   - Caries-surface clicks emit `apply` with a per-surface delta.
 *   - Toggling missing emits `apply` with the right shape.
 *   - The close × emits `close`.
 *
 * We avoid the Perio/Note modes here — they are bigger surfaces and need
 * their own focused specs once the component is split (see
 * dental-playground-gaps memory).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mountWithDeps } from '@/__tests__/helpers/mountWithDeps'
import ToothQuickActions from './ToothQuickActions.vue'

// useToothNumbering reads from the auth store; we stub the composable to
// avoid threading clinic + user state for tests that don't care about the
// formatted label.
vi.mock('../composables/useToothNumbering', () => ({
  useToothNumbering: () => ({ format: (fdi: number) => `#${fdi}` }),
}))
vi.mock('../composables/useToothSvg', () => ({
  isAnteriorFdi: (fdi: number) => fdi % 10 <= 3,
}))

let anchorEl: HTMLElement | null = null

beforeEach(() => {
  anchorEl = document.createElement('div')
  // Fake bounding rect so `reanchor()` sees a positioned cell.
  Object.defineProperty(anchorEl, 'getBoundingClientRect', {
    value: () => ({ top: 100, bottom: 140, left: 100, right: 140, width: 40, height: 40, x: 100, y: 100, toJSON: () => '' }),
  })
  document.body.appendChild(anchorEl)
})

afterEach(() => {
  if (anchorEl) anchorEl.remove()
  anchorEl = null
})

function mount(props: Partial<{
  fdi: number | null
  state: Record<string, unknown> | null
  anchor: HTMLElement | null
  disabled: boolean
}> = {}) {
  return mountWithDeps(ToothQuickActions, {
    attachTo: document.body,
    props: {
      fdi: 11,
      anchor: anchorEl,
      ...props,
    },
  })
}

describe('ToothQuickActions — render gating', () => {
  it('renders nothing when fdi is null', () => {
    const wrapper = mount({ fdi: null })
    // Teleport target = body; the panel should not appear there either.
    expect(document.body.querySelector('.quick-panel')).toBeNull()
    wrapper.unmount()
  })

  it('renders nothing when anchor is null', () => {
    const wrapper = mount({ anchor: null })
    expect(document.body.querySelector('.quick-panel')).toBeNull()
    wrapper.unmount()
  })

  it('renders the floating panel when fdi and anchor are provided', () => {
    const wrapper = mount({ fdi: 11 })
    const panel = document.body.querySelector('.quick-panel')
    expect(panel).not.toBeNull()
    wrapper.unmount()
  })
})

describe('ToothQuickActions — emits', () => {
  it('emits close when the × button is clicked', async () => {
    const wrapper = mount({ fdi: 11 })
    const closeBtn = document.body.querySelector<HTMLButtonElement>('.quick-close')
    expect(closeBtn).not.toBeNull()
    closeBtn!.click()
    expect(wrapper.emitted('close')).toHaveLength(1)
    wrapper.unmount()
  })

  it('emits apply with caries delta when a surface wedge is clicked', async () => {
    const wrapper = mount({ fdi: 11 })
    const wedges = document.body.querySelectorAll<SVGElement>('.wheel-slot')
    expect(wedges.length).toBeGreaterThan(0)
    wedges[0]!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    const applies = wrapper.emitted('apply')
    expect(applies).toBeTruthy()
    const last = (applies?.at(-1)?.[0] ?? {}) as { caries?: Record<string, unknown> }
    expect(last.caries).toBeDefined()
    // Each emit targets one surface key — assert the shape, not the specific
    // surface (depends on quadrant orientation logic).
    const surfaceKeys = Object.keys(last.caries ?? {})
    expect(surfaceKeys).toHaveLength(1)
    wrapper.unmount()
  })

  it('emits apply with missing toggle when Missing button is clicked', async () => {
    const wrapper = mount({ fdi: 11 })
    const buttons = document.body.querySelectorAll<HTMLButtonElement>('.context-item')
    // The Missing button has aria-label="Missing".
    const missingBtn = Array.from(buttons).find((b) => b.getAttribute('aria-label') === 'Missing')
    expect(missingBtn).toBeDefined()
    missingBtn!.click()
    const applies = wrapper.emitted('apply')
    expect(applies).toBeTruthy()
    const last = (applies?.at(-1)?.[0] ?? {}) as { missing?: unknown }
    // Toggling on (state.missing currently undefined) should emit a new
    // missing payload, not a __remove sentinel.
    expect(last.missing).toBeDefined()
    expect(last.missing).not.toMatchObject({ __remove: true })
    wrapper.unmount()
  })

  it('does not emit when disabled and a wedge is clicked', async () => {
    const wrapper = mount({ fdi: 11, disabled: true })
    const wedges = document.body.querySelectorAll<SVGElement>('.wheel-slot')
    wedges[0]!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(wrapper.emitted('apply')).toBeUndefined()
    wrapper.unmount()
  })
})
