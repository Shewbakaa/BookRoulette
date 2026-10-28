import confetti from 'canvas-confetti';

/** Shared motion helpers for the celebration screens. */
export const reducedMotion = (): boolean =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const COLORS = ['#ff7a59', '#ffb84a', '#ffd27a', '#ffffff', '#b28cff', '#7c5cff', '#ff5fa2', '#5fe0c8'];
const Z = 1000; // above the overlay (z 50) and prompt (z 60)

let fire: confetti.CreateTypes | null = null;
let bookShape: confetti.Shape | null = null;

function get(): confetti.CreateTypes | null {
  if (fire) return fire;
  try {
    const canvas = document.createElement('canvas');
    canvas.className = 'fx-canvas';
    if (!canvas.getContext?.('2d')) return null; // jsdom / no canvas support
    document.body.append(canvas);
    fire = confetti.create(canvas, { resize: true, useWorker: false, disableForReducedMotion: true });
    try { bookShape = confetti.shapeFromText({ text: '📚', scalar: 2 }); } catch { bookShape = null; }
  } catch {
    fire = null;
  }
  return fire;
}

function shoot(opts: confetti.Options): void {
  const f = get();
  if (!f) return;
  void f({ colors: COLORS, zIndex: Z, disableForReducedMotion: true, ...opts })?.catch?.(() => {});
}

const later = (ms: number, fn: () => void): void => { window.setTimeout(fn, ms); };

/** The big "Your next read!" party: side cannons, a centre pop and a sprinkle of books. */
export function bigParty(): void {
  if (reducedMotion()) return;
  shoot({ particleCount: 70, angle: 60, spread: 60, startVelocity: 62, origin: { x: 0, y: 0.85 } });
  shoot({ particleCount: 70, angle: 120, spread: 60, startVelocity: 62, origin: { x: 1, y: 0.85 } });
  later(180, () => shoot({ particleCount: 90, spread: 100, startVelocity: 42, scalar: 1.1, origin: { x: 0.5, y: 0.42 } }));
  later(520, () => {
    shoot({ particleCount: 26, spread: 140, startVelocity: 30, shapes: ['star'], scalar: 1.4, origin: { x: 0.5, y: 0.35 } });
    if (bookShape) shoot({ particleCount: 8, spread: 120, startVelocity: 26, shapes: [bookShape], scalar: 2, flat: true, origin: { x: 0.5, y: 0.35 } });
  });
  later(950, () => {
    shoot({ particleCount: 35, angle: 75, spread: 50, startVelocity: 50, origin: { x: 0.1, y: 0.95 } });
    shoot({ particleCount: 35, angle: 105, spread: 50, startVelocity: 50, origin: { x: 0.9, y: 0.95 } });
  });
}

/** A small burst from an element (e.g. the button that was tapped). */
export function burstFrom(el: Element | null, size: 'small' | 'medium' = 'small'): void {
  if (reducedMotion()) return;
  let origin = { x: 0.5, y: 0.4 };
  if (el && typeof innerWidth === 'number' && innerWidth > 0) {
    const r = el.getBoundingClientRect();
    origin = { x: (r.left + r.width / 2) / innerWidth, y: (r.top + r.height / 2) / innerHeight };
  }
  const n = size === 'small' ? 45 : 80;
  shoot({ particleCount: n, spread: 75, startVelocity: size === 'small' ? 28 : 38, ticks: 160, origin });
  later(140, () => shoot({ particleCount: Math.round(n / 3), spread: 120, startVelocity: 20, shapes: ['star'], origin }));
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
