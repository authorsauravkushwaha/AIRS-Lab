import type { ButtonHTMLAttributes, ReactNode, SelectHTMLAttributes, InputHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { AlertTriangle, Inbox, Loader2, RefreshCw } from 'lucide-react'

/* ---------- Buttons ---------- */
type ButtonVariant = 'primary' | 'ghost' | 'outline' | 'danger' | 'subtle'
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  loading?: boolean
  size?: 'sm' | 'md'
}
const buttonStyles: Record<ButtonVariant, string> = {
  primary:
    'text-ink-950 bg-brand-grad shadow-glow-sm hover:brightness-110 active:brightness-95 font-semibold',
  ghost:
    'text-mute hover:text-slate-100 hover:bg-white/5',
  outline:
    'text-slate-200 border border-line-strong hover:border-brand-400/40 hover:text-white hover:bg-white/[0.04]',
  danger:
    'text-rose-200 border border-rose-400/30 bg-rose-500/10 hover:bg-rose-500/20 hover:border-rose-400/50',
  subtle:
    'text-slate-300 bg-ink-800 border border-line hover:border-line-strong hover:text-white',
}
export function Button({ variant = 'primary', loading, size = 'md', className = '', children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-xl text-sm transition-all duration-150 disabled:opacity-45 disabled:cursor-not-allowed ${
        size === 'sm' ? 'px-3 py-1.5 text-[13px]' : 'px-4 py-2.5'
      } ${buttonStyles[variant]} ${className}`}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  )
}

/* ---------- Panels & cards ---------- */
export function Card({ title, icon, action, children, className = '', pad = true }: {
  title?: ReactNode; icon?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; pad?: boolean
}) {
  return (
    <section className={`panel ${pad ? 'p-5 sm:p-6' : ''} ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-4">
          <h3 className="flex items-center gap-2.5 font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-mute">
            {icon && <span className="text-brand-400">{icon}</span>}
            {title}
          </h3>
          {action && <div className="flex items-center gap-2">{action}</div>}
        </div>
      )}
      {children}
    </section>
  )
}

/* ---------- Badges ---------- */
const badgeStyles: Record<string, string> = {
  PASS: 'text-emerald-300 bg-emerald-400/10 border-emerald-400/25', pass: 'text-emerald-300 bg-emerald-400/10 border-emerald-400/25',
  FAIL: 'text-rose-300 bg-rose-400/10 border-rose-400/25', fail: 'text-rose-300 bg-rose-400/10 border-rose-400/25',
  UNCERTAIN: 'text-amber-300 bg-amber-400/10 border-amber-400/25', uncertain: 'text-amber-300 bg-amber-400/10 border-amber-400/25',
  ERROR: 'text-rose-300 bg-rose-400/10 border-rose-400/25', 'NOT RUN': 'text-slate-400 bg-slate-400/10 border-slate-400/20',
  completed: 'text-emerald-300 bg-emerald-400/10 border-emerald-400/25', running: 'text-sky-300 bg-sky-400/10 border-sky-400/25',
  error: 'text-rose-300 bg-rose-400/10 border-rose-400/25', pending: 'text-slate-400 bg-slate-400/10 border-slate-400/20',
  ok: 'text-emerald-300 bg-emerald-400/10 border-emerald-400/25', unknown: 'text-slate-400 bg-slate-400/10 border-slate-400/20',
  critical: 'text-rose-200 bg-rose-500/15 border-rose-400/35', high: 'text-orange-300 bg-orange-400/10 border-orange-400/30',
  medium: 'text-amber-300 bg-amber-400/10 border-amber-400/25', low: 'text-sky-300 bg-sky-400/10 border-sky-400/25',
  info: 'text-slate-300 bg-slate-400/10 border-slate-400/20',
}
export function StatusBadge({ status }: { status: string }) {
  const style = badgeStyles[status] ?? 'text-slate-300 bg-white/5 border-line-strong'
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] ${style}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {status}
    </span>
  )
}

/* ---------- Form controls ---------- */
export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.12em] text-mute">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-[11px] text-mute-dim">{hint}</span>}
    </label>
  )
}
export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`field ${props.className ?? ''}`} />
}
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`field ${props.className ?? ''}`} />
}
export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`field ${props.className ?? ''}`} />
}

/* ---------- Empty / error / loading states ---------- */
export function EmptyState({ title, hint, action, icon }: { title: string; hint?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl border border-line bg-ink-800 text-brand-400">
        {icon ?? <Inbox className="h-6 w-6" />}
      </div>
      <p className="font-display text-base font-semibold text-slate-100">{title}</p>
      {hint && <p className="max-w-sm text-sm text-mute">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
export function ErrorMsg({ text, onRetry }: { text: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-xl border border-rose-400/25 bg-rose-500/10 p-4 text-sm text-rose-200">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">Something went wrong</p>
        <p className="mt-0.5 break-words text-rose-200/80">{text}</p>
      </div>
      {onRetry && (
        <button onClick={onRetry} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-400/30 px-2.5 py-1.5 text-xs text-rose-200 transition hover:bg-rose-500/10">
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </button>
      )}
    </div>
  )
}
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />
}
export function PageHeader({ eyebrow, title, description, actions }: {
  eyebrow?: string; title: string; description?: string; actions?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 animate-fade-up">
      <div>
        {eyebrow && <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.28em] text-brand-400/90">{eyebrow}</p>}
        <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-50 sm:text-[28px]">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm leading-relaxed text-mute">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

/* ---------- Radial progress ring ---------- */
export function Ring({ value, size = 120, stroke = 10, label, tone = 'brand' }: {
  value: number | null; size?: number; stroke?: number; label?: string; tone?: 'brand' | 'emerald' | 'amber' | 'rose'
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = value === null ? 0 : Math.max(0, Math.min(100, value))
  const dash = (pct / 100) * c
  const strokeColor = tone === 'emerald' ? '#34d399' : tone === 'amber' ? '#fbbf24' : tone === 'rose' ? '#fb7185' : 'url(#ringGrad)'
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#22d3ee" /><stop offset="55%" stopColor="#38bdf8" /><stop offset="100%" stopColor="#818cf8" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(148,184,255,0.10)" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={strokeColor} strokeWidth={stroke} fill="none"
                strokeLinecap="round" strokeDasharray={`${dash} ${c}`}
                style={{ transition: 'stroke-dasharray .8s cubic-bezier(.22,1,.36,1)' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-[22px] font-semibold leading-none text-slate-50">
          {value === null ? '—' : value.toFixed(1)}
        </span>
        <span className="mt-1 font-mono text-[8.5px] uppercase tracking-[0.2em] text-mute">{label ?? 'pass %'}</span>
      </div>
    </div>
  )
}

/* ---------- Simple modal ---------- */
export function Modal({ open, onClose, title, children, footer, wide }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className={`relative m-0 w-full ${wide ? 'max-w-3xl' : 'max-w-xl'} max-h-[92vh] overflow-y-auto rounded-t-2xl border border-line-strong bg-panel-raised p-6 shadow-glow sm:m-6 sm:rounded-2xl animate-fade-up`}>
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="font-display text-lg font-semibold text-slate-50">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-lg border border-line p-1.5 text-mute transition hover:text-white">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        {children}
        {footer && <div className="mt-6 flex flex-wrap items-center justify-end gap-2">{footer}</div>}
      </div>
    </div>
  )
}
