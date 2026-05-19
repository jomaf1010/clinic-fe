import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mountWithDeps } from '@/__tests__/helpers/mountWithDeps'

let resizeCallback: ResizeObserverCallback | undefined

class ResizeObserverMock {
  constructor(cb: ResizeObserverCallback) {
    resizeCallback = cb
  }
  observe = vi.fn()
  disconnect = vi.fn()
}

async function mountButton(props: Record<string, unknown> = {}) {
  const { default: GoogleSignInButton } = await import('./GoogleSignInButton.vue')
  const wrapper = mountWithDeps(GoogleSignInButton, { props, attachTo: document.body })
  await flushPromises()
  return wrapper
}

function setContainerWidth(wrapper: { element: Element }, width: number) {
  Object.defineProperty(wrapper.element, 'clientWidth', {
    configurable: true,
    value: width,
  })
}

async function fireResize() {
  resizeCallback?.([], {} as ResizeObserver)
  await flushPromises()
}

describe('GoogleSignInButton', () => {
  let initializeSpy: ReturnType<typeof vi.fn>
  let renderButtonSpy: ReturnType<typeof vi.fn>
  let credentialCallback: ((response: GoogleCredentialResponse) => void) | undefined

  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'google-client-id')
    credentialCallback = undefined
    resizeCallback = undefined
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

  afterEach(() => {
    document.body.innerHTML = ''
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

  it('does not re-render when ResizeObserver fires with the same container width', async () => {
    await mountButton()

    expect(renderButtonSpy).toHaveBeenCalledTimes(1)

    // Simulate child-size wobble: GSI iframe replacement nudges the observer
    // but the container width has not actually changed.
    await fireResize()
    await fireResize()
    await fireResize()

    expect(renderButtonSpy).toHaveBeenCalledTimes(1)
  })

  it('re-renders when ResizeObserver fires after a real container width change', async () => {
    const wrapper = await mountButton()

    expect(renderButtonSpy).toHaveBeenCalledTimes(1)

    setContainerWidth(wrapper, 480)
    await fireResize()

    expect(renderButtonSpy).toHaveBeenCalledTimes(2)

    // A second resize at the new width is again a wobble — no re-render.
    await fireResize()

    expect(renderButtonSpy).toHaveBeenCalledTimes(2)

    setContainerWidth(wrapper, 360)
    await fireResize()

    expect(renderButtonSpy).toHaveBeenCalledTimes(3)
  })
})
