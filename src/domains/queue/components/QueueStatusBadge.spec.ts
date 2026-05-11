import { describe, expect, it } from 'vitest'
import { mountWithDeps } from '@/__tests__/helpers/mountWithDeps'
import QueueStatusBadge from './QueueStatusBadge.vue'
import type { QueueVisitStatus } from '../types/queue.types'

const STUBS = {
  Badge: {
    template: '<span v-bind="$attrs"><slot /></span>',
  },
}

function mountBadge(status: QueueVisitStatus) {
  return mountWithDeps(QueueStatusBadge, {
    props: { status },
    global: { stubs: STUBS },
  })
}

describe('QueueStatusBadge', () => {
  it.each([
    ['waiting', 'Waiting', 'amber'],
    ['in_progress', 'In Progress', 'blue'],
    ['completed', 'Completed', 'green'],
    ['cancelled', 'Cancelled', 'gray'],
  ] as const)('renders %s status styling', (status, label, colorClass) => {
    const wrapper = mountBadge(status)

    expect(wrapper.text()).toBe(label)
    expect(wrapper.find('span').attributes('class')).toContain(colorClass)
  })

  it('falls back to the raw status for unknown values', () => {
    const wrapper = mountBadge('deferred' as QueueVisitStatus)

    expect(wrapper.text()).toBe('deferred')
    expect(wrapper.find('span').attributes('class') ?? '').toBe('')
  })
})
