import { animate } from 'motion';
import type { Book } from '../types';
import { spinTargetAngle } from '../pick';
import { sound } from '../sound';
import { bookCard } from './bookCard';
import { angleFromMatrix, facing, frontIndex, ringRadius, tileRing } from './ringMath';
import { reducedMotion } from './fx';

export interface Carousel {
  render(books: Book[]): void;
  /** Resolves true when the ring landed on the winner, false if it did not spin. */
  spin(ring: Book[], winner: Book): Promise<boolean>;
}

const CARD_W_FALLBACK = 124;
// Normal spin ≈ 5s: wind-back prelude → long ease-out → gentle settle onto spinTargetAngle.
const WINDBACK_DEG = 8; // the ring spins toward negative angles, so +8° leans back
const WINDBACK_MS = 180;
const WINDBACK_EASE = 'cubic-bezier(.25,.6,.35,1)';
const MAIN_MS = 4400;
const MAIN_EASE = 'cubic-bezier(.18,.62,.1,1)';
const OVERSHOOT_DEG = 1.2; // a hair past the winner, then ease back like a flapper catching
const SETTLE_MS = 420;
const SETTLE_EASE = 'cubic-bezier(.35,0,.25,1)';
const REDUCED_MS = 1200;
const SHADE_MAX = 0.45; // darkest a book gets when it faces away from the lamp
const SWAP_MS = 180; // filter re-render cross-fade half-duration

/** Brass flapper: a wedge on a pivot pin (from docs/mockups/reading-lamp.html). */
const POINTER_SVG = `
  <svg class="pointer car-pointer" width="22" height="26" viewBox="0 0 22 26" aria-hidden="true" focusable="false"
       style="left: calc(50% - 11px); transform-origin: 50% 4px">
    <defs>
      <linearGradient id="car-ptr-brass" x1="0" x2="1">
        <stop offset="0" stop-color="#f0c876"/><stop offset=".55" stop-color="#c8963c"/><stop offset="1" stop-color="#7a531a"/>
      </linearGradient>
    </defs>
    <circle cx="11" cy="5" r="4" fill="#6d4c17"/>
    <path d="M3 5h16L11 25z" fill="url(#car-ptr-brass)"/>
    <circle cx="11" cy="5" r="2" fill="#2a1b06"/>
  </svg>`;

const keyOf = (books: Book[]): string =>
  books.map((b) => `${b.id}|${b.title}|${b.author}|${b.coverUrl ?? ''}|${b.color}`).join(';');

interface Slot { el: HTMLElement; face: HTMLElement; shade: HTMLElement; book: Book; lastShade: number }

/**
 * 3D ring of book cards. Only transform/opacity are animated:
 *  - the ring's rotateY runs as a single CSS transition (compositor thread),
 *  - a rAF loop reads the live computed transform to fire ticks and shade cards by depth.
 */
