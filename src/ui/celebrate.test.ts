import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Book } from '../types';

vi.mock('./fx', () => ({
  reducedMotion: () => true,
  bigParty: vi.fn(),
  burstFrom: vi.fn(),
  afterAnim: () => Promise.resolve(),
}));
const spinAgain = vi.fn(() => Promise.resolve(null));
vi.mock('../app', () => ({ spinAgain: () => spinAgain() }));

const { showCelebration, celebrationOpen } = await import('./celebrate');
const { store } = await import('../store');

const book: Book = {
  id: 'b1', title: '<img src=x onerror=alert(1)>', author: 'Auth', genre: 'Fantasy',
  color: '#335577', status: 'unread', addedAt: 1,
};
const flush = () => new Promise((r) => setTimeout(r, 0));
const btn = (label: string) =>
  [...document.querySelectorAll<HTMLButtonElement>('.cele button')].find((b) => b.textContent === label && !b.closest('[hidden]'))!;

function actions(over: Partial<Parameters<typeof showCelebration>[1]> = {}) {
  return { onAlreadyRead: vi.fn(), onStartReading: vi.fn(), onClose: vi.fn(), ...over };
}

beforeEach(() => {
  document.body.innerHTML = '<div id="app"></div>';
  spinAgain.mockClear();
});

describe('showCelebration', () => {
  it('shows the headline, question and buttons; book text is escaped', () => {
    showCelebration(book, actions());
    const root = document.querySelector('.cele')!;
    expect(root.getAttribute('aria-label')).toBe('Your next read!');
    expect(root.querySelector('.cele-title')!.getAttribute('aria-label')).toBe('🎉 Your next read!');
    expect(root.querySelector('.cele-q')!.textContent).toBe('Already read this one?');
    expect(btn("Yes, I've read it")).toBeTruthy();
    expect(btn('Start reading')).toBeTruthy();
    expect(btn('Close')).toBeTruthy();
    expect(root.querySelector('img[src="x"]')).toBeNull();
    expect(root.querySelector('.cele-book')!.textContent).toBe(book.title);
  });

  it('does not close on backdrop tap or Escape', async () => {
    showCelebration(book, actions());
    const root = document.querySelector<HTMLElement>('.cele')!;
    root.click();
    root.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await flush();
    expect(celebrationOpen()).toBe(true);
  });

  it('Close closes and calls onClose', async () => {
    const a = actions();
    showCelebration(book, a);
    btn('Close').click();
    await flush();
    expect(a.onClose).toHaveBeenCalledOnce();
    expect(celebrationOpen()).toBe(false);
    expect(document.querySelector('.cele')).toBeNull();
  });

  it('Yes marks read, stays open with Re-spin, and Re-spin closes then spins', async () => {
    store.add({ title: 'Other', author: 'O', genre: 'Fantasy' });
    const a = actions();
    showCelebration(book, a);
    btn("Yes, I've read it").click();
    await flush();
    expect(a.onAlreadyRead).toHaveBeenCalledOnce();
    expect(celebrationOpen()).toBe(true);
    expect(document.querySelector('.cele-done-msg')!.textContent).toBe('Moved to Finished ✓');
    btn('🎲 Re-spin').click();
    await flush();
    expect(celebrationOpen()).toBe(false);
    expect(spinAgain).toHaveBeenCalledOnce();
    expect(a.onClose).not.toHaveBeenCalled();
  });

  it('Yes with no unread books left hides Re-spin and says so', async () => {
    for (const b of store.books()) store.remove(b.id);
    showCelebration(book, actions());
    btn("Yes, I've read it").click();
    await flush();
    expect(document.querySelector('.cele-empty')!.textContent).toBe('No books left — add some!');
    expect(btn('🎲 Re-spin')).toBeUndefined();
  });

  it('Start reading closes unless the action returns false', async () => {
    const keep = actions({ onStartReading: vi.fn(async () => false) });
    showCelebration(book, keep);
    btn('Start reading').click();
    await flush();
    expect(keep.onStartReading).toHaveBeenCalledOnce();
    expect(celebrationOpen()).toBe(true);

    const go = actions({ onStartReading: vi.fn(async () => true) });
    showCelebration(book, go);
    btn('Start reading').click();
    await flush();
    expect(celebrationOpen()).toBe(false);
  });
});
