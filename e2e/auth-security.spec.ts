import { test, expect } from '@playwright/test'

test.describe('Auth & Security', () => {
  test('unauthenticated user is redirected to login', async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()

    await page.goto('/patients')

    // SPA boots, checks auth, redirects to login — may take time for JS to load
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible({ timeout: 20000 })

    await context.close()
  })

  test('login with wrong credentials shows error', async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()

    await page.goto('/login')
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible({ timeout: 10000 })

    await page.getByRole('textbox', { name: 'Email' }).fill('wrong@wrong.com')
    await page.locator('input[type="password"]').fill('wrongpassword')
    await page.getByRole('button', { name: 'Sign in' }).click()

    // Should show error toast or inline message
    await expect(
      page.getByText(/credentials|invalid|incorrect|failed|error/i).first()
    ).toBeVisible({ timeout: 10000 })

    await context.close()
  })
})
