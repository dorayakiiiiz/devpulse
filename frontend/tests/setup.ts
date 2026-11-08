import '@testing-library/jest-dom';

// Mock window.matchMedia for theme toggle testing
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock browser EventSource for real-time SSE testing
class MockEventSource {
  url: string;
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(url: string) {
    this.url = url;
    setTimeout(() => this.onopen?.(), 10);
  }

  close(): void {
    this.readyState = 2;
  }
}

// @ts-expect-error Mocking global EventSource for jsdom environment
global.EventSource = MockEventSource;

afterEach(() => {
  vi.clearAllMocks();
});
