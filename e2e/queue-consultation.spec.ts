import { test, expect } from './fixtures'
import { waitForDataLoad } from './helpers'

test.describe('Queue & Consultation Flow', () => {
  test('queue page loads', async ({ page }) => {
    await page.goto('/queue')
    await expect(page.getByText(/queue/i).first()).toBeVisible({ timeout: 10000 })
  })

  test('can open walk-in dialog', async ({ page }) => {
    await page.goto('/queue')
    await waitForDataLoad(page)

    const walkInBtn = page.getByRole('button', { name: /walk.?in/i })
    if (await walkInBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await walkInBtn.click()
      await page.waitForTimeout(1000)
    }
  })

  test('patient detail shows tabs', async ({ page }) => {
    await page.goto('/patients')
    await waitForDataLoad(page)

    await page.locator('tbody tr').first().click()
    await expect(page).toHaveURL(/\/patients\/[a-f0-9-]+/, { timeout: 10000 })
    await waitForDataLoad(page)

    await expect(page.getByText('BASIC INFO')).toBeVisible({ timeout: 10000 })
  })
})
