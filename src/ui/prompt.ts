import { afterAnim, play, pressSpring, reducedMotion } from './fx';

export interface ConfirmOptions {
  /** Message parts; strings are plain text, `{ em }` parts are emphasised. All set via textContent. */
  message: (string | { em: string })[];
  ok: string;
  cancel: string;
}

/** Small in-app confirm modal (replaces window.confirm). Resolves true for OK. */
export function askConfirm(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const back = document.createElement('div');
    back.className = 'prompt-back';
    const box = document.createElement('div');
    box.className = 'prompt';
    box.setAttribute('role', 'alertdialog');
    box.setAttribute('aria-modal', 'true');

    const p = document.createElement('p');
    p.className = 'prompt-msg';
    p.id = `prompt-msg-${Date.now()}`;
    for (const part of opts.message) {
      if (typeof part === 'string') p.append(document.createTextNode(part));
      else {
        const em = document.createElement('em');
        em.textContent = part.em;
        p.append(em);
      }
    }
    box.setAttribute('aria-labelledby', p.id);

    const row = document.createElement('div');
    row.className = 'prompt-row';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'btn btn-secondary springy';
    cancel.textContent = opts.cancel;
    const ok = document.createElement('button');
    ok.type = 'button';
    ok.className = 'btn btn-primary springy';
    ok.textContent = opts.ok;
    row.append(cancel, ok);
    box.append(p, row);
    back.append(box);
    document.body.append(back);
    const springs = [cancel, ok].map(pressSpring);
    if (!reducedMotion()) {
      void play(box, { opacity: [0, 1], scale: [0.94, 1], y: [10, 0] }, { type: 'spring', stiffness: 420, damping: 30 });
    }
    ok.focus({ preventScroll: true });

    let settled = false;
    const finish = (v: boolean): void => {
      if (settled) return;
      settled = true;
      document.removeEventListener('keydown', onKey);
      springs.forEach((off) => off());
      back.classList.add('out');
      void afterAnim(back, 200).then(() => back.remove());
      resolve(v);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') { e.stopPropagation(); finish(false); }
    };
    document.addEventListener('keydown', onKey);
    ok.addEventListener('click', () => finish(true));
    cancel.addEventListener('click', () => finish(false));
    // Tapping outside the small prompt cancels (harmless); it never closes the celebration under it.
    back.addEventListener('click', (e) => { if (e.target === back) finish(false); });
  });
}
