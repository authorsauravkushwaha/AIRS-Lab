import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  ChevronDown, Copy, Download, FileUp, Pencil, Plus, Search, SlidersHorizontal, Trash2, X,
} from 'lucide-react'
import { api, upload } from '../api'
import type { Case, Suite } from '../types'
import { Button, Card, EmptyState, ErrorMsg, Field, Input, Modal, PageHeader, Select, StatusBadge, Textarea } from '../components/ui'
import { useToast } from '../components/Toast'
import { fmtCategory } from '../lib/format'

const CATEGORIES = ['factual_accuracy', 'groundedness', 'hallucination', 'structured_output', 'consistency', 'refusal', 'security_injection', 'general']
const SEVERITIES = ['low', 'medium', 'high', 'critical']

interface CaseForm {
  id?: string
  suite_id: string; name: string; category: string; prompt: string
  reference_answer: string; expected_keywords: string; source_docs: string
  expected_schema: string; expected_behavior: string; severity: string; evaluation_criteria: string
}
const emptyForm = (suiteId: string): CaseForm => ({
  suite_id: suiteId, name: '', category: 'factual_accuracy', prompt: '',
  reference_answer: '', expected_keywords: '', source_docs: '', expected_schema: '',
  expected_behavior: '', severity: 'medium', evaluation_criteria: '',
})

