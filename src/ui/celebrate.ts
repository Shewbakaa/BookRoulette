import type { Book } from '../types';
import { spinAgain } from '../app';
import { bookCard } from './bookCard';
import { afterAnim, bigParty, burstFrom } from './fx';

export interface CelebrationActions {
  /** "Yes, I've read it": mark finished. The overlay then offers Re-spin. */
  onAlreadyRead(): void;
  /** "Start reading". Return false (or resolve false) to keep the overlay open, e.g. swap cancelled. */
  onStartReading(): void | boolean | Promise<void | boolean>;
  /** The Close button was used. */
  onClose(): void;
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

/** Headline with each letter in its own span so they can bounce in one after another. */
function headline(text: string): HTMLElement {
  const h = el('h2', 'cele-title');
  h.setAttribute('aria-label', text);
  [...text].forEach((ch, i) => {
    const s = el('span', ch === ' ' ? 'cele-ch sp' : 'cele-ch', ch);
    s.setAttribute('aria-hidden', 'true');
    s.style.setProperty('--i', String(i));
    h.append(s);
  });
  return h;
}

/**
 * Full-screen "Your next read!" overlay. Only Close, Start reading, or Yes → Re-spin dismiss it
 * (no backdrop tap, no Escape) — it's their pick, it stays until they're done with it.
 */
export function showCelebration(book: Book, actions: CelebrationActions): void {
  if (open) open.remove();
  const app = document.querySelector<HTMLElement>('#app');
  const prevFocus = document.activeElement as HTMLElement | null;

  const root = el('div', 'cele');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'Your next read!');

  const rays = el('div', 'cele-rays');
  rays.setAttribute('aria-hidden', 'true');
  const body = el('div', 'cele-body');

  const title = headline('🎉 Your next read!');

  const stage = el('div', 'cele-stage');
  const card = bookCard(book);
  card.classList.add('cele-card');
  const stamp = el('div', 'cele-stamp', 'Finished ✓');
  stamp.setAttribute('aria-hidden', 'true');
  card.append(stamp);
  const floater = el('div', 'cele-float');
  floater.append(card);
  stage.append(floater);

  const meta = el('div', 'cele-meta');
  meta.append(el('div', 'cele-book', book.title), el('div', 'cele-author', book.author));
  if (book.genre) meta.append(el('span', 'cele-genre', book.genre));

  // Panel 1: the question.
  const ask = el('div', 'cele-panel cele-ask');
  const q = el('p', 'cele-q', 'Already read this one?');
  const yes = button('btn-soft', "Yes, I've read it");
  const start = button('btn-hot btn-big', 'Start reading');
  const close = button('btn-ghost', 'Close');
  const row = el('div', 'cele-row');
  row.append(yes);
  ask.append(start, q, row, close);

  // Panel 2: after "Yes".
  const done = el('div', 'cele-panel cele-done');
  done.hidden = true;
  const doneMsg = el('p', 'cele-done-msg', 'Moved to Finished ✓');
  doneMsg.setAttribute('role', 'status');
  const respin = button('btn-hot btn-big', '🎲 Re-spin');
  const close2 = button('btn-ghost', 'Close');
  done.append(doneMsg, respin, close2);

  [title, stage, meta, ask].forEach((n, i) => n.style.setProperty('--d', String(i)));
  body.append(title, stage, meta, ask, done);
  // Rays stay put; the content scrolls on very short screens (centred via margin:auto, never clipped).
  const scroller = el('div', 'cele-scroll');
  scroller.append(body);
  root.append(rays, scroller);
  document.body.append(root);
  open = root;
  if (app) app.inert = true;
  document.body.classList.add('cele-open');

  // Kick the entrance on the next frame so transitions run.
  requestAnimationFrame(() => {
    root.classList.add('on');
    bigParty();
  });
  start.focus({ preventScroll: true });

  let busy = false;
  const dismiss = async (how: 'close' | 'start' | 'respin'): Promise<void> => {
    root.classList.add('out', `out-${how}`);
    await afterAnim(root, how === 'start' ? 650 : 380);
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
    root.classList.add('finished');
    ask.hidden = true;
    done.hidden = false;
    scroller.scrollTop = 0;
    burstFrom(card, 'small');
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
