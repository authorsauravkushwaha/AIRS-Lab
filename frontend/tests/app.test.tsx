import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import App from '../src/App'

const health = { status: 'ok', service: 'aegis-ai-lab', version: '2.0.0' }
const overview = {
  total_runs: 4, total_test_cases: 9, pass_rate: 88.9, wilson_95_ci: [56.5, 98.0],
  failed: 1, uncertain: 0, errors: 0,
  security_by_severity: { critical: 0, high: 0, medium: 1, low: 0, info: 8 },
  avg_latency_ms: 14, p95_latency_ms: 14, total_tokens: 620, total_cost_usd: 0.0012,
  total_reports: 1, total_gates: 1, approved_gates: 1, total_traces: 2,
  audit_chain_valid: true, audit_events_verified: 12,
  pass_rate_trend: [{ id: 'r1', label: '08 Nov 10:00', pass_rate: 88.9 }],
  category_breakdown: [{ category: 'factual_accuracy', total: 4, passed: 3, pass_rate: 75 }],
  recent_runs: [
    { id: 'r1', kind: 'reliability', status: 'completed', model_name: 'Mock Atlas — Guarded', dataset_hash: 'abcdef1234567890', summary: { pass_rate: 88.9 }, started_at: '2026-11-08T00:00:00' },
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

describe('AEGIS AI LAB v2.0 frontend', () => {
  it('renders all main navigation entries including Release Gates & Traces', () => {
    render(<MemoryRouter><App /></MemoryRouter>)
    for (const label of [
      'Overview', 'Projects', 'Model Management', 'Test Suites', 'Test Cases',
      'Run Evaluations', 'Reliability Lab', 'Security Lab', 'Model Comparison',
      'Release Gates & Traces', 'Reports', 'Settings',
    ]) {
      expect(screen.getAllByText(label).length).toBeGreaterThanOrEqual(1)
    }
  })

  it('dashboard loads overview metrics, Wilson CI, and SHA-256 audit verification badge', async () => {
    render(<MemoryRouter><App /></MemoryRouter>)
    await waitFor(() => expect(screen.getByText('88.9')).toBeTruthy())
    expect(screen.getByText(/SHA-256 Audit Chain Verified/i)).toBeTruthy()
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
    const created = { id: 'p1', name: 'NewProj', description: '', created_at: '2026-11-08T00:00:00', model_count: 0, suite_count: 0, case_count: 0, run_count: 0 }
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

  it('renders Release Gates & DLP Production Traces page with signed certificates', async () => {
    vi.stubGlobal('fetch', mockFetch({
      '/api/health': health,
      '/api/projects': [{ id: 'p1', name: 'Demo', description: '', created_at: '2026-11-08T00:00:00', model_count: 1, suite_count: 1, case_count: 6, run_count: 2 }],
      '/api/models': [{ id: 'm1', project_id: 'p1', name: 'Mock Atlas — Guarded', provider: 'mock', model_id: 'mock-atlas-guarded', base_url: '', api_key_env: '', enabled: true, last_status: 'ok', created_at: '2026-11-08T00:00:00' }],
      '/api/test-suites': [{ id: 's1', project_id: 'p1', name: 'Quant Suite', description: '', case_count: 6, created_at: '2026-11-08T00:00:00' }],
      '/api/gates': [{
        id: 'g1', project_id: 'p1', name: 'Tier 1 Deployment Gate', description: '', suite_id: 's1',
        min_pass_rate: 85, max_critical_findings: 0, max_high_findings: 0, max_avg_latency_ms: null,
        max_cost_per_case_usd: null, require_audit_integrity: true, last_verdict: 'approved', last_model_id: 'm1',
        last_certificate: { model_name: 'Mock Atlas — Guarded', certificate_sha256: '99887766554433221100aabbccddeeff99887766554433221100aabbccddeeff', checks: [{ check: 'min_pass_rate', expected: '>= 85%', actual: '100.0%', passed: true }] },
        last_evaluated_at: '2026-11-08T00:00:00', created_at: '2026-11-08T00:00:00',
      }],
      '/api/traces': [{
        id: 't1', project_id: 'p1', model_name: 'prod-bot', prompt_redacted: 'Client [REDACTED_EMAIL] asked margin delta',
        response_redacted: '1.25 bps', expected_answer_hint: '125 bps', flagged_reason: 'quant_unit_error',
        redactions_applied: ['EMAIL', 'US_SSN'], latency_ms: 210, tokens_in: 20, tokens_out: 5,
        promoted_case_id: '', created_at: '2026-11-08T00:00:00',
      }],
    }))
    render(<MemoryRouter initialEntries={['/gates']}><App /></MemoryRouter>)
    await waitFor(() => expect(screen.getByText('Tier 1 Deployment Gate')).toBeTruthy())
    expect(screen.getByText(/APPROVED — Mock Atlas — Guarded/i)).toBeTruthy()
    expect(screen.getByText('DLP:EMAIL')).toBeTruthy()
  })
})
