// Main user journey: open platform -> create project -> mock model -> suite -> cases -> run -> results -> report
// Run with: npx playwright test (requires `npx playwright install chromium` once)
import { expect, test } from '@playwright/test'

const BASE = process.env.E2E_BASE ?? 'http://localhost:5173'

test('main evaluation journey', async ({ page }) => {
  await page.goto(BASE)
  await expect(page.getByText('AEGIS AI LAB')).toBeVisible()

  await page.getByRole('link', { name: 'Projects' }).click()
  await page.getByPlaceholder('Project name').fill('E2E Project')
  await page.getByRole('button', { name: 'Create' }).click()

  await page.getByRole('link', { name: 'Test Cases' }).click()
  await expect(page.getByText('Cases')).toBeVisible()

  await page.getByRole('link', { name: 'Run Evaluations' }).click()
  await page.getByRole('button', { name: 'Run evaluation' }).click()
  await expect(page.getByText('completed')).toBeVisible({ timeout: 30000 })

  await page.getByRole('link', { name: 'Reports' }).click()
  await page.getByRole('button', { name: 'Export JSON' }).click()
  await expect(page.getByText('Generated reports')).toBeVisible()
})
