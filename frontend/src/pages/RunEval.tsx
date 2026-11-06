import { useEffect, useState } from 'react'
import { api } from '../api'
import type { ModelConfig, Run, Suite } from '../types'
import { Card, Empty, ErrorMsg, StatusBadge } from '../components/ui'

export default function RunEval() {
  const [models, setModels] = useState<ModelConfig[]>([])
  const [suites, setSuites] = useState<Suite[]>([])
  const [runs, setRuns] = useState<Run[]>([])
  const [sel, setSel] = useState({ suite_id: '', model_id: '', repeats: 1 })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const load = () => {
    api<ModelConfig[]>('/api/models').then((m) => { setModels(m); if (m[0]) setSel((s) => ({ ...s, model_id: s.model_id || m[0].id })) }).catch(() => {})
    api<Suite[]>('/api/test-suites').then((s) => { setSuites(s); if (s[0]) setSel((x) => ({ ...x, suite_id: x.suite_id || s[0].id })) }).catch(() => {})
    api<Run[]>('/api/evaluations').then(setRuns).catch(() => {})
  }
  useEffect(load, [])
  const run = async () => {
    setBusy(true); setError('')
    try {
      const model = models.find((m) => m.id === sel.model_id)
      await api('/api/evaluations/run', { method: 'POST', body: JSON.stringify({
        project_id: model?.project_id, suite_id: sel.suite_id, model_id: sel.model_id, repeats: sel.repeats }) })
      load()
    } catch (e) { setError(String(e)) } finally { setBusy(false) }
  }
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-slate-100">Run Evaluations</h2>
      {error && <ErrorMsg text={error} />}
      <Card title="New evaluation run">
        <div className="flex flex-wrap items-end gap-2">
          <select value={sel.suite_id} onChange={(e) => setSel({ ...sel, suite_id: e.target.value })} className="rounded border border-slate-700 bg-graphite-800 px-3 py-2 text-sm">
            {suites.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.case_count} cases)</option>)}
          </select>
          <select value={sel.model_id} onChange={(e) => setSel({ ...sel, model_id: e.target.value })} className="rounded border border-slate-700 bg-graphite-800 px-3 py-2 text-sm">
            {models.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.provider})</option>)}
          </select>
          <input type="number" min={1} max={10} value={sel.repeats} onChange={(e) => setSel({ ...sel, repeats: Number(e.target.value) })}
                 className="w-20 rounded border border-slate-700 bg-graphite-800 px-3 py-2 text-sm" title="Repeats (consistency)" />
          <button onClick={run} disabled={busy || !sel.suite_id || !sel.model_id}
                  className="rounded bg-accent px-4 py-2 text-sm font-medium text-graphite-950 disabled:opacity-50">
            {busy ? 'Running…' : 'Run evaluation'}
          </button>
        </div>
      </Card>
      <Card title="Run history">
        {runs.length === 0 ? <Empty text="No runs yet." /> : (
          <ul className="divide-y divide-slate-800">
            {runs.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-slate-300">{r.kind} · {r.started_at.slice(0, 19).replace('T', ' ')} ·
                  pass rate {String(r.summary.pass_rate ?? 'N/A')}%</span>
                <StatusBadge status={r.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
