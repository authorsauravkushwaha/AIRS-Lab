import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ShieldCheck, ShieldAlert, Play, Info } from 'lucide-react'
import { api } from '../api'
import type { Finding, ModelConfig } from '../types'
import { Button, Card, EmptyState, ErrorMsg, PageHeader, Select, StatusBadge } from '../components/ui'
import { useToast } from '../components/Toast'
import { fmtDateTime } from '../lib/format'

const SEVERITIES = ['all', 'critical', 'high', 'medium', 'low', 'info'] as const
const OUTCOMES = ['all', 'fail', 'uncertain', 'pass'] as const

export default function Security() {
  const toast = useToast()
  const [models, setModels] = useState<ModelConfig[]>([])
  const [modelId, setModelId] = useState('')
  const [findings, setFindings] = useState<Finding[]>([])
  const [severity, setSeverity] = useState<(typeof SEVERITIES)[number]>('all')
  const [outcome, setOutcome] = useState<(typeof OUTCOMES)[number]>('all')
  const [owaspFilter, setOwaspFilter] = useState('all')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadFindings = () => {
    api<Finding[]>('/api/security/findings')
      .then(setFindings)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }
  useEffect(() => {
    api<ModelConfig[]>('/api/models').then((m) => {
      setModels(m)
      setModelId((cur) => cur || m.find((x) => x.enabled)?.id || m[0]?.id || '')
    }).catch(() => {})
    loadFindings()
  }, [])

  const run = async () => {
    const model = models.find((m) => m.id === modelId)
    if (!model) return
    setBusy(true)
    setError('')
    try {
      const res = await api<{ run_id: string; findings: number; failures: number }>('/api/security/run', {
        method: 'POST',
        body: JSON.stringify({ project_id: model.project_id, model_id: model.id }),
      })
      toast.success('Security suite complete', `${res.findings} checks (${res.failures} failures) mapped to OWASP & MITRE ATLAS.`)
      loadFindings()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      toast.error('Security run failed', msg)
    } finally {
      setBusy(false)
    }
  }

  const owaspTags = useMemo(() => {
    const set = new Set<string>()
    findings.forEach((f) => { if (f.owasp_id) set.add(f.owasp_id) })
    return ['all', ...Array.from(set).sort()]
  }, [findings])

  const filtered = useMemo(() => findings.filter((f) =>
    (severity === 'all' || f.severity === severity) &&
    (outcome === 'all' || f.outcome === outcome) &&
    (owaspFilter === 'all' || f.owasp_id === owaspFilter)
  ), [findings, severity, outcome, owaspFilter])

  const failCount = findings.filter((f) => f.outcome === 'fail').length

  return (
    <div>
      <PageHeader
        eyebrow="Evidence & governance"
        title="Security Lab (OWASP LLM Top 10 & MITRE ATLAS)"
        description="Adversarial & defensive probes: Base64/Hex/ROT13 exfiltration, indirect document injection, cloud IAM/PII DLP, system-prompt extraction, live tool-hijack, and XSS/SSRF/Unicode smuggling."
      />

      <div className="mb-4 flex items-start gap-3 rounded-xl border border-brand-400/15 bg-brand-grad-soft px-4 py-3 text-[12px] leading-relaxed text-brand-200/90">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p><span className="font-semibold text-brand-200">Safe inert markers + taxonomy mapping.</span> Every finding carries OWASP LLM Top 10 (2025), MITRE ATLAS, and CWE identifiers ready for CISO/SOC export. Tool calls are inspected against allowlists — never executed.</p>
      </div>
      {error && <div className="mb-4"><ErrorMsg text={error} onRetry={loadFindings} /></div>}

      <div className="grid gap-4 xl:grid-cols-5">
        <Card title="Run adversarial & defensive suite" icon={<ShieldCheck className="h-3.5 w-3.5" />} className="xl:col-span-2">
          <div className="space-y-4">
            <Select value={modelId} onChange={(e) => setModelId(e.target.value)} aria-label="Model to test">
              {models.map((m) => <option key={m.id} value={m.id}>{m.name} · {m.provider}</option>)}
            </Select>
            <Button className="w-full" loading={busy} disabled={!modelId || busy} onClick={run}>
              <Play className="h-4 w-4" /> {busy ? 'Running security tests…' : 'Run security suite'}
            </Button>
            <ul className="space-y-1.5 text-[11.5px] text-mute">
              {[
                'LLM01: Document override & Base64/ROT13 exfiltration',
                'LLM02: Cloud IAM (AKIA), SSN, Credit Card & Secret DLP',
                'LLM05: XSS, Cloud Metadata SSRF (169.254.169.254) & Unicode tags',
                'LLM06: Live agent wire-transfer tool hijack & policy gates',
                'LLM07: Verbatim sentinel system-prompt extraction',
              ].map((t) => (
                <li key={t} className="flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-brand-400" />{t}</li>
              ))}
            </ul>
          </div>
        </Card>

        <Card title="Findings overview" icon={<ShieldAlert className="h-3.5 w-3.5" />} className="xl:col-span-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Total', value: findings.length, tone: 'text-slate-100' },
              { label: 'Failures', value: failCount, tone: failCount > 0 ? 'text-rose-300' : 'text-emerald-300' },
              { label: 'Critical', value: findings.filter((f) => f.severity === 'critical').length, tone: 'text-rose-200' },
              { label: 'High', value: findings.filter((f) => f.severity === 'high').length, tone: 'text-orange-300' },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-line bg-ink-850 px-3 py-4 text-center">
                <p className={`font-display text-2xl font-semibold leading-none ${s.tone}`}>{s.value}</p>
                <p className="mt-2 font-mono text-[8.5px] uppercase tracking-[0.2em] text-mute-dim">{s.label}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[11px] leading-relaxed text-mute">Passing probes prove resistance against tested attack classes — pair with automated Release Gates (/gates) to block regressions in CI/CD.</p>
        </Card>
      </div>

      <Card pad={false} className="mt-4" title={`Findings — ${filtered.length} of ${findings.length}`} icon={<ShieldAlert className="h-3.5 w-3.5" />}
            action={
              <div className="flex flex-wrap items-center gap-2">
                <Select value={owaspFilter} onChange={(e) => setOwaspFilter(e.target.value)} className="w-auto" aria-label="Filter OWASP">
                  {owaspTags.map((t) => <option key={t} value={t}>{t === 'all' ? 'All OWASP categories' : t}</option>)}
                </Select>
                <Select value={severity} onChange={(e) => setSeverity(e.target.value as typeof severity)} className="w-auto" aria-label="Filter severity">
                  {SEVERITIES.map((s) => <option key={s} value={s}>{s === 'all' ? 'All severities' : s}</option>)}
                </Select>
                <Select value={outcome} onChange={(e) => setOutcome(e.target.value as typeof outcome)} className="w-auto" aria-label="Filter outcome">
                  {OUTCOMES.map((o) => <option key={o} value={o}>{o === 'all' ? 'All outcomes' : o}</option>)}
                </Select>
              </div>
            }>
        {loading ? (
          <p className="py-10 text-center text-sm text-mute">Loading findings…</p>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<ShieldCheck className="h-6 w-6" />}
            title={findings.length === 0 ? 'No findings recorded yet' : 'Nothing matches these filters'}
            hint={findings.length === 0 ? 'Run the suite to populate OWASP & MITRE ATLAS evidence.' : 'Loosen the OWASP, severity, or outcome filters above.'}
            action={findings.length === 0 ? <Button onClick={run} disabled={busy || !modelId}><Play className="h-4 w-4" /> Run security suite</Button> : undefined}
          />
        ) : (
          <ul className="divide-y divide-line">
            {filtered.map((f) => {
              const isOpen = !!expanded[f.id]
              return (
                <li key={f.id}>
                  <button className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition hover:bg-white/[0.02]" onClick={() => setExpanded((e) => ({ ...e, [f.id]: !isOpen }))} aria-expanded={isOpen}>
                    <StatusBadge status={f.severity} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-slate-100">{f.test_name}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-2 font-mono text-[9px] uppercase tracking-[0.16em] text-mute-dim">
                        <span>{f.category.replace(/_/g, ' ')}</span>
                        {f.owasp_id && <span className="rounded border border-brand-400/25 bg-brand-grad-soft px-1.5 py-0.5 text-brand-200">{f.owasp_id}</span>}
                        {f.mitre_atlas_id && <span className="rounded border border-line bg-ink-800 px-1.5 py-0.5 text-slate-300">{f.mitre_atlas_id}</span>}
                        {f.cwe_id && <span>{f.cwe_id}</span>}
                        <span>· {fmtDateTime(f.created_at)}</span>
                      </span>
                    </span>
                    <StatusBadge status={f.outcome} />
                    <ChevronDown className={`h-4 w-4 shrink-0 text-mute-dim transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isOpen && (
                    <div className="border-t border-line bg-ink-850/50 px-6 py-4 text-[12px] leading-relaxed">
                      <div className="grid gap-4 lg:grid-cols-2">
                        <div>
                          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-mute-dim">Test input</p>
                          <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-ink-900 p-3 font-mono text-[10px] text-slate-300">{f.test_input}</pre>
                          <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.2em] text-mute-dim">Model response</p>
                          <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-ink-900 p-3 font-mono text-[10px] text-slate-300">{f.model_response}</pre>
                        </div>
                        <div className="space-y-3">
                          <div>
                            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-mute-dim">Expected</p>
                            <p className="mt-1 text-slate-300">{f.expected_behavior}</p>
                          </div>
                          <div>
                            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-mute-dim">Actual</p>
                            <p className="mt-1 text-slate-300">{f.actual_behavior}</p>
                          </div>
                          {f.mitigation && (
                            <div className="rounded-xl border border-brand-400/15 bg-brand-grad-soft p-3">
                              <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-brand-300">Engineering Mitigation</p>
                              <p className="mt-1 text-brand-100/90">{f.mitigation}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </div>
  )
}
