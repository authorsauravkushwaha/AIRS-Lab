import '@testing-library/jest-dom/vitest'

// jsdom does not implement ResizeObserver (required by recharts)
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
;(globalThis as Record<string, unknown>).ResizeObserver = ResizeObserverMock
