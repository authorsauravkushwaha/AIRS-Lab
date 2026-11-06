import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GitCompareArrows, Play, Trophy, Check } from 'lucide-react'
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell,
} from 'recharts'
import { api } from '../api'
import type { ModelConfig, Project, Suite } from '../types'
import { Button, Card, EmptyState, ErrorMsg, PageHeader } from '../components/ui'
import { useToast } from '../components/Toast'
import { fmtNum } from '../lib/format'

const PALETTE = ['#22d3ee', '#818cf8', '#34d399', '#fbbf24', '#fb7185', '#a78bfa']

type CompareStats = Record<string, { runs: number; pass_rate: number | null; avg_latency_ms: number | null; total_tokens: number; fail: number; uncertain: number }>

export default function Compare() {
  const toast = useToast()
  const navigate = useNavigate()
  const [models, setModels] = useState<ModelConfig[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [suites, setSuites] = useState<Suite[]>([])
  const [checked, setChecked] = useState<string[]>([])
  const [suiteId, setSuiteId] = useState('')
  const [data, setData] = useState<CompareStats | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api<ModelConfig[]>('/api/models').then(setModels).catch(() => {})
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
      const r = await api<{ models: CompareStats }>('/api/comparisons/run', {
        method: 'POST',
        body: JSON.stringify({ project_id: projectId, model_ids: checked, ...(suiteId ? { suite_id: suiteId } : {}) }),
      })
      setData(r.models)
      toast.success('Comparison ready', `${checked.length} models over their last 5 reliability runs each.`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      toast.error('Comparison failed', msg)
    } finally {
      setBusy(false)
    }
  }

  const rows = useMemo(() => {
    if (!data) return []
    return Object.entries(data).map(([id, stats]) => {
      const model = models.find((m) => m.id === id)
      return { id, name: model?.name ?? id.slice(0, 8), ...stats }
    })
  }, [data, models])

  const best = useMemo(() => {
    const rated = rows.filter((r) => r.pass_rate !== null)
    if (rated.length === 0) return null
    return rated.reduce((a, b) => ((b.pass_rate ?? 0) > (a.pass_rate ?? 0) ? b : a))
  }, [rows])

  const chartData = rows.map((r) => ({ name: r.name, 'Pass rate %': r.pass_rate ?? 0, 'Latency ms': Math.round(r.avg_latency_ms ?? 0) }))

  return (
    <div>
      <PageHeader
        eyebrow="Evidence labs"
        title="Model Comparison"
        description="Head-to-head over the last 5 completed reliability runs per model. Descriptive only — no significance claims."
        actions={<Button onClick={compare} loading={busy} disabled={checked.length < 2}><Play className="h-4 w-4" /> Compare {checked.length >= 2 ? `(${checked.length})` : ''}</Button>}
      />
      {error && <div className="mb-4"><ErrorMsg text={error} /></div>}

      {/* Selection */}
      <Card title="Pick at least two models" icon={<GitCompareArrows className="h-3.5 w-3.5" />} className="mb-4"
            action={
              <select value={suiteId} onChange={(e) => setSuiteId(e.target.value)} className="field w-auto" aria-label="Restrict to suite">
                <option value="">All suites</option>
                {suites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            }>
        {models.length < 2 ? (
          <EmptyState
            title="Need at least two models"
            hint="Register another model in Model Management to compare fixtures head-to-head."
            action={<Button variant="outline" onClick={() => navigate('/models')}>Go to Model Management</Button>}
          />
        ) : (
          <div className="flex flex-wrap gap-2.5">
            {models.map((m) => {
              const active = checked.includes(m.id)
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
                  <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-mute-dim">{m.provider}</span>
                </button>
              )
            })}
          </div>
        )}
      </Card>

      {data && rows.length === 0 && (
        <Card><EmptyState title="No comparable runs" hint="The selected models have no completed reliability runs yet. Run evaluations first." action={<Button onClick={() => navigate('/run')}><Play className="h-4 w-4" /> Run evaluation</Button>} /></Card>
      )}

      {data && rows.length > 0 && (
        <>
          {/* Winner banner */}
          {best && (
            <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-400/20 bg-gradient-to-r from-amber-400/10 via-brand-grad-soft to-transparent px-5 py-4">
              <Trophy className="h-5 w-5 text-amber-300" />
              <p className="text-[13px] text-slate-200">
                <span className="font-semibold text-amber-200">{best.name}</span> leads this comparison at{' '}
                <span className="font-mono font-semibold text-amber-200">{best.pass_rate?.toFixed(1)}%</span> pass rate
                <span className="text-mute"> — descriptive of stored runs only, not a superiority claim.</span>
              </p>
            </div>
          )}

          {/* Chart */}
          <Card title="Pass rate & latency" icon={<GitCompareArrows className="h-3.5 w-3.5" />} className="mb-4">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }} barCategoryGap="22%">
                <CartesianGrid strokeDasharray="3 6" stroke="rgba(148,184,255,0.07)" vertical={false} />
                <XAxis dataKey="name" stroke="#55627a" fontSize={10} tickLine={false} axisLine={false} interval={0} angle={chartData.length > 3 ? -12 : 0} textAnchor={chartData.length > 3 ? 'end' : 'middle'} height={chartData.length > 3 ? 54 : 30} />
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
          <Card pad={false} title="Evidence table" icon={<GitCompareArrows className="h-3.5 w-3.5" />}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-[12.5px]">
                <thead>
                  <tr className="border-b border-line font-mono text-[9px] uppercase tracking-[0.22em] text-mute-dim">
                    <th className="px-5 py-2.5 font-medium">Model</th>
                    <th className="px-3 py-2.5 font-medium">Runs</th>
                    <th className="px-3 py-2.5 font-medium">Pass rate</th>
                    <th className="px-3 py-2.5 font-medium">Fail / Unc.</th>
                    <th className="px-3 py-2.5 font-medium">Avg latency</th>
                    <th className="px-3 py-2.5 font-medium">Tokens</th>
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
                        <td className="px-3 py-3"><span className="font-mono font-semibold text-slate-100">{r.pass_rate === null ? '—' : `${r.pass_rate.toFixed(1)}%`}</span></td>
                        <td className="px-3 py-3 font-mono text-mute">{r.fail} / {r.uncertain}</td>
                        <td className="px-3 py-3 font-mono text-mute">{r.avg_latency_ms === null ? '—' : `${Math.round(r.avg_latency_ms)} ms`}</td>
                        <td className="px-3 py-3 font-mono text-mute">{fmtNum(r.total_tokens)}</td>
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
