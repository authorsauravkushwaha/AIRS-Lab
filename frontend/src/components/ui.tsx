import type { ReactNode } from 'react'

export function Card({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-graphite-900 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  )
}

export function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    PASS: 'bg-emerald-500/15 text-emerald-400', pass: 'bg-emerald-500/15 text-emerald-400',
    FAIL: 'bg-red-500/15 text-red-400', fail: 'bg-red-500/15 text-red-400',
    UNCERTAIN: 'bg-amber-500/15 text-amber-400', uncertain: 'bg-amber-500/15 text-amber-400',
    ERROR: 'bg-red-500/15 text-red-400', completed: 'bg-emerald-500/15 text-emerald-400',
    critical: 'bg-red-600/20 text-red-300', high: 'bg-orange-500/15 text-orange-400',
    medium: 'bg-amber-500/15 text-amber-400', low: 'bg-sky-500/15 text-sky-400', info: 'bg-slate-500/15 text-slate-400',
  }
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${colors[status] ?? 'bg-slate-500/15 text-slate-300'}`}>
      {status}
    </span>
  )
}

export function Empty({ text }: { text: string }) {
  return <p className="py-6 text-center text-sm text-slate-500">{text}</p>
}

export function ErrorMsg({ text }: { text: string }) {
  return <p className="rounded border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">{text}</p>
}
