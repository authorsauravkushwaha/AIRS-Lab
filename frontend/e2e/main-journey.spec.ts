// Main user journey: open the platform -> create a project -> run an evaluation -> inspect evidence -> export a report
// Run from frontend/: npm run test:e2e (requires `npx playwright install chromium` once)
// The app serves single-origin on :8000 (uvicorn serving frontend/dist) or via Vite on :5173.
import { expect, test } from '@playwright/test'

const BASE = process.env.E2E_BASE ?? 'http://127.0.0.1:8000'

test('main evaluation journey', async ({ page }) => {
  await page.goto(BASE)
  await expect(page.getByText(/Know where your models stand/i)).toBeVisible()

  // Create a project through the modal flow. Wait for the modal to CLOSE —
  // that is what proves the POST succeeded (the dialog itself must not
  // satisfy the assertion). `.first()` keeps retries idempotent when a
  // same-named project already exists from a previous attempt.
  await page.getByRole('link', { name: 'Projects' }).click()
  await page.getByRole('button', { name: 'New project' }).click()
  await page.getByPlaceholder(/Atlas rollout gate/i).fill('E2E Project')
  await page.getByRole('button', { name: 'Create project' }).click()
  await expect(page.getByRole('dialog')).toBeHidden({ timeout: 15000 })
  await expect(page.getByRole('heading', { name: 'E2E Project' }).first()).toBeVisible()

  // Run an evaluation against the seeded suite/model (selects are preselected)
  await page.getByRole('link', { name: 'Run Evaluations' }).click()
  await page.getByRole('button', { name: 'Run evaluation' }).click()
  await expect(page.getByText('Passed', { exact: true })).toBeVisible({ timeout: 30000 })

  // Evidence shows up in the Reliability Lab
  await page.getByRole('link', { name: 'Reliability Lab' }).click()
  await expect(page.getByRole('heading', { name: 'Reliability Lab' })).toBeVisible()

  // Export evidence as JSON: assert the API round-trip succeeded, then that
  // the artifacts list count actually incremented (the card header renders
  // "Generated artifacts — N"; N is 0 before the first export).
  await page.getByRole('link', { name: 'Reports' }).click()
  const reportCreated = page.waitForResponse(
    (r) => r.url().includes('/api/reports') && r.request().method() === 'POST' && r.ok(),
  )
  await page.getByRole('button', { name: /Export JSON/i }).click()
  await reportCreated
  await expect(page.getByText(/Generated artifacts — [1-9]/)).toBeVisible({ timeout: 30000 })
})
