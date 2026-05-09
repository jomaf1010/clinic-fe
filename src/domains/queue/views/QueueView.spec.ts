import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountWithDeps } from '@/__tests__/helpers/mountWithDeps'
import QueueView from './QueueView.vue'

const mocks = vi.hoisted(() => ({
  fetchQueue: vi.fn().mockResolvedValue(undefined),
  stopPolling: vi.fn(),
  startPolling: vi.fn(),
  handleRealtimeEvent: vi.fn(),
  getDisplayTokenStatus: vi.fn(),
  connect: vi.fn(),
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
  isConnected: { __v_isRef: true, value: true },
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/domains/auth/stores/authStore', () => ({
  useAuthStore: () => ({
    currentClinic: { id: 'clinic-1', role: 'owner' },
    user: { id: 'user-1' },
    hasPermission: (permission: string) => permission === 'queue.manage',
  }),
}))

vi.mock('../stores/queueStore', () => ({
  useQueueStore: () => ({
    visits: [],
    fetchQueue: mocks.fetchQueue,
    stopPolling: mocks.stopPolling,
    startPolling: mocks.startPolling,
    handleRealtimeEvent: mocks.handleRealtimeEvent,
    callPatient: vi.fn(),
    completeVisit: vi.fn(),
    cancelVisit: vi.fn(),
  }),
}))

vi.mock('@/composables/useCentrifugo', () => ({
  useCentrifugo: () => ({
    isConnected: mocks.isConnected,
    connect: mocks.connect,
    subscribe: mocks.subscribe,
    unsubscribe: mocks.unsubscribe,
  }),
}))

vi.mock('../api/queueApi', () => ({
  queueApi: {
    getDisplayTokenStatus: mocks.getDisplayTokenStatus,
    generateDisplayToken: vi.fn(),
    revokeDisplayToken: vi.fn(),
  },
}))

const STUBS = {
  Badge: { template: '<span><slot /></span>' },
  Button: {
    props: ['disabled'],
    emits: ['click'],
    template: '<button type="button" :disabled="disabled" @click="$emit(`click`, $event)"><slot /></button>',
  },
  Input: { template: '<input />' },
  Popover: { template: '<div><slot /></div>' },
  PopoverTrigger: { template: '<div><slot /></div>' },
  PopoverContent: { template: '<div><slot /></div>' },
  Select: { template: '<div><slot /></div>' },
  SelectContent: { template: '<div><slot /></div>' },
  SelectItem: { template: '<div><slot /></div>' },
  SelectTrigger: { template: '<div><slot /></div>' },
  SelectValue: { template: '<span />' },
  Dialog: { template: '<div><slot /></div>' },
  DialogContent: { template: '<div><slot /></div>' },
  DialogDescription: { template: '<div><slot /></div>' },
  DialogFooter: { template: '<div><slot /></div>' },
  DialogHeader: { template: '<div><slot /></div>' },
  DialogTitle: { template: '<div><slot /></div>' },
  QueueCard: { template: '<div />' },
  QueueKanban: { template: '<div />' },
  WalkInDialog: { template: '<div />' },
}

describe('QueueView display session controls', () => {
  beforeEach(() => {
    sessionStorage.clear()
    mocks.fetchQueue.mockClear()
    mocks.stopPolling.mockClear()
    mocks.startPolling.mockClear()
    mocks.handleRealtimeEvent.mockClear()
    mocks.connect.mockClear()
    mocks.subscribe.mockClear()
    mocks.unsubscribe.mockClear()
    mocks.getDisplayTokenStatus.mockResolvedValue({
      active: true,
      token: 'queue-token-123',
      created_at: null,
      expires_at: null,
    })
    vi.spyOn(window, 'open').mockImplementation(() => null)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    sessionStorage.clear()
  })

  it('describes queue display launch as same-browser only and does not offer URL copying', async () => {
    const wrapper = mountWithDeps(QueueView, { global: { stubs: STUBS } })

    await flushPromises()

    expect(wrapper.text()).toContain('same-browser display session')
    expect(wrapper.text()).toContain('Display session is ready')
    expect(wrapper.text()).toContain('Open the display from this browser')
    expect(wrapper.text()).toContain('never shown or copied')
    expect(wrapper.text()).toContain('Open Display')
    expect(wrapper.text()).not.toContain('Copy App URL')
    expect(wrapper.text()).not.toContain('https://app.mediflow.ph/queue-display')
  })

  it('opens display by storing the token in sessionStorage without copying it into the URL', async () => {
    const wrapper = mountWithDeps(QueueView, { global: { stubs: STUBS } })

    await flushPromises()
    await wrapper.findAll('button').find((button) => button.text().includes('Open Display'))?.trigger('click')

    expect(sessionStorage.getItem('mediflow.queueDisplay.token')).toBe('queue-token-123')
    expect(window.open).toHaveBeenCalledWith('http://localhost:3000/queue-display', '_blank')
    expect(window.open).not.toHaveBeenCalledWith(expect.stringContaining('queue-token-123'), expect.anything())
  })
})
