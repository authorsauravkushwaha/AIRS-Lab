import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Result, Run } from '../types'
import { Card, Empty, ErrorMsg, StatusBadge } from '../components/ui'

export default function Reliability() {
  const [runs, setRuns] = useState<Run[]>([])
  const [results, setResults] = useState<Result[]>([])
  const [error, setError] = useState('')
  useEffect(() => {
    api<Run[]>('/api/evaluations').then(async (rs) => {
      setRuns(rs)
      if (rs[0]) setResults(await api<Result[]>(`/api/evaluations/${rs[0].id}/results`))
    }).catch((e) => setError(String(e)))
  }, [])
  const show = async (id: string) => setResults(await api<Result[]>(`/api/evaluations/${id}/results`))
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-slate-100">Reliability Lab</h2>
      {error && <ErrorMsg text={error} />}
      <Card title="Select run">
        <select onChange={(e) => show(e.target.value)} className="rounded border border-slate-700 bg-graphite-800 px-3 py-2 text-sm">
          {runs.map((r) => <option key={r.id} value={r.id}>{r.kind} · {r.started_at.slice(0, 19).replace('T', ' ')}</option>)}
        </select>
      </Card>
      <Card title={`Results (${results.length})`}>
        {results.length === 0 ? <Empty text="Run an evaluation first." /> : (
          <ul className="space-y-3">
            {results.map((r) => (
              <li key={r.id} className="rounded border border-slate-800 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-slate-400">{r.test_case_id.slice(0, 8)}</span>
                  <span className="flex gap-2"><StatusBadge status={r.status} /><span className="text-xs text-slate-500">{r.method} · {r.latency_ms} ms</span></span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-slate-400">{r.response}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
