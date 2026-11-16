import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
for (const key of [
  'window',
  'document',
  'HTMLElement',
  'Element',
  'Node',
  'NodeFilter',
  'Event',
  'MouseEvent',
  'KeyboardEvent',
  'MutationObserver',
  'CustomEvent',
  'HTMLInputElement',
  'HTMLButtonElement',
  'getComputedStyle',
  'localStorage',
]) {
  Object.defineProperty(globalThis, key, {
    value: (dom.window as unknown as Record<string, unknown>)[key],
    configurable: true,
    writable: true,
  });
}
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Object.defineProperty(globalThis, 'ResizeObserver', {
  value: MockResizeObserver,
  configurable: true,
});
Object.defineProperty(globalThis, 'requestAnimationFrame', {
  value: (fn: FrameRequestCallback) => setTimeout(fn, 0),
  configurable: true,
});
Object.defineProperty(globalThis, 'cancelAnimationFrame', {
  value: clearTimeout,
  configurable: true,
});
dom.window.scrollTo = () => {};
dom.window.HTMLElement.prototype.scrollIntoView = () => {};

Object.defineProperty(dom.window, 'matchMedia', {
  writable: true,
  value: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
});
