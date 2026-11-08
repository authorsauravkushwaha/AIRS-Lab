import { useEffect, useState } from 'react'
import { ArrowUpRight, BadgeCheck, CheckCircle2, Lock, Play, Plus, ShieldAlert, Sparkles, XCircle } from 'lucide-react'
import { api } from '../api'
import type { ModelConfig, ProductionTrace, Project, ReleaseGate, Suite } from '../types'
import { Button, Card, EmptyState, ErrorMsg, Field, Input, Modal, PageHeader, Select, StatusBadge, Textarea } from '../components/ui'
import { useToast } from '../components/Toast'
import { fmtDateTime } from '../lib/format'

export default function Gates() {
  const toast = useToast()
  const [projects, setProjects] = useState<Project[]>([])
  const [models, setModels] = useState<ModelConfig[]>([])
  const [suites, setSuites] = useState<Suite[]>([])
  const [gates, setGates] = useState<ReleaseGate[]>([])
  const [traces, setTraces] = useState<ProductionTrace[]>([])
  const [selectedModel, setSelectedModel] = useState<Record<string, string>>({})
  const [evalBusy, setEvalBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  const [gateModal, setGateModal] = useState(false)
  const [gateForm, setGateForm] = useState({ name: '', suite_id: '', min_pass_rate: 85, max_critical_findings: 0, max_high_findings: 0 })
  const [traceModal, setTraceModal] = useState(false)
  const [traceForm, setTraceForm] = useState({
    model_name: 'prod-wealth-copilot',
    prompt: 'Client sarah.connor@familyoffice.io (SSN 123-45-6789, key AKIAIOSFODNN7EXAMPLE) asked: What is 19.65% minus 18.40% in basis points?',
    response: 'It increased by 1.25 bps.',
    expected_answer_hint: '125 bps',
    flagged_reason: 'quant_unit_error',
  })
  const [promotingId, setPromotingId] = useState<string | null>(null)

  const load = () => {
    Promise.all([
      api<Project[]>('/api/projects'),
      api<ModelConfig[]>('/api/models'),
      api<Suite[]>('/api/test-suites'),
      api<ReleaseGate[]>('/api/gates'),
      api<ProductionTrace[]>('/api/traces'),
    ]).then(([p, m, s, g, t]) => {
      setProjects(p)
      setModels(m)
      setSuites(s)
      setGates(g)
      setTraces(t)
      setGateForm((f) => ({ ...f, suite_id: f.suite_id || s[0]?.id || '' }))
      const map: Record<string, string> = {}
      g.forEach((gate) => { map[gate.id] = gate.last_model_id || m[0]?.id || '' })
      setSelectedModel((prev) => ({ ...map, ...prev }))
    }).catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }
  useEffect(load, [])

  const createGate = async () => {
    const pid = projects[0]?.id
    if (!pid || !gateForm.name.trim()) return
    try {
      await api('/api/gates', {
        method: 'POST',
        body: JSON.stringify({ project_id: pid, ...gateForm }),
      })
      setGateModal(false)
      setGateForm((f) => ({ ...f, name: '' }))
      toast.success('Release gate created', 'Evaluate any candidate model against this policy.')
      load()
    } catch (e) {
      toast.error('Could not create gate', e instanceof Error ? e.message : String(e))
    }
  }

  const evaluateGate = async (gate: ReleaseGate) => {
    const mid = selectedModel[gate.id] || models[0]?.id
    if (!mid) return
    setEvalBusy(gate.id)
    try {
      const updated = await api<ReleaseGate>(`/api/gates/${gate.id}/evaluate`, {
        method: 'POST',
        body: JSON.stringify({ model_id: mid, execute_fresh: true }),
      })
      toast[updated.last_verdict === 'approved' ? 'success' : 'error'](
        updated.last_verdict === 'approved' ? 'Release Gate APPROVED' : 'Release Gate BLOCKED',
        `Signed SHA-256 certificate issued for ${updated.last_certificate.model_name}.`
      )
      load()
    } catch (e) {
      toast.error('Gate evaluation failed', e instanceof Error ? e.message : String(e))
    } finally {
      setEvalBusy(null)
    }
  }

  const ingestTrace = async () => {
    const pid = projects[0]?.id
    if (!pid || !traceForm.prompt.trim()) return
    try {
      const created = await api<ProductionTrace>('/api/traces', {
        method: 'POST',
        body: JSON.stringify({ project_id: pid, ...traceForm }),
      })
      setTraceModal(false)
      toast.success('Trace ingested & scrubbed', `Redacted ${created.redactions_applied.length} sensitive entity type(s) automatically.`)
      load()
    } catch (e) {
      toast.error('Trace ingest failed', e instanceof Error ? e.message : String(e))
    }
  }

  const promoteTrace = async (t: ProductionTrace) => {
    const sid = suites[0]?.id
    if (!sid) {
      toast.error('No suite found', 'Create a suite first to receive promoted regression cases.')
      return
    }
    setPromotingId(t.id)
    try {
      await api(`/api/traces/${t.id}/promote`, {
        method: 'POST',
        body: JSON.stringify({ suite_id: sid, category: 'factual_accuracy', severity: 'critical' }),
      })
      toast.success('Promoted to Test Suite', `Locked into "${suites[0].name}" so this production failure never recurs.`)
      load()
    } catch (e) {
      toast.error('Promotion failed', e instanceof Error ? e.message : String(e))
    } finally {
      setPromotingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Evidence & governance"
        title="Release Gates & Production Trace Flywheel"
        description="Enforce automated CISO/Board deployment sign-off certificates and convert DLP-scrubbed production failures into permanent regression cases."
        actions={<>
          <Button variant="outline" onClick={() => setTraceModal(true)}><Sparkles className="h-4 w-4" /> Ingest DLP trace</Button>
          <Button onClick={() => setGateModal(true)}><Plus className="h-4 w-4" /> New release gate</Button>
        </>}
      />
      {error && <ErrorMsg text={error} onRetry={load} />}

      {/* Release Gates */}
      <Card title={`Automated Deployment Release Gates — ${gates.length}`} icon={<BadgeCheck className="h-4 w-4" />}>
        {gates.length === 0 ? (
          <EmptyState title="No release gates configured" hint="Create a release policy requiring minimum pass rates, zero Critical/High OWASP findings, and SHA-256 audit integrity." action={<Button onClick={() => setGateModal(true)}><Plus className="h-4 w-4" /> Create gate</Button>} />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {gates.map((g) => {
              const cert = g.last_certificate
              const approved = g.last_verdict === 'approved'
              const blocked = g.last_verdict === 'blocked'
              return (
                <div key={g.id} className="rounded-2xl border border-line bg-ink-850 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-display text-base font-semibold text-slate-50">{g.name}</h3>
                      <p className="mt-0.5 text-xs text-mute">
                        Min pass ≥ {g.min_pass_rate}% · Max Critical ≤ {g.max_critical_findings} · Max High ≤ {g.max_high_findings}
                      </p>
                    </div>
                    <StatusBadge status={approved ? 'PASS' : blocked ? 'FAIL' : 'pending'} />
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Select
                      value={selectedModel[g.id] ?? ''}
                      onChange={(e) => setSelectedModel({ ...selectedModel, [g.id]: e.target.value })}
                      className="flex-1"
                      aria-label="Candidate model for gate"
                    >
                      {models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </Select>
                    <Button size="sm" loading={evalBusy === g.id} onClick={() => evaluateGate(g)}>
                      <Play className="h-3.5 w-3.5" /> Evaluate gate
                    </Button>
                  </div>

                  {cert?.certificate_sha256 && (
                    <div className={`mt-4 rounded-xl border p-3.5 text-xs ${
                      approved ? 'border-emerald-400/25 bg-emerald-500/5' : 'border-rose-400/30 bg-rose-500/5'
                    }`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className={`flex items-center gap-1.5 font-semibold uppercase tracking-wider ${approved ? 'text-emerald-300' : 'text-rose-300'}`}>
                          {approved ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                          {g.last_verdict.toUpperCase()} — {cert.model_name}
                        </span>
                        <span className="font-mono text-[9.5px] text-mute-dim">{fmtDateTime(g.last_evaluated_at)}</span>
                      </div>
                      <p className="mt-1.5 flex items-center gap-1.5 font-mono text-[10px] text-mute">
                        <Lock className="h-3 w-3 text-brand-300" />
                        cert sha256: {cert.certificate_sha256.slice(0, 24)}…
                      </p>
                      {cert.checks && (
                        <div className="mt-2.5 grid grid-cols-2 gap-1.5 font-mono text-[10px]">
                          {cert.checks.map((chk) => (
                            <div key={chk.check} className="rounded border border-line bg-ink-900 px-2 py-1 text-slate-300">
                              <span className={chk.passed ? 'text-emerald-300' : 'text-rose-300'}>{chk.passed ? '✓' : '✗'}</span>{' '}
                              {chk.check}: {chk.actual}
                            </div>
                          ))}
                        </div>
                      )}
                      {cert.blocking_reasons && cert.blocking_reasons.length > 0 && (
                        <ul className="mt-2 space-y-1 text-[11px] text-rose-200">
                          {cert.blocking_reasons.map((r) => <li key={r}>• {r}</li>)}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* Production DLP Trace Flywheel */}
      <Card pad={false} title={`Production Trace DLP Flywheel — ${traces.length} sanitized traces`} icon={<ShieldAlert className="h-4 w-4" />}>
        {traces.length === 0 ? (
          <EmptyState title="No production traces ingested" hint="Stream production thumbs-downs or guardrail triggers via POST /api/traces — PII and cloud keys are scrubbed automatically." />
        ) : (
          <ul className="divide-y divide-line">
            {traces.map((t) => (
              <li key={t.id} className="flex flex-col justify-between gap-3 px-5 py-4 lg:flex-row lg:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded border border-rose-400/30 bg-rose-500/10 px-2 py-0.5 font-mono text-[9.5px] uppercase text-rose-200">
                      {t.flagged_reason}
                    </span>
                    <span className="font-mono text-[10px] text-mute">{t.model_name}</span>
                    {t.redactions_applied.map((tag) => (
                      <span key={tag} className="rounded border border-emerald-400/25 bg-emerald-400/10 px-1.5 py-0.5 font-mono text-[9px] text-emerald-300">
                        DLP:{tag}
                      </span>
                    ))}
                  </div>
                  <p className="mt-1.5 font-mono text-xs text-slate-200">{t.prompt_redacted}</p>
                  <p className="mt-1 text-xs text-mute">
                    Actual: <span className="text-rose-300">{t.response_redacted}</span>
                    {t.expected_answer_hint && <> · Expected oracle: <span className="text-emerald-300">{t.expected_answer_hint}</span></>}
                  </p>
                </div>
                <div className="shrink-0">
                  {t.promoted_case_id ? (
                    <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-3 py-1.5 font-mono text-[10px] text-emerald-300">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Locked in suite
                    </span>
                  ) : (
                    <Button size="sm" variant="outline" loading={promotingId === t.id} onClick={() => promoteTrace(t)}>
                      Promote to Test Case <ArrowUpRight className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Create Gate Modal */}
      <Modal open={gateModal} onClose={() => setGateModal(false)} title="Create Deployment Release Gate"
        footer={<>
          <Button variant="ghost" onClick={() => setGateModal(false)}>Cancel</Button>
          <Button onClick={createGate} disabled={!gateForm.name.trim()}>Create gate</Button>
        </>}>
        <div className="space-y-4">
          <Field label="Gate policy name">
            <Input autoFocus value={gateForm.name} onChange={(e) => setGateForm({ ...gateForm, name: e.target.value })} placeholder="e.g. Quant Memo Production Gate" />
          </Field>
          <Field label="Required reliability suite">
            <Select value={gateForm.suite_id} onChange={(e) => setGateForm({ ...gateForm, suite_id: e.target.value })}>
              {suites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Min pass %">
              <Input type="number" value={gateForm.min_pass_rate} onChange={(e) => setGateForm({ ...gateForm, min_pass_rate: Number(e.target.value) })} />
            </Field>
            <Field label="Max Critical">
              <Input type="number" value={gateForm.max_critical_findings} onChange={(e) => setGateForm({ ...gateForm, max_critical_findings: Number(e.target.value) })} />
            </Field>
            <Field label="Max High">
              <Input type="number" value={gateForm.max_high_findings} onChange={(e) => setGateForm({ ...gateForm, max_high_findings: Number(e.target.value) })} />
            </Field>
          </div>
        </div>
      </Modal>

      {/* Ingest DLP Trace Modal */}
      <Modal open={traceModal} onClose={() => setTraceModal(false)} wide title="Ingest Production Trace (Auto-DLP Redaction)"
        footer={<>
          <Button variant="ghost" onClick={() => setTraceModal(false)}>Cancel</Button>
          <Button onClick={ingestTrace}>Scrub PII & Ingest</Button>
        </>}>
        <div className="space-y-4">
          <p className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3 text-xs text-emerald-200">
            Emails, US SSNs, Luhn credit cards, phone numbers, JWTs, private keys, and AWS AKIA keys are automatically scrubbed on the server before database persistence.
          </p>
          <Field label="Raw production prompt (try including sample PII/keys to test DLP)">
            <Textarea rows={3} value={traceForm.prompt} onChange={(e) => setTraceForm({ ...traceForm, prompt: e.target.value })} />
          </Field>
          <Field label="Observed failed response">
            <Input value={traceForm.response} onChange={(e) => setTraceForm({ ...traceForm, response: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Expected correct oracle">
              <Input value={traceForm.expected_answer_hint} onChange={(e) => setTraceForm({ ...traceForm, expected_answer_hint: e.target.value })} />
            </Field>
            <Field label="Flagged reason">
              <Input value={traceForm.flagged_reason} onChange={(e) => setTraceForm({ ...traceForm, flagged_reason: e.target.value })} />
            </Field>
          </div>
        </div>
      </Modal>
    </div>
  )
}
