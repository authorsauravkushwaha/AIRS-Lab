import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Run } from '../types'
import { Card, Empty, ErrorMsg } from '../components/ui'

interface ReportItem { id: string; run_id: string; format: string; title: string; created_at: string }

export default function Reports() {
  const [runs, setRuns] = useState<Run[]>([])
  const [reports, setReports] = useState<ReportItem[]>([])
  const [runId, setRunId] = useState('')
  const [error, setError] = useState('')
  const load = () => {
    api<Run[]>('/api/evaluations').then((r) => { setRuns(r); if (r[0]) setRunId(r[0].id) }).catch(() => {})
    api<ReportItem[]>('/api/reports').then(setReports).catch(() => {})
  }
  useEffect(load, [])
  const gen = async (format: string) => {
    setError('')
    try {
      const model = runs[0]
      const run = runs.find((r) => r.id === runId) ?? runs[0]
      const proj = await api<{ id: string }[]>('/api/projects')
      await api('/api/reports', { method: 'POST', body: JSON.stringify({ project_id: proj[0]?.id ?? model?.id, run_id: run?.id ?? runId, format }) })
      load()
    } catch (e) { setError(String(e)) }
  }
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-slate-100">Reports</h2>
      {error && <ErrorMsg text={error} />}
      <Card title="Generate report from a stored run">
        <div className="flex flex-wrap gap-2">
          <select value={runId} onChange={(e) => setRunId(e.target.value)} className="rounded border border-slate-700 bg-graphite-800 px-3 py-2 text-sm">
            {runs.map((r) => <option key={r.id} value={r.id}>{r.kind} · {r.started_at.slice(0, 19).replace('T', ' ')}</option>)}
          </select>
          {['json', 'csv', 'pdf'].map((f) => (
            <button key={f} onClick={() => gen(f)} className="rounded border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-graphite-800">Export {f.toUpperCase()}</button>
          ))}
        </div>
      </Card>
      <Card title={`Generated reports (${reports.length})`}>
        {reports.length === 0 ? <Empty text="No reports generated." /> : (
          <ul className="divide-y divide-slate-800">
            {reports.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-slate-300">{r.title} ({r.format})</span>
                <a className="text-accent hover:underline" href={`/api/reports/${r.id}/download`}>Download</a>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
