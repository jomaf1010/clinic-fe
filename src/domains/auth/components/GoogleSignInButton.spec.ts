import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mountWithDeps } from '@/__tests__/helpers/mountWithDeps'

class ResizeObserverMock {
  observe = vi.fn()
  disconnect = vi.fn()
}

async function mountButton(props: Record<string, unknown> = {}) {
  const { default: GoogleSignInButton } = await import('./GoogleSignInButton.vue')
  const wrapper = mountWithDeps(GoogleSignInButton, { props })
  await flushPromises()
  return wrapper
}

describe('GoogleSignInButton', () => {
  let initializeSpy: ReturnType<typeof vi.fn>
  let renderButtonSpy: ReturnType<typeof vi.fn>
  let credentialCallback: ((response: GoogleCredentialResponse) => void) | undefined

  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'google-client-id')
    credentialCallback = undefined
    initializeSpy = vi.fn((options: { callback: (response: GoogleCredentialResponse) => void }) => {
      credentialCallback = options.callback
    })
    renderButtonSpy = vi.fn()

    window.google = {
      accounts: {
        id: {
          initialize: initializeSpy,
          renderButton: renderButtonSpy,
        },
      },
    }
    vi.stubGlobal('ResizeObserver', ResizeObserverMock)
  })

  it('initializes Google Identity once while allowing button re-renders', async () => {
    const wrapper = await mountButton({ shape: 'pill' })

    expect(initializeSpy).toHaveBeenCalledTimes(1)
    expect(renderButtonSpy).toHaveBeenCalledTimes(1)

    await wrapper.setProps({ text: 'signup_with' })
    await flushPromises()

    expect(initializeSpy).toHaveBeenCalledTimes(1)
    expect(renderButtonSpy).toHaveBeenCalledTimes(2)
  })

  it('keeps one Google Identity initialization across remounts and routes credentials to the active instance', async () => {
    const first = await mountButton()
    first.unmount()
    const second = await mountButton({ text: 'signup_with' })

    expect(initializeSpy).toHaveBeenCalledTimes(1)
    expect(renderButtonSpy).toHaveBeenCalledTimes(2)

    credentialCallback?.({ credential: 'jwt-from-google' })

    expect(first.emitted('credential')).toBeUndefined()
    expect(second.emitted('credential')).toEqual([['jwt-from-google']])

    const emittedBeforeUnmount = second.emitted('credential')
    second.unmount()
    credentialCallback?.({ credential: 'late-jwt-from-google' })

    expect(emittedBeforeUnmount).toEqual([['jwt-from-google']])
  })
})
