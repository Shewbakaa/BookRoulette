export type ToastKind = 'ok' | 'info' | 'warn';

let host: HTMLElement | null = null;

function getHost(): HTMLElement {
  if (host && host.isConnected) return host;
  host = document.createElement('div');
  host.className = 'toasts';
  host.setAttribute('role', 'status');
  host.setAttribute('aria-live', 'polite');
  document.body.append(host);
  return host;
}

const ICON: Record<ToastKind, string> = { ok: '✓', info: 'ℹ', warn: '!' };

/** Small bouncy pill at the top of the screen. Text is set via textContent. Auto-dismisses. */
export function toast(msg: string, kind: ToastKind = 'info', ms = 2600): HTMLElement {
  const h = getHost();
  const t = document.createElement('div');
  t.className = `toast toast-${kind}`;
  const i = document.createElement('span');
  i.className = 'toast-icon';
  i.setAttribute('aria-hidden', 'true');
  i.textContent = ICON[kind];
  const m = document.createElement('span');
  m.className = 'toast-msg';
  m.textContent = msg;
  t.append(i, m);
  // Keep at most 3 on screen.
  while (h.children.length >= 3) h.firstElementChild?.remove();
  h.append(t);
  let gone = false;
  const dismiss = (): void => {
    if (gone) return;
    gone = true;
    t.classList.add('out');
    window.setTimeout(() => t.remove(), 260);
  };
  t.addEventListener('click', dismiss);
  window.setTimeout(dismiss, ms);
  return t;
}
