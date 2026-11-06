import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FlaskConical, Layers, Play, Trash2, ArrowRight, Info } from 'lucide-react'
import { api } from '../api'
import type { ModelConfig, Run, Suite } from '../types'
import { Button, Card, EmptyState, ErrorMsg, Field, PageHeader, Ring, Select, StatusBadge } from '../components/ui'
import { useToast } from '../components/Toast'
import { fmtDateTime, fmtNum } from '../lib/format'

export default function RunEval() {
  const toast = useToast()
  const navigate = useNavigate()
  const [models, setModels] = useState<ModelConfig[]>([])
  const [suites, setSuites] = useState<Suite[]>([])
  const [runs, setRuns] = useState<Run[]>([])
  const [selected, setSelected] = useState({ suite_id: '', model_id: '' })
  const [repeats, setRepeats] = useState(3)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [lastRun, setLastRun] = useState<Run | null>(null)

  const load = () => {
    api<ModelConfig[]>('/api/models').then((m) => {
      setModels(m)
      setSelected((s) => ({ ...s, model_id: s.model_id || m.find((x) => x.enabled)?.id || m[0]?.id || '' }))
    }).catch(() => setError('Could not load models.'))
    api<Suite[]>('/api/test-suites').then((s) => {
      setSuites(s)
      setSelected((x) => ({ ...x, suite_id: x.suite_id || s[0]?.id || '' }))
    }).catch(() => setError('Could not load suites.'))
    api<Run[]>('/api/evaluations?kind=reliability').then(setRuns).catch(() => {})
  }
  useEffect(load, [])

  const suite = suites.find((s) => s.id === selected.suite_id)
  const model = models.find((m) => m.id === selected.model_id)
  const canRun = !busy && !!suite && !!model && model.enabled && suite.case_count > 0

  const run = async () => {
    if (!suite || !model) return
    setBusy(true)
    setError('')
    setLastRun(null)
    try {
      const created = await api<Run>('/api/evaluations/run', {
        method: 'POST',
        body: JSON.stringify({ project_id: model.project_id, suite_id: suite.id, model_id: model.id, repeats }),
      })
      setLastRun(created)
      toast.success('Evaluation complete', `${suite.name} × ${model.name}`)
      api<Run[]>('/api/evaluations?kind=reliability').then(setRuns).catch(() => {})
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      toast.error('Evaluation failed', msg)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (r: Run) => {
    try {
      await api(`/api/evaluations/${r.id}`, { method: 'DELETE' })
      setRuns((rs) => rs.filter((x) => x.id !== r.id))
      toast.success('Run deleted', 'Results and findings were removed.')
    } catch (e) {
      toast.error('Could not delete run', e instanceof Error ? e.message : String(e))
    }
  }

  const summary = lastRun?.summary as Record<string, unknown> | undefined
  const passRate = typeof summary?.pass_rate === 'number' ? (summary.pass_rate as number) : null

  return (
    <div>
      <PageHeader
        eyebrow="Test engineering"
        title="Run Evaluations"
        description="Execute a suite against a model and store reproducible, case-level evidence. Nothing is executed outside the evaluation path."
      />
      {error && <div className="mb-4"><ErrorMsg text={error} /></div>}

      <div className="grid gap-4 xl:grid-cols-5">
        {/* Run builder */}
        <Card title="New evaluation run" icon={<FlaskConical className="h-3.5 w-3.5" />} className="xl:col-span-2">
          <div className="space-y-4">
            <Field label="Test suite">
              <Select value={selected.suite_id} onChange={(e) => setSelected({ ...selected, suite_id: e.target.value })}>
                {suites.length === 0 && <option value="">No suites — create one first</option>}
                {suites.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.case_count} cases</option>)}
              </Select>
            </Field>
            <Field label="Model under test">
              <Select value={selected.model_id} onChange={(e) => setSelected({ ...selected, model_id: e.target.value })}>
                {models.length === 0 && <option value="">No models — add one first</option>}
                {models.map((m) => <option key={m.id} value={m.id}>{m.name} · {m.provider}{m.enabled ? '' : ' (disabled)'}</option>)}
              </Select>
            </Field>
            <Field label={`Consistency repeats — ${repeats}×`} hint="Applies to cases in the ‘Consistency’ category: same prompt, N runs, token-stability measured.">
              <input
                type="range" min={1} max={10} step={1} value={repeats}
                onChange={(e) => setRepeats(Number(e.target.value))}
                className="mt-2 w-full accent-cyan-400"
                aria-label="Repeats for consistency cases"
              />
              <div className="mt-1 flex justify-between font-mono text-[9px] text-mute-dim"><span>1</span><span>5</span><span>10</span></div>
            </Field>
            <div className="rounded-xl border border-line bg-ink-850 p-3.5 text-[12px] leading-relaxed text-mute">
              <p className="mb-1 flex items-center gap-1.5 font-semibold text-slate-200"><Info className="h-3.5 w-3.5 text-brand-400" />What will happen</p>
              Every case in <span className="text-slate-100">{suite?.name ?? '…'}</span> is sent to <span className="text-slate-100">{model?.name ?? '…'}</span>, graded by deterministic rule-based checks, and stored with latency, tokens and verdict. Tool calls are inspected as data — never executed.
            </div>
            <Button size="md" className="w-full" loading={busy} disabled={!canRun} onClick={run}>
              <Play className="h-4 w-4" /> {busy ? 'Running evaluation…' : 'Run evaluation'}
            </Button>
            {suite && suite.case_count === 0 && <p className="text-center text-[11px] text-amber-300">This suite has no cases yet — add some in Test Cases.</p>}
            {model && !model.enabled && <p className="text-center text-[11px] text-amber-300">This model is disabled — re-enable it in Model Management.</p>}
          </div>
        </Card>

        {/* Result summary */}
        <Card title="Last run outcome" icon={<Layers className="h-3.5 w-3.5" />} className="xl:col-span-3">
          {!lastRun ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 py-12 text-center">
              <div className="grid h-14 w-14 place-items-center rounded-2xl border border-line bg-ink-800 text-brand-400"><Play className="h-6 w-6" /></div>
              <p className="font-display text-base font-semibold text-slate-100">No run in this session yet</p>
              <p className="max-w-sm text-sm text-mute">Configure a suite and a model, then press Run. Results land here instantly with a pass-rate breakdown.</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-6 py-2 sm:flex-row sm:items-center sm:gap-10">
              <Ring value={passRate} size={150} stroke={13} />
              <div className="w-full">
                <div className="flex items-center gap-3">
                  <StatusBadge status={lastRun.status} />
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-mute-dim">{lastRun.id.slice(0, 8)}</span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  {[
                    { label: 'Passed', value: Number(summary?.PASS ?? 0), tone: 'text-emerald-300' },
                    { label: 'Failed', value: Number(summary?.FAIL ?? 0), tone: 'text-rose-300' },
                    { label: 'Uncertain', value: Number(summary?.UNCERTAIN ?? 0), tone: 'text-amber-300' },
                    { label: 'Errors', value: Number(summary?.ERROR ?? 0), tone: 'text-rose-300' },
                    { label: 'Latency', value: `${fmtNum(Math.round(Number(summary?.avg_latency_ms ?? 0)))} ms`, tone: 'text-slate-100' },
                    { label: 'Tokens', value: fmtNum(Number(summary?.total_tokens ?? 0)), tone: 'text-slate-100' },
                  ].map((s) => (
                    <div key={s.label} className="rounded-xl border border-line bg-ink-850 px-2 py-3">
                      <p className={`font-display text-xl font-semibold leading-none ${s.tone}`}>{s.value}</p>
                      <p className="mt-1.5 font-mono text-[8.5px] uppercase tracking-[0.18em] text-mute-dim">{s.label}</p>
                    </div>
                  ))}
                </div>
                <Button variant="outline" className="mt-4 w-full" onClick={() => navigate('/reliability')}>
                  Inspect case-level evidence <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Run history */}
      <Card pad={false} className="mt-4" title="Run history" icon={<FlaskConical className="h-3.5 w-3.5" />}
            action={<span className="font-mono text-[10px] uppercase tracking-[0.2em] text-mute-dim">{runs.length} stored</span>}>
        {runs.length === 0 ? (
          <EmptyState title="No runs yet" hint="Every evaluation is stored locally so evidence survives restarts." action={<Button onClick={run} disabled={!canRun}><Play className="h-4 w-4" /> Run now</Button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[12.5px]">
              <thead>
                <tr className="border-b border-line font-mono text-[9px] uppercase tracking-[0.22em] text-mute-dim">
                  <th className="px-5 py-2.5 font-medium">Started</th>
                  <th className="px-3 py-2.5 font-medium">Type</th>
                  <th className="px-3 py-2.5 font-medium">Pass rate</th>
                  <th className="px-3 py-2.5 font-medium">Latency</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 text-right font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {runs.map((r) => {
                  const s = r.summary as Record<string, unknown>
                  return (
                    <tr key={r.id} className="transition hover:bg-white/[0.02]">
                      <td className="px-5 py-3 text-slate-300">{fmtDateTime(r.started_at)}</td>
                      <td className="px-3 py-3 capitalize text-mute">{r.kind}</td>
                      <td className="px-3 py-3"><span className="font-mono text-slate-100">{typeof s.pass_rate === 'number' ? `${(s.pass_rate as number).toFixed(1)}%` : '—'}</span></td>
                      <td className="px-3 py-3 font-mono text-mute">{typeof s.avg_latency_ms === 'number' ? `${Math.round(s.avg_latency_ms as number)} ms` : '—'}</td>
                      <td className="px-3 py-3"><StatusBadge status={r.status} /></td>
                      <td className="px-3 py-3 text-right">
                        <button onClick={() => remove(r)} aria-label="Delete run" className="rounded-lg p-1.5 text-mute-dim transition hover:bg-rose-500/10 hover:text-rose-300">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
