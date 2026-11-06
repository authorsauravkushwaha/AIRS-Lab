import { useEffect, useState } from 'react'
import { FileJson, FileText, FileSpreadsheet, Download, Plus, Trash2, FileBarChart } from 'lucide-react'
import { api } from '../api'
import type { ReportItem, Run } from '../types'
import { Button, Card, EmptyState, ErrorMsg, Field, Input, PageHeader, Select } from '../components/ui'
import { useToast } from '../components/Toast'
import { fmtDateTime, downloadPath } from '../lib/format'

const FORMATS = [
  { id: 'json', label: 'JSON', hint: 'Machine-readable evidence bundle', icon: <FileJson className="h-4 w-4" /> },
  { id: 'csv', label: 'CSV', hint: 'Spreadsheet-friendly results table', icon: <FileSpreadsheet className="h-4 w-4" /> },
  { id: 'pdf', label: 'PDF', hint: 'Boardroom-ready summary document', icon: <FileText className="h-4 w-4" /> },
] as const

export default function Reports() {
  const toast = useToast()
  const [runs, setRuns] = useState<Run[]>([])
  const [reports, setReports] = useState<ReportItem[]>([])
  const [runId, setRunId] = useState('')
  const [title, setTitle] = useState('AEGIS Evaluation Report')
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
      // Resolve the run's project via the first project (runs carry project_id server-side).
      const projects = await api<{ id: string }[]>('/api/projects')
      await api('/api/reports', {
        method: 'POST',
        body: JSON.stringify({ project_id: projects[0]?.id, run_id: run.id, format, title: title.trim() || 'AEGIS Evaluation Report' }),
      })
      toast.success(`${format.toUpperCase()} report generated`, 'Stored locally — download anytime.')
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
        eyebrow="Evidence labs"
        title="Reports"
        description="Export any stored run as JSON, CSV or PDF evidence. Reports are built only from persisted rows — nothing is re-executed."
      />
      {error && <div className="mb-4"><ErrorMsg text={error} onRetry={load} /></div>}

      <div className="grid gap-4 xl:grid-cols-5">
        {/* Generator */}
        <Card title="Generate report" icon={<Plus className="h-3.5 w-3.5" />} className="xl:col-span-2">
          <div className="space-y-4">
            <Field label="Source run">
              <Select value={runId} onChange={(e) => setRunId(e.target.value)}>
                {runs.length === 0 && <option value="">No runs stored yet</option>}
                {runs.map((r) => <option key={r.id} value={r.id}>{runLabel(r)}</option>)}
              </Select>
            </Field>
            <Field label="Report title">
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

        {/* Existing reports */}
        <Card pad={false} className="xl:col-span-3" title={`Generated reports — ${reports.length}`} icon={<FileBarChart className="h-3.5 w-3.5" />}>
          {reports.length === 0 ? (
            <EmptyState
              icon={<FileText className="h-6 w-6" />}
              title="No reports generated"
              hint="Pick a stored run on the left and export it — JSON for pipelines, CSV for spreadsheets, PDF for reviews."
            />
          ) : (
            <ul className="divide-y divide-line">
              {reports.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5 transition hover:bg-white/[0.02]">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-line bg-ink-850 font-mono text-[9px] font-bold uppercase tracking-wider text-brand-300">
                    {r.format}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-slate-100">{r.title}</p>
                    <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-mute-dim">{fmtDateTime(r.created_at)} · run {r.run_id.slice(0, 8)}</p>
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
