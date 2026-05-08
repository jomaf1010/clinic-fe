import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

const resendVerification = vi.fn()
const routeQuery = vi.hoisted(() => ({ value: {} as Record<string, string> }))

async function mountVerifyEmailNoticeView() {
  vi.doMock('vue-router', () => ({
    useRoute: () => ({ query: routeQuery.value }),
    RouterLink: {
      props: ['to'],
      template: '<a href="#" :data-to="JSON.stringify(to)"><slot /></a>',
    },
  }))
  vi.doMock('@/composables/useNeuralNetwork', () => ({ useNeuralNetwork: () => ({ canvasRef: ref(null) }) }))
  vi.doMock('../api/authApi', () => ({
    authApi: { resendVerification },
  }))

  const { default: VerifyEmailNoticeView } = await import('./VerifyEmailNoticeView.vue')

  return mount(VerifyEmailNoticeView, {
    global: {
      stubs: {
        AppLogo: { template: '<div />' },
        Button: { template: '<button><slot /></button>' },
        Card: { template: '<div><slot /></div>' },
        CardContent: { template: '<div><slot /></div>' },
        CardDescription: { template: '<div><slot /></div>' },
        CardHeader: { template: '<div><slot /></div>' },
        CardTitle: { template: '<div><slot /></div>' },
        ArrowLeft: true,
        LoaderCircle: true,
        MailCheck: true,
        RefreshCw: true,
        RouterLink: {
          props: ['to'],
          template: '<a href="#" :data-to="JSON.stringify(to)"><slot /></a>',
        },
      },
    },
  })
}

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  routeQuery.value = {}
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(0)
    return 1
  })
})

describe('VerifyEmailNoticeView', () => {
  it('collects an email before resending when none is provided in the URL', async () => {
    resendVerification.mockResolvedValue({ message: 'If the email exists, we sent a verification link.' })

    const wrapper = await mountVerifyEmailNoticeView()

    expect(wrapper.text()).toContain('Enter your email address')
    expect(wrapper.text()).not.toContain("We've sent a verification link to")

    await wrapper.find('input[type="email"]').setValue('doctor@example.test')
    await wrapper.find('button').trigger('click')
    await flushPromises()
    await nextTick()

    expect(resendVerification).toHaveBeenCalledWith({ email: 'doctor@example.test' })
    expect(wrapper.text()).toContain('If the email exists, we sent a verification link.')
  })

  it('shows validation feedback instead of silently doing nothing when email is blank', async () => {
    const wrapper = await mountVerifyEmailNoticeView()

    await wrapper.find('button').trigger('click')
    await nextTick()

    expect(resendVerification).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Enter your email address to resend verification.')
  })
})
