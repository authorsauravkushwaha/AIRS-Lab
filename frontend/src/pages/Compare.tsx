import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Coins, GitCompareArrows, Play, Trophy, Check, TrendingDown } from 'lucide-react'
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell,
} from 'recharts'
import { api } from '../api'
import type { ModelConfig, Project, Suite } from '../types'
import { Button, Card, EmptyState, ErrorMsg, PageHeader } from '../components/ui'
import { useToast } from '../components/Toast'
import { fmtNum } from '../lib/format'

const PALETTE = ['#22d3ee', '#818cf8', '#34d399', '#fbbf24', '#fb7185', '#a78bfa']

interface ModelStats {
  runs: number; pass_rate: number | null; wilson_95_ci?: [number, number] | null
  avg_latency_ms: number | null; p95_latency_ms?: number | null
  total_tokens: number; est_cost_usd?: number; avg_cost_per_call_usd?: number
  cost_per_verified_pass_usd?: number | null; fail: number; uncertain: number
}
interface PairedInfo {
  shared_cases: number; improvements: string[]; regressions: string[]
  net_case_delta: number; mcnemar_p_value: number; statistically_significant_95: boolean
}
interface ArbitrageInfo {
  monthly_calls_assumed: number; monthly_baseline_usd: number; monthly_candidate_usd: number
  annual_savings_usd: number; cost_reduction_pct: number | null
  baseline_cost_per_verified_pass_usd: number | null
  candidate_cost_per_verified_pass_usd: number | null
  quality_delta_pp: number | null
}
interface ComparePayload {
  baseline_model_id: string
  models: Record<string, ModelStats>
  paired_vs_baseline?: Record<string, PairedInfo>
  arbitrage_vs_baseline?: Record<string, ArbitrageInfo>
}

