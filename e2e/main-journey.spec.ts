// Main user journey: open the landing page -> enter workbench -> create a project ->
// run an evaluation -> inspect evidence -> export a report
// Run with: npx playwright test (requires `npx playwright install chromium` once)
// The app serves single-origin on :8000 (uvicorn serving frontend/dist) or via Vite on :5173.
import { expect, test } from '@playwright/test'

const BASE = process.env.E2E_BASE ?? 'http://localhost:8000'

test('main evaluation journey', async ({ page }) => {
  await page.goto(BASE)
  // Landing page hero
  await expect(page.getByRole('heading', { name: /Ship AI you can/i })).toBeVisible()

  // Enter the workbench
  await page.getByRole('link', { name: /Open the workbench|Open workbench/i }).first().click()
  await expect(page.getByText(/Know where your models stand/i)).toBeVisible()

  // Create a project through the modal flow
  await page.getByRole('link', { name: 'Projects' }).click()
  await page.getByRole('button', { name: 'New project' }).click()
  await page.getByPlaceholder(/Atlas rollout gate/i).fill('E2E Project')
  await page.getByRole('button', { name: 'Create project' }).click()
  await expect(page.getByRole('dialog').or(page.locator('text=E2E Project'))).toBeVisible()

  // Run an evaluation against the seeded suite/model (selects are preselected)
  await page.getByRole('link', { name: 'Run Evaluations' }).click()
  await page.getByRole('button', { name: 'Run evaluation' }).click()
  await expect(page.getByText('Passed', { exact: true })).toBeVisible({ timeout: 30000 })

  // Evidence shows up in the Reliability Lab
  await page.getByRole('link', { name: 'Reliability Lab' }).click()
  await expect(page.getByRole('heading', { name: 'Reliability Lab' })).toBeVisible()

  // Export evidence as JSON
  await page.getByRole('link', { name: 'Reports' }).click()
  await page.getByRole('button', { name: /Export JSON/i }).click()
  await expect(page.getByText(/Generated reports/)).toBeVisible({ timeout: 30000 })
})
