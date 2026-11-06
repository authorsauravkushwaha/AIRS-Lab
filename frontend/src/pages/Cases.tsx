import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Case, Suite } from '../types'
import { Card, Empty, ErrorMsg, StatusBadge } from '../components/ui'

export default function Cases() {
  const [cases, setCases] = useState<Case[]>([])
  const [suites, setSuites] = useState<Suite[]>([])
  const [suiteId, setSuiteId] = useState('')
  const [q, setQ] = useState('')
  const [error, setError] = useState('')
  const [form, setForm] = useState({ suite_id: '', name: '', category: 'factual_accuracy', prompt: '', reference_answer: '', severity: 'medium' })
  const load = () => {
    const params = new URLSearchParams()
    if (suiteId) params.set('suite_id', suiteId)
    if (q) params.set('q', q)
    api<Case[]>(`/api/test-cases?${params}`).then(setCases).catch((e) => setError(String(e)))
    api<Suite[]>('/api/test-suites').then((s) => { setSuites(s); if (s[0]) setForm((f) => ({ ...f, suite_id: f.suite_id || s[0].id })) }).catch(() => {})
  }
  useEffect(load, [suiteId, q])
  const create = async () => {
    await api('/api/test-cases', { method: 'POST', body: JSON.stringify(form) }); load()
  }
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-slate-100">Test Cases</h2>
      {error && <ErrorMsg text={error} />}
      <Card title="Filter">
        <div className="flex gap-2">
          <select value={suiteId} onChange={(e) => setSuiteId(e.target.value)} className="rounded border border-slate-700 bg-graphite-800 px-3 py-2 text-sm">
            <option value="">All suites</option>
            {suites.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.case_count})</option>)}
          </select>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name…" className="flex-1 rounded border border-slate-700 bg-graphite-800 px-3 py-2 text-sm" />
        </div>
      </Card>
      <Card title="New test case">
        <div className="grid gap-2 md:grid-cols-2">
          <select value={form.suite_id} onChange={(e) => setForm({ ...form, suite_id: e.target.value })} className="rounded border border-slate-700 bg-graphite-800 px-3 py-2 text-sm">
            {suites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded border border-slate-700 bg-graphite-800 px-3 py-2 text-sm" />
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="rounded border border-slate-700 bg-graphite-800 px-3 py-2 text-sm">
            {['factual_accuracy', 'groundedness', 'hallucination', 'structured_output', 'consistency', 'refusal', 'security_injection'].map((c) => <option key={c}>{c}</option>)}
          </select>
          <select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })} className="rounded border border-slate-700 bg-graphite-800 px-3 py-2 text-sm">
            {['low', 'medium', 'high', 'critical'].map((s) => <option key={s}>{s}</option>)}
          </select>
          <textarea placeholder="Prompt" value={form.prompt} onChange={(e) => setForm({ ...form, prompt: e.target.value })} className="rounded border border-slate-700 bg-graphite-800 px-3 py-2 text-sm md:col-span-2" rows={2} />
          <input placeholder="Reference answer (optional)" value={form.reference_answer} onChange={(e) => setForm({ ...form, reference_answer: e.target.value })} className="rounded border border-slate-700 bg-graphite-800 px-3 py-2 text-sm md:col-span-2" />
        </div>
        <button onClick={create} className="mt-3 rounded bg-accent px-4 py-2 text-sm font-medium text-graphite-950">Create</button>
      </Card>
      <Card title={`Cases (${cases.length})`}>
        {cases.length === 0 ? <Empty text="No test cases." /> : (
          <ul className="divide-y divide-slate-800">
            {cases.map((c) => (
              <li key={c.id} className="py-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-100">{c.name}</span>
                  <span className="flex gap-2"><StatusBadge status={c.category} /><StatusBadge status={c.severity} /></span>
                </div>
                <p className="mt-1 truncate text-xs text-slate-500">{c.prompt}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
