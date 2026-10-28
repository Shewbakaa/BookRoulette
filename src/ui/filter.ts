import type { Book } from '../types';
import { allGenres } from '../genres';
import { play, reducedMotion } from './fx';

export interface Filter {
  /** Rebuild options from the library (keeps the selection where still valid). */
  update(books: Book[]): void;
  selected(): Set<string>;
  /** Locks the dropdown (e.g. while the roulette spins); closes it if open. */
  setDisabled(on: boolean): void;
}

/** Checked genres first, then the rest; each group keeps the library's genre order. */
export function orderGenres(genres: string[], checked: Set<string>): string[] {
  return [...genres.filter((g) => checked.has(g)), ...genres.filter((g) => !checked.has(g))];
}

const CHEVRON = `<svg class="gf-chev" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
  <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const CHECK = `<svg class="gf-tick" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
  <path d="M2.5 6.2 5 8.6l4.5-5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/**
 * "Genre Filter" dropdown: a trigger showing the current selection, and a panel of checkbox
 * options with unread counts. Checked genres float to the top (animated FLIP, transform only).
 * Nothing checked = all genres.
 */
export function createFilter(root: HTMLElement, onChange: (genres: Set<string>) => void): Filter {
  const sel = new Set<string>();
  root.classList.add('gf');

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'gf-trigger';
  trigger.setAttribute('aria-haspopup', 'true');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-controls', 'gf-panel');

  const panel = document.createElement('div');
  panel.className = 'gf-panel';
  panel.id = 'gf-panel';
  panel.hidden = true;
  panel.setAttribute('role', 'group');
  panel.setAttribute('aria-label', 'Genre Filter');
  panel.innerHTML = `
    <div class="gf-head"><span class="gf-title">Genre Filter</span>
      <button type="button" class="gf-clear text-act">Clear</button></div>
    <div class="gf-list"></div>`;
  const list = panel.querySelector<HTMLElement>('.gf-list')!;
  const clear = panel.querySelector<HTMLButtonElement>('.gf-clear')!;
  root.replaceChildren(trigger, panel);

  let books: Book[] = [];
  let open = false;

  const summary = (): string => {
    const picked = [...sel];
    if (picked.length === 0) return 'All genres';
    if (picked.length === 1) return picked[0];
    return `${picked.length} genres`;
  };

  const drawTrigger = (): void => {
    trigger.innerHTML = `<span class="gf-label">Genre Filter</span><span class="gf-value"></span>${CHEVRON}`;
    trigger.querySelector('.gf-value')!.textContent = summary();
    trigger.classList.toggle('active', sel.size > 0);
    clear.hidden = sel.size === 0;
  };

  const option = (g: string, count: number): HTMLLabelElement => {
    const row = document.createElement('label');
    row.className = 'gf-option' + (sel.has(g) ? ' on' : '') + (count === 0 ? ' zero' : '');
    row.dataset.genre = g;
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = sel.has(g);
    const mark = document.createElement('span');
    mark.className = 'gf-box';
    mark.innerHTML = CHECK;
    const name = document.createElement('span');
    name.className = 'gf-name';
    name.textContent = g;
    const n = document.createElement('span');
    n.className = 'gf-count';
    n.textContent = String(count);
    row.append(box, mark, name, n);
    return row;
  };

  /** Rebuild the option rows; with `flip`, slide rows from their old spots to the new order. */
  const drawList = (flip: boolean): void => {
    const before = new Map<string, number>();
    if (flip) list.querySelectorAll<HTMLElement>('.gf-option').forEach((o) => before.set(o.dataset.genre!, o.offsetTop));
    const counts = new Map<string, number>();
    for (const b of books) if (b.status === 'unread') counts.set(b.genre, (counts.get(b.genre) ?? 0) + 1);
    list.replaceChildren(...orderGenres(allGenres(books), sel).map((g) => option(g, counts.get(g) ?? 0)));
    if (!flip || reducedMotion()) return;
    list.querySelectorAll<HTMLElement>('.gf-option').forEach((o) => {
      const from = before.get(o.dataset.genre!);
      const dy = from === undefined ? 0 : from - o.offsetTop;
      if (dy) void play(o, { y: [dy, 0] }, { type: 'spring', stiffness: 520, damping: 44 });
    });
  };

  const prune = (): boolean => {
    const genres = allGenres(books);
    let pruned = false;
    for (const g of [...sel]) if (!genres.includes(g)) { sel.delete(g); pruned = true; }
    return pruned;
  };

  const setOpen = (on: boolean): void => {
    if (on === open) return;
    open = on;
    trigger.setAttribute('aria-expanded', String(on));
    trigger.classList.toggle('open', on);
    if (on) {
      drawList(false);
      panel.hidden = false;
      list.scrollTop = 0;
      if (!reducedMotion()) void play(panel, { opacity: [0, 1], y: [-6, 0] }, { duration: 0.18, ease: 'easeOut' });
    } else {
      panel.hidden = true;
    }
  };

  const changed = (): void => {
    drawTrigger();
    onChange(new Set(sel));
  };

  trigger.addEventListener('click', () => {
    if (root.getAttribute('aria-disabled') === 'true') return;
    setOpen(!open);
  });

  list.addEventListener('change', (e) => {
    const box = e.target as HTMLInputElement;
    const g = box.closest<HTMLElement>('.gf-option')?.dataset.genre;
    if (!g) return;
    if (box.checked) sel.add(g);
    else sel.delete(g);
    drawList(true);
    changed();
  });

  clear.addEventListener('click', () => {
    if (sel.size === 0) return;
    sel.clear();
    drawList(true);
    changed();
  });

  document.addEventListener('pointerdown', (e) => {
    if (open && !root.contains(e.target as Node)) setOpen(false);
  });
  document.addEventListener('keydown', (e) => {
    if (open && e.key === 'Escape') { setOpen(false); trigger.focus(); }
  });

  drawTrigger();

  return {
    update(next) {
      books = next;
      const pruned = prune();
      drawTrigger();
      if (open) drawList(false);
      if (pruned) onChange(new Set(sel));
    },
    setDisabled(on) {
      root.setAttribute('aria-disabled', String(on));
      root.classList.toggle('disabled', on);
      trigger.disabled = on;
      if (on) setOpen(false);
    },
    selected: () => new Set(sel),
  };
}
