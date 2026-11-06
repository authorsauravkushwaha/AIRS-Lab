import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import App from '../src/App'

const health = { status: 'ok', service: 'aegis-ai-lab', version: '0.1.0' }
const overview = {
  total_runs: 3, total_test_cases: 9, pass_rate: 66.7, failed: 1, uncertain: 2, errors: 0,
  security_by_severity: { critical: 0, high: 1, medium: 0, low: 0, info: 2 },
  avg_latency_ms: 12, total_tokens: 500, recent_runs: [],
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
      expect(screen.getByText(label)).toBeTruthy()
    }
  })

  it('dashboard loads overview metrics from the API', async () => {
    render(<MemoryRouter><App /></MemoryRouter>)
    await waitFor(() => expect(screen.getByText('66.7%')).toBeTruthy())
    expect(screen.getByText('Evaluation runs').closest('div')?.parentElement?.textContent).toContain('3')
  })

  it('shows an error state when the API fails', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify({ detail: 'boom' }), { status: 500 }))))
    render(<MemoryRouter><App /></MemoryRouter>)
    await waitFor(() => expect(screen.getByText(/API 500/)).toBeTruthy())
  })

  it('navigates to the Projects page and creates a project', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/api/projects') && init?.method === 'POST') {
        return Promise.resolve(new Response(JSON.stringify([{ id: 'p1', name: 'NewProj', description: '', created_at: '2026-11-06T00:00:00' }]), { status: 200 }))
      }
      if (url.includes('/api/projects')) {
        return Promise.resolve(new Response(JSON.stringify([{ id: 'p1', name: 'Demo Project', description: '', created_at: '2026-11-06T00:00:00' }]), { status: 200 }))
      }
      return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }))
    })
    vi.stubGlobal('fetch', fetchMock)
    render(<MemoryRouter initialEntries={['/projects']}><App /></MemoryRouter>)
    const input = await screen.findByPlaceholderText('Project name')
    await userEvent.type(input, 'NewProj')
    await userEvent.click(screen.getByText('Create'))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/projects', expect.objectContaining({ method: 'POST' })))
  })
})
