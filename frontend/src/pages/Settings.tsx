import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Database, FileText, FlaskConical, Lock, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react'
import { api } from '../api'
import type { AuditChainStatus, AuditEvent, SystemConfig } from '../types'
import { Button, Card, ErrorMsg, Modal, PageHeader } from '../components/ui'
import { useToast } from '../components/Toast'
import { fmtDateTime } from '../lib/format'

function eventTone(eventType: string): string {
  if (eventType.includes('deleted') || eventType.includes('cleared') || eventType.includes('blocked')) return 'bg-rose-400'
  if (eventType.startsWith('evaluation') || eventType.startsWith('security') || eventType.includes('approved')) return 'bg-emerald-400'
  if (eventType.startsWith('report') || eventType.startsWith('trace')) return 'bg-sky-400'
  return 'bg-slate-500'
}

export default function SettingsPage() {
  const toast = useToast()
  const [config, setConfig] = useState<SystemConfig | null>(null)
  const [audit, setAudit] = useState<AuditEvent[]>([])
  const [chain, setChain] = useState<AuditChainStatus | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState('')
  const [clearOpen, setClearOpen] = useState(false)
  const [clearing, setClearing] = useState(false)

  const refresh = useCallback(() => {
    api<SystemConfig>('/api/system/config').then((cfg) => {
      setConfig(cfg)
      if (cfg.audit_chain) setChain(cfg.audit_chain)
    }).catch((e) => setError(e instanceof Error ? e.message : String(e)))
    api<AuditEvent[]>('/api/system/audit?limit=25').then(setAudit).catch(() => {})
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const verifyChain = async () => {
    setVerifying(true)
    try {
      const res = await api<AuditChainStatus>('/api/system/audit/verify')
      setChain(res)
      toast[res.valid ? 'success' : 'error'](
        res.valid ? 'Audit Hash-Chain Verified' : 'Audit Tampering Detected!',
        res.valid ? `${res.checked_events} sequential SHA-256 events verified from GENESIS.` : 'Chain link hash mismatch.'
      )
    } catch (e) {
      toast.error('Verification failed', e instanceof Error ? e.message : String(e))
    } finally {
      setVerifying(false)
    }
  }

  const clearCache = async () => {
    try {
      const res = await api<{ deleted_entries: number }>('/api/system/cache', { method: 'DELETE' })
      toast.info('Response cache cleared', `${res.deleted_entries} cached entry(s) purged.`)
      refresh()
    } catch (e) {
      toast.error('Could not clear cache', e instanceof Error ? e.message : String(e))
    }
  }

  const clearRuns = async () => {
    setClearing(true)
    try {
      const res = await api<{ deleted_runs: number }>('/api/system/runs', { method: 'DELETE' })
      toast.success('Run history cleared', `${res.deleted_runs} run(s) and their evidence were removed. Reports were kept.`)
      setClearOpen(false)
      refresh()
    } catch (e) {
      toast.error('Could not clear run history', e instanceof Error ? e.message : String(e))
    } finally {
      setClearing(false)
    }
  }

  const stats = config
    ? [
        { icon: <FlaskConical className="h-4 w-4" />, label: 'Evaluation runs', value: config.counts.runs },
        { icon: <ShieldCheck className="h-4 w-4" />, label: 'Stored results', value: config.counts.results },
        { icon: <AlertTriangle className="h-4 w-4" />, label: 'Security findings', value: config.counts.findings },
        { icon: <FileText className="h-4 w-4" />, label: 'Signed reports', value: config.counts.reports },
      ]
    : []

  const rows: [string, string][] = config
    ? [
        ['Service & Version', `${config.service} · v${config.version} (evaluator ${config.evaluator_version ?? '2.0.0'})`],
        ['Database backend', config.database],
        ['DLP secret redaction', config.secret_redaction_enabled ? 'Enabled (SSN, Email, Card, AWS IAM, JWT)' : 'Disabled'],
        ['OpenAI provider key', config.openai_key_configured ? `Configured (${config.openai_key_env})` : `Not configured — set ${config.openai_key_env}`],
        ['Anthropic provider key', config.anthropic_key_configured ? `Configured (${config.anthropic_key_env})` : `Not configured — set ${config.anthropic_key_env ?? 'AEGIS_ANTHROPIC_API_KEY'}`],
        ['Ollama base URL', config.ollama_base_url],
        ['Response cache entries', String(config.counts.cached_responses ?? 0)],
        ['Single-origin SPA', config.frontend_served ? 'Serving built frontend/dist' : 'API mode'],
      ]
    : []

  return (
    <div>
      <PageHeader
        eyebrow="System"
        title="Settings & Cryptographic Audit Chain"
        description="Non-secret runtime introspection and the tamper-evident SHA-256 hash-chained workspace ledger."
        actions={<Button variant="outline" size="sm" loading={verifying} onClick={verifyChain}><Lock className="h-4 w-4" /> Verify SHA-256 audit chain</Button>}
      />
      {error && <div className="mb-4"><ErrorMsg text={error} onRetry={refresh} /></div>}

      {chain && (
        <div className={`mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-5 py-3.5 text-xs ${
          chain.valid ? 'border-emerald-400/25 bg-emerald-500/5 text-emerald-200' : 'border-rose-400/35 bg-rose-500/10 text-rose-200'
        }`}>
          <span className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {chain.valid
              ? `Tamper-evident ledger intact — ${chain.checked_events} sequential events cryptographically verified from GENESIS.`
              : 'WARNING: Hash-chain verification failed — historical audit event was altered!'}
          </span>
          <span className="font-mono text-[10px] text-mute">head sha256: {chain.head_hash.slice(0, 20)}…</span>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-5">
        <Card title="Runtime configuration" icon={<Database className="h-4 w-4" />} className="xl:col-span-3">
          <dl className="divide-y divide-line text-sm">
            {rows.map(([k, v]) => (
              <div key={k} className="grid grid-cols-3 gap-4 py-2.5">
                <dt className="text-[11px] uppercase tracking-wider text-mute-dim">{k}</dt>
                <dd className="col-span-2 break-all font-mono text-[12px] text-slate-200">{v}</dd>
              </div>
            ))}
            {!config && <p className="py-6 text-center text-sm text-mute">Loading configuration…</p>}
          </dl>
        </Card>

        <Card title="Stored evidence" icon={<FlaskConical className="h-4 w-4" />} className="xl:col-span-2"
              action={<Button variant="ghost" size="sm" onClick={clearCache}><RefreshCw className="h-3.5 w-3.5" /> Purge cache</Button>}>
          <div className="grid grid-cols-2 gap-3">
            {stats.map((s) => (
              <div key={s.label} className="rounded-xl border border-line bg-ink-800/70 p-3.5">
                <div className="flex items-center gap-2 text-mute">{s.icon}<span className="text-[10px] uppercase tracking-wider">{s.label}</span></div>
                <p className="mt-1.5 font-display text-2xl font-semibold text-slate-50">{s.value.toLocaleString()}</p>
              </div>
            ))}
            {!config && <p className="col-span-2 py-6 text-center text-sm text-mute">Loading counts…</p>}
          </div>
        </Card>
      </div>

      <Card title="Hash-chained audit trail" icon={<Lock className="h-4 w-4" />} className="mt-5"
            action={<span className="font-mono text-[9px] uppercase tracking-widest text-mute-dim">last 25 signed events</span>}>
        {audit.length === 0 ? (
          <p className="py-6 text-center text-sm text-mute">No activity recorded yet.</p>
        ) : (
          <ul className="divide-y divide-line text-[13px]">
            {audit.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <span className="flex items-center gap-2">
                  <span className={`h-1.5 w-1.5 rounded-full ${eventTone(e.event_type)}`} />
                  {e.seq !== undefined && <span className="font-mono text-[9.5px] text-mute-dim">#{e.seq}</span>}
                  <span className="font-mono text-[10.5px] uppercase tracking-wider text-slate-300">{e.event_type.replace(/\./g, ' ')}</span>
                </span>
                <span className="min-w-0 flex-1 truncate text-slate-400" title={e.detail}>{e.detail || '—'}</span>
                {e.entry_hash && (
                  <span className="hidden rounded border border-line bg-ink-850 px-1.5 py-0.5 font-mono text-[9px] text-brand-300 sm:inline" title={`SHA-256: ${e.entry_hash}`}>
                    {e.entry_hash.slice(0, 10)}…
                  </span>
                )}
                <time className="font-mono text-[10px] text-mute-dim">{fmtDateTime(e.created_at)}</time>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Danger zone" icon={<AlertTriangle className="h-4 w-4" />} className="mt-5 border-rose-500/30" pad>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-rose-200">Clear run history</p>
            <p className="mt-0.5 text-xs text-mute">Deletes every evaluation run and its stored results. Projects, models, cases and signed reports are kept.</p>
          </div>
          <Button variant="danger" className="shrink-0" onClick={() => setClearOpen(true)}>
            <Trash2 className="h-4 w-4" /> Clear run history
          </Button>
        </div>
      </Card>

      <Modal open={clearOpen} onClose={() => setClearOpen(false)} title="Clear all run history?"
        footer={<>
          <Button variant="ghost" onClick={() => setClearOpen(false)}>Cancel</Button>
          <Button variant="danger" loading={clearing} onClick={clearRuns}>Delete run history</Button>
        </>}>
        <p className="text-sm leading-relaxed text-slate-300">Every evaluation run, its per-case results and findings will be permanently deleted. Projects, model configurations, test cases and already-generated reports are preserved. This cannot be undone.</p>
      </Modal>
    </div>
  )
}
