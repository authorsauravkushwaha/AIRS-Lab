import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Finding, ModelConfig } from '../types'
import { Card, Empty, ErrorMsg, StatusBadge } from '../components/ui'

export default function Security() {
  const [models, setModels] = useState<ModelConfig[]>([])
  const [modelId, setModelId] = useState('')
  const [findings, setFindings] = useState<Finding[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    api<ModelConfig[]>('/api/models').then((m) => { setModels(m); if (m[0]) setModelId(m[0].id) }).catch(() => {})
    api<Finding[]>('/api/security/findings').then(setFindings).catch(() => {})
  }, [])
  const run = async () => {
    setBusy(true); setError('')
    try {
      const model = models.find((m) => m.id === modelId)
      await api('/api/security/run', { method: 'POST', body: JSON.stringify({ project_id: model?.project_id, model_id: modelId }) })
      api<Finding[]>('/api/security/findings').then(setFindings)
    } catch (e) { setError(String(e)) } finally { setBusy(false) }
  }
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-slate-100">Security Lab</h2>
      {error && <ErrorMsg text={error} />}
      <Card title="Run defensive security suite (synthetic fixtures only)">
        <div className="flex gap-2">
          <select value={modelId} onChange={(e) => setModelId(e.target.value)} className="rounded border border-slate-700 bg-graphite-800 px-3 py-2 text-sm">
            {models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <button onClick={run} disabled={busy || !modelId} className="rounded bg-accent px-4 py-2 text-sm font-medium text-graphite-950 disabled:opacity-50">
            {busy ? 'Running…' : 'Run security tests'}
          </button>
        </div>
      </Card>
      <Card title={`Findings (${findings.length})`}>
        {findings.length === 0 ? <Empty text="No findings yet." /> : (
          <ul className="space-y-3">
            {findings.map((f) => (
              <li key={f.id} className="rounded border border-slate-800 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-100">{f.test_name}</span>
                  <span className="flex gap-2"><StatusBadge status={f.severity} /><StatusBadge status={f.outcome} /></span>
                </div>
                <p className="mt-1 text-xs text-slate-500">{f.category} — {f.actual_behavior}</p>
                {f.mitigation && <p className="mt-1 text-xs text-sky-400">Mitigation: {f.mitigation}</p>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
