import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Boxes, FlaskConical, Layers, Plus, Trash2, TestTube2 } from 'lucide-react'
import { api } from '../api'
import type { Project } from '../types'
import { Button, Card, EmptyState, ErrorMsg, Field, Input, Modal, PageHeader } from '../components/ui'
import { useToast } from '../components/Toast'
import { timeAgo } from '../lib/format'

export default function Projects() {
  const toast = useToast()
  const navigate = useNavigate()
  const [projects, setProjects] = useState<Project[]>([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<Project | null>(null)

  const load = () => api<Project[]>('/api/projects').then(setProjects).catch((e) => setError(e instanceof Error ? e.message : String(e)))
  useEffect(() => { load() }, [])

  const create = async () => {
    if (!name.trim()) return
    setBusy(true)
    try {
      await api('/api/projects', { method: 'POST', body: JSON.stringify({ name: name.trim(), description: description.trim() }) })
      setName(''); setDescription(''); setModalOpen(false)
      toast.success('Project created', 'A fresh workspace is ready — add models and suites.')
      load()
    } catch (e) {
      toast.error('Could not create project', e instanceof Error ? e.message : String(e))
    } finally { setBusy(false) }
  }

  const remove = async (p: Project) => {
    try {
      await api(`/api/projects/${p.id}`, { method: 'DELETE' })
      toast.success('Project deleted', p.name)
      setConfirmDelete(null)
      load()
    } catch (e) {
      toast.error('Could not delete project', e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Workspace"
        title="Projects"
        description="Isolated workspaces grouping models, suites, cases and evidence. Delete calmly — cascade is fully wired."
        actions={<Button onClick={() => setModalOpen(true)}><Plus className="h-4 w-4" /> New project</Button>}
      />
      {error && <div className="mb-4"><ErrorMsg text={error} onRetry={load} /></div>}

      {projects.length === 0 ? (
        <Card>
          <EmptyState
            title="No projects yet"
            hint="Create your first workspace to start evaluating models against shared, versioned test suites."
            action={<Button onClick={() => setModalOpen(true)}><Plus className="h-4 w-4" /> Create project</Button>}
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => (
            <article key={p.id} className="panel panel-hover flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate font-display text-lg font-semibold text-slate-50">{p.name}</h2>
                  <p className="mt-0.5 line-clamp-2 text-[12.5px] text-mute">{p.description || 'No description yet.'}</p>
                </div>
                <button
                  onClick={() => setConfirmDelete(p)}
                  aria-label={`Delete project ${p.name}`}
                  className="rounded-lg border border-transparent p-2 text-mute-dim transition hover:border-rose-400/25 hover:bg-rose-500/10 hover:text-rose-300"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                {[
                  { n: p.model_count, label: 'Models', icon: <Boxes className="mx-auto mb-1 h-3.5 w-3.5 text-brand-400" /> },
                  { n: p.suite_count, label: 'Suites', icon: <Layers className="mx-auto mb-1 h-3.5 w-3.5 text-brand-400" /> },
                  { n: p.case_count, label: 'Cases', icon: <TestTube2 className="mx-auto mb-1 h-3.5 w-3.5 text-brand-400" /> },
                  { n: p.run_count, label: 'Runs', icon: <FlaskConical className="mx-auto mb-1 h-3.5 w-3.5 text-brand-400" /> },
                ].map(({ n, label, icon }) => (
                  <div key={label} className="rounded-xl border border-line bg-ink-850 px-2 py-2.5">
                    {icon}
                    <p className="font-display text-lg font-semibold leading-none text-slate-100">{n}</p>
                    <p className="mt-1 font-mono text-[8.5px] uppercase tracking-[0.18em] text-mute-dim">{label}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-4">
                <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-mute-dim">Created {timeAgo(p.created_at)}</span>
                <button onClick={() => navigate('/run')} className="font-mono text-[10px] uppercase tracking-[0.2em] text-brand-300 transition hover:text-brand-200">
                  Run eval ↗
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Create modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Create project"
        footer={<>
          <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button onClick={create} loading={busy} disabled={!name.trim()}>Create project</Button>
        </>}
      >
        <div className="space-y-4">
          <Field label="Project name">
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Atlas rollout gate" onKeyDown={(e) => e.key === 'Enter' && create()} />
          </Field>
          <Field label="Description" hint="Optional — what is this workspace evaluating?">
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Pre-release regression suite for the Atlas assistant" />
          </Field>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title="Delete project?"
        footer={<>
          <Button variant="ghost" onClick={() => setConfirmDelete(null)}>Keep it</Button>
          <Button variant="danger" onClick={() => confirmDelete && remove(confirmDelete)}>Delete forever</Button>
        </>}
      >
        <p className="text-sm leading-relaxed text-slate-300">
          <span className="font-semibold text-slate-100">{confirmDelete?.name}</span> and everything inside it —
          models, suites, cases, runs, results, findings and reports — will be permanently deleted. This cannot be undone.
        </p>
      </Modal>
    </div>
  )
}
