import { test as base, expect } from '@playwright/test'

const EMAIL = process.env.E2E_EMAIL
const PASSWORD = process.env.E2E_PASSWORD
const HAS_E2E_CREDENTIALS = Boolean(EMAIL && PASSWORD)

// Custom fixture that provides a pre-authenticated page
// Login happens once per worker, shared across all tests
export const test = base.extend<{}, { authenticatedContext: import('@playwright/test').BrowserContext }>({
  authenticatedContext: [async ({ browser }, use) => {
    const context = await browser.newContext()
    const page = await context.newPage()

    await page.goto('/login')
    await page.getByRole('textbox', { name: 'Email' }).fill(EMAIL)
    await page.locator('input[type="password"]').fill(PASSWORD)
    await page.getByRole('checkbox', { name: 'Remember me' }).check()
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()

    // Wait for app to be ready
    await expect(page.getByRole('link', { name: /patient/i }).first()).toBeVisible({ timeout: 15000 })

    await page.close()
    await use(context)
    await context.close()
  }, { scope: 'worker' }],

  // Override the default `page` to use our authenticated context
  page: async ({ authenticatedContext }, use) => {
    const page = await authenticatedContext.newPage()
    await use(page)
    await page.close()
  },
})

test.beforeEach(({}, testInfo) => {
  testInfo.skip(!HAS_E2E_CREDENTIALS, 'Set E2E_EMAIL and E2E_PASSWORD to run authenticated staging tests.')
})

export { expect }
