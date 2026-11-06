import { Link } from 'react-router-dom'

/** The AEGIS shield mark — gradient stroke + star core. */
export function ShieldMark({ className = 'h-8 w-8', id = 'brandGrad' }: { className?: string; id?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={`${className} shrink-0 drop-shadow-[0_0_12px_rgba(34,211,238,0.35)]`} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="8" y1="6" x2="56" y2="58" gradientUnits="userSpaceOnUse">
          <stop stopColor="#22d3ee" /><stop offset=".55" stopColor="#38bdf8" /><stop offset="1" stopColor="#818cf8" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill="#0b101c" />
      <path d="M32 7l17 6.4v13.2c0 12-7.1 22.6-17 29.4-9.9-6.8-17-17.4-17-29.4V13.4L32 7z" fill="none" stroke={`url(#${id})`} strokeWidth="4.6" strokeLinejoin="round" />
      <path d="M32 21.5l3.5 7.1 7.8 1.1-5.7 5.5 1.4 7.8L32 40.8l-7 3.7 1.4-7.8-5.7-5.5 7.8-1.1L32 21.5z" fill={`url(#${id})`} />
    </svg>
  )
}

export default function Brand({ compact, to = '/' }: { compact?: boolean; to?: string }) {
  return (
    <Link to={to} className="group flex items-center gap-2.5 outline-none" aria-label="AEGIS AI LAB home">
      <span className="transition-transform duration-500 ease-spring group-hover:rotate-[8deg] group-hover:scale-105">
        <ShieldMark />
      </span>
      {!compact && (
        <span className="leading-tight">
          <span className="block font-display text-[17px] font-bold tracking-tight text-slate-50">AEGIS<span className="text-brand">&nbsp;AI&nbsp;LAB</span></span>
          <span className="block font-mono text-[8.5px] uppercase tracking-[0.3em] text-mute-dim">Reliability · Security</span>
        </span>
      )}
    </Link>
  )
}
