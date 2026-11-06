import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import App from '../src/App'

const health = { status: 'ok', service: 'aegis-ai-lab', version: '1.0.0' }
const overview = {
  total_runs: 3, total_test_cases: 9, pass_rate: 66.7, failed: 1, uncertain: 2, errors: 0,
  security_by_severity: { critical: 0, high: 1, medium: 0, low: 0, info: 2 },
  avg_latency_ms: 12, total_tokens: 500, total_reports: 1,
  pass_rate_trend: [{ id: 'r1', label: '06 Nov 10:00', pass_rate: 66.7 }],
  category_breakdown: [{ category: 'factual_accuracy', total: 4, passed: 3, pass_rate: 75 }],
  recent_runs: [
    { id: 'r1', kind: 'reliability', status: 'completed', model_name: 'Mock Atlas — Guarded', summary: { pass_rate: 66.7 }, started_at: '2026-11-06T00:00:00' },
  ],
}

function mockFetch(routes: Record<string, unknown>) {
  return vi.fn((input: RequestInfo | URL) => {
    const url = String(input)
    for (const [path, body] of Object.entries(routes)) {
      if (url.includes(path)) {
        return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      }
    }
    return Promise.resolve(new Response(JSON.stringify({ detail: 'not found' }), { status: 404 }))
  })
}

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch({ '/api/health': health, '/api/dashboard/overview': overview }))
})

describe('AEGIS AI LAB frontend', () => {
  it('renders all main navigation entries', () => {
    render(<MemoryRouter><App /></MemoryRouter>)
    for (const label of ['Overview', 'Projects', 'Model Management', 'Test Suites', 'Test Cases', 'Run Evaluations', 'Reliability Lab', 'Security Lab', 'Model Comparison', 'Reports', 'Settings']) {
      expect(screen.getAllByText(label).length).toBeGreaterThanOrEqual(1)
    }
  })

  it('dashboard loads overview metrics from the API', async () => {
    render(<MemoryRouter><App /></MemoryRouter>)
    await waitFor(() => expect(screen.getByText('66.7')).toBeTruthy())
    expect(screen.getByText('Evaluation runs')).toBeTruthy()
    expect(screen.getByText('Category breakdown')).toBeTruthy()
    expect(screen.getByText('Factual Accuracy')).toBeTruthy()
  })

  it('shows an error state when the API fails', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify({ detail: 'boom' }), { status: 500 }))))
    render(<MemoryRouter><App /></MemoryRouter>)
    await waitFor(() => expect(screen.getByText(/Something went wrong/)).toBeTruthy())
    expect(screen.getByText(/500: boom/)).toBeTruthy()
  })

  it('navigates to Projects and creates a project through the modal', async () => {
    const created = { id: 'p1', name: 'NewProj', description: '', created_at: '2026-11-06T00:00:00', model_count: 0, suite_count: 0, case_count: 0, run_count: 0 }
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/api/projects') && init?.method === 'POST') {
        return Promise.resolve(new Response(JSON.stringify(created), { status: 201, headers: { 'Content-Type': 'application/json' } }))
      }
      if (url.includes('/api/projects')) {
        return Promise.resolve(new Response(JSON.stringify([created]), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      }
      if (url.includes('/api/health')) {
        return Promise.resolve(new Response(JSON.stringify(health), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      }
      return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }))
    })
    vi.stubGlobal('fetch', fetchMock)
    render(<MemoryRouter initialEntries={['/projects']}><App /></MemoryRouter>)
    await userEvent.click(await screen.findByText('New project'))
    const input = await screen.findByPlaceholderText(/Atlas rollout gate/i)
    await userEvent.type(input, 'NewProj')
    await userEvent.click(screen.getByRole('button', { name: /create project/i }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/projects', expect.objectContaining({ method: 'POST' })))
  })
})
