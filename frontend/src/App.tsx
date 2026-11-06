import { NavLink, Route, Routes } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import Dashboard from './pages/Dashboard'
import Projects from './pages/Projects'
import Models from './pages/Models'
import Cases from './pages/Cases'
import RunEval from './pages/RunEval'
import Reliability from './pages/Reliability'
import Security from './pages/Security'
import Compare from './pages/Compare'
import Reports from './pages/Reports'

const NAV = [
  ['/', 'Overview'],
  ['/projects', 'Projects'],
  ['/models', 'Model Management'],
  ['/suites', 'Test Suites'],
  ['/cases', 'Test Cases'],
  ['/run', 'Run Evaluations'],
  ['/reliability', 'Reliability Lab'],
  ['/security', 'Security Lab'],
  ['/compare', 'Model Comparison'],
  ['/reports', 'Reports'],
  ['/settings', 'Settings'],
] as const

function Placeholder({ title }: { title: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-graphite-900 p-8">
      <h2 className="text-xl font-semibold text-slate-100">{title}</h2>
      <p className="mt-2 text-sm text-slate-400">Module coming in a later phase.</p>
    </div>
  )
}

export default function App() {
  return (
    <div className="flex min-h-screen">
      <aside className="w-60 shrink-0 border-r border-slate-800 bg-graphite-900 p-4">
        <div className="mb-6 flex items-center gap-2 px-2">
          <ShieldCheck className="h-6 w-6 text-accent" />
          <span className="text-lg font-bold text-slate-100">AEGIS AI LAB</span>
        </div>
        <nav className="space-y-1">
          {NAV.map(([path, label]) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/'}
              className={({ isActive }) =>
                `block rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? 'bg-graphite-800 font-medium text-accent'
                    : 'text-slate-400 hover:bg-graphite-800 hover:text-slate-200'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-8">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/models" element={<Models />} />
          <Route path="/suites" element={<Placeholder title="Test Suites" />} />
          <Route path="/cases" element={<Cases />} />
          <Route path="/run" element={<RunEval />} />
          <Route path="/reliability" element={<Reliability />} />
          <Route path="/security" element={<Security />} />
          <Route path="/compare" element={<Compare />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/settings" element={<Placeholder title="Settings" />} />
        </Routes>
      </main>
    </div>
  )
}
