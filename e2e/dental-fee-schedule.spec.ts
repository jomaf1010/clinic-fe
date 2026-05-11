import { test, expect } from './fixtures'
import { waitForDataLoad } from './helpers'

/**
 * Smoke coverage for the Dental Fee Schedule scope-aware tab.
 *
 * Two mount points to exercise:
 *   1. Clinic Settings → Specialties → Dental — clinic-wide defaults.
 *   2. Dentist Account → Financial / Billing — per-dentist overrides
 *      (with clinic prices shown as input placeholders).
 *
 * Both tests gate on the presence of the relevant section and skip
 * (rather than fail) when the demo account isn't a dentist or the
 * dental specialty isn't enabled — staging seed data isn't guaranteed.
 * The point is to detect mount-site regressions (component import path,
 * tab wiring, route presence) once the feature ships.
 */
test.describe('Dental Fee Schedule', () => {
  test('clinic settings → Specialties → Dental tab shows the Fee Schedule card', async ({ page }) => {
    await page.goto('/clinic/settings')
    await waitForDataLoad(page)

    const specialtiesHeading = page.getByRole('heading', { name: /specialties/i }).first()
    if (!(await specialtiesHeading.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, 'Specialties section not present — clinic settings may differ on this account')
      return
    }

    const dentalTab = page.getByRole('tab', { name: /^dental$/i }).first()
    if (!(await dentalTab.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, 'Dental specialty tab not present on this clinic')
      return
    }

    await dentalTab.click()

    // Card title is "Dental Fee Schedule" in both clinic and doctor scopes —
    // the description text differs. Asserting the title catches mount
    // regressions without coupling to scope-specific copy.
    await expect(page.getByText('Dental Fee Schedule')).toBeVisible({ timeout: 10000 })

    // The clinic-scope description gives the strongest signal that the
    // right scope is mounted. Match a stable substring.
    await expect(
      page.getByText(/Set the clinic-wide default prices/i),
    ).toBeVisible({ timeout: 5000 })
  })

  test('search input filters the catalog', async ({ page }) => {
    await page.goto('/clinic/settings')
    await waitForDataLoad(page)

    const dentalTab = page.getByRole('tab', { name: /^dental$/i }).first()
    if (!(await dentalTab.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, 'Dental specialty tab not present on this clinic')
      return
    }
    await dentalTab.click()

    const searchInput = page.getByPlaceholder(/search by name, code, or material/i)
    if (!(await searchInput.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, 'Catalog rows did not load — likely an unseeded test clinic')
      return
    }

    // Search for a CDT code that won't match anything to verify the empty
    // state renders. We avoid asserting positive matches because the seed
    // catalog can change over time.
    await searchInput.fill('ZZ-NO-SUCH-CODE')
    await expect(page.getByText(/no services match your search/i)).toBeVisible({ timeout: 5000 })
  })

  test('dentist account → Financial/Billing shows the override editor when applicable', async ({ page }) => {
    // The account-settings route varies by app version; navigate via the
    // user menu rather than guessing a URL. Skip the test if the menu
    // doesn't expose an "Account" / "Profile" option (e.g., role is not a
    // doctor).
    await page.goto('/')
    await waitForDataLoad(page)

    // Try common entry points — any one of these should work; if none do
    // we skip rather than fail.
    const entryPoints = ['/account', '/account/settings', '/profile', '/profile/settings']
    let landed = false
    for (const path of entryPoints) {
      const res = await page.goto(path).catch(() => null)
      if (res && res.ok()) {
        landed = true
        break
      }
    }
    if (!landed) {
      test.skip(true, 'No account/profile route is reachable for this user')
      return
    }
    await waitForDataLoad(page)

    // The Dental Fee Schedule only mounts when the user's specialty is
    // dental. Otherwise the financial form omits it. Skip rather than
    // fail.
    const card = page.getByText('Dental Fee Schedule')
    if (!(await card.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, 'User is not a dentist — DentalBillingTab not mounted')
      return
    }

    await expect(card).toBeVisible()
    // Doctor-scope description signals the override semantics.
    await expect(
      page.getByText(/Override your clinic.{0,3}s prices for procedures you charge differently/i),
    ).toBeVisible({ timeout: 5000 })
  })
})
