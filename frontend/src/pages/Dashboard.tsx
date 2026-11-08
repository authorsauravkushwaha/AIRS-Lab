import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight, ArrowUpRight, BadgeCheck, Coins, FlaskConical, Layers, Lock, Play, ShieldCheck, TestTube2, Timer,
} from 'lucide-react'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { api } from '../api'
import type { Overview } from '../types'
import { Button, Card, ErrorMsg, Ring, Skeleton, StatusBadge } from '../components/ui'
import { fmtCategory, fmtNum, timeAgo } from '../lib/format'

const SEV_COLORS: Record<string, string> = {
  critical: '#fb7185', high: '#fb923c', medium: '#fbbf24', low: '#38bdf8', info: '#64748b',
}

function Kpi({ icon, label, value, sub }: { icon: ReactNode; label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="panel panel-hover p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-mute">{label}</p>
        <span className="grid h-8 w-8 place-items-center rounded-lg border border-line bg-ink-800 text-brand-400">{icon}</span>
      </div>
      <p className="mt-3 font-display text-[26px] font-semibold leading-none tracking-tight text-slate-50">{value}</p>
      {sub && <p className="mt-1.5 text-[11px] text-mute-dim">{sub}</p>}
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [data, setData] = useState<Overview | null>(null)
  const [error, setError] = useState('')
  const load = () => {
    setError('')
    api<Overview>('/api/dashboard/overview').then(setData).catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }
  useEffect(load, [])

  if (error) return <ErrorMsg text={error} onRetry={load} />
  if (!data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-44 w-full" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div>
        <div className="grid gap-4 lg:grid-cols-5"><Skeleton className="h-64 lg:col-span-3" /><Skeleton className="h-64 lg:col-span-2" /></div>
      </div>
    )
  }

  const trend = data.pass_rate_trend.filter((t) => t.pass_rate !== null)
  const severity = Object.entries(data.security_by_severity).map(([severity, count]) => ({ severity, count }))
  const severityTotal = severity.reduce((a, s) => a + s.count, 0)
  const passTone = data.pass_rate === null ? 'brand' : data.pass_rate >= 75 ? 'emerald' : data.pass_rate >= 50 ? 'amber' : 'rose'
  const ci = data.wilson_95_ci

  return (
    <div className="space-y-5">
      {/* Hero band */}
      <section className="panel relative overflow-hidden p-6 sm:p-8">
        <div aria-hidden="true" className="absolute -right-24 -top-28 h-72 w-72 rounded-full bg-brand-500/10 blur-3xl" />
        <div aria-hidden="true" className="absolute -left-20 bottom-[-6rem] h-64 w-64 rounded-full bg-brand-600/10 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-8">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2.5">
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-brand-400">AEGIS AI LAB · Flight Recorder & Crash-Test Lab</p>
              {data.audit_chain_valid !== undefined && (
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-wider ${
                  data.audit_chain_valid ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300' : 'border-rose-400/35 bg-rose-500/15 text-rose-200'
                }`}>
                  <Lock className="h-3 w-3" />
                  {data.audit_chain_valid ? `SHA-256 Audit Chain Verified (${data.audit_events_verified ?? 0})` : 'Audit Chain Alert'}
                </span>
              )}
            </div>
            <h1 className="mt-3 font-display text-[30px] font-semibold leading-[1.12] tracking-tight text-slate-50 sm:text-4xl">
              Know where your models stand — <span className="text-brand">before capital or reputation is at risk.</span>
            </h1>
            <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-mute">
              SHA-256 dataset fingerprints, Draft 2020-12 schema & contradiction checks, OWASP LLM Top 10 / MITRE ATLAS security probes, McNemar paired inference arbitrage, and signed release-gate certificates.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              <Button onClick={() => navigate('/run')} className="group">
                <Play className="h-4 w-4" /> Run evaluation
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Button>
              <Button variant="outline" onClick={() => navigate('/gates')}>
                <BadgeCheck className="h-4 w-4" /> Release gates ({data.approved_gates ?? 0}/{data.total_gates ?? 0})
              </Button>
              <Button variant="subtle" onClick={() => navigate('/suites')}>
                <Layers className="h-4 w-4" /> Domain packs
              </Button>
            </div>
          </div>
          <div className="hidden shrink-0 flex-col items-center md:flex">
            <Ring value={data.pass_rate} size={158} stroke={12} label="pass rate" tone={passTone} />
            {ci && (
              <span className="mt-2 font-mono text-[9.5px] uppercase tracking-[0.16em] text-mute-dim">
                95% Wilson CI: {ci[0]}%–{ci[1]}%
              </span>
            )}
          </div>
        </div>
      </section>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi icon={<FlaskConical className="h-4 w-4" />} label="Evaluation runs" value={fmtNum(data.total_runs)} sub={`${fmtNum(data.total_reports)} reports · ${fmtNum(data.total_traces ?? 0)} DLP traces`} />
        <Kpi icon={<TestTube2 className="h-4 w-4" />} label="Test cases" value={fmtNum(data.total_test_cases)} sub="SHA-256 fingerprinted across models" />
        <Kpi icon={<Timer className="h-4 w-4" />} label="Avg / P95 latency" value={data.avg_latency_ms === null ? '—' : `${fmtNum(Math.round(data.avg_latency_ms))} ms`} sub={data.p95_latency_ms ? `P95: ${Math.round(data.p95_latency_ms)} ms wall-clock` : 'Per-case wall-clock'} />
        <Kpi icon={<Coins className="h-4 w-4" />} label="Tokens processed" value={fmtNum(data.total_tokens)} sub={data.total_cost_usd ? `Est. spend $${data.total_cost_usd.toFixed(5)}` : 'Input + output, all stored runs'} />
      </div>

      {/* Trend + categories */}
      <div className="grid gap-4 lg:grid-cols-5">
        <Card title="Pass-rate trend" icon={<ArrowUpRight className="h-3.5 w-3.5" />} className="lg:col-span-3"
              action={<Link to="/compare" className="font-mono text-[10px] uppercase tracking-[0.2em] text-brand-300 hover:text-brand-200">Arbitrage & Compare ↗</Link>}>
          {trend.length === 0 ? (
            <p className="py-10 text-center text-sm text-mute">No completed runs yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={230}>
              <AreaChart data={trend} margin={{ top: 8, right: 4, left: -14, bottom: 0 }}>
                <defs>
                  <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.42} />
                    <stop offset="100%" stopColor="#818cf8" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 6" stroke="rgba(148,184,255,0.07)" vertical={false} />
                <XAxis dataKey="label" stroke="#55627a" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} stroke="#55627a" fontSize={10} tickLine={false} axisLine={false} unit="%" />
                <Tooltip
                  cursor={{ stroke: 'rgba(148,184,255,0.25)' }}
                  contentStyle={{ background: '#101828', border: '1px solid rgba(148,184,255,0.18)', borderRadius: 12, fontSize: 12 }}
                  labelStyle={{ color: '#a5f3fc', marginBottom: 4 }}
                  formatter={(value: number) => [`${value}%`, 'pass rate']}
                />
                <Area type="monotone" dataKey="pass_rate" stroke="#38bdf8" strokeWidth={2.4} fill="url(#trendFill)" dot={{ r: 2.4, fill: '#22d3ee' }} activeDot={{ r: 4.5 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="Category breakdown" icon={<Layers className="h-3.5 w-3.5" />} className="lg:col-span-2">
          {data.category_breakdown.length === 0 ? (
            <p className="py-10 text-center text-sm text-mute">No graded results yet.</p>
          ) : (
            <ul className="space-y-3">
              {data.category_breakdown.map((c) => {
                const rate = c.pass_rate ?? 0
                const bar = rate >= 100 ? 'from-emerald-400 to-teal-300' : rate >= 60 ? 'from-sky-400 to-indigo-400' : rate >= 30 ? 'from-amber-400 to-orange-400' : 'from-rose-400 to-red-400'
                return (
                  <li key={c.category}>
                    <div className="mb-1 flex items-baseline justify-between gap-3 text-[12px]">
                      <span className="text-slate-300">{fmtCategory(c.category)}</span>
                      <span className="font-mono text-[10.5px] text-mute">{c.passed}/{c.total} · {rate.toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-ink-800">
                      <div className={`h-full rounded-full bg-gradient-to-r ${bar} transition-all duration-700`} style={{ width: `${rate}%` }} />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>

      {/* Security severity + recent runs */}
      <div className="grid gap-4 lg:grid-cols-5">
        <Card title="Security findings by severity" icon={<ShieldCheck className="h-3.5 w-3.5" />} className="lg:col-span-2"
              action={<Link to="/security" className="font-mono text-[10px] uppercase tracking-[0.2em] text-brand-300 hover:text-brand-200">OWASP & ATLAS ↗</Link>}>
          <ResponsiveContainer width="100%" height={170}>
            <BarChart data={severity} margin={{ top: 4, right: 4, left: -26, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 6" stroke="rgba(148,184,255,0.07)" vertical={false} />
              <XAxis dataKey="severity" stroke="#55627a" fontSize={9.5} tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} stroke="#55627a" fontSize={9.5} tickLine={false} axisLine={false} />
              <Tooltip
                cursor={{ fill: 'rgba(148,184,255,0.06)' }}
                contentStyle={{ background: '#101828', border: '1px solid rgba(148,184,255,0.18)', borderRadius: 12, fontSize: 12 }}
              />
              <Bar dataKey="count" radius={[5, 5, 0, 0]} maxBarSize={40}>
                {severity.map((s) => <Cell key={s.severity} fill={SEV_COLORS[s.severity] ?? '#64748b'} fillOpacity={0.9} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="mt-2 text-center font-mono text-[9.5px] uppercase tracking-[0.2em] text-mute-dim">
            {severityTotal} findings mapped to OWASP LLM Top 10
          </p>
        </Card>

        <Card title="Recent runs" icon={<Play className="h-3.5 w-3.5" />} className="lg:col-span-3" pad={false}>
          {data.recent_runs.length === 0 ? (
            <p className="py-10 text-center text-sm text-mute">No runs yet — <Link to="/run" className="text-brand-300 hover:underline">run your first evaluation</Link>.</p>
          ) : (
            <ul className="divide-y divide-line">
              {data.recent_runs.slice(0, 6).map((run) => (
                <li key={run.id} className="flex items-center gap-3 px-5 py-3 transition hover:bg-white/[0.02]">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${run.status === 'completed' ? 'bg-emerald-400' : run.status === 'running' ? 'bg-sky-400 animate-pulse-dot' : 'bg-rose-400'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-slate-200">
                      <span className="capitalize">{run.kind}</span>
                      <span className="text-mute-dim"> · </span>
                      <span className="text-mute">{run.model_name ?? 'Unknown model'}</span>
                    </p>
                    <p className="mt-0.5 font-mono text-[9.5px] uppercase tracking-wider text-mute-dim">
                      {timeAgo(run.started_at)}
                      {run.dataset_hash ? ` · sha256:${run.dataset_hash.slice(0, 8)}` : ''}
                    </p>
                  </div>
                  {typeof run.summary?.pass_rate === 'number' && (
                    <span className="font-display text-sm font-semibold text-slate-100">{(run.summary.pass_rate as number).toFixed(1)}%</span>
                  )}
                  <StatusBadge status={run.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