export function createCarousel(root: HTMLElement): Carousel {
  root.classList.add('carousel');
  root.innerHTML = `
    <div class="car-stage">
      <div class="car-floor" aria-hidden="true"></div>
      ${POINTER_SVG}
      <div class="car-fader">
        <div class="car-tilt"><div class="car-ring"></div></div>
      </div>
      <div class="car-empty" hidden>
        <p>No books here. Add some!</p>
      </div>
    </div>`;
  const fader = root.querySelector<HTMLElement>('.car-fader')!;
  const tilt = root.querySelector<HTMLElement>('.car-tilt')!;
  const ring = root.querySelector<HTMLElement>('.car-ring')!;
  const pointer = root.querySelector<SVGSVGElement>('.pointer')!;
  const empty = root.querySelector<HTMLElement>('.car-empty')!;

  let slots: Slot[] = [];
  let angle = 0;
  let shownKey: string | null = null;
  let spinning = false;
  let pending: Book[] | null = null;
  let swapTimer = 0;
  let builtW = 0;

  const setAngle = (deg: number): void => {
    angle = deg;
    ring.style.transform = `rotateY(${deg}deg)`;
  };

  const shadeAll = (deg: number): void => {
    const n = slots.length;
    for (let i = 0; i < n; i++) {
      const s = slots[i];
      // sqrt curve: neighbours already sit noticeably out of the lamplight; full SHADE_MAX by ~70°.
      const v = Math.round(Math.sqrt(Math.min(1, facing(deg, i, n) * 3)) * SHADE_MAX * 100) / 100;
      if (v !== s.lastShade) { s.lastShade = v; s.shade.style.opacity = String(v); }
    }
  };

  const makeFace = (book: Book): { face: HTMLElement; shade: HTMLElement } => {
    const face = bookCard(book);
    face.classList.add('car-face');
    const shade = document.createElement('div');
    shade.className = 'car-shade';
    face.append(shade);
    return { face, shade };
  };

  /** Lay out `books` as a fresh ring (no animation). */
  const build = (books: Book[]): void => {
    const n = books.length;
    const cardW = fader.offsetWidth || CARD_W_FALLBACK; // --card-w is a min() expression; read the result
    builtW = cardW;
    const r = ringRadius(n, cardW);
    const seg = n ? 360 / n : 0;
    ring.style.transition = 'none';
    ring.replaceChildren();
    slots = books.map((book, i) => {
      const el = document.createElement('div');
      el.className = 'car-slot';
      el.style.transform = `rotateY(${i * seg}deg) translateZ(${r}px)`;
      const { face, shade } = makeFace(book);
      el.append(face);
      ring.append(el);
      return { el, face, shade, book, lastShade: -1 };
    });
    // Pull the ring back by its radius so the front card sits at natural size; tilt to look down on it.
    tilt.style.transform = `translateZ(${-r}px) rotateX(-8deg)`;
    setAngle(0);
    shadeAll(0);
    shownKey = keyOf(books);
    empty.hidden = n > 0;
    root.classList.toggle('is-empty', n === 0);
    root.classList.toggle('is-single', n === 1);
    placePointer();
  };

  /**
   * Rest the pointer's tip 2px above the front cover. Measured, because where that edge lands
   * depends on ring size, tilt, perspective and viewport (it differs between browsers).
   */
  const stage = root.querySelector<HTMLElement>('.car-stage')!;
  const placePointer = (): void => {
    const front = slots[frontIndex(angle, slots.length)];
    if (!front) return;
    const prev = fader.style.transform;
    fader.style.transform = 'none'; // measure at rest, not mid filter-fade scale
    const top = front.face.getBoundingClientRect().top - stage.getBoundingClientRect().top;
    fader.style.transform = prev;
    pointer.style.top = `${Math.round(top - 27)}px`; // 26px tall wedge, tip at y=25, 2px gap
  };
  let resizeRaf = 0;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(() => {
      if (spinning) return;
      // Covers resize with the screen (rotation); rebuild so the ring radius matches.
      if (fader.offsetWidth !== builtW && slots.length) build(slots.map((s) => s.book));
      else placePointer();
    });
  });

  /** Swap card contents in place (same ring size), reusing faces already on screen. */
  const reassign = (books: Book[]): void => {
    // A tiled ring shows the same book more than once; each slot needs its own face element.
    const byId = new Map<string, Slot[]>();
    for (const s of slots) byId.set(s.book.id, [...(byId.get(s.book.id) ?? []), s]);
    const faces = books.map((b) => {
      const old = byId.get(b.id)?.shift();
      return old ? { face: old.face, shade: old.shade } : makeFace(b);
    });
    slots.forEach((s, i) => {
      s.el.replaceChildren(faces[i].face);
      s.face = faces[i].face;
      s.shade = faces[i].shade;
      s.book = books[i];
      s.lastShade = -1;
    });
    shownKey = keyOf(books);
  };

  const transitionTo = (deg: number, ms: number, ease: string): Promise<void> =>
    new Promise((resolve) => {
      let done = false;
      const finish = (): void => {
        if (done) return;
        done = true;
        ring.removeEventListener('transitionend', onEnd);
        clearTimeout(timer);
        resolve();
      };
      const onEnd = (e: TransitionEvent): void => {
        if (e.target === ring && e.propertyName === 'transform') finish();
      };
      ring.addEventListener('transitionend', onEnd);
      // Fallback if transitionend never fires (hidden tab, same angle).
      const timer = window.setTimeout(finish, ms + 300);
      ring.style.transition = `transform ${ms}ms ${ease}`;
      void ring.offsetWidth; // commit the transition before changing transform
      setAngle(deg);
    });

  const liveAngle = (): number => {
    const t = getComputedStyle(ring).transform;
    if (!t || t === 'none') return angle;
    const m = new DOMMatrix(t);
    return angleFromMatrix(m.m11, m.m13);
  };

  const render = (shelf: Book[]): void => {
    const books = tileRing(shelf);
    if (spinning) { pending = shelf; return; }
    // Cancel any in-flight fade first, so toggling a chip on→off quickly can't build the stale ring.
    clearTimeout(swapTimer);
    if (keyOf(books) === shownKey) { fader.classList.remove('out'); return; }
    if (shownKey === null) { build(books); return; } // first paint: nothing moves
    root.classList.remove('landed');
    fader.classList.add('out');
    swapTimer = window.setTimeout(() => {
      build(books);
      void fader.offsetWidth;
      fader.classList.remove('out');
    }, reducedMotion() ? 0 : SWAP_MS);
  };

  /** Resolves true once the ring has landed on `winner`; false if nothing spun. */
  const spin = async (shelf: Book[], winner: Book): Promise<boolean> => {
    if (spinning) return false;
    const next = tileRing(shelf);
    const wi = next.findIndex((b) => b.id === winner.id);
    if (wi < 0 || next.length === 0) return false;
    spinning = true;
    let raf = 0;
    try {
      clearTimeout(swapTimer);
      fader.classList.remove('out');
      root.classList.remove('landed');
      slots.forEach((s) => s.face.classList.remove('winner'));

      const n = next.length;
      const reduced = reducedMotion();
      const sameShape = slots.length === n && shownKey !== null;
      if (!sameShape) build(next);

      // rAF loop: tick when a new card reaches the front, shade by depth.
      const tickN = Math.max(n, 4); // tiny rings still tick 4×/turn
      let lastTick = frontIndex(angle, tickN);
      const loop = (): void => {
        const a = liveAngle();
        const idx = frontIndex(a, tickN);
        if (idx !== lastTick) {
          lastTick = idx;
          sound.tick();
          // Flick on the pivot. Motion writes only rotate(); centering is `left`, never a translate.
          if (!reduced) animate(pointer, { rotate: [0, -14, 0] }, { duration: 0.2, ease: 'easeOut' });
        }
        shadeAll(a);
        raf = requestAnimationFrame(loop);
      };

      root.classList.add('spinning');
      raf = requestAnimationFrame(loop);
      // Anticipation: lean back a few degrees before the main move (skipped under reduced motion).
      if (!reduced) await transitionTo(angle + WINDBACK_DEG, WINDBACK_MS, WINDBACK_EASE);

      const target = spinTargetAngle(angle, n, wi, reduced ? 1 : 5);
      // Swap in the sampled ring while cards are a blur (same size → same geometry).
      let swap = 0;
      if (sameShape && keyOf(next) !== shownKey) {
        swap = window.setTimeout(() => reassign(next), reduced ? 60 : 160);
      }
      if (reduced) {
        await transitionTo(target, REDUCED_MS, 'cubic-bezier(.2,.7,.2,1)');
      } else {
        // Long ease-out a hair past the winner, then settle back onto spinTargetAngle exactly.
        await transitionTo(target - OVERSHOOT_DEG, MAIN_MS, MAIN_EASE);
        await transitionTo(target, SETTLE_MS, SETTLE_EASE);
      }
      clearTimeout(swap);
      if (keyOf(next) !== shownKey) reassign(next);
      cancelAnimationFrame(raf);

      // Normalise the angle (visually identical) so numbers stay small.
      ring.style.transition = 'none';
      setAngle(-((wi * 360) / n));
      shadeAll(angle);
      root.classList.remove('spinning');

      // Landed: the winner lifts a touch under the lamp, rising arpeggio.
      const win = slots[wi];
      win.face.classList.add('winner');
      root.classList.add('landed');
      sound.land();
      if (!reduced) animate(win.face, { scale: [1, 1.035, 1] }, { duration: 0.6, ease: 'easeInOut' });

      return true;
    } finally {
      cancelAnimationFrame(raf);
      root.classList.remove('spinning');
      spinning = false;
      if (pending) {
        const p = pending;
        pending = null;
        render(p);
      }
    }
  };

  return { render, spin };
}
