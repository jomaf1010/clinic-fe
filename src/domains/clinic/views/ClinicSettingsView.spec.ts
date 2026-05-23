import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mountWithDeps } from '@/__tests__/helpers/mountWithDeps'

const mocks = vi.hoisted(() => ({
  features: [] as string[],
  show: vi.fn(),
  update: vi.fn(),
  fetchUser: vi.fn().mockResolvedValue(undefined),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock('vue-sonner', () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
  },
}))

vi.mock('@/domains/auth/stores/authStore', () => ({
  useAuthStore: () => ({
    hasFeature: (feature: string) => mocks.features.includes(feature),
    fetchUser: mocks.fetchUser,
  }),
}))

vi.mock('@/domains/clinic/api/clinicApi', () => ({
  clinicApi: {
    show: mocks.show,
    update: mocks.update,
  },
}))

vi.mock('@/domains/dental/components/DentalBillingTab.vue', () => ({
  default: { template: '<div data-test="dental-billing-tab" />' },
}))

const STUBS = {
  Card: { template: '<div :data-test="$attrs[\'data-test\']"><slot /></div>', inheritAttrs: false },
  CardHeader: { template: '<div><slot /></div>' },
  CardTitle: { template: '<div><slot /></div>' },
  CardDescription: { template: '<div><slot /></div>' },
  CardContent: { template: '<div><slot /></div>' },
  Input: { template: '<input />' },
  Label: { template: '<label><slot /></label>' },
  Separator: { template: '<hr />' },
  Tabs: { template: '<div><slot /></div>' },
  TabsContent: { template: '<div><slot /></div>' },
  TabsList: { template: '<div><slot /></div>' },
  TabsTrigger: { template: '<button type="button"><slot /></button>' },
  Switch: {
    props: ['modelValue', 'disabled'],
    emits: ['update:modelValue'],
    template:
      '<button type="button" role="switch" :data-test="$attrs[\'data-test\']" :aria-checked="modelValue" :disabled="disabled" @click="$emit(\'update:modelValue\', !modelValue)"></button>',
    inheritAttrs: false,
  },
  FileText: true,
  Receipt: true,
  LoaderCircle: true,
  Banknote: true,
  Stethoscope: true,
  MessageSquare: true,
}

function settingsResponse(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      id: 'clinic-1',
      settings: {
        auto_generate_prescription_pdf: true,
        prescription_quantity_mode: 'absolute',
        auto_regenerate_pdf_on_qty_change: true,
        billing_supplies_as_clinic_revenue: true,
        ...overrides,
      },
    },
  }
}

async function mountSettingsView() {
  const { default: ClinicSettingsView } = await import('./ClinicSettingsView.vue')
  const wrapper = mountWithDeps(ClinicSettingsView, { global: { stubs: STUBS } })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  mocks.features = []
  mocks.show.mockResolvedValue(settingsResponse())
  mocks.update.mockResolvedValue({ data: { id: 'clinic-1' } })
  mocks.fetchUser.mockResolvedValue(undefined)
  mocks.toastSuccess.mockClear()
  mocks.toastError.mockClear()
})

describe('ClinicSettingsView — queue SMS notifications toggle', () => {
  it('hides the toggle when the feature flag is absent (Free clinic)', async () => {
    mocks.features = []

    const wrapper = await mountSettingsView()

    expect(wrapper.find('[data-test="queue-notifications-card"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="queue-sms-toggle"]').exists()).toBe(false)
  })

  it('renders the toggle when hasFeature("queue_sms_notifications") is true', async () => {
    mocks.features = ['queue_sms_notifications']

    const wrapper = await mountSettingsView()

    expect(wrapper.find('[data-test="queue-notifications-card"]').exists()).toBe(true)
    const toggle = wrapper.find('[data-test="queue-sms-toggle"]')
    expect(toggle.exists()).toBe(true)
    expect(toggle.attributes('aria-checked')).toBe('false')
    expect(wrapper.text()).toContain('SMS rank notifications')
    expect(wrapper.text()).toContain("3rd and 2nd in line")
    expect(wrapper.text()).toContain('no clinical details')
  })

  it('hydrates the toggle from the loaded clinic settings', async () => {
    mocks.features = ['queue_sms_notifications']
    mocks.show.mockResolvedValue(settingsResponse({ queue_sms_notifications_enabled: true }))

    const wrapper = await mountSettingsView()

    const toggle = wrapper.find('[data-test="queue-sms-toggle"]')
    expect(toggle.attributes('aria-checked')).toBe('true')
  })

  it('persists the new value via clinicApi.update and refreshes the auth store', async () => {
    mocks.features = ['queue_sms_notifications']

    const wrapper = await mountSettingsView()

    await wrapper.find('[data-test="queue-sms-toggle"]').trigger('click')
    await flushPromises()

    expect(mocks.update).toHaveBeenCalledWith({
      settings: { queue_sms_notifications_enabled: true },
    })
    expect(mocks.fetchUser).toHaveBeenCalled()
    expect(mocks.toastSuccess).toHaveBeenCalled()
    expect(wrapper.find('[data-test="queue-sms-toggle"]').attributes('aria-checked')).toBe('true')
  })

  it('reverts the toggle and shows an error toast when the update fails', async () => {
    mocks.features = ['queue_sms_notifications']
    mocks.update.mockRejectedValueOnce(new Error('boom'))

    const wrapper = await mountSettingsView()

    await wrapper.find('[data-test="queue-sms-toggle"]').trigger('click')
    await flushPromises()

    expect(mocks.update).toHaveBeenCalledWith({
      settings: { queue_sms_notifications_enabled: true },
    })
    expect(mocks.toastError).toHaveBeenCalled()
    expect(mocks.fetchUser).not.toHaveBeenCalled()
    expect(wrapper.find('[data-test="queue-sms-toggle"]').attributes('aria-checked')).toBe('false')
  })

  it('keeps the toggle and reports success when the save succeeds but the auth refresh fails', async () => {
    // Transient refresh-token / network blip on fetchUser must NOT roll back
    // a real backend save or surface a save error — the value is already
    // persisted server-side.
    mocks.features = ['queue_sms_notifications']
    mocks.fetchUser.mockRejectedValueOnce(new Error('refresh failed'))

    const wrapper = await mountSettingsView()

    await wrapper.find('[data-test="queue-sms-toggle"]').trigger('click')
    await flushPromises()

    expect(mocks.update).toHaveBeenCalledWith({
      settings: { queue_sms_notifications_enabled: true },
    })
    expect(mocks.toastSuccess).toHaveBeenCalled()
    expect(mocks.toastError).not.toHaveBeenCalled()
    expect(wrapper.find('[data-test="queue-sms-toggle"]').attributes('aria-checked')).toBe('true')
  })
})
