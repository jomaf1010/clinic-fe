import { test, expect } from './fixtures'

test.describe('Dashboard', () => {
  test('loads after login with clinic context', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText(/total patients/i)).toBeVisible({ timeout: 10000 })
  })

  test('sidebar navigation to patients works', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: /patient/i }).first().click()
    await expect(page).toHaveURL(/\/patients/)
  })

  test('sidebar navigation to queue works', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: /queue/i }).click()
    await expect(page).toHaveURL(/\/queue/)
  })
})
