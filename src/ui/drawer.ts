import { afterAnim } from './fx';

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
 * Slide-up sheet with a backdrop and a springy entrance. Closes on backdrop tap, Escape,
 * or the ✕ button. Only the top-most sheet reacts to Escape.
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
  x.textContent = '✕';
  head.append(h, x);

  const body = document.createElement('div');
  body.className = 'sheet-body';
  panel.append(grab, head, body);
  back.append(panel);
  document.body.append(back);
  requestAnimationFrame(() => back.classList.add('on'));

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
      back.classList.remove('on');
      back.classList.add('out');
      try { opts.onClose?.(); } catch { /* never let a callback block closing */ }
      if (prevFocus && prevFocus.isConnected) prevFocus.focus({ preventScroll: true });
      gone = afterAnim(panel, 320).then(() => back.remove());
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
  /** Text label; a function is re-evaluated each time the drawer renders (e.g. "Sound: on"). */
  label: string | (() => string);
  icon: string | (() => string);
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

/** Mounts the floating ☰ button (top-right) and its slide-up menu sheet. */
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
    items.forEach((it, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'drawer-item';
      b.style.setProperty('--i', String(i));
      const ic = document.createElement('span');
      ic.className = 'di-icon';
      ic.setAttribute('aria-hidden', 'true');
      ic.textContent = val(it.icon);
      const lb = document.createElement('span');
      lb.className = 'di-label';
      lb.textContent = val(it.label);
      const chev = document.createElement('span');
      chev.className = 'di-chev';
      chev.setAttribute('aria-hidden', 'true');
      chev.textContent = it.stay ? '' : '›';
      b.append(ic, lb, chev);
      b.addEventListener('click', () => {
        if (it.stay) {
          it.open();
          ic.textContent = val(it.icon);
          lb.textContent = val(it.label);
          b.classList.remove('pulse');
          void b.offsetWidth;
          b.classList.add('pulse');
          return;
        }
        void api.close();
        it.open();
      });
      list.append(b);
    });
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
