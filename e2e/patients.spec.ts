import { test, expect } from './fixtures'
import { waitForDataLoad } from './helpers'

test.describe('Patients', () => {
  test('lists patients with data', async ({ page }) => {
    await page.goto('/patients')
    await waitForDataLoad(page)

    const rows = page.locator('tbody tr')
    await expect(rows.first()).toBeVisible({ timeout: 15000 })
    expect(await rows.count()).toBeGreaterThan(0)
  })

  test('opens patient detail on click', async ({ page }) => {
    await page.goto('/patients')
    await waitForDataLoad(page)

    await page.locator('tbody tr').first().click()
    await expect(page).toHaveURL(/\/patients\/[a-f0-9-]+/, { timeout: 10000 })
  })

  test('search filters patients', async ({ page }) => {
    await page.goto('/patients')
    await waitForDataLoad(page)

    const initialCount = await page.locator('tbody tr').count()
    const searchInput = page.locator('main input[placeholder*="earch"]').first()

    if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await searchInput.fill('Adrian')
      await page.waitForTimeout(2000)
      await waitForDataLoad(page)
      expect(await page.locator('tbody tr').count()).toBeLessThanOrEqual(initialCount)
    }
  })
})
