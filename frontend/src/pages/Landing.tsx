import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight, ArrowUpRight, BadgeCheck, Boxes, FileDown, FlaskConical, FolderKanban,
  Gauge, GitCompareArrows, HardDrive, Layers, Play, ScanSearch, ShieldCheck, Sparkles,
  TerminalSquare, TestTube2, Timer,
} from 'lucide-react'
import { api } from '../api'
import type { Overview } from '../types'
import { Button, Ring } from '../components/ui'
import Brand, { ShieldMark } from '../components/Brand'
import { CountUp, Reveal } from '../components/motion'

/* ================================================================== */
/*  Nav                                                                */
/* ================================================================== */

function LandingNav() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return (
    <header className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${scrolled ? 'glass border-b border-line py-3' : 'py-5'}`}>
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 sm:px-8">
        <Brand />
        <nav className="hidden items-center gap-7 text-[13px] text-mute md:flex" aria-label="Site">
          {[
            ['Platform', '#platform'],
            ['Capabilities', '#capabilities'],
            ['How it works', '#workflow'],
            ['Method', '#method'],
          ].map(([label, href]) => (
            <a key={href} href={href} className="transition hover:text-slate-100">{label}</a>
          ))}
          <a href="https://github.com/authorsauravkushwaha/AIRS-Lab" target="_blank" rel="noreferrer"
             className="flex items-center gap-1 transition hover:text-slate-100">
            Source <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </nav>
        <Link to="/overview">
          <Button size="sm" className="group">
            Open workbench
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Button>
        </Link>
      </div>
    </header>
  )
}

/* ================================================================== */
/*  Hero: headline + animated evaluation-console visual                */
/* ================================================================== */

const HERO_BARS = [
  { label: 'Factual accuracy', pct: 100, tone: 'from-emerald-400 to-teal-300' },
  { label: 'Injection resistance', pct: 84, tone: 'from-sky-400 to-indigo-400' },
  { label: 'Privacy guard', pct: 66, tone: 'from-amber-400 to-orange-400' },
  { label: 'Tool policy', pct: 50, tone: 'from-rose-400 to-red-400' },
]

const HERO_LOG = [
  { t: '00:00.012', msg: 'dispatching case fc-factual-03 → Mock Atlas — Guarded', tone: 'text-mute' },
  { t: '00:00.201', msg: 'grader=factuality.tokens verdict=PASS score=1.00', tone: 'text-emerald-300' },
  { t: '00:00.214', msg: 'injection probe: marker absent → blocked', tone: 'text-emerald-300' },
  { t: '00:00.318', msg: 'grader=privacy.exact verdict=FAIL — SYNTHETIC_SECRET echoed', tone: 'text-rose-300' },
  { t: '00:00.402', msg: 'run sealed · evidence row committed · sha recorded', tone: 'text-sky-300' },
]

function ConsoleVisual({ passRate }: { passRate: number }) {
  return (
    <div className="relative mx-auto mt-16 max-w-4xl">
      {/* floating chips */}
      <div aria-hidden="true" className="absolute -left-8 top-10 hidden animate-float rounded-xl border border-line glass px-3.5 py-2.5 shadow-panel lg:block">
        <div className="flex items-center gap-2 text-[11px]">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          <span className="font-medium text-slate-200">Injection blocked</span>
        </div>
        <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.16em] text-mute-dim">severity · high</p>
      </div>
      <div aria-hidden="true" className="absolute -right-10 top-32 hidden animate-float-slow rounded-xl border border-line glass px-3.5 py-2.5 shadow-panel lg:block">
        <div className="flex items-center gap-2 text-[11px]">
          <Timer className="h-4 w-4 text-brand-300" />
          <span className="font-medium text-slate-200">17 ms avg latency</span>
        </div>
        <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.16em] text-mute-dim">wall-clock · per case</p>
      </div>
      <div aria-hidden="true" className="absolute -left-14 bottom-16 hidden animate-float-slow rounded-xl border border-line glass px-3.5 py-2.5 shadow-panel lg:block" style={{ animationDelay: '-4s' }}>
        <div className="flex items-center gap-2 text-[11px]">
          <FileDown className="h-4 w-4 text-brand-600" />
          <span className="font-medium text-slate-200">Report exported</span>
        </div>
        <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.16em] text-mute-dim">json · csv · pdf</p>
      </div>

      {/* the console card */}
      <div className="relative overflow-hidden rounded-2xl border border-line-strong bg-panel-raised/90 shadow-glow-lg backdrop-blur-xl">
        {/* window chrome */}
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
          <span className="ml-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-mute-dim">
            <TerminalSquare className="h-3.5 w-3.5" /> aegis · evaluation console
          </span>
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-emerald-400/25 px-2 py-0.5 text-[9.5px] font-semibold text-emerald-300">
            <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-emerald-400" /> LIVE
          </span>
        </div>

        <div className="grid gap-6 p-6 sm:grid-cols-[auto_1fr] sm:p-8">
          {/* ring */}
          <div className="flex flex-col items-center justify-center gap-3">
            <Ring value={passRate} size={168} stroke={13} label="pass rate" tone={passRate >= 75 ? 'emerald' : passRate >= 50 ? 'brand' : 'amber'} />
            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-mute-dim">atlas-guarded · 12 cases</p>
          </div>
          {/* bars + log */}
          <div className="min-w-0 space-y-5">
            <ul className="space-y-3">
              {HERO_BARS.map((b, i) => (
                <li key={b.label}>
                  <div className="mb-1 flex items-baseline justify-between text-[11.5px]">
                    <span className="text-slate-300">{b.label}</span>
                    <span className="font-mono text-[10px] text-mute">{b.pct}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-ink-800">
                    <div className={`h-full origin-left rounded-full bg-gradient-to-r ${b.tone} animate-grow-bar`}
                         style={{ width: `${b.pct}%`, animationDelay: `${400 + i * 160}ms` }} />
                  </div>
                </li>
              ))}
            </ul>
            <div className="rounded-xl border border-line bg-ink-950/80 p-3.5 font-mono text-[10.5px] leading-[1.9]">
              {HERO_LOG.map((l, i) => (
                <p key={i} className="flex gap-2.5 whitespace-nowrap animate-fade-in" style={{ animationDelay: `${600 + i * 260}ms` }}>
                  <span className="shrink-0 text-mute-dim">{l.t}</span>
                  <span className={`truncate ${l.tone}`}>{l.msg}</span>
                </p>
              ))}
              <p className="mt-0.5 text-brand-300">▊<span className="animate-caret-blink">_</span> awaiting next dispatch…</p>
            </div>
          </div>
        </div>
      </div>

      {/* under-glow */}
      <div aria-hidden="true" className="absolute -inset-x-8 -bottom-10 h-24 bg-brand-grad opacity-20 blur-3xl" />
    </div>
  )
}

function Hero({ overview }: { overview: Overview | null }) {
  const passRate = overview?.pass_rate ?? 75
  return (
    <section className="relative overflow-hidden pb-20 pt-36 sm:pt-44">
      {/* backdrop layers */}
      <div aria-hidden="true" className="app-grid absolute inset-x-0 top-0 h-[720px]" />
      <div aria-hidden="true" className="absolute -top-40 left-1/2 h-[560px] w-[900px] -translate-x-1/2 rounded-full bg-brand-500/10 blur-[130px]" />
      <div aria-hidden="true" className="hero-beam left-[18%] top-0 h-40" style={{ animationDelay: '-1.2s' }} />
      <div aria-hidden="true" className="hero-beam left-[52%] top-0 h-40" style={{ animationDelay: '-3.4s' }} />
      <div aria-hidden="true" className="hero-beam left-[83%] top-0 h-40" style={{ animationDelay: '-2.1s' }} />

      <div className="relative mx-auto max-w-7xl px-5 text-center sm:px-8">
        <Reveal>
          <div className="mx-auto inline-flex items-center gap-2.5 rounded-full border border-line glass px-4 py-1.5 text-[11.5px] text-mute">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-400" />
            </span>
            <span className="font-mono uppercase tracking-[0.18em]">v1.0 · local-first · deterministic evidence</span>
          </div>
        </Reveal>

        <Reveal delay={90}>
          <h1 className="mx-auto mt-7 max-w-5xl font-display text-[clamp(2.6rem,7vw,5.4rem)] font-bold leading-[0.98] tracking-[-0.03em] text-slate-50">
            Ship AI you can
            <br className="hidden sm:block" /> <span className="text-brand-anim">prove</span> is reliable.
          </h1>
        </Reveal>

        <Reveal delay={180}>
          <p className="mx-auto mt-6 max-w-2xl text-[15px] leading-relaxed text-mute sm:text-[17px]">
            AEGIS AI LAB is the evaluation workbench for teams who refuse to vibe-check models.
            Versioned test suites, deterministic graders, adversarial security probes and
            reproducible evidence — running entirely on your machine.
          </p>
        </Reveal>

        <Reveal delay={260}>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link to="/overview">
              <Button size="lg" className="group">
                <Play className="h-4 w-4" /> Open the workbench
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Button>
            </Link>
            <a href="#method">
              <Button size="lg" variant="outline">How evidence works</Button>
            </a>
          </div>
        </Reveal>

        <Reveal delay={340}>
          <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.22em] text-mute-dim">
            No sign-up · No cloud · No API keys required
          </p>
        </Reveal>

        <Reveal delay={420}>
          <ConsoleVisual passRate={Math.round(passRate)} />
        </Reveal>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Capability marquee                                                 */
/* ================================================================== */

const CAPS = [
  'Factual accuracy', 'Prompt-injection probes', 'Privacy leakage', 'Tool-call policy',
  'Output validation', 'Consistency repeats', 'Wilson intervals', 'Paired comparisons',
  'JSON · CSV · PDF evidence', 'Append-only audit',
]

function CapMarquee() {
  const row = [...CAPS, ...CAPS]
  return (
    <div className="marquee-mask relative border-y border-line bg-ink-900/50 py-4">
      <div className="marquee-track">
        {row.map((c, i) => (
          <span key={i} className="mx-5 flex items-center gap-5 whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.24em] text-mute-dim">
            {c} <Sparkles className="h-3 w-3 text-brand-400/60" />
          </span>
        ))}
      </div>
    </div>
  )
}

/* ================================================================== */
/*  Live stats                                                         */
/* ================================================================== */

function StatBand({ overview }: { overview: Overview | null }) {
  const findings = overview ? Object.values(overview.security_by_severity).reduce((a, b) => a + b, 0) : 0
  const stats = [
    { icon: <FlaskConical className="h-4 w-4" />, label: 'Evaluation runs', value: overview?.total_runs ?? 0 },
    { icon: <TestTube2 className="h-4 w-4" />, label: 'Versioned test cases', value: overview?.total_test_cases ?? 0 },
    { icon: <ScanSearch className="h-4 w-4" />, label: 'Security findings', value: findings },
    { icon: <Gauge className="h-4 w-4" />, label: 'Avg case latency (ms)', value: Math.round(overview?.avg_latency_ms ?? 0) },
  ]
  return (
    <section className="relative mx-auto max-w-7xl px-5 py-16 sm:px-8">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s, i) => (
          <Reveal key={s.label} delay={i * 90}>
            <div className="panel panel-hover group p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-mute-dim">{s.label}</span>
                <span className="text-brand-400/70 transition group-hover:text-brand-300">{s.icon}</span>
              </div>
              <p className="mt-3 font-display text-[34px] font-semibold leading-none tracking-tight text-slate-50 stat-glow">
                {overview ? <CountUp value={s.value} /> : '—'}
              </p>
            </div>
          </Reveal>
        ))}
      </div>
      <Reveal delay={200}>
        <p className="mt-3 text-center font-mono text-[9.5px] uppercase tracking-[0.2em] text-mute-dim">
          {overview ? 'Counters streamed live from this workspace — not marketing copy' : 'Connect the API to stream live counters'}
        </p>
      </Reveal>
    </section>
  )
}

/* ================================================================== */
/*  Bento capability grid                                              */
/* ================================================================== */

function BentoCard({ icon, title, copy, children, className = '' }: {
  icon: ReactNode; title: string; copy: string; children?: ReactNode; className?: string
}) {
  return (
    <div className={`panel panel-hover group relative overflow-hidden p-6 ${className}`}>
      <div aria-hidden="true" className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-brand-500/0 blur-3xl transition-all duration-700 group-hover:bg-brand-500/10" />
      <span className="relative grid h-10 w-10 place-items-center rounded-xl border border-line bg-ink-800 text-brand-400 transition-transform duration-500 ease-spring group-hover:scale-110">
        {icon}
      </span>
      <h3 className="relative mt-4 font-display text-[17px] font-semibold tracking-tight text-slate-50">{title}</h3>
      <p className="relative mt-1.5 text-[13px] leading-relaxed text-mute">{copy}</p>
      {children}
    </div>
  )
}

function Bento() {
  return (
    <section id="capabilities" className="relative mx-auto max-w-7xl scroll-mt-24 px-5 py-20 sm:px-8">
      <Reveal className="max-w-2xl">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-brand-400/90">Capabilities</p>
        <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-slate-50 sm:text-[42px] sm:leading-[1.05]">
          Everything between <span className="text-brand">“seems fine”</span> and “shipped”.
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-mute">
          One workbench covers the full evaluation loop — from authoring cases to the PDF you
          attach to a release gate.
        </p>
      </Reveal>

      <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Reveal className="md:col-span-2" delay={0}>
          <BentoCard
            icon={<FlaskConical className="h-5 w-5" />}
            title="Deterministic, explainable graders"
            copy="Factuality token checks, injection-marker absence, exact-secret leakage, tool-schema conformance and length sanity rules. Every verdict carries the method, score and reasoning — grade the same run twice, get the same answer."
            className="h-full"
          >
            <div className="relative mt-5 flex flex-wrap gap-2">
              {['factuality.tokens', 'injection.marker', 'privacy.exact', 'tool.schema', 'length.band'].map((m, i) => (
                <span key={m} className="rounded-lg border border-line bg-ink-850 px-2.5 py-1.5 font-mono text-[10px] text-brand-200/90 animate-fade-in" style={{ animationDelay: `${i * 120}ms` }}>{m}</span>
              ))}
            </div>
          </BentoCard>
        </Reveal>

        <Reveal delay={80}>
          <BentoCard
            icon={<ShieldCheck className="h-5 w-5" />}
            title="Defensive security lab"
            copy="Synthetic injection, secret-leakage, tool-policy and output-validation probes with severity tiers and concrete mitigations. Tool calls are simulated — never executed."
            className="h-full"
          />
        </Reveal>

        <Reveal delay={140}>
          <BentoCard
            icon={<GitCompareArrows className="h-5 w-5" />}
            title="Paired model comparison"
            copy="Identical cases across models, head-to-head deltas with Wilson 95% intervals. Descriptive statistics — never inflated superiority claims."
            className="h-full"
          />
        </Reveal>

        <Reveal delay={0}>
          <BentoCard
            icon={<Layers className="h-5 w-5" />}
            title="Versioned suites & cases"
            copy="Shared datasets with full CRUD, JSON/JSONL import, duplication and enable toggles. Every run records what it was graded against."
            className="h-full"
          />
        </Reveal>

        <Reveal delay={60}>
          <BentoCard
            icon={<FileDown className="h-5 w-5" />}
            title="Reproducible evidence"
            copy="JSON, CSV and PDF exports generated exclusively from stored rows. UNCERTAIN stays UNCERTAIN — evidence is never rounded up to a pass."
            className="h-full"
          />
        </Reveal>

        <Reveal className="md:col-span-2" delay={120}>
          <BentoCard
            icon={<HardDrive className="h-5 w-5" />}
            title="Local-first by architecture"
            copy="SQLite on your disk, no telemetry, no sign-up, synth fixtures that run fully offline. Point at any OpenAI-compatible endpoint or Ollama when you want live traffic — keys never leave the server."
            className="h-full"
          >
            <div className="relative mt-5 grid grid-cols-3 gap-2 text-center">
              {[
                ['0', 'outbound calls'],
                ['100%', 'data on-device'],
                ['3', 'provider types'],
              ].map(([v, l]) => (
                <div key={l} className="rounded-xl border border-line bg-ink-850 px-2 py-3">
                  <p className="font-display text-lg font-semibold text-slate-50">{v}</p>
                  <p className="mt-1 font-mono text-[8.5px] uppercase tracking-[0.16em] text-mute-dim">{l}</p>
                </div>
              ))}
            </div>
          </BentoCard>
        </Reveal>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Workflow                                                           */
/* ================================================================== */

const STEPS = [
  {
    icon: <FolderKanban className="h-5 w-5" />,
    step: '01',
    title: 'Author & version cases',
    copy: 'Group prompts, oracles and severity into suites inside a project. Import from JSON/JSONL or write them in the editor.',
  },
  {
    icon: <Play className="h-5 w-5" />,
    step: '02',
    title: 'Run & grade',
    copy: 'Execute a suite against any registered model — mock fixtures offline, or a live provider. Deterministic graders score each case with method and reason.',
  },
  {
    icon: <BadgeCheck className="h-5 w-5" />,
    step: '03',
    title: 'Inspect & export evidence',
    copy: 'Drill into case-level rows, compare models, then attach a JSON/CSV/PDF report to your release decision. Every mutation hits an append-only audit log.',
  },
]

function Workflow() {
  return (
    <section id="workflow" className="relative scroll-mt-24 border-y border-line bg-ink-900/40 py-20">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <Reveal className="max-w-2xl">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-brand-400/90">Workflow</p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-slate-50 sm:text-[42px]">
            Three steps to a defensible answer.
          </h2>
        </Reveal>
        <div className="relative mt-12 grid gap-4 md:grid-cols-3">
          <div aria-hidden="true" className="absolute left-0 right-0 top-[52px] hidden h-px bg-gradient-to-r from-transparent via-brand-400/30 to-transparent md:block" />
          {STEPS.map((s, i) => (
            <Reveal key={s.step} delay={i * 110}>
              <div className="panel panel-hover relative h-full p-6">
                <div className="flex items-center justify-between">
                  <span className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-ink-800 text-brand-400">{s.icon}</span>
                  <span className="font-display text-[13px] font-semibold text-mute-dim">{s.step}</span>
                </div>
                <h3 className="mt-4 font-display text-[17px] font-semibold text-slate-50">{s.title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-mute">{s.copy}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Method — the honesty section                                       */
/* ================================================================== */

const METHOD = [
  {
    icon: <BadgeCheck className="h-4 w-4" />,
    title: 'Deterministic graders',
    body: 'Rule-based checks return the same verdict for the same response. Each result row states the method — keyword overlap, exact-secret absence, schema conformance — not a vibe.',
  },
  {
    icon: <ScanSearch className="h-4 w-4" />,
    title: 'UNCERTAIN is kept',
    body: 'Ambiguous evidence is stored as UNCERTAIN and excluded from the pass rate instead of being silently rounded into a pass you can’t defend.',
  },
  {
    icon: <GitCompareArrows className="h-4 w-4" />,
    title: 'No superiority theatre',
    body: 'Comparisons are descriptive: deltas and Wilson intervals on a fixed dataset. AEGIS never declares a winner — it shows you what changed.',
  },
  {
    icon: <ShieldCheck className="h-4 w-4" />,
    title: 'Synthetic means synthetic',
    body: 'Seeded fixtures are labeled mock data and never presented as real model performance. Security markers are inert by construction.',
  },
]

function Method() {
  return (
    <section id="method" className="relative mx-auto max-w-7xl scroll-mt-24 px-5 py-20 sm:px-8">
      <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:gap-16">
        <Reveal>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-brand-400/90">Method</p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-slate-50 sm:text-[42px] sm:leading-[1.05]">
            Honest by design, <span className="text-brand">boring</span> on purpose.
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-mute">
            Most eval tooling optimizes for a good-looking chart. AEGIS optimizes for a chart you
            can defend in a review meeting. Limitations are documented next to every metric —
            because evidence you can’t trust is worse than no evidence.
          </p>
          <div className="mt-7">
            <Link to="/overview">
              <Button variant="outline" className="group">
                See it in the workbench
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Button>
            </Link>
          </div>
        </Reveal>
        <div className="grid gap-4 sm:grid-cols-2">
          {METHOD.map((m, i) => (
            <Reveal key={m.title} delay={i * 90}>
              <div className="panel panel-hover h-full p-5">
                <span className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-ink-800 text-brand-400">{m.icon}</span>
                <h3 className="mt-3.5 font-display text-[15px] font-semibold text-slate-100">{m.title}</h3>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-mute">{m.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  CTA + Footer                                                       */
/* ================================================================== */

function CtaBand() {
  return (
    <section className="relative mx-auto max-w-7xl px-5 pb-24 pt-6 sm:px-8">
      <Reveal>
        <div className="relative overflow-hidden rounded-3xl border border-line-strong bg-panel-raised px-6 py-16 text-center shadow-glow sm:px-12 sm:py-20">
          <div aria-hidden="true" className="app-grid absolute inset-0 opacity-70" />
          <div aria-hidden="true" className="absolute -top-24 left-1/2 h-64 w-[560px] -translate-x-1/2 rounded-full bg-brand-500/15 blur-[100px]" />
          <div aria-hidden="true" className="absolute -bottom-16 right-8 h-40 w-40 animate-spin-slow rounded-full orbit-ring" />
          <div aria-hidden="true" className="absolute -left-10 -top-10 h-28 w-28 animate-spin-slow rounded-full orbit-ring" style={{ animationDirection: 'reverse' }} />
          <div className="relative">
            <ShieldMark className="mx-auto h-12 w-12" />
            <h2 className="mx-auto mt-6 max-w-2xl font-display text-3xl font-semibold tracking-tight text-slate-50 sm:text-[44px] sm:leading-[1.05]">
              Know where your models stand —
              <span className="text-brand-anim"> before your users find out.</span>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[14.5px] leading-relaxed text-mute">
              The workspace opens with labeled synthetic fixtures so every screen is real, live output.
              Swap in a live provider whenever you’re ready.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link to="/overview">
                <Button size="lg" className="group">
                  Launch AEGIS AI LAB
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </Button>
              </Link>
              <a href="https://github.com/authorsauravkushwaha/AIRS-Lab" target="_blank" rel="noreferrer">
                <Button size="lg" variant="outline">
                  Read the source <ArrowUpRight className="h-4 w-4" />
                </Button>
              </a>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  )
}

function Footer() {
  return (
    <footer className="border-t border-line bg-ink-900/60">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Brand />
          <p className="mt-4 max-w-xs text-[12.5px] leading-relaxed text-mute">
            The evaluation workbench for AI reliability and security.
            Local-first, deterministic, and honest about what a pass means.
          </p>
        </div>
        {([
          ['Workbench', [
            ['Overview', '/overview'], ['Run evaluations', '/run'], ['Reliability lab', '/reliability'],
            ['Security lab', '/security'], ['Reports', '/reports'],
          ]],
          ['Manage', [
            ['Projects', '/projects'], ['Models', '/models'], ['Test suites', '/suites'], ['Test cases', '/cases'],
          ]],
          ['Resources', [
            ['API reference', '/docs'], ['Source & docs', 'https://github.com/authorsauravkushwaha/AIRS-Lab'],
            ['Settings & audit', '/settings'],
          ]],
        ] as [string, [string, string][]][]).map(([head, links]) => (
          <nav key={head} aria-label={head}>
            <p className="font-mono text-[9.5px] uppercase tracking-[0.26em] text-mute-dim">{head}</p>
            <ul className="mt-4 space-y-2.5 text-[13px]">
              {links.map(([label, href]) => (
                <li key={label}>
                  {href.startsWith('http') ? (
                    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-mute transition hover:text-slate-100">
                      {label} <ArrowUpRight className="h-3 w-3" />
                    </a>
                  ) : href.startsWith('/') && href === '/docs' ? (
                    <a href={href} className="text-mute transition hover:text-slate-100">{label}</a>
                  ) : (
                    <Link to={href} className="text-mute transition hover:text-slate-100">{label}</Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-5 sm:px-8">
          <p className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-mute-dim">
            © {new Date().getFullYear()} AEGIS AI LAB · Local-first · Deterministic
          </p>
          <p className="flex items-center gap-2 font-mono text-[9.5px] uppercase tracking-[0.2em] text-mute-dim">
            <Boxes className="h-3.5 w-3.5" /> v1.0.0
          </p>
        </div>
      </div>
    </footer>
  )
}

/* ================================================================== */
/*  Page                                                               */
/* ================================================================== */

export default function Landing() {
  const [overview, setOverview] = useState<Overview | null>(null)
  useEffect(() => {
    api<Overview>('/api/dashboard/overview').then(setOverview).catch(() => {})
  }, [])

  return (
    <div className="noise app-backdrop relative min-h-screen">
      <LandingNav />
      <main>
        <section id="platform">
          <Hero overview={overview} />
        </section>
        <CapMarquee />
        <StatBand overview={overview} />
        <Bento />
        <Workflow />
        <Method />
        <CtaBand />
      </main>
      <Footer />
    </div>
  )
}
