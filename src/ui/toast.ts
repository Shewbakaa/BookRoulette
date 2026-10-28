import { play, reducedMotion } from './fx';

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

/**
 * Small dark card at the top of the screen with a status dot (brass ok, muted info, amber warn).
 * Text is set via textContent. Slides in, auto-dismisses.
 */
export function toast(msg: string, kind: ToastKind = 'info', ms = 2600): HTMLElement {
  const h = getHost();
  const t = document.createElement('div');
  t.className = `toast toast-${kind}`;
  const dot = document.createElement('span');
  dot.className = 'toast-dot';
  dot.setAttribute('aria-hidden', 'true');
  const m = document.createElement('span');
  m.className = 'toast-msg';
  m.textContent = msg;
  t.append(dot, m);
  // Keep at most 3 on screen.
  while (h.children.length >= 3) h.firstElementChild?.remove();
  h.append(t);
  if (!reducedMotion()) {
    void play(t, { opacity: [0, 1], y: [-14, 0] }, { type: 'spring', stiffness: 420, damping: 32 });
  }
  let gone = false;
  const dismiss = (): void => {
    if (gone) return;
    gone = true;
    if (reducedMotion()) {
      t.classList.add('out');
      window.setTimeout(() => t.remove(), 160);
      return;
    }
    void play(t, { opacity: 0, y: -8 }, { duration: 0.22, ease: 'easeIn' }).then(() => t.remove());
  };
  t.addEventListener('click', dismiss);
  window.setTimeout(dismiss, ms);
  return t;
}
