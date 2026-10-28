import type { Book } from '../types';
import { store } from '../store';
import { poolFor } from '../pick';
import { spinAgain } from '../app';
import { bookCard } from './bookCard';
import { play, pressSpring, reducedMotion, sparks } from './fx';

export interface CelebrationActions {
  /** "Yes, I've read it": mark finished. The overlay then offers Re-spin. */
  onAlreadyRead(): void;
  /** "Start reading". Return false (or resolve false) to keep the overlay open, e.g. swap cancelled. */
  onStartReading(): void | boolean | Promise<void | boolean>;
  /** The Close button was used. */
  onClose(): void;
  /** Genres currently filtered on; empty/undefined = all. Used to decide whether Re-spin makes sense. */
  genres?(): Set<string>;
  /** Re-spin after "Yes" (runs after the overlay has animated out). Defaults to app.spinAgain. */
  onRespin?(): void;
}

let open: HTMLElement | null = null;

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] => {
  const n = document.createElement(tag);
  n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};

const button = (cls: string, text: string): HTMLButtonElement => {
  const b = el('button', `btn ${cls}`, text);
  b.type = 'button';
  return b;
};

const EYEBROW = "Tonight you're reading";

/**
 * Full-screen "Tonight you're reading" overlay. Only Close, Start reading, or Yes → Spin again
 * dismiss it (no backdrop tap, no Escape) — it's their pick, it stays until they're done with it.
 */
export function showCelebration(book: Book, actions: CelebrationActions): void {
  if (open) open.remove();
  const app = document.querySelector<HTMLElement>('#app');
  const prevFocus = document.activeElement as HTMLElement | null;
  const still = reducedMotion();

  const root = el('div', 'cele');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', EYEBROW);

  const body = el('div', 'cele-body');
  const eyebrow = el('p', 'cele-eyebrow', EYEBROW);

  // The cover sits in a warm pool of lamplight (.cele-stage::before).
  const stage = el('div', 'cele-stage');
  const card = bookCard(book);
  card.classList.add('cele-card');
  const stamp = el('div', 'cele-stamp', 'Finished');
  stamp.setAttribute('aria-hidden', 'true');
  card.append(stamp);
  stage.append(card);

  const meta = el('div', 'cele-meta');
  meta.append(
    el('div', 'cele-book', book.title),
    el('div', 'cele-author', book.genre ? `${book.author} · ${book.genre}` : book.author),
  );

  // Panel 1: the question.
  const ask = el('div', 'cele-panel cele-ask');
  const start = button('btn-primary', 'Start reading');
  const q = el('p', 'cele-q', 'Already read this one?');
  const yes = button('btn-secondary', 'Yes — set it aside & spin again');
  const close = button('btn-tertiary cele-close', 'Close');
  ask.append(start, q, yes, close);

  // Panel 2: after "Yes".
  const done = el('div', 'cele-panel cele-done');
  done.hidden = true;
  const doneMsg = el('p', 'cele-done-msg', 'Moved to Finished ✓');
  doneMsg.setAttribute('role', 'status');
  const respin = button('btn-primary', 'Spin again');
  const close2 = button('btn-tertiary cele-close', 'Close');
  done.append(doneMsg, respin, close2);

  body.append(eyebrow, stage, meta, ask, done);
  // The content scrolls on very short screens (centred via margin:auto, never clipped).
  const scroller = el('div', 'cele-scroll');
  scroller.append(body);
  root.append(scroller);
  document.body.append(root);
  open = root;
  if (app) app.inert = true;
  document.body.classList.add('cele-open');

  const springs = [start, yes, close, respin, close2].map((b) => {
    b.classList.add('springy');
    return pressSpring(b);
  });

  if (!still) {
    void play(root, { opacity: [0, 1] }, { duration: 0.3, ease: 'easeOut' });
    void play(eyebrow, { opacity: [0, 1], y: [8, 0] }, { duration: 0.4, delay: 0.1, ease: 'easeOut' });
    void play(
      card,
      { opacity: [0, 1], y: [60, 0], scale: [0.6, 1], rotate: [-6, 0] },
      { type: 'spring', stiffness: 180, damping: 14, delay: 0.12 },
      2500,
    );
    [meta, ask].forEach((n, i) =>
      void play(n, { opacity: [0, 1], y: [14, 0] }, { duration: 0.45, delay: 0.4 + i * 0.12, ease: 'easeOut' }),
    );
  }
  void sparks(root);
  start.focus({ preventScroll: true });

  let busy = false;
  const dismiss = async (how: 'close' | 'start' | 'respin'): Promise<void> => {
    root.classList.add('out');
    if (!reducedMotion()) {
      const cardOut =
        how === 'start'
          ? play(card, { y: -220, scale: 0.35, opacity: 0 }, { duration: 0.5, ease: [0.5, 0, 0.75, 0] })
          : how === 'respin'
            ? play(card, { scale: 0.3, rotate: 24, opacity: 0 }, { duration: 0.35, ease: [0.5, 0, 0.75, 0] })
            : play(body, { y: 12, scale: 0.97 }, { duration: 0.3, ease: 'easeIn' });
      const fade = play(root, { opacity: 0 }, { duration: 0.3, delay: how === 'start' ? 0.22 : 0, ease: 'easeIn' });
      await Promise.all([cardOut, fade]);
    }
    springs.forEach((off) => off());
    root.remove();
    if (open === root) open = null;
    if (!open) {
      if (app) app.inert = false;
      document.body.classList.remove('cele-open');
    }
    if (how !== 'respin' && prevFocus && document.contains(prevFocus)) prevFocus.focus({ preventScroll: true });
  };

  const guard = (fn: () => Promise<void> | void) => async (): Promise<void> => {
    if (busy) return;
    busy = true;
    try { await fn(); } finally { busy = false; }
  };

  close.addEventListener('click', guard(async () => { await dismiss('close'); actions.onClose(); }));
  close2.addEventListener('click', guard(async () => { await dismiss('close'); actions.onClose(); }));

  start.addEventListener('click', guard(async () => {
    const ok = await actions.onStartReading();
    if (ok === false) return; // swap cancelled: the pick stays on screen
    await dismiss('start');
  }));

  yes.addEventListener('click', guard(() => {
    actions.onAlreadyRead();
    if (poolFor(store.books(), actions.genres?.() ?? new Set()).length === 0) {
      respin.hidden = true;
      const empty = el('p', 'cele-done-msg cele-empty', 'No books left — add some!');
      empty.setAttribute('role', 'status');
      doneMsg.after(empty);
    }
    root.classList.add('finished');
    ask.hidden = true;
    done.hidden = false;
    scroller.scrollTop = 0;
    if (!reducedMotion()) {
      void play(stamp, { opacity: [0, 1], y: [10, 0] }, { type: 'spring', stiffness: 420, damping: 22 });
      void play(done, { opacity: [0, 1], y: [10, 0] }, { duration: 0.35, ease: 'easeOut' });
    }
    void sparks(stage, { burst: true });
    respin.focus({ preventScroll: true });
  }));

  respin.addEventListener('click', guard(async () => {
    await dismiss('respin');
    (actions.onRespin ?? (() => { void spinAgain(); }))();
  }));

  // Keep the dialog in charge of the keyboard; Escape deliberately does nothing.
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') e.preventDefault();
  });
}

/** For tests: is a celebration currently on screen? */
export function celebrationOpen(): boolean {
  return !!open && document.body.contains(open);
}
