import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  Boxes, ChevronRight, FileText, FlaskConical, GitCompareArrows, Globe, Layers, LayoutDashboard,
  Menu, Play, Search, Settings, ShieldCheck, TestTube2, FolderKanban, X, ExternalLink,
} from 'lucide-react'
import CommandPalette from '../components/CommandPalette'
import Brand from '../components/Brand'
import { api } from '../api'
import type { Health } from '../types'

const NAV_SECTIONS: { label: string; items: { to: string; label: string; icon: ReactNode }[] }[] = [
  {
    label: 'Workspace',
    items: [
      { to: '/overview', label: 'Overview', icon: <LayoutDashboard className="h-4 w-4" /> },
      { to: '/projects', label: 'Projects', icon: <FolderKanban className="h-4 w-4" /> },
      { to: '/models', label: 'Model Management', icon: <Boxes className="h-4 w-4" /> },
    ],
  },
  {
    label: 'Test engineering',
    items: [
      { to: '/suites', label: 'Test Suites', icon: <Layers className="h-4 w-4" /> },
      { to: '/cases', label: 'Test Cases', icon: <TestTube2 className="h-4 w-4" /> },
      { to: '/run', label: 'Run Evaluations', icon: <Play className="h-4 w-4" /> },
    ],
  },
  {
    label: 'Evidence labs',
    items: [
      { to: '/reliability', label: 'Reliability Lab', icon: <FlaskConical className="h-4 w-4" /> },
      { to: '/security', label: 'Security Lab', icon: <ShieldCheck className="h-4 w-4" /> },
      { to: '/compare', label: 'Model Comparison', icon: <GitCompareArrows className="h-4 w-4" /> },
      { to: '/reports', label: 'Reports', icon: <FileText className="h-4 w-4" /> },
    ],
  },
]

const ALL_NAV = NAV_SECTIONS.flatMap((s) => s.items)

export default function AppShell({ children }: { children: ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [health, setHealth] = useState<Health | null>(null)
  const [healthFailed, setHealthFailed] = useState(false)
  const location = useLocation()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey
      if (meta && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    setSidebarOpen(false)
    api<Health>('/api/health').then(setHealth).catch(() => setHealthFailed(true))
  }, [location.pathname])

  const current = ALL_NAV.find((n) => n.to === location.pathname)?.label ?? 'Workspace'

  const navLink = (item: { to: string; label: string; icon: ReactNode }) => (
    <NavLink
      key={item.to}
      to={item.to}
      end={item.to === '/overview'}
      className={({ isActive }) =>
        `group relative flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] transition-all duration-200 ease-out-expo ${
          isActive ? 'bg-brand-grad-soft text-slate-50 shadow-[inset_0_1px_0_rgba(255,255,255,.06)]' : 'text-mute hover:bg-white/[0.04] hover:text-slate-100'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-grad shadow-glow-sm" />}
          <span className={`transition-transform duration-300 group-hover:scale-110 ${isActive ? 'text-brand-300' : 'text-mute-dim group-hover:text-brand-300'}`}>{item.icon}</span>
          <span className="flex-1">{item.label}</span>
        </>
      )}
    </NavLink>
  )

  const sidebar = (
    <aside className="flex h-full w-[248px] shrink-0 flex-col border-r border-line bg-ink-900/80 backdrop-blur-xl">
      <div className="border-b border-line px-5 py-4">
        <Brand />
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4" aria-label="Primary">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="mb-1.5 px-3 font-mono text-[9px] font-medium uppercase tracking-[0.26em] text-mute-dim">{section.label}</p>
            <div className="space-y-0.5">{section.items.map(navLink)}</div>
          </div>
        ))}
        <div>
          <p className="mb-1.5 px-3 font-mono text-[9px] font-medium uppercase tracking-[0.26em] text-mute-dim">System</p>
          {navLink({ to: '/settings', label: 'Settings', icon: <Settings className="h-4 w-4" /> })}
        </div>
      </nav>
      <div className="space-y-2.5 border-t border-line p-4">
        <NavLink to="/"
                 className="flex items-center justify-between rounded-xl border border-line bg-panel px-3 py-2.5 text-[11px] text-mute transition hover:border-line-strong hover:text-slate-100">
          <span className="flex items-center gap-2"><Globe className="h-3.5 w-3.5 text-brand-400" /> Public website</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </NavLink>
        <div className="rounded-xl border border-line bg-panel p-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-mute">System status</span>
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
              healthFailed ? 'border-amber-400/30 text-amber-300' : 'border-emerald-400/25 text-emerald-300'
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full animate-pulse-dot ${healthFailed ? 'bg-amber-400' : 'bg-emerald-400'}`} />
              {healthFailed ? 'Degraded' : 'Operational'}
            </span>
          </div>
          <a href="https://github.com/authorsauravkushwaha/AIRS-Lab" target="_blank" rel="noreferrer"
             className="mt-2.5 flex items-center justify-between rounded-lg border border-line px-2.5 py-2 text-[11px] text-mute transition hover:border-line-strong hover:text-slate-100">
            Source &amp; docs
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <p className="mt-2.5 text-center font-mono text-[9px] text-mute-dim">AEGIS AI LAB · v{health?.version ?? '1.0.0'}</p>
        </div>
      </div>
    </aside>
  )

  return (
    <div className="app-backdrop noise relative flex h-screen overflow-hidden">
      <a href="#main-content"
         className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-xl focus:border focus:border-line-strong focus:bg-panel-raised focus:px-4 focus:py-2.5 focus:text-sm focus:text-slate-100 focus:shadow-glow">
        Skip to content
      </a>
      <div className="app-grid pointer-events-none absolute inset-x-0 top-0 h-[560px]" aria-hidden="true" />

      {/* Desktop sidebar */}
      <div className="relative z-10 hidden lg:flex">{sidebar}</div>

      {/* Mobile drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 top-0 h-full animate-fade-in">{sidebar}</div>
        </div>
      )}

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-line bg-ink-950/70 px-4 backdrop-blur-xl sm:px-6">
          <div className="flex min-w-0 items-center gap-2 text-[13px]">
            <button className="rounded-lg border border-line p-1.5 text-mute hover:text-white lg:hidden" onClick={() => setSidebarOpen(true)} aria-label="Open navigation">
              {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
            <span className="hidden font-mono text-[10px] uppercase tracking-[0.24em] text-mute-dim sm:inline">Workbench</span>
            <ChevronRight className="hidden h-3.5 w-3.5 text-mute-dim sm:block" />
            <span className="truncate font-medium text-slate-100">{current}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-2 rounded-full border border-line bg-panel px-3 py-1 font-mono text-[9.5px] uppercase tracking-[0.18em] text-mute md:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />
              Local-first · Mock provider
            </span>
            <button
              onClick={() => setPaletteOpen(true)}
              className="group flex items-center gap-2 rounded-xl border border-line bg-panel py-1.5 pl-3 pr-2 text-[12px] text-mute transition hover:border-line-strong hover:text-slate-100 hover:shadow-glow-sm"
              aria-label="Open command palette"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Search…</span>
              <kbd className="rounded border border-line bg-ink-800 px-1.5 py-0.5 font-mono text-[9px] text-brand-300">⌘K</kbd>
            </button>
          </div>
        </header>

        {/* Main content */}
        <main id="main-content" className="min-w-0 flex-1 overflow-y-auto">
          <div key={location.pathname} className="mx-auto w-full max-w-[1480px] px-4 py-6 sm:px-6 lg:px-8 animate-fade-up">
            {children}
          </div>
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  )
}
