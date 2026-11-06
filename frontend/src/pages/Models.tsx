import { useEffect, useState } from 'react'
import { api } from '../api'
import type { ModelConfig, Project } from '../types'
import { Card, Empty, ErrorMsg, StatusBadge } from '../components/ui'

export default function Models() {
  const [models, setModels] = useState<ModelConfig[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [form, setForm] = useState({ project_id: '', name: '', provider: 'mock', model_id: 'mock-v1', base_url: '', api_key_env: '' })
  const [error, setError] = useState('')
  const [msg, setMsg] = useState<Record<string, string>>({})
  const load = () => {
    api<ModelConfig[]>('/api/models').then(setModels).catch((e) => setError(String(e)))
    api<Project[]>('/api/projects').then((ps) => { setProjects(ps); if (ps[0]) setForm((f) => ({ ...f, project_id: f.project_id || ps[0].id })) }).catch(() => {})
  }
  useEffect(load, [])
  const create = async () => {
    await api('/api/models', { method: 'POST', body: JSON.stringify(form) }); load()
  }
  const testConn = async (id: string) => {
    const r = await api<{ ok: boolean; message: string }>(`/api/models/${id}/test-connection`, { method: 'POST' })
    setMsg((m) => ({ ...m, [id]: r.message })); load()
  }
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-slate-100">Model Management</h2>
      {error && <ErrorMsg text={error} />}
      <Card title="Add model configuration">
        <div className="grid gap-2 md:grid-cols-3">
          <select value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })} className="rounded border border-slate-700 bg-graphite-800 px-3 py-2 text-sm">
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input placeholder="Display name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded border border-slate-700 bg-graphite-800 px-3 py-2 text-sm" />
          <select value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} className="rounded border border-slate-700 bg-graphite-800 px-3 py-2 text-sm">
            <option value="mock">mock (demo)</option><option value="openai_compat">openai_compat</option><option value="ollama">ollama</option>
          </select>
          <input placeholder="Model ID" value={form.model_id} onChange={(e) => setForm({ ...form, model_id: e.target.value })} className="rounded border border-slate-700 bg-graphite-800 px-3 py-2 text-sm" />
          <input placeholder="Base URL (optional)" value={form.base_url} onChange={(e) => setForm({ ...form, base_url: e.target.value })} className="rounded border border-slate-700 bg-graphite-800 px-3 py-2 text-sm" />
          <input placeholder="API key env var NAME (never the key)" value={form.api_key_env} onChange={(e) => setForm({ ...form, api_key_env: e.target.value })} className="rounded border border-slate-700 bg-graphite-800 px-3 py-2 text-sm" />
        </div>
        <button onClick={create} className="mt-3 rounded bg-accent px-4 py-2 text-sm font-medium text-graphite-950">Add model</button>
      </Card>
      <Card title="Configured models">
        {models.length === 0 ? <Empty text="No models configured." /> : (
          <ul className="space-y-2">
            {models.map((m) => (
              <li key={m.id} className="rounded border border-slate-800 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-100">{m.name} <span className="text-slate-500">({m.provider} / {m.model_id})</span></span>
                  <StatusBadge status={m.last_status} />
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <button onClick={() => testConn(m.id)} className="rounded border border-slate-600 px-3 py-1 text-xs text-slate-300 hover:bg-graphite-800">Test connection</button>
                  {msg[m.id] && <span className="text-xs text-slate-400">{msg[m.id]}</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
