import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, FlaskConical, Play } from 'lucide-react'
import { api } from '../api'
import type { Result, Run } from '../types'
import { Button, Card, EmptyState, ErrorMsg, PageHeader, Select, StatusBadge } from '../components/ui'
import { fmtDateTime, fmtCategory } from '../lib/format'

const STATUS_FILTERS = ['ALL', 'PASS', 'FAIL', 'UNCERTAIN', 'ERROR', 'NOT RUN'] as const

export default function Reliability() {
  const navigate = useNavigate()
  const [runs, setRuns] = useState<Run[]>([])
  const [runId, setRunId] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]>('ALL')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const loadRuns = () => {
    api<Run[]>('/api/evaluations?kind=reliability').then((rs) => {
      setRuns(rs)
      setRunId((cur) => cur || rs[0]?.id || '')
    }).catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }
  useEffect(loadRuns, [])

  useEffect(() => {
    if (!runId) { setResults([]); return }
    setLoading(true)
    setError('')
    api<Result[]>(`/api/evaluations/${runId}/results`)
      .then(setResults)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [runId])

  const filtered = useMemo(() => status === 'ALL' ? results : results.filter((r) => r.status === status), [results, status])
  const counts = useMemo(() => {
    const c: Record<string, number> = { PASS: 0, FAIL: 0, UNCERTAIN: 0, ERROR: 0, 'NOT RUN': 0 }
    for (const r of results) c[r.status] = (c[r.status] ?? 0) + 1
    return c
  }, [results])
  const currentRun = runs.find((r) => r.id === runId)

  return (
    <div>
      <PageHeader
        eyebrow="Evidence labs"
        title="Reliability Lab"
        description="Case-level evidence for every stored run: prompt, response, method, score, latency and token cost."
        actions={<Button onClick={() => navigate('/run')}><Play className="h-4 w-4" /> New run</Button>}
      />
      {error && <div className="mb-4"><ErrorMsg text={error} /></div>}

      {runs.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FlaskConical className="h-6 w-6" />}
            title="No reliability runs stored"
            hint="Run an evaluation first — every result lands here with full case-level evidence."
            action={<Button onClick={() => navigate('/run')}><Play className="h-4 w-4" /> Run evaluation</Button>}
          />
        </Card>
      ) : (
        <>
          {/* Run picker + filter chips */}
          <Card pad={false} className="mb-4 p-3">
            <div className="flex flex-wrap items-center gap-3">
              <Select value={runId} onChange={(e) => setRunId(e.target.value)} className="w-auto min-w-[260px]" aria-label="Select run">
                {runs.map((r) => (
                  <option key={r.id} value={r.id}>
                    {fmtDateTime(r.started_at)} · {typeof r.summary?.pass_rate === 'number' ? `${(r.summary.pass_rate as number).toFixed(1)}% pass` : r.status}
                  </option>
                ))}
              </Select>
              <div className="flex flex-wrap items-center gap-1.5">
                {STATUS_FILTERS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatus(s)}
                    aria-pressed={status === s}
                    className={`rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] transition ${
                      status === s ? 'border-brand-400/50 bg-brand-grad-soft text-brand-200' : 'border-line text-mute hover:text-slate-100'
                    }`}
                  >
                    {s}{s !== 'ALL' && <span className="ml-1 text-mute-dim">{counts[s] ?? 0}</span>}
                  </button>
                ))}
              </div>
              {currentRun && (
                <span className="ml-auto font-mono text-[9.5px] uppercase tracking-[0.2em] text-mute-dim">
                  {currentRun.id.slice(0, 8)} · {currentRun.status}
                </span>
              )}
            </div>
          </Card>

          {/* Results */}
          <Card pad={false} title={`Results — ${filtered.length} of ${results.length}`} icon={<FlaskConical className="h-3.5 w-3.5" />}>
            {loading ? (
              <p className="py-10 text-center text-sm text-mute">Loading results…</p>
            ) : filtered.length === 0 ? (
              <p className="py-10 text-center text-sm text-mute">No results with status “{status}” in this run.</p>
            ) : (
              <ul className="divide-y divide-line">
                {filtered.map((r) => {
                  const isOpen = !!expanded[r.id]
                  const score = Math.max(0, Math.min(1, r.score))
                  return (
                    <li key={r.id}>
                      <button className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition hover:bg-white/[0.02]" onClick={() => setExpanded((e) => ({ ...e, [r.id]: !isOpen }))} aria-expanded={isOpen}>
                        <StatusBadge status={r.status} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium text-slate-100">{r.case_name}</span>
                          <span className="mt-0.5 block font-mono text-[9px] uppercase tracking-[0.18em] text-mute-dim">{fmtCategory(r.case_category)} · {r.method}</span>
                        </span>
                        <span className="hidden w-24 shrink-0 md:block" aria-hidden="true">
                          <span className="mb-1 flex justify-between font-mono text-[8.5px] text-mute-dim"><span>score</span><span>{score.toFixed(2)}</span></span>
                          <span className="block h-1.5 overflow-hidden rounded-full bg-ink-800">
                            <span className={`block h-full rounded-full ${r.status === 'PASS' ? 'bg-emerald-400' : r.status === 'FAIL' ? 'bg-rose-400' : 'bg-amber-400'}`} style={{ width: `${score * 100}%` }} />
                          </span>
                        </span>
                        <span className="shrink-0 font-mono text-[10px] text-mute">{Math.round(r.latency_ms)} ms</span>
                        <ChevronDown className={`h-4 w-4 shrink-0 text-mute-dim transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {isOpen && (
                        <div className="border-t border-line bg-ink-850/50 px-6 py-4 text-[12px]">
                          <div className="grid gap-4 lg:grid-cols-2">
                            <div>
                              <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-mute-dim">Prompt</p>
                              <p className="mt-1 whitespace-pre-wrap leading-relaxed text-slate-200">{r.prompt}</p>
                              {r.reference_answer && (
                                <>
                                  <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.2em] text-mute-dim">Reference</p>
                                  <p className="mt-1 text-slate-300">{r.reference_answer}</p>
                                </>
                              )}
                            </div>
                            <div>
                              <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-mute-dim">Model response</p>
                              <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-ink-900 p-3 font-mono text-[10.5px] leading-relaxed text-slate-300">{r.response}</pre>
                              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[9.5px] text-mute">
                                <span>tokens in/out: {r.tokens_in}/{r.tokens_out}</span>
                                <span>latency: {r.latency_ms.toFixed(0)} ms</span>
                                {r.est_cost_usd > 0 && <span>cost: ${r.est_cost_usd}</span>}
                              </div>
                              {r.evidence && Object.keys(r.evidence).length > 0 && (
                                <>
                                  <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.2em] text-mute-dim">Evidence</p>
                                  <pre className="mt-1 overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-ink-900 p-3 font-mono text-[10.5px] leading-relaxed text-slate-400">{JSON.stringify(r.evidence, null, 2)}</pre>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
