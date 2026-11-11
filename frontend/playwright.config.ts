import { defineConfig } from '@playwright/test'

/**
 * Browser-level end-to-end journey (e2e/main-journey.spec.ts).
 *
 * The app is served single-origin: uvicorn (backend) also serves the built
 * SPA from frontend/dist, so one base URL drives the whole journey.
 *
 * Run from frontend/:
 *   npm run build && npm run test:e2e
 * (requires `npx playwright install chromium` once)
 *
 * CI runs this suite only in the dedicated e2e job; the HTTP-level journey
 * is covered faster by backend/tests/test_e2e_journey.py.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: process.env.E2E_BASE ?? 'http://127.0.0.1:8000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    // Build output must exist; the API seeds its demo workspace on startup.
    // CI installs deps into the ambient interpreter (E2E_PYTHON=python);
    // locally we reuse the project venv created by scripts/setup_local.py.
    command: `${process.env.E2E_PYTHON ?? '../.venv/bin/python'} -m uvicorn app.main:app --host 127.0.0.1 --port 8000`,
    cwd: '../backend',
    url: 'http://127.0.0.1:8000/api/health',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    env: {
      AEGIS_DATABASE_URL: 'sqlite:///./e2e_browser.db',
    },
  },
})
