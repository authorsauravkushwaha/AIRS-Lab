import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Project } from '../types'
import { Card, Empty, ErrorMsg } from '../components/ui'

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([])
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const load = () => api<Project[]>('/api/projects').then(setProjects).catch((e) => setError(String(e)))
  useEffect(() => { load() }, [])
  const create = async () => {
    if (!name.trim()) return
    await api('/api/projects', { method: 'POST', body: JSON.stringify({ name, description: '' }) })
    setName(''); load()
  }
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-slate-100">Projects</h2>
      {error && <ErrorMsg text={error} />}
      <Card title="Create project">
        <div className="flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Project name"
                 className="flex-1 rounded border border-slate-700 bg-graphite-800 px-3 py-2 text-sm text-slate-100" />
          <button onClick={create} className="rounded bg-accent px-4 py-2 text-sm font-medium text-graphite-950">Create</button>
        </div>
      </Card>
      <Card title="All projects">
        {projects.length === 0 ? <Empty text="No projects yet." /> : (
          <ul className="divide-y divide-slate-800">
            {projects.map((p) => (
              <li key={p.id} className="py-2 text-sm"><span className="text-slate-100">{p.name}</span>
                <span className="ml-3 text-slate-500">{p.description || '—'}</span></li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
