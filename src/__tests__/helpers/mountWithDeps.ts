/**
 * Component-mount helper.
 *
 * Wraps `@vue/test-utils` `mount` with the project's standard global
 * deps wired up: Pinia + a few component stubs that are noisy in tests
 * (lucide-vue-next icons render as `<svg>` text otherwise — stubbing
 * them keeps assertions tidy).
 *
 * Tests that need a different shape (router, async props, custom
 * provides) can pass `options` through — mountWithDeps merges them
 * onto the defaults rather than overriding.
 */

import { mount, type ComponentMountingOptions } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { Component } from 'vue'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyComponent = Component & { __isFragment?: boolean }

interface MountOptions<C extends AnyComponent> extends ComponentMountingOptions<C> {
  /** Skip the default Pinia setup (use the test's own active Pinia instead). */
  noPinia?: boolean
}

export function mountWithDeps<C extends AnyComponent>(
  component: C,
  options: MountOptions<C> = {},
) {
  const { noPinia, global: userGlobal, ...rest } = options

  if (!noPinia) {
    setActivePinia(createPinia())
  }

  const stubs: Record<string, Component | boolean> = {
    // Lucide icons are noisy in DOM assertions; render as `<svg-stub />`.
    // Tests that need to assert on a specific icon can set
    // `stubs: { LoaderCircle: false }` to opt out for that icon.
    LoaderCircle: true,
    Search: true,
    Stethoscope: true,
    ...(userGlobal?.stubs as Record<string, Component | boolean> | undefined),
  }

  return mount(component, {
    ...rest,
    global: {
      ...userGlobal,
      stubs,
    },
  })
}
