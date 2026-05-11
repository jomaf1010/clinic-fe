/**
 * Tests for `useFormDraft`.
 *
 * The composable is a tiny localStorage cache for in-progress vee-validate
 * forms. It debounces saves (500ms) so we drive that through fake timers,
 * and we restore by mounting a Vue test component so onMounted actually
 * runs. happy-dom's localStorage is real; we assert via `localStorage.getItem`.
 */

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { defineComponent, h, nextTick, ref, type Ref } from 'vue'
import { mount } from '@vue/test-utils'
import { useFormDraft } from './useFormDraft'

interface FieldRef {
  value: unknown
}

function makeField<T>(initial: T): FieldRef & { value: T } {
  // vee-validate's useField returns an object with a writable `.value`.
  // A plain reactive ref would also work but the contract is `{ value }`.
  const r = ref(initial) as unknown as Ref<T> & { value: T }
  return r
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

function mountWithDraft(setup: () => unknown) {
  const Component = defineComponent({ setup, render: () => h('div') })
  return mount(Component)
}

describe('useFormDraft', () => {
  it('writes a debounced draft to localStorage when fields change', async () => {
    const email = makeField('')
    const name = makeField('')

    mountWithDraft(() => {
      useFormDraft('signup', { email, name })
    })

    email.value = 'user@example.com'
    name.value = 'Jane'

    // Before the debounce timer fires, nothing is written.
    expect(localStorage.getItem('signup')).toBeNull()

    await vi.advanceTimersByTimeAsync(500)

    const stored = JSON.parse(localStorage.getItem('signup') ?? '{}') as Record<string, unknown>
    expect(stored.email).toBe('user@example.com')
    expect(stored.name).toBe('Jane')
  })

  it('restores existing draft into the fields on mount', () => {
    localStorage.setItem('signup', JSON.stringify({ email: 'restored@x.com' }))

    const email = makeField('')
    const name = makeField('initial')

    mountWithDraft(() => {
      useFormDraft('signup', { email, name })
    })

    expect(email.value).toBe('restored@x.com')
    // Name is not in the saved draft → initial value preserved
    expect(name.value).toBe('initial')
  })

  it('ignores corrupted JSON in localStorage', () => {
    localStorage.setItem('signup', '{not valid')
    const email = makeField('initial')

    expect(() =>
      mountWithDraft(() => {
        useFormDraft('signup', { email })
      }),
    ).not.toThrow()
    expect(email.value).toBe('initial')
  })

  it('clearDraft removes the localStorage entry', async () => {
    const email = makeField('user@example.com')

    let returned!: { clearDraft: () => void }
    mountWithDraft(() => {
      returned = useFormDraft('signup', { email })
      return {}
    })

    email.value = 'changed@example.com'
    await vi.advanceTimersByTimeAsync(500)
    expect(localStorage.getItem('signup')).not.toBeNull()

    returned.clearDraft()
    expect(localStorage.getItem('signup')).toBeNull()
  })

  it('persists extraRefs alongside fieldRefs', async () => {
    const email = makeField('')
    const tags = ref<string[]>([])

    mountWithDraft(() => {
      useFormDraft('signup', { email }, { tags })
    })

    email.value = 'a@b.co'
    tags.value = ['vip']
    await vi.advanceTimersByTimeAsync(500)

    const stored = JSON.parse(localStorage.getItem('signup') ?? '{}') as Record<string, unknown>
    expect(stored.email).toBe('a@b.co')
    expect(stored.tags).toEqual(['vip'])
  })

  it('can use sessionStorage for PHI-sensitive drafts', async () => {
    const email = makeField('')

    mountWithDraft(() => {
      useFormDraft('create-patient:user:clinic', { email }, undefined, { storage: sessionStorage })
    })

    email.value = 'patient@example.com'
    await vi.advanceTimersByTimeAsync(500)

    expect(sessionStorage.getItem('create-patient:user:clinic')).toContain('patient@example.com')
    expect(localStorage.getItem('create-patient:user:clinic')).toBeNull()
  })

  it('disables draft persistence while the reactive key is null', async () => {
    const email = makeField('')
    const draftKey = ref<string | null>(null)

    mountWithDraft(() => {
      useFormDraft(draftKey, { email }, undefined, { storage: sessionStorage })
    })

    email.value = 'patient@example.com'
    await vi.advanceTimersByTimeAsync(500)

    expect(sessionStorage.length).toBe(0)
  })

  it('loads the active scoped draft and resets stale values when the key changes', async () => {
    sessionStorage.setItem('create-patient:user-a:clinic-a', JSON.stringify({ email: 'a@example.com' }))
    const email = makeField('')
    const draftKey = ref<string | null>('create-patient:user-a:clinic-a')

    mountWithDraft(() => {
      useFormDraft(draftKey, { email }, undefined, { storage: sessionStorage })
    })

    expect(email.value).toBe('a@example.com')

    draftKey.value = 'create-patient:user-b:clinic-b'
    await nextTick()

    expect(email.value).toBe('')
    expect(sessionStorage.getItem('create-patient:user-b:clinic-b')).toBeNull()
  })

  it.skip('debounces multiple rapid changes into a single write', async () => {
    const email = makeField('')

    mountWithDraft(() => {
      useFormDraft('signup', { email })
    })

    // Spy on setItem AFTER the load-on-mount path completed
    const spy = vi.spyOn(Storage.prototype, 'setItem')

    email.value = 'a'
    await vi.advanceTimersByTimeAsync(100)
    email.value = 'ab'
    await vi.advanceTimersByTimeAsync(100)
    email.value = 'abc'

    // Still inside debounce window — no write has happened.
    expect(spy).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(500)
    // One coalesced write
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('skips null fields in the saved draft when restoring', () => {
    localStorage.setItem('signup', JSON.stringify({ email: null, name: 'Jane' }))
    const email = makeField('initial')
    const name = makeField('initial')

    mountWithDraft(() => {
      useFormDraft('signup', { email, name })
    })

    // null in stored draft is skipped (preserves initial)
    expect(email.value).toBe('initial')
    expect(name.value).toBe('Jane')
  })
})
