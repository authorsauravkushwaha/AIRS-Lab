import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Database, FileText, FlaskConical, Info, ShieldCheck, Trash2 } from 'lucide-react'
import { api } from '../api'
import type { AuditEvent, SystemConfig } from '../types'
import { Button, Card, ErrorMsg, Modal, PageHeader } from '../components/ui'
import { useToast } from '../components/Toast'
import { fmtDateTime } from '../lib/format'

function eventTone(eventType: string): string {
  if (eventType.includes('deleted') || eventType.includes('cleared')) return 'bg-rose-400'
  if (eventType.startsWith('evaluation') || eventType.startsWith('security')) return 'bg-emerald-400'
  if (eventType.startsWith('report')) return 'bg-sky-400'
  return 'bg-slate-500'
}

export default function SettingsPage() {
  const toast = useToast()
  const [config, setConfig] = useState<SystemConfig | null>(null)
  const [audit, setAudit] = useState<AuditEvent[]>([])
  const [error, setError] = useState('')
  const [clearOpen, setClearOpen] = useState(false)
  const [clearing, setClearing] = useState(false)

  const refresh = useCallback(() => {
    api<SystemConfig>('/api/system/config').then(setConfig).catch((e) => setError(e instanceof Error ? e.message : String(e)))
    api<AuditEvent[]>('/api/system/audit?limit=20').then(setAudit).catch(() => {})
  }, [])

  useEffect(() => { refresh() }, [refresh])

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
        { icon: <FileText className="h-4 w-4" />, label: 'Generated reports', value: config.counts.reports },
      ]
    : []

  const rows: [string, string][] = config
    ? [
        ['Service', config.service],
        ['Version', config.version],
        ['Database backend', config.database],
        ['Secret redaction', config.secret_redaction_enabled ? 'Enabled' : 'Disabled'],
        ['Live provider key', config.openai_key_configured ? `Configured (env: ${config.openai_key_env})` : `Not configured — set ${config.openai_key_env}`],
        ['Ollama base URL', config.ollama_base_url],
        ['Local SPA serving', config.frontend_served ? 'Serving frontend/dist' : 'API only (use the Vite dev server)'],
      ]
    : []

  return (
    <div>
      <PageHeader
        eyebrow="System"
        title="Settings"
        description="Runtime configuration and the append-only audit trail. Secrets are never shown or stored in the browser."
      />
      {error && <div className="mb-4"><ErrorMsg text={error} onRetry={refresh} /></div>}

      <div className="grid gap-5 xl:grid-cols-5">
        <Card title="Runtime configuration" icon={<Database className="h-4 w-4" />} className="xl:col-span-3">
          <dl className="divide-y divide-line text-sm">
            {rows.map(([k, v]) => (
              <div key={k} className="grid grid-cols-3 gap-4 py-3">
                <dt className="text-[11px] uppercase tracking-wider text-mute-dim">{k}</dt>
                <dd className="col-span-2 break-all font-mono text-[12px] text-slate-200">{v}</dd>
              </div>
            ))}
            {!config && <p className="py-6 text-center text-sm text-mute">Loading configuration…</p>}
          </dl>
        </Card>

        <Card title="Stored evidence" icon={<FlaskConical className="h-4 w-4" />} className="xl:col-span-2">
          <div className="grid grid-cols-2 gap-3">
            {stats.map((s) => (
              <div key={s.label} className="rounded-xl border border-line bg-ink-800/70 p-3.5">
                <div className="flex items-center gap-2 text-mute">{s.icon}<span className="text-[10px] uppercase tracking-wider">{s.label}</span></div>
                <p className="mt-1.5 font-display text-2xl font-semibold text-slate-50">{s.value.toLocaleString()}</p>
              </div>
            ))}
            {!config && <p className="col-span-2 py-6 text-center text-sm text-mute">Loading counts…</p>}
          </div>
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-sky-400/20 bg-sky-400/5 p-3 text-xs leading-relaxed text-sky-200/80">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <p>Evidence lives in the configured database and never leaves this machine. Mock-provider results demonstrate plumbing — they are labeled synthetic and are not real model performance.</p>
          </div>
        </Card>
      </div>

      <Card title="Audit trail" icon={<Database className="h-4 w-4" />} className="mt-5"
            action={<span className="font-mono text-[9px] uppercase tracking-widest text-mute-dim">last 20 events</span>}>
        {audit.length === 0 ? (
          <p className="py-6 text-center text-sm text-mute">No activity recorded yet.</p>
        ) : (
          <ul className="divide-y divide-line text-[13px]">
            {audit.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <span className="flex items-center gap-2">
                  <span className={`h-1.5 w-1.5 rounded-full ${eventTone(e.event_type)}`} />
                  <span className="font-mono text-[10.5px] uppercase tracking-wider text-slate-300">{e.event_type.replace(/\./g, ' ')}</span>
                </span>
                <span className="min-w-0 flex-1 truncate text-slate-400" title={e.detail}>{e.detail || '—'}</span>
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
            <p className="mt-0.5 text-xs text-mute">Deletes every evaluation run and its stored results. Projects, models, cases and existing reports are kept.</p>
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
