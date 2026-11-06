import { useEffect, useRef, useState, type ReactNode } from 'react'

/** True when the user prefers reduced motion. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

/**
 * Scroll-triggered reveal. Children fade+rise into view the first time
 * they intersect the viewport. `delay` (ms) staggers siblings.
 */
export function Reveal({ children, delay = 0, className = '', as: Tag = 'div' }: {
  children: ReactNode; delay?: number; className?: string; as?: 'div' | 'section' | 'li' | 'span'
}) {
  const ref = useRef<HTMLElement | null>(null)
  const reduced = usePrefersReducedMotion()
  useEffect(() => {
    const el = ref.current
    if (!el || reduced) { el?.classList.add('is-visible'); return }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible')
            io.unobserve(entry.target)
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [reduced])
  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <Tag ref={ref as any} className={`reveal ${reduced ? 'is-visible' : ''} ${className}`}
         style={{ ['--reveal-delay' as string]: `${delay}ms` }}>
      {children}
    </Tag>
  )
}

/**
 * Animated number that counts from 0 to `value` when it enters the viewport.
 * Honors prefers-reduced-motion by rendering the final value immediately.
 */
export function CountUp({ value, duration = 1400, decimals = 0, suffix = '', prefix = '', className = '' }: {
  value: number; duration?: number; decimals?: number; suffix?: string; prefix?: string; className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const reduced = usePrefersReducedMotion()
  const [display, setDisplay] = useState(0)
  const started = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const run = () => {
      if (started.current) return
      started.current = true
      if (reduced) { setDisplay(value); return }
      const t0 = performance.now()
      const tick = (t: number) => {
        const p = Math.min(1, (t - t0) / duration)
        const eased = 1 - Math.pow(1 - p, 4)
        setDisplay(value * eased)
        if (p < 1) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { run(); io.disconnect() }
    }, { threshold: 0.4 })
    io.observe(el)
    return () => io.disconnect()
  }, [value, duration, reduced])

  const rendered = decimals > 0 ? display.toFixed(decimals) : Math.round(display).toLocaleString()
  return <span ref={ref} className={className}>{prefix}{rendered}{suffix}</span>
}
