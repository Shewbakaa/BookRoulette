import { describe, it, expect, vi } from 'vitest';
vi.mock('./fx', () => ({ afterAnim: () => Promise.resolve() }));
const { askConfirm } = await import('./prompt');
import { swapMessage } from '../reading';

describe('askConfirm', () => {
  it('renders the message safely and resolves true on Swap', async () => {
    const p = askConfirm({ message: swapMessage('<b>Dune</b>'), ok: 'Swap', cancel: 'Cancel' });
    const box = document.querySelector('.prompt')!;
    expect(box.querySelector('.prompt-msg')!.textContent).toBe('Swap with <b>Dune</b>? It goes back in the roulette.');
    expect(box.querySelector('em')!.textContent).toBe('<b>Dune</b>');
    expect(box.querySelector('b')).toBeNull();
    [...box.querySelectorAll('button')].find((b) => b.textContent === 'Swap')!.click();
    await expect(p).resolves.toBe(true);
  });

  it('resolves false on Cancel', async () => {
    const p = askConfirm({ message: ['x'], ok: 'Swap', cancel: 'Cancel' });
    [...document.querySelectorAll<HTMLButtonElement>('.prompt-back:not(.out) button')].find((b) => b.textContent === 'Cancel')!.click();
    await expect(p).resolves.toBe(false);
  });
});
