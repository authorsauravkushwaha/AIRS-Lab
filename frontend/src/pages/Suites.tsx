import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FlaskConical, Layers, Plus, TestTube2 } from 'lucide-react'
import { api } from '../api'
import type { Project, Suite } from '../types'
import { Button, Card, EmptyState, ErrorMsg, Field, Input, Modal, PageHeader, Skeleton, Textarea } from '../components/ui'
import { useToast } from '../components/Toast'
import { timeAgo } from '../lib/format'

export default function Suites() {
  const navigate = useNavigate()
  const toast = useToast()
  const [suites, setSuites] = useState<Suite[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState({ name: '', description: '' })

  const load = () => {
    setLoading(true)
    Promise.all([
      api<Suite[]>('/api/test-suites'),
      api<Project[]>('/api/projects'),
    ])
      .then(([s, p]) => { setSuites(s); setProjects(p) })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const create = async () => {
    const name = draft.name.trim()
    if (!name) return
    setCreating(true)
    try {
      await api('/api/test-suites', {
        method: 'POST',
        body: JSON.stringify({ name, description: draft.description.trim(), project_id: projects[0]?.id ?? '' }),
      })
      setDraft({ name: '', description: '' })
      setCreateOpen(false)
      toast.success('Suite created', `“${name}” is ready for test cases.`)
      load()
    } catch (e) {
      toast.error('Could not create suite', e instanceof Error ? e.message : String(e))
    } finally {
      setCreating(false)
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Workspace"
        title="Test Suites"
        description="Collections of test cases. Every suite carries an explicit oracle — never an assumed one."
        actions={<Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> New suite</Button>}
      />
      {error && <div className="mb-4"><ErrorMsg text={error} onRetry={load} /></div>}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-44" />)}
        </div>
      ) : suites.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Layers className="h-8 w-8" />}
            title="No suites yet"
            hint="Create your first suite to start building evidence. The seeded workspace ships with a reliability gate suite."
            action={<Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> Create a suite</Button>}
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {suites.map((s) => (
            <article key={s.id} className="panel panel-hover flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <span className="inline-flex rounded-xl border border-brand-500/25 bg-brand-500/10 p-2 text-brand-300">
                  <Layers className="h-5 w-5" />
                </span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-mute-dim">{timeAgo(s.created_at)}</span>
              </div>
              <h2 className="mt-3 font-display text-lg font-semibold text-slate-50">{s.name}</h2>
              <p className="mt-0.5 line-clamp-2 text-[12.5px] text-mute">{s.description || 'No description yet.'}</p>
              <div className="mt-auto pt-4">
                <div className="mb-3 flex items-center gap-1.5 text-[11px] text-mute">
                  <TestTube2 className="h-3.5 w-3.5 text-brand-400" />
                  {s.case_count ?? 0} test case{(s.case_count ?? 0) === 1 ? '' : 's'}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="subtle" size="sm" onClick={() => navigate('/cases')}>View cases</Button>
                  <Button variant="ghost" size="sm" onClick={() => navigate('/run')}><FlaskConical className="h-3.5 w-3.5" /> Run</Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New test suite"
        footer={projects.length === 0 ? undefined : (
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button loading={creating} onClick={create}>Create suite</Button>
          </>
        )}>
        {projects.length === 0 ? (
          <div className="text-sm text-mute">
            <p>Create a project first — suites belong to a workspace.</p>
            <Button className="mt-4" onClick={() => navigate('/projects')}>Go to Projects</Button>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); create() }}>
            <Field label="Suite name" hint="Give it a gate-shaped name like “Purchase Cancellation Gate”.">
              <Input autoFocus value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                     placeholder="e.g. Purchase Cancellation Gate" />
            </Field>
            <Field label="Description (optional)">
              <Textarea rows={2} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                        placeholder="What does this suite gate?" />
            </Field>
          </form>
        )}
      </Modal>
    </div>
  )
}
