import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '../api'
import type { Overview } from '../types'
import { Card, Empty, ErrorMsg, StatusBadge } from '../components/ui'

export default function Dashboard() {
  const [data, setData] = useState<Overview | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    api<Overview>('/api/dashboard/overview').then(setData).catch((e) => setError(String(e)))
  }, [])
  if (error) return <ErrorMsg text={error} />
  if (!data) return <p className="text-slate-400">Loading…</p>
  const sevData = Object.entries(data.security_by_severity).map(([k, v]) => ({ severity: k, count: v }))
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-slate-100">Overview Dashboard</h2>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card title="Evaluation runs"><p className="text-3xl font-bold text-slate-100">{data.total_runs}</p></Card>
        <Card title="Test cases"><p className="text-3xl font-bold text-slate-100">{data.total_test_cases}</p></Card>
        <Card title="Pass rate"><p className="text-3xl font-bold text-emerald-400">{data.pass_rate ?? 'N/A'}%</p></Card>
        <Card title="Failed / Uncertain"><p className="text-3xl font-bold text-red-400">{data.failed} / {data.uncertain}</p></Card>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Security findings by severity">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={sevData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2430" />
              <XAxis dataKey="severity" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} allowDecimals={false} />
              <Tooltip contentStyle={{ background: '#1e2430', border: '1px solid #334155' }} />
              <Bar dataKey="count" fill="#38bdf8" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Performance">
          <p className="text-sm text-slate-400">Avg latency: <span className="text-slate-100">{data.avg_latency_ms ?? 'N/A'} ms</span></p>
          <p className="mt-1 text-sm text-slate-400">Total tokens: <span className="text-slate-100">{data.total_tokens}</span></p>
        </Card>
      </div>
      <Card title="Recent test runs">
        {data.recent_runs.length === 0 ? <Empty text="No runs yet — go to Run Evaluations." /> : (
          <ul className="divide-y divide-slate-800">
            {data.recent_runs.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-slate-300">{r.kind} · {r.started_at.slice(0, 19).replace('T', ' ')}</span>
                <StatusBadge status={r.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
