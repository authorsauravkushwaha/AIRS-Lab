import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '../api'
import type { ModelConfig, Project } from '../types'
import { Card, Empty, ErrorMsg } from '../components/ui'

export default function Compare() {
  const [models, setModels] = useState<ModelConfig[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [checked, setChecked] = useState<string[]>([])
  const [data, setData] = useState<Record<string, Record<string, unknown>> | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    api<ModelConfig[]>('/api/models').then(setModels).catch(() => {})
    api<Project[]>('/api/projects').then((p) => p[0] && setChecked([])).catch(() => {})
    api<Project[]>('/api/projects').then(setProjects).catch(() => {})
  }, [])
  const run = async () => {
    setError('')
    try {
      const r = await api<{ models: Record<string, Record<string, unknown>> }>('/api/comparisons/run', {
        method: 'POST', body: JSON.stringify({ project_id: projects[0]?.id, model_ids: checked }) })
      setData(r.models)
    } catch (e) { setError(String(e)) }
  }
  const chart = data ? Object.entries(data).map(([mid, m]) => {
    const model = models.find((x) => x.id === mid)
    return { model: model?.name ?? mid.slice(0, 6), pass_rate: m.pass_rate ?? 0, avg_latency_ms: m.avg_latency_ms ?? 0, tokens: m.total_tokens ?? 0 }
  }) : []
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-slate-100">Model Comparison</h2>
      {error && <ErrorMsg text={error} />}
      <Card title="Select at least two models">
        <div className="flex flex-wrap gap-3">
          {models.map((m) => (
            <label key={m.id} className="flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={checked.includes(m.id)}
                     onChange={(e) => setChecked((c) => e.target.checked ? [...c, m.id] : c.filter((x) => x !== m.id))} />
              {m.name}
            </label>
          ))}
          <button onClick={run} disabled={checked.length < 2} className="rounded bg-accent px-4 py-2 text-sm font-medium text-graphite-950 disabled:opacity-50">Compare</button>
        </div>
      </Card>
      {data && (
        <Card title="Comparison (last 5 completed runs per model)">
          {chart.length === 0 ? <Empty text="No completed runs to compare." /> : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2430" />
                <XAxis dataKey="model" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip contentStyle={{ background: '#1e2430', border: '1px solid #334155' }} />
                <Legend />
                <Bar dataKey="pass_rate" name="Pass rate %" fill="#38bdf8" />
                <Bar dataKey="avg_latency_ms" name="Avg latency ms" fill="#818cf8" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      )}
    </div>
  )
}
