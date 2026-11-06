import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight, Boxes, FileText, FlaskConical, GitCompareArrows, Layers, LayoutDashboard,
  Search, Settings, ShieldCheck, TestTube2, FolderKanban, Play,
} from 'lucide-react'

interface Command {
  id: string; label: string; hint: string; icon: ReactNode; path: string; keywords: string
}
const COMMANDS: Command[] = [
  { id: 'overview', label: 'Go to Overview', hint: 'Navigate', icon: <LayoutDashboard className="h-4 w-4" />, path: '/', keywords: 'home dashboard metrics' },
  { id: 'projects', label: 'Go to Projects', hint: 'Navigate', icon: <FolderKanban className="h-4 w-4" />, path: '/projects', keywords: 'workspace new project' },
  { id: 'models', label: 'Go to Model Management', hint: 'Navigate', icon: <Boxes className="h-4 w-4" />, path: '/models', keywords: 'model provider mock openai ollama connection' },
  { id: 'suites', label: 'Go to Test Suites', hint: 'Navigate', icon: <Layers className="h-4 w-4" />, path: '/suites', keywords: 'suite collection cases' },
  { id: 'cases', label: 'Go to Test Cases', hint: 'Navigate', icon: <TestTube2 className="h-4 w-4" />, path: '/cases', keywords: 'case prompt expected oracle' },
  { id: 'run', label: 'Run a new evaluation', hint: 'Action', icon: <Play className="h-4 w-4" />, path: '/run', keywords: 'run evaluation execute suite benchmark' },
  { id: 'reliability', label: 'Go to Reliability Lab', hint: 'Navigate', icon: <FlaskConical className="h-4 w-4" />, path: '/reliability', keywords: 'reliability results evidence failures' },
  { id: 'security', label: 'Run Security Lab', hint: 'Navigate', icon: <ShieldCheck className="h-4 w-4" />, path: '/security', keywords: 'security injection leakage tool findings' },
  { id: 'compare', label: 'Go to Model Comparison', hint: 'Navigate', icon: <GitCompareArrows className="h-4 w-4" />, path: '/compare', keywords: 'compare bake-off models pass rate' },
  { id: 'reports', label: 'Go to Reports', hint: 'Navigate', icon: <FileText className="h-4 w-4" />, path: '/reports', keywords: 'report export pdf csv json download' },
  { id: 'settings', label: 'Go to Settings', hint: 'Navigate', icon: <Settings className="h-4 w-4" />, path: '/settings', keywords: 'settings config audit system danger zone' },
]

export default function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return COMMANDS
    return COMMANDS.filter((c) => `${c.label} ${c.keywords}`.toLowerCase().includes(q))
  }, [query])

  useEffect(() => {
    if (open) {
      setQuery('')
      setIndex(0)
    }
  }, [open])

  useEffect(() => { setIndex(0) }, [results.length])

  if (!open) return null

  const go = (path: string) => { onClose(); navigate(path) }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh]" role="dialog" aria-modal="true" aria-label="Command palette">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="relative w-[min(94vw,560px)] overflow-hidden rounded-2xl border border-line-strong bg-panel-raised shadow-glow animate-fade-up">
        <div className="flex items-center gap-3 border-b border-line px-4 py-3.5">
          <Search className="h-4 w-4 text-brand-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setIndex((i) => Math.min(i + 1, results.length - 1)) }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setIndex((i) => Math.max(i - 1, 0)) }
              else if (e.key === 'Enter' && results[index]) { e.preventDefault(); go(results[index].path) }
            }}
            placeholder="Type a command or page…"
            aria-label="Search commands"
            className="w-full bg-transparent text-[15px] text-slate-100 outline-none placeholder-mute-dim"
          />
          <kbd className="rounded-md border border-line bg-ink-800 px-1.5 py-0.5 font-mono text-[10px] text-mute">ESC</kbd>
        </div>
        <ul className="max-h-80 overflow-y-auto p-2">
          {results.length === 0 && <li className="px-3 py-6 text-center text-sm text-mute">No matches for “{query}”.</li>}
          {results.map((c, i) => (
            <li key={c.id}>
              <button
                onMouseEnter={() => setIndex(i)}
                onClick={() => go(c.path)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                  i === index ? 'bg-brand-grad-soft text-slate-50' : 'text-slate-300'
                }`}
              >
                <span className={i === index ? 'text-brand-300' : 'text-mute'}>{c.icon}</span>
                <span className="flex-1 text-sm">{c.label}</span>
                <span className="font-mono text-[9px] uppercase tracking-widest text-mute-dim">{c.hint}</span>
                <ArrowRight className={`h-3.5 w-3.5 ${i === index ? 'text-brand-300' : 'text-transparent'}`} />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
