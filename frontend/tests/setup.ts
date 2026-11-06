import '@testing-library/jest-dom/vitest'

// jsdom does not implement ResizeObserver (required by recharts)
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
;(globalThis as Record<string, unknown>).ResizeObserver = ResizeObserverMock

// jsdom does not implement IntersectionObserver (required by Reveal / CountUp).
// The mock reports every observed element as immediately intersecting.
class IntersectionObserverMock {
  private cb: IntersectionObserverCallback
  constructor(cb: IntersectionObserverCallback) { this.cb = cb }
  observe(target: Element) {
    this.cb([{ isIntersecting: true, target } as unknown as IntersectionObserverEntry], this as unknown as IntersectionObserver)
  }
  unobserve() {}
  disconnect() {}
}
;(globalThis as Record<string, unknown>).IntersectionObserver = IntersectionObserverMock

// jsdom lacks scrollTo / matchMedia plumbing used by landing + motion helpers
window.scrollTo = window.scrollTo ?? (() => {})
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}
