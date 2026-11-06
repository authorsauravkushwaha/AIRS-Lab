/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { 950: '#070a12', 900: '#0b101c', 850: '#0d1322', 800: '#111829', 750: '#151d30' },
        panel: { DEFAULT: '#0d1322', raised: '#101828', sunken: '#090d17' },
        line: { DEFAULT: 'rgba(148,184,255,0.10)', strong: 'rgba(148,184,255,0.18)' },
        brand: { 200: '#a5f3fc', 300: '#67e8f9', 400: '#22d3ee', 500: '#38bdf8', 600: '#818cf8' },
        mute: { DEFAULT: '#8b98ad', dim: '#55627a' },
        ok: '#34d399', warn: '#fbbf24', danger: '#fb7185', info: '#22d3ee',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'Inter', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      backgroundImage: {
        'brand-grad': 'linear-gradient(135deg,#22d3ee 0%,#38bdf8 48%,#818cf8 100%)',
        'brand-grad-soft': 'linear-gradient(135deg,rgba(34,211,238,.16) 0%,rgba(56,189,248,.12) 48%,rgba(129,140,248,.16) 100%)',
        'panel-sheen': 'linear-gradient(180deg,rgba(255,255,255,.045) 0%,rgba(255,255,255,0) 42%)',
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(56,189,248,.35), 0 8px 32px -8px rgba(34,211,238,.35), 0 16px 48px -16px rgba(129,140,248,.35)',
        'glow-sm': '0 0 18px -6px rgba(34,211,238,.45)',
        panel: '0 1px 0 rgba(255,255,255,.04) inset, 0 24px 48px -24px rgba(0,0,0,.6)',
      },
      keyframes: {
        'fade-up': { from: { opacity: '0', transform: 'translateY(10px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'pulse-dot': { '0%,100%': { opacity: '1' }, '50%': { opacity: '.35' } },
        shimmer: { from: { backgroundPosition: '-200% 0' }, to: { backgroundPosition: '200% 0' } },
      },
      animation: {
        'fade-up': 'fade-up .45s cubic-bezier(.22,1,.36,1) both',
        'fade-in': 'fade-in .3s ease both',
        'pulse-dot': 'pulse-dot 1.8s ease-in-out infinite',
        shimmer: 'shimmer 1.6s linear infinite',
      },
    },
  },
  plugins: [],
}
