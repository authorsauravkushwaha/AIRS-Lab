import { Route, Routes } from 'react-router-dom'
import AppShell from './layout/AppShell'
import { ToastProvider } from './components/Toast'
import Dashboard from './pages/Dashboard'
import Projects from './pages/Projects'
import Models from './pages/Models'
import Suites from './pages/Suites'
import Cases from './pages/Cases'
import RunEval from './pages/RunEval'
import Reliability from './pages/Reliability'
import Security from './pages/Security'
import Compare from './pages/Compare'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import NotFound from './pages/NotFound'

export default function App() {
  return (
    <ToastProvider>
      <AppShell>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/models" element={<Models />} />
          <Route path="/suites" element={<Suites />} />
          <Route path="/cases" element={<Cases />} />
          <Route path="/run" element={<RunEval />} />
          <Route path="/reliability" element={<Reliability />} />
          <Route path="/security" element={<Security />} />
          <Route path="/compare" element={<Compare />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AppShell>
    </ToastProvider>
  )
}
