import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, Fingerprint, FlaskConical, Layers, Plus, Sparkles, TestTube2 } from 'lucide-react'
import { api } from '../api'
import type { Project, Suite, SuiteTemplate } from '../types'
import { Button, Card, EmptyState, ErrorMsg, Field, Input, Modal, PageHeader, Skeleton, Textarea } from '../components/ui'
import { useToast } from '../components/Toast'
import { timeAgo } from '../lib/format'

export default function Suites() {
  const navigate = useNavigate()
  const toast = useToast()
  const [suites, setSuites] = useState<Suite[]>([])
  const [templates, setTemplates] = useState<SuiteTemplate[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [packOpen, setPackOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [installingId, setInstallingId] = useState<string | null>(null)
  const [draft, setDraft] = useState({ name: '', description: '' })

  const load = () => {
    setLoading(true)
    Promise.all([
      api<Suite[]>('/api/test-suites'),
      api<Project[]>('/api/projects'),
      api<SuiteTemplate[]>('/api/test-suites/templates').catch(() => []),
    ])
      .then(([s, p, t]) => { setSuites(s); setProjects(p); setTemplates(t) })
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

  const installPack = async (pack: SuiteTemplate) => {
    const pid = projects[0]?.id
    if (!pid) {
      toast.error('Create a project first', 'Suites belong to a workspace project.')
      return
    }
    setInstallingId(pack.id)
    try {
      await api('/api/test-suites/install-template', {
        method: 'POST',
        body: JSON.stringify({ project_id: pid, pack_id: pack.id }),
      })
      toast.success('Domain pack installed', `${pack.name} (${pack.case_count} verified cases) added.`)
      setPackOpen(false)
      load()
    } catch (e) {
      toast.error('Install failed', e instanceof Error ? e.message : String(e))
    } finally {
      setInstallingId(null)
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Workspace"
        title="Test Suites"
        description="Collections of versioned test cases fingerprinted by canonical SHA-256 hash — plus 1-click high-stakes industry packs."
        actions={<>
          <Button variant="outline" onClick={() => setPackOpen(true)}>
            <Sparkles className="h-4 w-4" /> Install domain pack
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> New suite
          </Button>
        </>}
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
            hint="Create a custom suite or install a verified Quant Finance, Family-Office, Clinical, or FinTech gate pack."
            action={<div className="flex gap-2">
              <Button variant="outline" onClick={() => setPackOpen(true)}><Sparkles className="h-4 w-4" /> Domain packs</Button>
              <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> Create a suite</Button>
            </div>}
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
                <div className="flex items-center gap-2">
                  {s.domain_pack && (
                    <span className="rounded-full border border-brand-400/25 bg-brand-grad-soft px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-brand-200">
                      {s.domain_pack.replace(/_/g, ' ')}
                    </span>
                  )}
                  <span className="font-mono text-[10px] uppercase tracking-wider text-mute-dim">{timeAgo(s.created_at)}</span>
                </div>
              </div>
              <h2 className="mt-3 font-display text-lg font-semibold text-slate-50">{s.name}</h2>
              <p className="mt-1 line-clamp-2 text-[12.5px] text-mute">{s.description || 'No description yet.'}</p>

              <div className="mt-auto pt-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-ink-850 px-2.5 py-1.5 font-mono text-[10px] text-mute">
                  <span className="flex items-center gap-1.5">
                    <TestTube2 className="h-3.5 w-3.5 text-brand-400" />
                    {s.case_count ?? 0} case{(s.case_count ?? 0) === 1 ? '' : 's'}
                  </span>
                  {s.dataset_hash && (
                    <span className="flex items-center gap-1 text-mute-dim" title={`Dataset SHA-256: ${s.dataset_hash}`}>
                      <Fingerprint className="h-3.5 w-3.5 text-emerald-400" />
                      {s.dataset_hash.slice(0, 12)}…
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="subtle" size="sm" onClick={() => navigate(`/cases?suite=${s.id}`)}>View cases</Button>
                  <Button variant="ghost" size="sm" onClick={() => navigate('/run')}><FlaskConical className="h-3.5 w-3.5" /> Run</Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Domain Pack Installer Modal */}
      <Modal open={packOpen} onClose={() => setPackOpen(false)} wide title="Install High-Stakes Domain Pack"
        footer={<Button variant="ghost" onClick={() => setPackOpen(false)}>Close</Button>}>
        <p className="mb-4 text-xs leading-relaxed text-mute">
          Pre-engineered adversarial & verification suites used by quant funds, family offices, clinical safety boards, and fintech operators. Every installed case is editable and hashed with SHA-256.
        </p>
        <div className="grid gap-3">
          {templates.map((t) => (
            <div key={t.id} className="flex flex-col justify-between gap-3 rounded-xl border border-line bg-ink-850 p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-brand-300">{t.audience}</p>
                <h3 className="mt-1 font-display text-[15px] font-semibold text-slate-50">{t.name}</h3>
                <p className="mt-1 text-xs leading-relaxed text-mute">{t.description}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="rounded border border-line bg-ink-900 px-2 py-0.5 font-mono text-[9.5px] text-slate-300">{t.case_count} cases</span>
                  {t.categories.map((c) => (
                    <span key={c} className="rounded border border-line bg-ink-900 px-2 py-0.5 font-mono text-[9.5px] text-mute">{c}</span>
                  ))}
                </div>
              </div>
              <Button size="sm" loading={installingId === t.id} disabled={installingId !== null} onClick={() => installPack(t)} className="shrink-0">
                <Download className="h-3.5 w-3.5" /> Install pack
              </Button>
            </div>
          ))}
        </div>
      </Modal>

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
            <Field label="Suite name" hint="Give it a gate-shaped name like “Q4 Earnings Filing Gate”.">
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
