import { revealList, sheetIn, sheetOut } from './fx';

/* ------------------------------------------------------------------ */
/* Generic bottom sheet (used by the menu drawer, Add book, and Task 8) */
/* ------------------------------------------------------------------ */

export interface SheetOptions {
  /** Heading shown at the top of the sheet (textContent). */
  title: string;
  /** Extra class on the sheet panel, e.g. 'sheet-add'. */
  className?: string;
  /** Called once after the sheet has started closing (by any means). */
  onClose?(): void;
}

export interface Sheet {
  /** The scrollable content area; fill it with your UI. */
  body: HTMLElement;
  /** The panel element (for measuring / extra classes). */
  panel: HTMLElement;
  setTitle(text: string): void;
  /** Animate out and remove. Resolves when gone. Safe to call more than once. */
  close(): Promise<void>;
  readonly closed: boolean;
}

const openSheets: Sheet[] = [];

/**
 * Slide-up sheet with a backdrop and a spring entrance (fx.sheetIn / sheetOut). Closes on
 * backdrop tap, Escape, or the close button. Only the top-most sheet reacts to Escape.
 * Closing mid-open is safe: sheetOut takes over the same values and the removal is capped.
 */
export function openSheet(opts: SheetOptions): Sheet {
  const prevFocus = document.activeElement as HTMLElement | null;
  const back = document.createElement('div');
  back.className = 'sheet-back';
  const panel = document.createElement('div');
  panel.className = `sheet${opts.className ? ` ${opts.className}` : ''}`;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');

  const grab = document.createElement('div');
  grab.className = 'sheet-grab';
  grab.setAttribute('aria-hidden', 'true');
  const head = document.createElement('div');
  head.className = 'sheet-head';
  const h = document.createElement('h2');
  h.className = 'sheet-title';
  h.id = `sheet-t-${Math.random().toString(36).slice(2)}`;
  h.textContent = opts.title;
  panel.setAttribute('aria-labelledby', h.id);
  const x = document.createElement('button');
  x.type = 'button';
  x.className = 'sheet-x';
  x.setAttribute('aria-label', 'Close');
  x.innerHTML =
    '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false">' +
    '<path d="M1.5 1.5l9 9M10.5 1.5l-9 9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';
  head.append(h, x);

  const body = document.createElement('div');
  body.className = 'sheet-body';
  panel.append(grab, head, body);
  back.append(panel);
  back.style.opacity = '0';
  panel.style.opacity = '0';
  document.body.append(back);
  void sheetIn(panel, back).catch(() => {});

  let closed = false;
  let gone: Promise<void> | null = null;
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && openSheets[openSheets.length - 1] === sheet) {
      e.stopPropagation();
      void sheet.close();
    }
  };

  const sheet: Sheet = {
    body,
    panel,
    setTitle: (t) => { h.textContent = t; },
    get closed() { return closed; },
    close(): Promise<void> {
      if (gone) return gone;
      closed = true;
      document.removeEventListener('keydown', onKey);
      const i = openSheets.indexOf(sheet);
      if (i >= 0) openSheets.splice(i, 1);
      back.classList.add('out'); // taps fall through while it leaves
      try { opts.onClose?.(); } catch { /* never let a callback block closing */ }
      if (prevFocus && prevFocus.isConnected) prevFocus.focus({ preventScroll: true });
      let timer = 0;
      const cap = new Promise<void>((r) => { timer = window.setTimeout(r, 450); });
      const out = sheetOut(panel, back).catch(() => {});
      gone = Promise.race([out, cap]).then(() => {
        window.clearTimeout(timer);
        back.remove();
      });
      return gone;
    },
  };
  openSheets.push(sheet);

  document.addEventListener('keydown', onKey);
  x.addEventListener('click', () => void sheet.close());
  back.addEventListener('click', (e) => { if (e.target === back) void sheet.close(); });
  x.focus({ preventScroll: true });
  return sheet;
}

/* ------------------------- */
/* Floating menu + drawer    */
/* ------------------------- */

export interface DrawerItem {
  /** Row label; a function is re-evaluated each time the drawer renders. */
  label: string | (() => string);
  /** Right-side detail (e.g. "7 unread", "On"); re-evaluated on render and after a `stay` tap. */
  detail?: string | (() => string);
  /** Draw the detail in brass: it names an action (e.g. "Scan ↗") rather than a fact. */
  action?: boolean;
  open(): void;
  /** Keep the drawer open after tapping (for toggles). Default: the drawer closes first. */
  stay?: boolean;
}

export interface Drawer {
  open(): void;
  close(): Promise<void>;
  readonly isOpen: boolean;
}

const val = (v: string | (() => string)): string => (typeof v === 'function' ? v() : v);

/** Mounts the floating brass menu button (top-right) and its slide-up menu sheet. */
export function createDrawer(items: DrawerItem[]): Drawer {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'menu-btn';
  btn.setAttribute('aria-label', 'Menu');
  btn.setAttribute('aria-expanded', 'false');
  btn.innerHTML =
    '<svg class="mb-glyph" width="16" height="12" viewBox="0 0 16 12" aria-hidden="true" focusable="false">' +
    '<path d="M1 1h14M1 6h14M1 11h14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
  document.body.append(btn);

  let sheet: Sheet | null = null;

  const renderList = (list: HTMLElement): void => {
    list.replaceChildren();
    for (const it of items) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'drawer-item';
      const lb = document.createElement('span');
      lb.className = 'di-label';
      lb.textContent = val(it.label);
      const dt = document.createElement('span');
      dt.className = `di-detail${it.action ? ' di-action' : ''}`;
      dt.textContent = it.detail ? val(it.detail) : '';
      b.append(lb, dt);
      b.addEventListener('click', () => {
        if (it.stay) {
          it.open();
          lb.textContent = val(it.label);
          dt.textContent = it.detail ? val(it.detail) : '';
          return;
        }
        void api.close();
        it.open();
      });
      list.append(b);
    }
    revealList([...list.children]);
  };

  const api: Drawer = {
    get isOpen() { return !!sheet && !sheet.closed; },
    open() {
      if (api.isOpen) return;
      btn.classList.add('open');
      btn.setAttribute('aria-expanded', 'true');
      sheet = openSheet({
        title: 'Menu',
        className: 'sheet-menu',
        onClose: () => {
          btn.classList.remove('open');
          btn.setAttribute('aria-expanded', 'false');
        },
      });
      const list = document.createElement('div');
      list.className = 'drawer-list';
      renderList(list);
      sheet.body.append(list);
    },
    close() {
      return sheet ? sheet.close() : Promise.resolve();
    },
  };

  btn.addEventListener('click', () => (api.isOpen ? void api.close() : api.open()));
  return api;
}
