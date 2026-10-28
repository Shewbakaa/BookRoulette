import { animate } from 'motion';
import type { Book } from '../types';
import { allGenres } from '../genres';
import { reducedMotion } from './fx';

export interface Filter {
  /** Rebuild items from the library (keeps the selection where still valid). */
  update(books: Book[]): void;
  selected(): Set<string>;
  /** Locks the items (e.g. while the roulette spins). */
  setDisabled(on: boolean): void;
}

/** Underline base width; Motion scales it (transform only) to the item's width. */
const LINE_W = 100;

/**
 * Horizontally scrollable, multi-select genre filter: plain text items with superscript counts.
 * "All" clears the selection. One brass underline slides (Motion spring) to the most recently
 * chosen item; any other selected items keep a static underline of their own.
 */
export function createFilter(root: HTMLElement, onChange: (genres: Set<string>) => void): Filter {
  const sel = new Set<string>();
  /** Selection order, newest last — the sliding underline follows the newest. */
  const order: string[] = [];
  root.classList.add('filter');
  root.setAttribute('role', 'toolbar');
  root.setAttribute('aria-label', 'Filter by genre');

  const line = document.createElement('span');
  line.className = 'filter-underline';
  line.setAttribute('aria-hidden', 'true');
  line.style.width = `${LINE_W}px`;
  let placed = false;

  const chip = (label: string, value: string, count: number | null, on: boolean): HTMLButtonElement => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip' + (on ? ' on' : '') + (count === 0 ? ' zero' : '');
    b.dataset.genre = value;
    b.setAttribute('aria-pressed', String(on));
    b.textContent = label;
    if (count !== null) {
      const c = document.createElement('sup');
      c.className = 'count';
      c.textContent = String(count);
      b.append(c);
    }
    return b;
  };

  const lead = (): string => {
    for (let i = order.length - 1; i >= 0; i--) if (sel.has(order[i])) return order[i];
    return '';
  };

  /** Slide the underline under the lead item (jump on first placement or with reduced motion). */
  const moveLine = (): void => {
    const target = [...root.querySelectorAll<HTMLButtonElement>('button.chip')].find(
      (b) => (b.dataset.genre ?? '') === lead(),
    );
    root.querySelectorAll('button.chip.lead').forEach((b) => b.classList.remove('lead'));
    if (!target) return;
    target.classList.add('lead');
    const to = { x: target.offsetLeft, scaleX: target.offsetWidth / LINE_W };
    if (!placed || reducedMotion()) {
      animate(line, to, { duration: 0 });
      placed = target.offsetWidth > 0;
    } else {
      animate(line, to, { type: 'spring', stiffness: 420, damping: 40, mass: 0.9 });
    }
  };

  let books: Book[] = [];
  /** Returns true if a selected genre vanished from the library and was dropped. */
  const draw = (): boolean => {
    const counts = new Map<string, number>();
    let total = 0;
    for (const b of books) {
      if (b.status !== 'unread') continue;
      total++;
      counts.set(b.genre, (counts.get(b.genre) ?? 0) + 1);
    }
    const genres = allGenres(books);
    let pruned = false;
    for (const g of [...sel]) if (!genres.includes(g)) { sel.delete(g); pruned = true; }
    const scroll = root.scrollLeft;
    root.replaceChildren(
      line,
      chip('All', '', total, sel.size === 0),
      ...genres.map((g) => chip(g, g, counts.get(g) ?? 0, sel.has(g))),
    );
    root.scrollLeft = scroll;
    moveLine();
    return pruned;
  };

  root.addEventListener('click', (e) => {
    if (root.getAttribute('aria-disabled') === 'true') return;
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button.chip');
    if (!b || !root.contains(b)) return;
    const g = b.dataset.genre ?? '';
    if (g === '') {
      if (sel.size === 0) return;
      sel.clear();
    } else if (sel.has(g)) sel.delete(g);
    else {
      sel.add(g);
      const at = order.indexOf(g);
      if (at >= 0) order.splice(at, 1);
      order.push(g);
    }
    draw();
    onChange(new Set(sel));
  });

  // Fonts loading late change item widths: re-place the underline once they are ready.
  void document.fonts?.ready?.then(() => { placed = false; moveLine(); });

  return {
    update(next) {
      books = next;
      if (draw()) onChange(new Set(sel));
    },
    setDisabled(on) {
      root.setAttribute('aria-disabled', String(on));
      root.classList.toggle('disabled', on);
    },
    selected: () => new Set(sel),
  };
}
