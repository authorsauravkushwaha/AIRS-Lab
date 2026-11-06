import { Link } from 'react-router-dom'
import { LayoutDashboard } from 'lucide-react'
import { Button } from '../components/ui'

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center animate-fade-up">
      <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-brand-400/90">404</p>
      <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-slate-50 sm:text-5xl">
        This evidence page <span className="text-brand">doesn’t exist</span>
      </h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-mute">
        The route you tried isn’t part of the lab. Head back to the overview and keep shipping with evidence.
      </p>
      <Link to="/" className="mt-6">
        <Button><LayoutDashboard className="h-4 w-4" /> Back to Overview</Button>
      </Link>
    </div>
  )
}
