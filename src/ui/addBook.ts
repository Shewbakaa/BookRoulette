import type { Book, BookInput } from '../types';
import { store } from '../store';
import { lookupIsbn } from '../lookup';
import { MSG, resolveScan } from '../addFlow';
import { cameraErrorMessage, startScanner } from '../scanner';
import { bookCard } from './bookCard';
import { bookForm } from './bookForm';
import { openSheet, type Sheet } from './drawer';
import { reducedMotion } from './fx';
import { toast } from './toast';

interface Flow {
  sheet: Sheet;
  /** Runs a code exactly as if the camera had read it. */
  handle(raw: string): Promise<void>;
}

let current: Flow | null = null;

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] => {
  const n = document.createElement(tag);
  n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};

const btn = (cls: string, text: string): HTMLButtonElement => {
  const b = el('button', `btn ${cls}`, text);
  b.type = 'button';
  return b;
};

/** The new card flies from the form preview into the carousel. Skipped under reduced motion. */
function flyToRing(from: Element | null, book: Book): void {
  if (reducedMotion() || !from) return;
  const target = document.querySelector('#carousel .car-stage') ?? document.querySelector('#carousel');
  if (!target) return;
  const a = from.getBoundingClientRect();
  const b = target.getBoundingClientRect();
  if (!a.width || !b.width) return;
  const card = bookCard(book);
  card.classList.add('fly-card');
  card.style.left = `${a.left}px`;
  card.style.top = `${a.top}px`;
  card.style.width = `${a.width}px`;
  card.style.height = `${a.height}px`;
  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  card.style.setProperty('--dx', `${dx}px`);
  card.style.setProperty('--dy', `${dy}px`);
  document.body.append(card);
  card.addEventListener('animationend', () => card.remove(), { once: true });
  window.setTimeout(() => card.remove(), 1400);
}

/** Opens the Add book sheet. With `isbn`, skips the camera and handles that code directly. */
export function openAddBook(opts: { isbn?: string } = {}): Flow {
  if (current && !current.sheet.closed) {
    if (opts.isbn) void current.handle(opts.isbn);
    return current;
  }

  let stopCam: (() => Promise<void>) | null = null;
  let token = 0; // bumps on every view change, so stale async work is dropped
  const release = (): void => {
    const s = stopCam;
    stopCam = null;
    if (s) void s();
  };

  const sheet = openSheet({
    title: MSG.manual,
    className: 'sheet-add',
    onClose: () => { token++; release(); if (current?.sheet === sheet) current = null; },
  });
  const view = el('div', 'add-view');
  sheet.body.append(view);

  const swap = (...nodes: Node[]): number => {
    token++;
    release();
    view.classList.remove('swap-in');
    void view.offsetWidth;
    view.classList.add('swap-in');
    view.replaceChildren(...nodes);
    return token;
  };

  const save = (input: BookInput, form: HTMLElement): void => {
    const r = store.add(input);
    if (!r.ok) {
      toast(MSG.duplicate, 'warn');
      return;
    }
    flyToRing(form.querySelector('.bf-card'), r.book);
    toast(`Added “${r.book.title}”`, 'ok');
    void sheet.close();
  };

  const showForm = (initial: Partial<BookInput>, heading: string, note?: { text: string; kind: 'ok' | 'warn' | 'info' }): void => {
    sheet.setTitle(heading);
    const nodes: Node[] = [];
    if (note) nodes.push(el('p', `add-note add-note-${note.kind}`, note.text));
    const form = bookForm(initial, (b) => save(b, form));
    nodes.push(form);
    const again = btn('btn-ghost add-rescan', '📷 Scan instead');
    again.addEventListener('click', () => showScan());
    nodes.push(again);
    swap(...nodes);
    if (!initial.title) form.querySelector<HTMLInputElement>('input[name="title"]')?.focus({ preventScroll: true });
  };

  const showLookingUp = (isbn: string): void => {
    sheet.setTitle(MSG.lookingUp);
    const wrap = el('div', 'add-looking');
    const shimmer = el('div', 'shimmer-card');
    shimmer.setAttribute('aria-hidden', 'true');
    const lines = el('div', 'shimmer-lines');
    lines.append(el('div', 'shimmer-line'), el('div', 'shimmer-line short'), el('div', 'shimmer-line tiny'));
    wrap.append(shimmer, lines);
    const p = el('p', 'add-sub', `${MSG.lookingUp} ISBN ${isbn}`);
    p.setAttribute('role', 'status');
    swap(wrap, p);
  };

  const showDuplicate = (existing: Book): void => {
    sheet.setTitle(MSG.duplicate);
    const wrap = el('div', 'add-dupe');
    const card = bookCard(existing);
    card.classList.add('dupe-card');
    const meta = el('div', 'add-dupe-meta');
    meta.append(el('div', 'add-dupe-title', existing.title), el('div', 'add-dupe-author', existing.author));
    wrap.append(card, meta);
    const row = el('div', 'add-row');
    const scanMore = btn('btn-hot', '📷 Scan another');
    const done = btn('btn-soft', 'Done');
    scanMore.addEventListener('click', () => showScan());
    done.addEventListener('click', () => void sheet.close());
    row.append(done, scanMore);
    swap(wrap, row);
  };

  const handle = async (raw: string): Promise<void> => {
    if (sheet.closed) return;
    const outcome = await resolveScan(raw, {
      books: () => store.books(),
      lookup: async (isbn) => {
        showLookingUp(isbn);
        return lookupIsbn(isbn);
      },
    });
    if (sheet.closed) return;
    switch (outcome.kind) {
      case 'invalid':
        return; // not an ISBN: ignore, keep whatever is on screen
      case 'duplicate':
        toast(MSG.duplicate, 'warn');
        showDuplicate(outcome.existing);
        return;
      case 'found':
        showForm(outcome.input, `${MSG.found} 🎉`);
        return;
      case 'notFound':
        showForm({ isbn: outcome.isbn }, MSG.manual, { text: MSG.notFound, kind: 'warn' });
        return;
    }
  };

  const showScan = (): void => {
    sheet.setTitle('Scan a book');
    const cam = el('div', 'scan-cam');
    const viewport = el('div', 'scan-viewport');
    const laser = el('div', 'scan-laser');
    laser.setAttribute('aria-hidden', 'true');
    const starting = el('div', 'scan-starting', 'Starting camera…');
    cam.append(viewport, laser, starting);
    const hint = el('p', 'add-sub', 'Point at the barcode on the back of the book.');
    const manual = btn('btn-soft add-manual', '✍️ Enter manually');
    manual.addEventListener('click', () => showForm({}, MSG.manual));
    const my = swap(cam, hint, manual);

    startScanner(viewport, (isbn) => { void handle(isbn); })
      .then((stop) => {
        if (my !== token || sheet.closed) { void stop(); return; } // view changed while starting
        stopCam = stop;
        cam.classList.add('live');
      })
      .catch((err: unknown) => {
        if (my !== token || sheet.closed) return;
        showForm({}, MSG.manual, { text: cameraErrorMessage(err), kind: 'info' });
      });
  };

  current = { sheet, handle };
  if (opts.isbn) void handle(opts.isbn).then(() => {
    // An invalid test code leaves an empty view: fall back to manual entry.
    if (!view.hasChildNodes() && !sheet.closed) showForm({}, MSG.manual);
  });
  else showScan();
  return current;
}
