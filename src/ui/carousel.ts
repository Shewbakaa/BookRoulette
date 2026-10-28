import type { Book } from '../types';
import { spinTargetAngle } from '../pick';
import { sound } from '../sound';
import { bookCard } from './bookCard';
import { angleFromMatrix, facing, frontIndex, ringRadius } from './ringMath';

export interface Carousel {
  render(books: Book[]): void;
  spin(ring: Book[], winner: Book): Promise<void>;
}

const CARD_W_FALLBACK = 124;
const SPIN_MS = 5000;
const SPIN_EASE = 'cubic-bezier(.12,.8,.12,1)';
const REDUCED_MS = 1200;
const WINDUP_MS = 420;
const SWAP_MS = 180; // filter re-render fade/scale half-duration

const reducedMotion = (): boolean =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

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
      <div class="car-spot"></div>
      <div class="car-floor"></div>
      <div class="car-pointer" aria-hidden="true"></div>
      <div class="car-fader">
        <div class="car-tilt"><div class="car-ring"></div></div>
      </div>
      <div class="car-burst" aria-hidden="true"></div>
      <div class="car-empty" hidden>
        <div class="car-empty-icon">📚</div>
        <p>No books here — add some!</p>
      </div>
    </div>`;
  const stage = root.querySelector<HTMLElement>('.car-stage')!;
  const fader = root.querySelector<HTMLElement>('.car-fader')!;
  const tilt = root.querySelector<HTMLElement>('.car-tilt')!;
  const ring = root.querySelector<HTMLElement>('.car-ring')!;
  const pointer = root.querySelector<HTMLElement>('.car-pointer')!;
  const burst = root.querySelector<HTMLElement>('.car-burst')!;
  const empty = root.querySelector<HTMLElement>('.car-empty')!;

  let slots: Slot[] = [];
  let angle = 0;
  let shownKey: string | null = null;
  let spinning = false;
  let pending: Book[] | null = null;
  let swapTimer = 0;

  const setAngle = (deg: number): void => {
    angle = deg;
    ring.style.transform = `rotateY(${deg}deg)`;
  };

  const shadeAll = (deg: number): void => {
    const n = slots.length;
    for (let i = 0; i < n; i++) {
      const s = slots[i];
      const v = Math.round(facing(deg, i, n) * 0.72 * 100) / 100;
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
    const cardW = parseFloat(getComputedStyle(root).getPropertyValue('--card-w')) || CARD_W_FALLBACK;
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
  };

  /** Swap card contents in place (same ring size), reusing faces already on screen. */
  const reassign = (books: Book[]): void => {
    const byId = new Map(slots.map((s) => [s.book.id, s]));
    const faces = books.map((b) => {
      const old = byId.get(b.id);
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

  const render = (books: Book[]): void => {
    if (spinning) { pending = books; return; }
    if (keyOf(books) === shownKey) return;
    clearTimeout(swapTimer);
    if (shownKey === null) { build(books); return; } // first paint: nothing moves
    root.classList.remove('landed');
    fader.classList.add('out');
    swapTimer = window.setTimeout(() => {
      build(books);
      void fader.offsetWidth;
      fader.classList.remove('out');
    }, reducedMotion() ? 0 : SWAP_MS);
  };

  const spin = async (next: Book[], winner: Book): Promise<void> => {
    if (spinning) return;
    const wi = next.findIndex((b) => b.id === winner.id);
    if (wi < 0 || next.length === 0) return;
    spinning = true;
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
    let raf = 0;
    const loop = (): void => {
      const a = liveAngle();
      const idx = frontIndex(a, tickN);
      if (idx !== lastTick) {
        lastTick = idx;
        sound.tick();
        pointer.animate(
          [{ transform: 'translateX(-50%) rotate(0)' }, { transform: 'translateX(-50%) rotate(-22deg)' }, { transform: 'translateX(-50%) rotate(0)' }],
          { duration: 110, easing: 'ease-out' },
        );
      }
      shadeAll(a);
      raf = requestAnimationFrame(loop);
    };

    root.classList.add('spinning');
    if (!reduced) {
      // Anticipation: lean back a little, then let it rip.
      stage.classList.add('windup');
      raf = requestAnimationFrame(loop);
      await transitionTo(angle + 22, WINDUP_MS, 'cubic-bezier(.45,0,.55,1)');
      stage.classList.remove('windup');
    } else {
      raf = requestAnimationFrame(loop);
    }

    const target = spinTargetAngle(angle, n, wi, reduced ? 1 : 5);
    // Swap in the sampled ring while cards are a blur (same size → same geometry).
    let swap = 0;
    if (sameShape && keyOf(next) !== shownKey) {
      swap = window.setTimeout(() => reassign(next), reduced ? 60 : 160);
    }
    await transitionTo(target, reduced ? REDUCED_MS : SPIN_MS, reduced ? 'cubic-bezier(.2,.7,.2,1)' : SPIN_EASE);
    clearTimeout(swap);
    if (keyOf(next) !== shownKey) reassign(next);
    cancelAnimationFrame(raf);

    // Normalise the angle (visually identical) so numbers stay small.
    ring.style.transition = 'none';
    setAngle(-((wi * 360) / n));
    shadeAll(angle);
    root.classList.remove('spinning');

    // Settle: winner pops and glows, burst ring, rising arpeggio.
    const win = slots[wi];
    win.face.classList.add('winner');
    root.classList.add('landed');
    sound.land();
    if (!reduced) {
      win.face.animate(
        [
          { transform: 'scale(1)' },
          { transform: 'scale(1.13)', offset: 0.3 },
          { transform: 'scale(0.98)', offset: 0.6 },
          { transform: 'scale(1.03)', offset: 0.8 },
          { transform: 'scale(1)' },
        ],
        { duration: 750, easing: 'ease-out' },
      );
      burst.animate(
        [
          { transform: 'translate(-50%,-50%) scale(.5)', opacity: 0.9 },
          { transform: 'translate(-50%,-50%) scale(1.9)', opacity: 0 },
        ],
        { duration: 700, easing: 'cubic-bezier(.2,.7,.3,1)' },
      );
    }

    spinning = false;
    if (pending) {
      const p = pending;
      pending = null;
      render(p);
    }
  };

  return { render, spin };
}
