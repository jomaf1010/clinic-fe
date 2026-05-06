import { describe, expect, it } from 'vitest'
import { mountWithDeps } from '@/__tests__/helpers/mountWithDeps'
import AppointmentStatusBadge from './AppointmentStatusBadge.vue'
import type { AppointmentStatus } from '../types/appointment.types'

const STUBS = {
  Badge: { template: '<span data-testid="badge" :class="$attrs.class"><slot /></span>' },
}

describe('AppointmentStatusBadge', () => {
  it.each([
    ['scheduled', 'Scheduled'],
    ['checked_in', 'Checked In'],
    ['completed', 'Completed'],
    ['cancelled', 'Cancelled'],
    ['no_show', 'No Show'],
  ] satisfies [AppointmentStatus, string][])('renders the %s label', (status, label) => {
    const wrapper = mountWithDeps(AppointmentStatusBadge, {
      props: { status },
      global: { stubs: STUBS },
    })

    expect(wrapper.text()).toContain(label)
  })
})
