import { useEffect, useState } from 'react'
import { Bot, Plus, Power, Trash2, Zap, PlugZap, Server } from 'lucide-react'
import { api } from '../api'
import type { ModelConfig, Project } from '../types'
import { Button, Card, EmptyState, ErrorMsg, Field, Input, Modal, PageHeader, Select, StatusBadge } from '../components/ui'
import { useToast } from '../components/Toast'

const PROVIDER_HINTS: Record<string, string> = {
  mock: 'Built-in deterministic fixtures. Always available — perfect for development and CI.',
  openai_compat: 'Any OpenAI-compatible Chat Completions API. Point base_url at the host; reference your key by env-var NAME.',
  ollama: 'A local Ollama server (default http://localhost:11434). No API key required.',
}

export default function Models() {
  const toast = useToast()
  const [models, setModels] = useState<ModelConfig[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [testing, setTesting] = useState<Record<string, boolean>>({})
  const [results, setResults] = useState<Record<string, { ok: boolean; message: string }>>({})
  const [confirmDelete, setConfirmDelete] = useState<ModelConfig | null>(null)
  const [form, setForm] = useState({ project_id: '', name: '', provider: 'mock', model_id: 'mock-v1', base_url: '', api_key_env: '' })

  const load = () => {
    api<ModelConfig[]>('/api/models').then(setModels).catch((e) => setError(e instanceof Error ? e.message : String(e)))
    api<Project[]>('/api/projects').then((ps) => {
      setProjects(ps)
      setForm((f) => ({ ...f, project_id: f.project_id || ps[0]?.id || '' }))
    }).catch(() => {})
  }
  useEffect(load, [])

  const create = async () => {
    setBusy(true)
    try {
      await api('/api/models', { method: 'POST', body: JSON.stringify(form) })
      setModalOpen(false)
      setForm((f) => ({ ...f, name: '', model_id: f.provider === 'mock' ? 'mock-v1' : '', base_url: '', api_key_env: '' }))
      toast.success('Model added', 'Test its connection, then run an evaluation.')
      load()
    } catch (e) {
      toast.error('Could not add model', e instanceof Error ? e.message : String(e))
    } finally { setBusy(false) }
  }

  const toggleEnabled = async (m: ModelConfig) => {
    try {
      await api(`/api/models/${m.id}`, { method: 'PATCH', body: JSON.stringify({ enabled: !m.enabled }) })
      toast.info(m.enabled ? 'Model disabled' : 'Model enabled', m.name)
      load()
    } catch (e) {
      toast.error('Could not update model', e instanceof Error ? e.message : String(e))
    }
  }

  const testConnection = async (m: ModelConfig) => {
    setTesting((t) => ({ ...t, [m.id]: true }))
    try {
      const r = await api<{ ok: boolean; message: string }>(`/api/models/${m.id}/test-connection`, { method: 'POST' })
      setResults((prev) => ({ ...prev, [m.id]: r }))
      toast[r.ok ? 'success' : 'error'](r.ok ? 'Connection OK' : 'Connection failed', r.message)
      load()
    } catch (e) {
      toast.error('Test failed', e instanceof Error ? e.message : String(e))
    } finally {
      setTesting((t) => ({ ...t, [m.id]: false }))
    }
  }

  const remove = async (m: ModelConfig) => {
    try {
      await api(`/api/models/${m.id}`, { method: 'DELETE' })
      setConfirmDelete(null)
      toast.success('Model deleted', `${m.name} and its evaluation runs were removed.`)
      load()
    } catch (e) {
      toast.error('Could not delete model', e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Workspace"
        title="Model Management"
        description="Register the models under test. Keys are referenced by environment-variable NAME — values never touch the database or the browser."
        actions={<Button onClick={() => setModalOpen(true)}><Plus className="h-4 w-4" /> Add model</Button>}
      />
      {error && <div className="mb-4"><ErrorMsg text={error} onRetry={load} /></div>}

      {models.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Bot className="h-6 w-6" />}
            title="No models configured"
            hint="Add the built-in mock provider to explore everything offline, or register an OpenAI-compatible endpoint / local Ollama server."
            action={<Button onClick={() => setModalOpen(true)}><Plus className="h-4 w-4" /> Add your first model</Button>}
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {models.map((m) => (
            <article key={m.id} className={`panel panel-hover flex flex-col p-5 transition-opacity ${m.enabled ? '' : 'opacity-65'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-line bg-ink-800 text-brand-300">
                    {m.provider === 'mock' ? <Zap className="h-5 w-5" /> : <Server className="h-5 w-5" />}
                  </span>
                  <div className="min-w-0">
                    <h2 className="truncate font-display text-[15px] font-semibold text-slate-50">{m.name}</h2>
                    <p className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-[0.14em] text-mute-dim">{m.provider} · {m.model_id}</p>
                  </div>
                </div>
                <StatusBadge status={m.last_status} />
              </div>

              <dl className="mt-4 space-y-1.5 rounded-xl border border-line bg-ink-850 p-3 font-mono text-[10px] text-mute">
                <div className="flex justify-between gap-3"><dt>provider</dt><dd className="text-slate-300">{m.provider}</dd></div>
                {m.base_url && <div className="flex justify-between gap-3"><dt>base_url</dt><dd className="max-w-[60%] truncate text-slate-300">{m.base_url}</dd></div>}
                {m.api_key_env && <div className="flex justify-between gap-3"><dt>api_key_env</dt><dd className="text-slate-300">{m.api_key_env}</dd></div>}
                <div className="flex justify-between gap-3"><dt>state</dt><dd className={m.enabled ? 'text-emerald-300' : 'text-mute'}>{m.enabled ? 'enabled' : 'disabled'}</dd></div>
              </dl>

              <div className="mt-4 flex items-center gap-2 border-t border-line pt-4">
                <Button size="sm" variant="subtle" loading={testing[m.id]} onClick={() => testConnection(m)}>
                  <PlugZap className="h-3.5 w-3.5" /> Test
                </Button>
                <Button size="sm" variant="ghost" onClick={() => toggleEnabled(m)} aria-pressed={m.enabled} title={m.enabled ? 'Disable model' : 'Enable model'}>
                  <Power className="h-3.5 w-3.5" /> {m.enabled ? 'Disable' : 'Enable'}
                </Button>
                <button onClick={() => setConfirmDelete(m)} aria-label={`Delete ${m.name}`} className="ml-auto rounded-lg p-2 text-mute-dim transition hover:bg-rose-500/10 hover:text-rose-300">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {results[m.id] && (
                <p className={`mt-2 rounded-lg border px-3 py-2 text-[11px] leading-snug ${results[m.id].ok ? 'border-emerald-400/20 bg-emerald-500/5 text-emerald-200' : 'border-rose-400/25 bg-rose-500/5 text-rose-200'}`}>
                  {results[m.id].message}
                </p>
              )}
            </article>
          ))}
        </div>
      )}

      {/* Add model modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add model"
        wide
        footer={<>
          <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button onClick={create} loading={busy} disabled={!form.name.trim() || !form.model_id.trim() || !form.project_id}>Add model</Button>
        </>}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Project">
            <Select value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })}>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Field>
          <Field label="Display name">
            <Input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Atlas assistant — release candidate" />
          </Field>
          <Field label="Provider">
            <Select value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value, model_id: e.target.value === 'mock' ? 'mock-v1' : '' })}>
              <option value="mock">mock — deterministic fixtures</option>
              <option value="openai_compat">openai_compat — OpenAI-compatible API</option>
              <option value="ollama">ollama — local server</option>
            </Select>
          </Field>
          <Field label="Model ID" hint={form.provider === 'mock' ? 'mock-v1, mock-atlas-guarded, mock-atlas-baseline, mock-orion-small' : 'The identifier the provider expects'}>
            <Input value={form.model_id} onChange={(e) => setForm({ ...form, model_id: e.target.value })} placeholder="mock-v1" className="font-mono" />
          </Field>
          <Field label="Base URL" hint={form.provider === 'ollama' ? 'Defaults to http://localhost:11434' : 'Optional for mock; required for remote endpoints'}>
            <Input value={form.base_url} onChange={(e) => setForm({ ...form, base_url: e.target.value })} placeholder="https://api.example.com/v1" className="font-mono" />
          </Field>
          <Field label="API key env var NAME" hint="Never the key itself — only the name of the server-side variable">
            <Input value={form.api_key_env} onChange={(e) => setForm({ ...form, api_key_env: e.target.value })} placeholder="OPENAI_API_KEY" className="font-mono" />
          </Field>
        </div>
        <p className="mt-4 rounded-xl border border-brand-400/15 bg-brand-grad-soft px-4 py-3 text-[12px] leading-relaxed text-brand-200/90">
          {PROVIDER_HINTS[form.provider]}
        </p>
      </Modal>

      {/* Delete confirm */}
      <Modal
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title="Delete model?"
        footer={<>
          <Button variant="ghost" onClick={() => setConfirmDelete(null)}>Keep it</Button>
          <Button variant="danger" onClick={() => confirmDelete && remove(confirmDelete)}>Delete model</Button>
        </>}
      >
        <p className="text-sm leading-relaxed text-slate-300">
          <span className="font-semibold text-slate-100">{confirmDelete?.name}</span> will be deleted together with all of its evaluation runs and evidence. This cannot be undone.
        </p>
      </Modal>
    </div>
  )
}
