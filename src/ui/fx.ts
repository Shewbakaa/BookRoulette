import { animate, stagger } from 'motion';

/** Shared motion helpers (Motion-based). Every helper reads reduced motion at call time. */
export const reducedMotion = (): boolean =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const rand = (min: number, max: number): number => min + Math.random() * (max - min);

/**
 * Spring scale on press/release. Returns a cleanup that removes the listeners.
 * No-op (no listeners) under reduced motion.
 */
export function pressSpring(el: HTMLElement): () => void {
  if (reducedMotion()) return () => {};
  const down = (): void => {
    animate(el, { scale: 0.94 }, { type: 'spring', stiffness: 700, damping: 32 });
  };
  const up = (): void => {
    animate(el, { scale: 1 }, { type: 'spring', stiffness: 500, damping: 14 });
  };
  const events: [string, () => void][] = [
    ['pointerdown', down],
    ['pointerup', up],
    ['pointercancel', up],
    ['pointerleave', up],
  ];
  for (const [ev, fn] of events) el.addEventListener(ev, fn);
  return () => {
    for (const [ev, fn] of events) el.removeEventListener(ev, fn);
  };
}

/**
 * Warm spark dots that rise and fade inside `host` (which should be positioned).
 * Default: 24 drifting sparks. `burst: true`: 12 sparks radiating from the centre.
 * Nodes are always removed when done. Creates nothing under reduced motion.
 */
export async function sparks(host: HTMLElement, opts: { count?: number; burst?: boolean } = {}): Promise<void> {
  if (reducedMotion()) return;
  const burst = !!opts.burst;
  const count = opts.count ?? (burst ? 12 : 24);
  const nodes: HTMLElement[] = [];
  const runs: Promise<unknown>[] = [];
  for (let i = 0; i < count; i++) {
    const s = document.createElement('span');
    s.className = 'spark';
    s.setAttribute('aria-hidden', 'true');
    const size = rand(3, 6);
    s.style.width = s.style.height = `${size.toFixed(1)}px`;
    if (burst) {
      s.style.left = '50%';
      s.style.top = '50%';
    } else {
      s.style.left = `${rand(15, 85).toFixed(1)}%`;
      s.style.top = `${rand(55, 90).toFixed(1)}%`;
    }
    s.style.opacity = '0';
    nodes.push(s);
  }
  host.append(...nodes);
  try {
    nodes.forEach((s, i) => {
      if (burst) {
        const a = (i / count) * Math.PI * 2 + rand(-0.15, 0.15);
        const d = rand(56, 92);
        runs.push(
          animate(
            s,
            { x: [0, Math.cos(a) * d], y: [0, Math.sin(a) * d - 18], opacity: [0, 1, 0], scale: [0.6, 1, 0.4] },
            { duration: rand(0.6, 0.85), ease: 'easeOut' },
          ).finished,
        );
      } else {
        runs.push(
          animate(
            s,
            { x: [0, rand(-24, 24)], y: [0, -rand(90, 170)], opacity: [0, 1, 0], scale: [0.7, 1, 0.5] },
            { duration: rand(1.3, 2.1), delay: rand(0, 0.7), ease: 'easeOut' },
          ).finished,
        );
      }
    });
    await Promise.all(runs);
  } finally {
    for (const s of nodes) s.remove();
  }
}

/** Staggered fade/rise (50ms apart). Under reduced motion items are simply shown. */
export function revealList(items: Element[]): void {
  if (!items.length) return;
  if (reducedMotion()) {
    for (const it of items) {
      if (it instanceof HTMLElement) {
        it.style.opacity = '';
        it.style.transform = '';
      }
    }
    return;
  }
  animate(items, { opacity: [0, 1], y: [10, 0] }, { delay: stagger(0.05), duration: 0.36, ease: 'easeOut' });
}

/** Spring slide-up of a bottom sheet with a backdrop fade. Short fade under reduced motion. */
export async function sheetIn(sheet: HTMLElement, backdrop: HTMLElement): Promise<void> {
  if (reducedMotion()) {
    await Promise.all([
      animate(backdrop, { opacity: [0, 1] }, { duration: 0.15 }).finished,
      animate(sheet, { opacity: [0, 1] }, { duration: 0.15 }).finished,
    ]);
    return;
  }
  await Promise.all([
    animate(backdrop, { opacity: [0, 1] }, { duration: 0.25, ease: 'easeOut' }).finished,
    animate(sheet, { y: ['100%', '0%'], opacity: 1 }, { type: 'spring', stiffness: 380, damping: 36, mass: 0.9 }).finished,
  ]);
}

/** Faster reverse of `sheetIn`. */
export async function sheetOut(sheet: HTMLElement, backdrop: HTMLElement): Promise<void> {
  if (reducedMotion()) {
    await Promise.all([
      animate(backdrop, { opacity: 0 }, { duration: 0.12 }).finished,
      animate(sheet, { opacity: 0 }, { duration: 0.12 }).finished,
    ]);
    return;
  }
  await Promise.all([
    animate(backdrop, { opacity: 0 }, { duration: 0.18, ease: 'easeIn' }).finished,
    animate(sheet, { y: '100%' }, { duration: 0.2, ease: [0.4, 0, 1, 1] }).finished,
  ]);
}

/** Fixed, tap-through layer for sparks that are not tied to a positioned host. */
function fxLayer(rect?: DOMRect): HTMLElement {
  const layer = document.createElement('div');
  layer.className = 'fx-layer';
  if (rect) {
    layer.style.left = `${rect.left}px`;
    layer.style.top = `${rect.top}px`;
    layer.style.width = `${rect.width}px`;
    layer.style.height = `${rect.height}px`;
  } else {
    layer.style.inset = '0';
  }
  document.body.append(layer);
  return layer;
}

/** @deprecated Temporary wrapper over `sparks`; removed in Task 4. */
export function bigParty(): void {
  if (reducedMotion()) return;
  const layer = fxLayer();
  void sparks(layer).finally(() => layer.remove());
}

/** @deprecated Temporary wrapper over `sparks`; removed in Task 4. */
export function burstFrom(el: Element | null, _size: 'small' | 'medium' = 'small'): void {
  if (reducedMotion()) return;
  const layer = fxLayer(el?.getBoundingClientRect());
  void sparks(layer, { burst: true }).finally(() => layer.remove());
}

/** Resolve after an element's animation (or `ms`, whichever first). Instant with reduced motion. */
export function afterAnim(el: HTMLElement, ms: number): Promise<void> {
  if (reducedMotion()) return Promise.resolve();
  return new Promise((resolve) => {
    let done = false;
    const end = (e?: Event): void => {
      if (e && e.target !== el) return;
      if (done) return;
      done = true;
      el.removeEventListener('animationend', end);
      resolve();
    };
    el.addEventListener('animationend', end);
    window.setTimeout(() => end(), ms + 80);
  });
}
