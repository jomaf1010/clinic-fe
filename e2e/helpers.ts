import { type Page, expect } from '@playwright/test'

const EMAIL = process.env.E2E_EMAIL || 'demo@mail.com'
const PASSWORD = process.env.E2E_PASSWORD || 'password'

/**
 * Login and navigate to the dashboard. Reusable across all test files.
 */
export async function login(page: Page) {
  await page.goto('/login')
  await page.getByRole('textbox', { name: 'Email' }).fill(EMAIL)
  await page.locator('input[type="password"]').fill(PASSWORD)
  await page.getByRole('checkbox', { name: 'Remember me' }).check()
  await page.getByRole('button', { name: 'Sign in' }).click()

  // Wait for app to be ready (sidebar visible = logged in + clinic selected)
  await expect(page.getByRole('link', { name: /patient/i }).first()).toBeVisible({ timeout: 15000 })
}

/**
 * Wait for skeleton loaders to disappear and real content to load.
 */
export async function waitForDataLoad(page: Page) {
  await page.waitForFunction(() => {
    const skeletons = document.querySelectorAll('[class*="skeleton"], [class*="animate-pulse"]')
    return skeletons.length === 0
  }, { timeout: 15000 })
}