export default function Compare() {
  const toast = useToast()
  const navigate = useNavigate()
  const [models, setModels] = useState<ModelConfig[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [suites, setSuites] = useState<Suite[]>([])
  const [checked, setChecked] = useState<string[]>([])
  const [suiteId, setSuiteId] = useState('')
  const [monthlyCalls, setMonthlyCalls] = useState(1_000_000)
  const [resp, setResp] = useState<ComparePayload | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api<ModelConfig[]>('/api/models').then((ms) => {
      setModels(ms)
      if (ms.length >= 2) setChecked([ms[0].id, ms[1].id])
    }).catch(() => {})
    api<Project[]>('/api/projects').then(setProjects).catch(() => {})
    api<Suite[]>('/api/test-suites').then(setSuites).catch(() => {})
  }, [])

  const projectId = projects[0]?.id
  const toggle = (id: string) => setChecked((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]))

  const compare = async () => {
    if (!projectId || checked.length < 2) return
    setBusy(true)
    setError('')
    try {
      const r = await api<ComparePayload>('/api/comparisons/run', {
        method: 'POST',
        body: JSON.stringify({
          project_id: projectId,
          model_ids: checked,
          monthly_calls: monthlyCalls,
          ...(suiteId ? { suite_id: suiteId } : {}),
        }),
      })
      setResp(r)
      toast.success('Comparison & Arbitrage ready', `${checked.length} models evaluated with paired McNemar statistics.`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      toast.error('Comparison failed', msg)
    } finally {
      setBusy(false)
    }
  }

  const rows = useMemo(() => {
    if (!resp?.models) return []
    return checked.filter((id) => resp.models[id]).map((id) => {
      const model = models.find((m) => m.id === id)
      return { id, name: model?.name ?? id.slice(0, 8), ...resp.models[id] }
    })
  }, [resp, models, checked])

  const best = useMemo(() => {
    const rated = rows.filter((r) => r.pass_rate !== null)
    if (rated.length === 0) return null
    return rated.reduce((a, b) => ((b.pass_rate ?? 0) > (a.pass_rate ?? 0) ? b : a))
  }, [rows])

  const baselineName = models.find((m) => m.id === resp?.baseline_model_id)?.name ?? 'Baseline'
  const chartData = rows.map((r) => ({ name: r.name, 'Pass rate %': r.pass_rate ?? 0, 'Latency ms': Math.round(r.avg_latency_ms ?? 0) }))

  return (
    <div>
      <PageHeader
        eyebrow="Evidence & governance"
        title="Model Comparison & Inference Arbitrage"
        description="Paired case-by-case McNemar significance testing, Wilson 95% confidence bounds, and annualized EBITDA inference-cost arbitrage."
        actions={<Button onClick={compare} loading={busy} disabled={checked.length < 2}><Play className="h-4 w-4" /> Compare {checked.length >= 2 ? `(${checked.length})` : ''}</Button>}
      />
      {error && <div className="mb-4"><ErrorMsg text={error} /></div>}

      <Card title="Select baseline (first checked) + candidate models" icon={<GitCompareArrows className="h-3.5 w-3.5" />} className="mb-4"
            action={
              <div className="flex flex-wrap items-center gap-2">
                <select value={monthlyCalls} onChange={(e) => setMonthlyCalls(Number(e.target.value))} className="field w-auto" aria-label="Monthly request volume">
                  <option value={100_000}>100K calls / mo</option>
                  <option value={1_000_000}>1M calls / mo</option>
                  <option value={10_000_000}>10M calls / mo</option>
                  <option value={50_000_000}>50M calls / mo</option>
                </select>
                <select value={suiteId} onChange={(e) => setSuiteId(e.target.value)} className="field w-auto" aria-label="Restrict to suite">
                  <option value="">All suites</option>
                  {suites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            }>
        {models.length < 2 ? (
          <EmptyState
            title="Need at least two models"
            hint="Register another model in Model Management to compare head-to-head."
            action={<Button variant="outline" onClick={() => navigate('/models')}>Go to Model Management</Button>}
          />
        ) : (
          <div className="flex flex-wrap gap-2.5">
            {models.map((m) => {
              const idx = checked.indexOf(m.id)
              const active = idx !== -1
              return (
                <button
                  key={m.id}
                  onClick={() => toggle(m.id)}
                  aria-pressed={active}
                  className={`group flex items-center gap-2.5 rounded-xl border px-4 py-2.5 text-[13px] transition-all duration-150 ${
                    active
                      ? 'border-brand-400/50 bg-brand-grad-soft text-brand-100 shadow-glow-sm'
                      : 'border-line bg-ink-800 text-mute hover:border-line-strong hover:text-slate-100'
                  }`}
                >
                  <span className={`grid h-5 w-5 place-items-center rounded-md border transition ${active ? 'border-brand-400 bg-brand-400 text-ink-950' : 'border-line-strong text-transparent'}`}>
                    <Check className="h-3.5 w-3.5" />
                  </span>
                  <span className="font-medium">{m.name}</span>
                  {idx === 0 && <span className="rounded bg-amber-400/20 px-1.5 py-0.5 font-mono text-[8.5px] uppercase text-amber-200">Baseline</span>}
                  <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-mute-dim">{m.provider}</span>
                </button>
              )
            })}
          </div>
        )}
      </Card>

      {resp && rows.length > 0 && (
        <>
          {best && (
            <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-400/20 bg-gradient-to-r from-amber-400/10 via-brand-grad-soft to-transparent px-5 py-4">
              <Trophy className="h-5 w-5 text-amber-300" />
              <p className="text-[13px] text-slate-200">
                <span className="font-semibold text-amber-200">{best.name}</span> leads stored runs at{' '}
                <span className="font-mono font-semibold text-amber-200">{best.pass_rate?.toFixed(1)}%</span>
                {best.wilson_95_ci && <span className="font-mono text-xs text-mute"> (95% Wilson CI: {best.wilson_95_ci[0]}%–{best.wilson_95_ci[1]}%)</span>}
              </p>
            </div>
          )}

          {/* Inference Arbitrage EBITDA Cards */}
          {resp.arbitrage_vs_baseline && Object.keys(resp.arbitrage_vs_baseline).length > 0 && (
            <Card title={`Inference Arbitrage ROI vs ${baselineName} (${fmtNum(monthlyCalls)} calls/mo)`} icon={<Coins className="h-3.5 w-3.5" />} className="mb-4">
              <div className="grid gap-3 md:grid-cols-2">
                {Object.entries(resp.arbitrage_vs_baseline).map(([candId, arb]) => {
                  const candName = models.find((m) => m.id === candId)?.name ?? candId.slice(0, 8)
                  const paired = resp.paired_vs_baseline?.[candId]
                  const positive = arb.annual_savings_usd > 0
                  return (
                    <div key={candId} className="rounded-xl border border-line bg-ink-850 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-display text-sm font-semibold text-slate-100">{candName}</span>
                        {arb.cost_reduction_pct !== null && (
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-mono text-[10px] ${
                            positive ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300' : 'border-slate-400/20 text-mute'
                          }`}>
                            <TrendingDown className="h-3 w-3" />
                            {arb.cost_reduction_pct.toFixed(1)}% cost delta
                          </span>
                        )}
                      </div>
                      <p className="mt-2 font-display text-2xl font-semibold text-emerald-300">
                        {arb.annual_savings_usd >= 0 ? `+$${fmtNum(Math.round(arb.annual_savings_usd))}` : `-$${fmtNum(Math.round(Math.abs(arb.annual_savings_usd)))}`}
                        <span className="ml-1.5 font-mono text-[10px] font-normal uppercase tracking-wider text-mute">annualized savings / yr</span>
                      </p>
                      <p className="mt-1 font-mono text-[10.5px] text-mute">
                        Quality delta: <span className={(arb.quality_delta_pp ?? 0) >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
                          {arb.quality_delta_pp !== null ? `${arb.quality_delta_pp >= 0 ? '+' : ''}${arb.quality_delta_pp} pp` : '—'}
                        </span>
                        {paired && ` · McNemar p=${paired.mcnemar_p_value.toFixed(3)} (${paired.statistically_significant_95 ? 'p<0.05 sig.' : 'non-sig.'})`}
                      </p>
                      {paired && (paired.improvements.length > 0 || paired.regressions.length > 0) && (
                        <div className="mt-2.5 space-y-1 border-t border-line pt-2 text-[11px]">
                          {paired.improvements.length > 0 && (
                            <p className="text-emerald-300">+ Improved ({paired.improvements.length}): <span className="text-slate-300">{paired.improvements.join(', ')}</span></p>
                          )}
                          {paired.regressions.length > 0 && (
                            <p className="text-rose-300">− Regressed ({paired.regressions.length}): <span className="text-slate-300">{paired.regressions.join(', ')}</span></p>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </Card>
          )}

          {/* Chart */}
          <Card title="Pass rate & latency" icon={<GitCompareArrows className="h-3.5 w-3.5" />} className="mb-4">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }} barCategoryGap="22%">
                <CartesianGrid strokeDasharray="3 6" stroke="rgba(148,184,255,0.07)" vertical={false} />
                <XAxis dataKey="name" stroke="#55627a" fontSize={10} tickLine={false} axisLine={false} interval={0} />
                <YAxis stroke="#55627a" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(148,184,255,0.05)' }}
                  contentStyle={{ background: '#101828', border: '1px solid rgba(148,184,255,0.18)', borderRadius: 12, fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Pass rate %" radius={[6, 6, 0, 0]} maxBarSize={44}>
                  {chartData.map((entry, i) => <Cell key={entry.name} fill={PALETTE[i % PALETTE.length]} fillOpacity={0.9} />)}
                </Bar>
                <Bar dataKey="Latency ms" fill="#334155" radius={[6, 6, 0, 0]} maxBarSize={44} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Stats table */}
          <Card pad={false} title="Evidence & Cost-per-Verified-Pass table" icon={<GitCompareArrows className="h-3.5 w-3.5" />}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-[12.5px]">
                <thead>
                  <tr className="border-b border-line font-mono text-[9px] uppercase tracking-[0.22em] text-mute-dim">
                    <th className="px-5 py-2.5 font-medium">Model</th>
                    <th className="px-3 py-2.5 font-medium">Runs</th>
                    <th className="px-3 py-2.5 font-medium">Pass rate (Wilson 95% CI)</th>
                    <th className="px-3 py-2.5 font-medium">Fail / Unc.</th>
                    <th className="px-3 py-2.5 font-medium">Avg / P95 lat</th>
                    <th className="px-3 py-2.5 font-medium">Cost / Verified Pass</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((r) => {
                    const isBest = best?.id === r.id
                    return (
                      <tr key={r.id} className={`transition hover:bg-white/[0.02] ${isBest ? 'bg-amber-400/[0.04]' : ''}`}>
                        <td className="px-5 py-3 font-medium text-slate-100">
                          <span className="flex items-center gap-2">{isBest && <Trophy className="h-3.5 w-3.5 text-amber-300" />}{r.name}</span>
                        </td>
                        <td className="px-3 py-3 font-mono text-mute">{r.runs}</td>
                        <td className="px-3 py-3">
                          <span className="font-mono font-semibold text-slate-100">{r.pass_rate === null ? '—' : `${r.pass_rate.toFixed(1)}%`}</span>
                          {r.wilson_95_ci && <span className="ml-1.5 font-mono text-[10px] text-mute-dim">[{r.wilson_95_ci[0]}–{r.wilson_95_ci[1]}%]</span>}
                        </td>
                        <td className="px-3 py-3 font-mono text-mute">{r.fail} / {r.uncertain}</td>
                        <td className="px-3 py-3 font-mono text-mute">
                          {r.avg_latency_ms === null ? '—' : `${Math.round(r.avg_latency_ms)} ms`}
                          {r.p95_latency_ms ? ` / ${Math.round(r.p95_latency_ms)} ms` : ''}
                        </td>
                        <td className="px-3 py-3 font-mono text-brand-200">
                          {r.cost_per_verified_pass_usd ? `$${r.cost_per_verified_pass_usd.toFixed(6)}` : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
