import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { CheckCircle2, Info, X, XCircle } from 'lucide-react'

type ToastTone = 'success' | 'error' | 'info'
interface Toast { id: number; tone: ToastTone; title: string; detail?: string }
interface ToastContextValue {
  toast: (tone: ToastTone, title: string, detail?: string) => void
  success: (title: string, detail?: string) => void
  error: (title: string, detail?: string) => void
  info: (title: string, detail?: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)
let toastId = 0

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>')
  return ctx
}

const toneStyles: Record<ToastTone, { ring: string; icon: ReactNode }> = {
  success: { ring: 'border-emerald-400/30', icon: <CheckCircle2 className="h-5 w-5 text-emerald-400" /> },
  error: { ring: 'border-rose-400/30', icon: <XCircle className="h-5 w-5 text-rose-400" /> },
  info: { ring: 'border-sky-400/30', icon: <Info className="h-5 w-5 text-sky-400" /> },
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), [])
  const toast = useCallback((tone: ToastTone, title: string, detail?: string) => {
    const id = ++toastId
    setToasts((t) => [...t.slice(-3), { id, tone, title, detail }])
    window.setTimeout(() => dismiss(id), 5200)
  }, [dismiss])

  const value = useMemo<ToastContextValue>(() => ({
    toast,
    success: (title, detail) => toast('success', title, detail),
    error: (title, detail) => toast('error', title, detail),
    info: (title, detail) => toast('info', title, detail),
  }), [toast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed bottom-5 right-5 z-[60] flex w-[min(92vw,380px)] flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} role="status"
               className={`pointer-events-auto flex items-start gap-3 rounded-xl border bg-panel-raised/95 p-3.5 shadow-panel backdrop-blur-md animate-fade-up ${toneStyles[t.tone].ring}`}>
            <span className="mt-0.5 shrink-0">{toneStyles[t.tone].icon}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium leading-snug text-slate-100">{t.title}</p>
              {t.detail && <p className="mt-1 break-words text-xs leading-relaxed text-mute">{t.detail}</p>}
            </div>
            <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="shrink-0 rounded-md p-1 text-mute transition hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
