/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        graphite: { 800: '#1e2430', 900: '#141922', 950: '#0d1117' },
        accent: { DEFAULT: '#38bdf8', dark: '#0ea5e9' },
      },
    },
  },
  plugins: [],
}
