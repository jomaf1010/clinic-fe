import { test, expect } from './fixtures'
import { waitForDataLoad } from './helpers'

test.describe('Appointments board', () => {
  test('renders board controls and quick book on desktop', async ({ page }) => {
    await page.goto('/appointments?page=1')
    await waitForDataLoad(page)

    await expect(page.getByRole('heading', { name: 'Appointments' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Today Board' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Calendar' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'List' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'All doctors' })).toBeVisible()
    await expect(page.getByRole('combobox')).toHaveCount(2)
    await expect(page.getByRole('heading', { name: "Today's flow" })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Week at a glance' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Doctor lanes' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Quick book' })).toBeVisible()
    await expect(page.getByText('Today', { exact: true }).first()).toBeVisible()
    await expect(page.getByLabel('Reason')).toBeVisible()
    await expect(page.getByPlaceholder('Reason for visit...')).toBeVisible()
  })

  test('keeps board usable on a narrow viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/appointments?page=1')
    await waitForDataLoad(page)

    await expect(page.getByRole('heading', { name: 'Appointments' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Today Board' })).toBeVisible()
    await expect(page.getByRole('heading', { name: "Today's flow" })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Quick book' })).toBeVisible()
    await expect(page.getByLabel('Patient')).toBeVisible()
    await expect(page.getByLabel('Doctor')).toBeVisible()
    await expect(page.getByLabel('Reason')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Book appointment' }).last()).toBeVisible()
  })
})
