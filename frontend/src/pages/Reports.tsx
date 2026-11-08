import { useEffect, useState } from 'react'
import { Archive, FileJson, FileText, FileSpreadsheet, Download, Plus, Trash2, FileBarChart, Fingerprint } from 'lucide-react'
import { api } from '../api'
import type { ReportItem, Run } from '../types'
import { Button, Card, EmptyState, ErrorMsg, Field, Input, PageHeader, Select } from '../components/ui'
import { useToast } from '../components/Toast'
import { fmtDateTime, downloadPath } from '../lib/format'

const FORMATS = [
  { id: 'bundle', label: 'Evidence Bundle (.zip)', hint: 'Signed SHA-256 archive (manifest + JSON + CSV + offline verifier)', icon: <Archive className="h-4 w-4" /> },
  { id: 'pdf', label: 'Executive Compliance PDF', hint: 'Boardroom & EU AI Act / OWASP / MITRE ATLAS dossier', icon: <FileText className="h-4 w-4" /> },
  { id: 'json', label: 'JSON', hint: 'Machine-readable provenance & evidence payload', icon: <FileJson className="h-4 w-4" /> },
  { id: 'csv', label: 'CSV', hint: 'Spreadsheet-friendly case results table', icon: <FileSpreadsheet className="h-4 w-4" /> },
] as const

export default function Reports() {
  const toast = useToast()
  const [runs, setRuns] = useState<Run[]>([])
  const [reports, setReports] = useState<ReportItem[]>([])
  const [runId, setRunId] = useState('')
  const [title, setTitle] = useState('AEGIS Compliance & Reliability Dossier')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const load = () => {
    api<Run[]>('/api/evaluations').then((r) => {
      setRuns(r)
      setRunId((cur) => cur || r[0]?.id || '')
    }).catch(() => {})
    api<ReportItem[]>('/api/reports').then(setReports).catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }
  useEffect(load, [])

  const generate = async (format: string) => {
    const run = runs.find((r) => r.id === runId)
    if (!run) {
      toast.error('Select a run', 'Generate evidence from a stored run.')
      return
    }
    setBusy(format)
    setError('')
    try {
      const projects = await api<{ id: string }[]>('/api/projects')
      await api('/api/reports', {
        method: 'POST',
        body: JSON.stringify({ project_id: run.project_id || projects[0]?.id, run_id: run.id, format, title: title.trim() || 'AEGIS Evaluation Report' }),
      })
      toast.success(`${format.toUpperCase()} artifact signed`, 'SHA-256 checksum recorded — download anytime.')
      load()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      toast.error('Report generation failed', msg)
    } finally {
      setBusy(null)
    }
  }

  const remove = async (r: ReportItem) => {
    try {
      await api(`/api/reports/${r.id}`, { method: 'DELETE' })
      setReports((rs) => rs.filter((x) => x.id !== r.id))
      toast.success('Report deleted', r.title)
    } catch (e) {
      toast.error('Could not delete report', e instanceof Error ? e.message : String(e))
    }
  }

  const runLabel = (r: Run) => `${fmtDateTime(r.started_at)} · ${r.kind}${typeof r.summary?.pass_rate === 'number' ? ` · ${(r.summary.pass_rate as number).toFixed(1)}% pass` : ''}`

  return (
    <div>
      <PageHeader
        eyebrow="Evidence & governance"
        title="Reports & Signed Evidence Bundles"
        description="Export persisted runs as cryptographically signed .airsbundle.zip archives, Executive Compliance PDFs, JSON, or CSV — built strictly from stored rows."
      />
      {error && <div className="mb-4"><ErrorMsg text={error} onRetry={load} /></div>}

      <div className="grid gap-4 xl:grid-cols-5">
        <Card title="Generate signed artifact" icon={<Plus className="h-3.5 w-3.5" />} className="xl:col-span-2">
          <div className="space-y-4">
            <Field label="Source run">
              <Select value={runId} onChange={(e) => setRunId(e.target.value)}>
                {runs.length === 0 && <option value="">No runs stored yet</option>}
                {runs.map((r) => <option key={r.id} value={r.id}>{runLabel(r)}</option>)}
              </Select>
            </Field>
            <Field label="Report / Dossier title">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="AEGIS Evaluation Report" />
            </Field>
            <div className="grid gap-2">
              {FORMATS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => generate(f.id)}
                  disabled={busy !== null || runs.length === 0}
                  className="group flex items-center gap-4 rounded-xl border border-line bg-ink-800 px-4 py-3 text-left transition hover:border-brand-400/40 hover:bg-brand-grad-soft disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-lg border border-line bg-ink-850 text-brand-300">{busy === f.id ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-400 border-t-transparent" /> : f.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold text-slate-100">Export {f.label}</span>
                    <span className="mt-0.5 block text-[11px] text-mute">{f.hint}</span>
                  </span>
                  <Download className="h-4 w-4 text-mute-dim transition group-hover:text-brand-300" />
                </button>
              ))}
            </div>
          </div>
        </Card>

        <Card pad={false} className="xl:col-span-3" title={`Generated artifacts — ${reports.length}`} icon={<FileBarChart className="h-3.5 w-3.5" />}>
          {reports.length === 0 ? (
            <EmptyState
              icon={<FileText className="h-6 w-6" />}
              title="No reports generated"
              hint="Export an Evidence Bundle (.zip) for external due-diligence auditors or PDF for board reviews."
            />
          ) : (
            <ul className="divide-y divide-line">
              {reports.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5 transition hover:bg-white/[0.02]">
                  <span className="grid h-10 w-12 shrink-0 place-items-center rounded-lg border border-line bg-ink-850 font-mono text-[9px] font-bold uppercase tracking-wider text-brand-300">
                    {r.format}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-slate-100">{r.title}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-2 font-mono text-[9px] uppercase tracking-[0.16em] text-mute-dim">
                      <span>{fmtDateTime(r.created_at)} · run {r.run_id.slice(0, 8)}</span>
                      {r.sha256_hash && (
                        <span className="inline-flex items-center gap-1 text-emerald-300" title={`Artifact SHA-256: ${r.sha256_hash}`}>
                          <Fingerprint className="h-3 w-3" /> {r.sha256_hash.slice(0, 12)}…
                        </span>
                      )}
                    </p>
                  </div>
                  <button onClick={() => downloadPath(`/api/reports/${r.id}/download`)} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[11px] font-medium text-slate-200 transition hover:border-brand-400/40 hover:text-brand-200" aria-label={`Download ${r.title}`}>
                    <Download className="h-3.5 w-3.5" /> Download
                  </button>
                  <button onClick={() => remove(r)} className="rounded-lg p-2 text-mute-dim transition hover:bg-rose-500/10 hover:text-rose-300" aria-label={`Delete report ${r.title}`}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
