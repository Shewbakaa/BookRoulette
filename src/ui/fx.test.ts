import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Motion animations resolve immediately in tests (jsdom has no WAAPI timing).
vi.mock('motion', () => {
  const controls = () =>
    Object.assign(Promise.resolve(), { finished: Promise.resolve(), stop: vi.fn(), cancel: vi.fn(), complete: vi.fn() });
  return {
    animate: vi.fn(() => controls()),
    stagger: vi.fn(() => 0),
  };
});

import { animate } from 'motion';
import { sparks, pressSpring, revealList, sheetIn, sheetOut } from './fx';

function setReduced(reduced: boolean): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((q: string) => ({
      matches: reduced && q.includes('reduce'),
      media: q,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

let host: HTMLElement;
const defaultAnimate = vi.mocked(animate).getMockImplementation()!;
beforeEach(() => {
  vi.mocked(animate).mockImplementation(defaultAnimate);
  document.body.innerHTML = '';
  host = document.createElement('div');
  document.body.append(host);
  vi.mocked(animate).mockClear();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('sparks', () => {
  it('resolves and leaves no spark nodes behind', async () => {
    setReduced(false);
    const p = sparks(host);
    expect(host.querySelectorAll('.spark').length).toBe(24);
    await p;
    expect(host.querySelectorAll('.spark').length).toBe(0);
  });

  it('burst mode makes 12 sparks and cleans them up', async () => {
    setReduced(false);
    const p = sparks(host, { burst: true });
    expect(host.querySelectorAll('.spark').length).toBe(12);
    await p;
    expect(host.querySelectorAll('.spark').length).toBe(0);
  });

  it('repeated calls do not accumulate nodes', async () => {
    setReduced(false);
    await sparks(host);
    await sparks(host, { count: 5 });
    expect(host.children.length).toBe(0);
  });

  it('swallows a rejected Motion finish and still removes nodes', async () => {
    setReduced(false);
    vi.mocked(animate).mockImplementation(
      () => ({ finished: Promise.reject(new Error('detached')), stop: vi.fn() }) as never,
    );
    await expect(sparks(host, { count: 3 })).resolves.toBeUndefined();
    expect(host.querySelectorAll('.spark').length).toBe(0);
  });

  it('never hangs if Motion never finishes (detached host)', async () => {
    setReduced(false);
    vi.useFakeTimers();
    vi.mocked(animate).mockImplementation(() => ({ finished: new Promise(() => {}), stop: vi.fn() }) as never);
    const p = sparks(host, { count: 3 });
    expect(host.querySelectorAll('.spark').length).toBe(3);
    await vi.advanceTimersByTimeAsync(4000);
    await expect(p).resolves.toBeUndefined();
    expect(host.querySelectorAll('.spark').length).toBe(0);
    vi.useRealTimers();
  });

  it('creates nothing under reduced motion', async () => {
    setReduced(true);
    const append = vi.spyOn(host, 'append');
    const appendChild = vi.spyOn(host, 'appendChild');
    await sparks(host);
    expect(host.querySelectorAll('.spark').length).toBe(0);
    expect(append).not.toHaveBeenCalled();
    expect(appendChild).not.toHaveBeenCalled();
    expect(animate).not.toHaveBeenCalled();
  });
});

describe('pressSpring', () => {
  it('adds no listeners under reduced motion and returns a callable cleanup', () => {
    setReduced(true);
    const el = document.createElement('button');
    const add = vi.spyOn(el, 'addEventListener');
    const cleanup = pressSpring(el);
    expect(add).not.toHaveBeenCalled();
    expect(() => cleanup()).not.toThrow();
  });

  it('adds pointer listeners and removes them on cleanup', () => {
    setReduced(false);
    const el = document.createElement('button');
    const add = vi.spyOn(el, 'addEventListener');
    const remove = vi.spyOn(el, 'removeEventListener');
    const cleanup = pressSpring(el);
    expect(add).toHaveBeenCalledWith('pointerdown', expect.any(Function));
    el.dispatchEvent(new Event('pointerdown'));
    expect(animate).toHaveBeenCalled();
    cleanup();
    expect(remove.mock.calls.length).toBe(add.mock.calls.length);
  });
});

describe('revealList', () => {
  it('just shows items under reduced motion', () => {
    setReduced(true);
    const items = [document.createElement('li'), document.createElement('li')];
    items.forEach((i) => (i.style.opacity = '0'));
    revealList(items);
    expect(animate).not.toHaveBeenCalled();
    items.forEach((i) => expect(i.style.opacity).toBe(''));
  });

  it('animates items with Motion otherwise', () => {
    setReduced(false);
    revealList([document.createElement('li')]);
    expect(animate).toHaveBeenCalled();
  });
});

describe('sheetIn / sheetOut', () => {
  it('resolve', async () => {
    setReduced(false);
    const sheet = document.createElement('div');
    const backdrop = document.createElement('div');
    await expect(sheetIn(sheet, backdrop)).resolves.toBeUndefined();
    await expect(sheetOut(sheet, backdrop)).resolves.toBeUndefined();
  });
});