export default function Cases() {
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const [cases, setCases] = useState<Case[]>([])
  const [suites, setSuites] = useState<Suite[]>([])
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [debounced, setDebounced] = useState('')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [form, setForm] = useState<CaseForm | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<Case | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const suiteId = searchParams.get('suite') ?? ''

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(search.trim()), 250)
    return () => window.clearTimeout(t)
  }, [search])

  const load = useCallback(() => {
    const params = new URLSearchParams()
    if (suiteId) params.set('suite_id', suiteId)
    if (category) params.set('category', category)
    if (debounced) params.set('q', debounced)
    api<Case[]>(`/api/test-cases?${params}`).then(setCases).catch((e) => setError(e instanceof Error ? e.message : String(e)))
    api<Suite[]>('/api/test-suites').then(setSuites).catch(() => {})
  }, [suiteId, category, debounced])
  useEffect(load, [load])

  const setSuiteParam = (value: string) => {
    setSearchParams(value ? { suite: value } : {}, { replace: true })
  }

  const openCreate = () => setForm(emptyForm(suiteId || suites[0]?.id || ''))
  const openEdit = (c: Case) => setForm({
    id: c.id, suite_id: c.suite_id, name: c.name, category: c.category, prompt: c.prompt,
    reference_answer: c.reference_answer,
    expected_keywords: c.expected_keywords.join(', '),
    source_docs: c.source_docs.join('\n'),
    expected_schema: c.expected_schema ? JSON.stringify(c.expected_schema, null, 2) : '',
    expected_behavior: c.expected_behavior, severity: c.severity, evaluation_criteria: c.evaluation_criteria,
  })

  const save = async () => {
    if (!form) return
    let expected_schema: unknown = null
    if (form.expected_schema.trim()) {
      try {
        expected_schema = JSON.parse(form.expected_schema)
      } catch {
        toast.error('Invalid JSON schema', 'Expected-schema must be valid JSON (or left empty).')
        return
      }
    }
    const payload = {
      suite_id: form.suite_id,
      name: form.name.trim(),
      category: form.category,
      prompt: form.prompt,
      reference_answer: form.reference_answer,
      expected_keywords: form.expected_keywords.split(',').map((k) => k.trim()).filter(Boolean),
      source_docs: form.source_docs.split('\n').map((d) => d.trim()).filter(Boolean),
      expected_schema,
      expected_behavior: form.expected_behavior,
      severity: form.severity,
      evaluation_criteria: form.evaluation_criteria,
    }
    setBusy(true)
    try {
      if (form.id) {
        await api(`/api/test-cases/${form.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
        toast.success('Case updated', form.name)
      } else {
        await api('/api/test-cases', { method: 'POST', body: JSON.stringify(payload) })
        toast.success('Case created', form.name)
      }
      setForm(null)
      load()
    } catch (e) {
      toast.error('Could not save case', e instanceof Error ? e.message : String(e))
    } finally { setBusy(false) }
  }

  const duplicate = async (c: Case) => {
    try {
      await api(`/api/test-cases/${c.id}/duplicate`, { method: 'POST' })
      toast.success('Case duplicated', `${c.name} (copy)`)
      load()
    } catch (e) {
      toast.error('Could not duplicate', e instanceof Error ? e.message : String(e))
    }
  }

  const remove = async (c: Case) => {
    try {
      await api(`/api/test-cases/${c.id}`, { method: 'DELETE' })
      setConfirmDelete(null)
      toast.success('Case deleted', c.name)
      load()
    } catch (e) {
      toast.error('Could not delete case', e instanceof Error ? e.message : String(e))
    }
  }

  const exportCases = () => {
    const blob = new Blob([JSON.stringify(cases, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = suiteId ? `aegis-cases-${suiteId.slice(0, 8)}.json` : 'aegis-cases.json'
    a.click()
    URL.revokeObjectURL(url)
    toast.info('Export ready', `${cases.length} case(s) downloaded as JSON.`)
  }

  const importCases = async (file: File | undefined) => {
    if (!file) return
    try {
      const res = await upload<{ imported: number }>('/api/test-cases/import', file)
      toast.success('Import complete', `${res.imported} case(s) imported.`)
      load()
    } catch (e) {
      toast.error('Import failed', e instanceof Error ? e.message : String(e))
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const filtered = useMemo(() => cases, [cases])
  const activeFilters = [suiteId && 'suite', category && 'category', debounced && 'search'].filter(Boolean).length

  return (
    <div>
      <PageHeader
        eyebrow="Test engineering"
        title="Test Cases"
        description="Atomic checks with explicit oracles: reference answers, keyword rubrics, JSON schemas and behavioral expectations."
        actions={<>
          <input ref={fileRef} type="file" accept=".json,.jsonl,application/json" className="hidden" onChange={(e) => importCases(e.target.files?.[0])} aria-hidden="true" />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}><FileUp className="h-4 w-4" /> Import</Button>
          <Button variant="outline" size="sm" onClick={exportCases} disabled={cases.length === 0}><Download className="h-4 w-4" /> Export</Button>
          <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4" /> New case</Button>
        </>}
      />
      {error && <div className="mb-4"><ErrorMsg text={error} onRetry={load} /></div>}

      {/* Filters */}
      <Card pad={false} className="mb-4 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <SlidersHorizontal className="ml-1 h-4 w-4 text-mute-dim" />
          <Select value={suiteId} onChange={(e) => setSuiteParam(e.target.value)} className="w-auto min-w-[180px]" aria-label="Filter by suite">
            <option value="">All suites</option>
            {suites.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.case_count})</option>)}
          </Select>
          <Select value={category} onChange={(e) => setCategory(e.target.value)} className="w-auto min-w-[160px]" aria-label="Filter by category">
            <option value="">All categories</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{fmtCategory(c)}</option>)}
          </Select>
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-mute-dim" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search cases by name…" className="pl-10" aria-label="Search cases" />
          </div>
          {activeFilters > 0 && (
            <button onClick={() => { setSuiteParam(''); setCategory(''); setSearch('') }} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs text-mute transition hover:text-slate-100">
              <X className="h-3.5 w-3.5" /> Clear ({activeFilters})
            </button>
          )}
        </div>
      </Card>

      {/* Case list */}
      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            title={activeFilters ? 'No cases match these filters' : 'No test cases yet'}
            hint={activeFilters ? 'Try clearing the filters above.' : 'Cases are the atomic unit of evaluation — each carries an explicit oracle so results are explainable.'}
            action={activeFilters
              ? <Button variant="outline" onClick={() => { setSuiteParam(''); setCategory(''); setSearch('') }}>Clear filters</Button>
              : <Button onClick={openCreate}><Plus className="h-4 w-4" /> New case</Button>}
          />
        </Card>
      ) : (
        <Card pad={false}>
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-mute">{filtered.length} case{filtered.length === 1 ? '' : 's'}</span>
            <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-mute-dim">Click a row to expand</span>
          </div>
          <ul className="divide-y divide-line">
            {filtered.map((c) => {
              const isOpen = !!expanded[c.id]
              return (
                <li key={c.id}>
                  <button className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition hover:bg-white/[0.02]" onClick={() => setExpanded((e) => ({ ...e, [c.id]: !isOpen }))} aria-expanded={isOpen}>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-mute-dim transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-slate-100">{c.name}</span>
                      <span className="mt-0.5 block truncate text-[11px] text-mute-dim">{c.prompt}</span>
                    </span>
                    <span className="hidden shrink-0 items-center gap-2 sm:flex">
                      <StatusBadge status={c.category} />
                      <StatusBadge status={c.severity} />
                    </span>
                  </button>
                  {isOpen && (
                    <div className="border-t border-line bg-ink-850/50 px-6 py-4">
                      <dl className="grid gap-4 text-[12px] sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <dt className="font-mono text-[9px] uppercase tracking-[0.2em] text-mute-dim">Prompt</dt>
                          <dd className="mt-1 whitespace-pre-wrap leading-relaxed text-slate-200">{c.prompt}</dd>
                        </div>
                        {c.reference_answer && (
                          <div><dt className="font-mono text-[9px] uppercase tracking-[0.2em] text-mute-dim">Reference answer</dt><dd className="mt-1 text-slate-200">{c.reference_answer}</dd></div>
                        )}
                        {c.expected_keywords.length > 0 && (
                          <div><dt className="font-mono text-[9px] uppercase tracking-[0.2em] text-mute-dim">Expected keywords</dt>
                            <dd className="mt-1 flex flex-wrap gap-1.5">{c.expected_keywords.map((k) => <code key={k} className="rounded border border-line bg-ink-800 px-1.5 py-0.5 font-mono text-[10.5px] text-brand-200">{k}</code>)}</dd></div>
                        )}
                        {c.expected_schema && (
                          <div className="sm:col-span-2"><dt className="font-mono text-[9px] uppercase tracking-[0.2em] text-mute-dim">Expected schema</dt><dd><pre className="mt-1 overflow-x-auto rounded-lg border border-line bg-ink-900 p-3 font-mono text-[10.5px] leading-relaxed text-slate-300">{JSON.stringify(c.expected_schema, null, 2)}</pre></dd></div>
                        )}
                        {c.expected_behavior && (
                          <div className="sm:col-span-2"><dt className="font-mono text-[9px] uppercase tracking-[0.2em] text-mute-dim">Expected behavior</dt><dd className="mt-1 text-slate-200">{c.expected_behavior}</dd></div>
                        )}
                        {c.evaluation_criteria && (
                          <div className="sm:col-span-2"><dt className="font-mono text-[9px] uppercase tracking-[0.2em] text-mute-dim">Evaluation criteria</dt><dd className="mt-1 text-slate-300">{c.evaluation_criteria}</dd></div>
                        )}
                      </dl>
                      <div className="mt-4 flex items-center gap-2 border-t border-line pt-3">
                        <Button size="sm" variant="subtle" onClick={() => openEdit(c)}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
                        <Button size="sm" variant="ghost" onClick={() => duplicate(c)}><Copy className="h-3.5 w-3.5" /> Duplicate</Button>
                        <button onClick={() => setConfirmDelete(c)} aria-label={`Delete ${c.name}`} className="ml-auto rounded-lg p-2 text-mute-dim transition hover:bg-rose-500/10 hover:text-rose-300">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </Card>
      )}

      {/* Create / edit modal */}
      <Modal
        open={form !== null}
        onClose={() => setForm(null)}
        wide
        title={form?.id ? 'Edit test case' : 'New test case'}
        footer={<>
          <Button variant="ghost" onClick={() => setForm(null)}>Cancel</Button>
          <Button onClick={save} loading={busy} disabled={!form?.name.trim() || !form?.prompt.trim() || !form?.suite_id}>{form?.id ? 'Save changes' : 'Create case'}</Button>
        </>}
      >
        {form && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Suite">
              <Select value={form.suite_id} onChange={(e) => setForm({ ...form, suite_id: e.target.value })}>
                {suites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </Field>
            <Field label="Name">
              <Input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Capital of France (factual)" />
            </Field>
            <Field label="Category">
              <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{fmtCategory(c)}</option>)}
              </Select>
            </Field>
            <Field label="Severity">
              <Select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
                {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Prompt">
                <Textarea rows={2} value={form.prompt} onChange={(e) => setForm({ ...form, prompt: e.target.value })} placeholder="The exact prompt sent to the model under test…" />
              </Field>
            </div>
            <Field label="Reference answer" hint="Optional oracle">
              <Input value={form.reference_answer} onChange={(e) => setForm({ ...form, reference_answer: e.target.value })} placeholder="Paris" />
            </Field>
            <Field label="Expected keywords" hint="Comma-separated">
              <Input value={form.expected_keywords} onChange={(e) => setForm({ ...form, expected_keywords: e.target.value })} placeholder="Paris, capital" />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Source documents" hint="One per line — used by groundedness/hallucination checks">
                <Textarea rows={2} value={form.source_docs} onChange={(e) => setForm({ ...form, source_docs: e.target.value })} placeholder="Shipping notice: parcel ORD-991, ETA Friday…" />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Expected JSON schema" hint="Optional — enables the structured-output grader">
                <Textarea rows={3} className="font-mono text-[11px]" value={form.expected_schema} onChange={(e) => setForm({ ...form, expected_schema: e.target.value })} placeholder='{"type": "object", "required": ["name"], …}' spellCheck={false} />
              </Field>
            </div>
            <Field label="Expected behavior" hint="For refusal/injection cases">
              <Input value={form.expected_behavior} onChange={(e) => setForm({ ...form, expected_behavior: e.target.value })} placeholder="Ignore embedded instructions…" />
            </Field>
            <Field label="Evaluation criteria">
              <Input value={form.evaluation_criteria} onChange={(e) => setForm({ ...form, evaluation_criteria: e.target.value })} placeholder="Human-readable grading note" />
            </Field>
          </div>
        )}
      </Modal>

      {/* Delete confirm */}
      <Modal
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title="Delete case?"
        footer={<>
          <Button variant="ghost" onClick={() => setConfirmDelete(null)}>Keep it</Button>
          <Button variant="danger" onClick={() => confirmDelete && remove(confirmDelete)}>Delete case</Button>
        </>}
      >
        <p className="text-sm leading-relaxed text-slate-300">
          <span className="font-semibold text-slate-100">{confirmDelete?.name}</span> will be permanently deleted from its suite.
        </p>
      </Modal>
    </div>
  )
}
