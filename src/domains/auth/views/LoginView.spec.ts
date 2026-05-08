import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

const push = vi.fn()
const login = vi.fn()

async function mountLoginView() {
  vi.doMock('vue-router', () => ({
    useRouter: () => ({ push }),
    RouterLink: {
      props: ['to'],
      template: '<a href="#" :data-to="JSON.stringify(to)"><slot /></a>',
    },
  }))
  vi.doMock('../stores/authStore', () => ({
    useAuthStore: () => ({ login }),
  }))
  vi.doMock('@/lib/http', () => ({ HttpError: class HttpError extends Error {} }))
  vi.doMock('@/composables/useNeuralNetwork', () => ({ useNeuralNetwork: () => ({ canvasRef: ref(null) }) }))
  vi.doMock('@/composables/useTheme', () => ({ useTheme: () => ({ isDark: false, toggleTheme: vi.fn() }) }))
  vi.doMock('../components/GoogleSignInButton.vue', () => ({ default: { template: '<button type="button">Google</button>' } }))
  vi.doMock('../components/AuthFeedbackAlert.vue', () => ({ default: { template: '<div><slot /></div>' } }))

  const { default: LoginView } = await import('./LoginView.vue')

  return mount(LoginView, {
    global: {
      stubs: {
        AppLogo: { template: '<div />' },
        Button: { template: '<button><slot /></button>' },
        Checkbox: { template: '<input type="checkbox" />' },
        RouterLink: {
          props: ['to'],
          template: '<a href="#" :data-to="JSON.stringify(to)"><slot /></a>',
        },
        Input: {
          props: ['modelValue'],
          emits: ['update:modelValue'],
          template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
        },
        PasswordInput: {
          props: ['modelValue'],
          emits: ['update:modelValue'],
          template: '<input type="password" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
        },
        Label: { template: '<label><slot /></label>' },
        Card: { template: '<div><slot /></div>' },
        CardContent: { template: '<div><slot /></div>' },
        CardDescription: { template: '<div><slot /></div>' },
        CardHeader: { template: '<div><slot /></div>' },
        CardTitle: { template: '<div><slot /></div>' },
        AlertDialog: { template: '<div><slot /></div>' },
        AlertDialogAction: { template: '<button><slot /></button>' },
        AlertDialogCancel: { template: '<button><slot /></button>' },
        AlertDialogContent: { template: '<div><slot /></div>' },
        AlertDialogDescription: { template: '<div><slot /></div>' },
        AlertDialogFooter: { template: '<div><slot /></div>' },
        AlertDialogHeader: { template: '<div><slot /></div>' },
        AlertDialogTitle: { template: '<div><slot /></div>' },
        Activity: true,
        Building2: true,
        Lock: true,
        LoaderCircle: true,
        Mail: true,
        Moon: true,
        ShieldCheck: true,
        Sun: true,
      },
    },
  })
}

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(0)
    return 1
  })
})

describe('LoginView verification UX', () => {
  it('offers a non-enumerating verification email path before login fails', async () => {
    const wrapper = await mountLoginView()

    await wrapper.find('input[type="email"]').setValue('doctor@example.test')
    await nextTick()

    const link = wrapper.findAll('a').find(anchor => anchor.text().includes('Need a verification email?'))

    expect(link).toBeTruthy()
    expect(link?.attributes('data-to')).toContain('verify-email-notice')
    expect(link?.attributes('data-to')).toContain('doctor@example.test')
  })
})
