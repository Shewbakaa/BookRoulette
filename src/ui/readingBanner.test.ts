import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Book } from '../types';

vi.mock('./fx', () => ({ reducedMotion: () => true, burstFrom: vi.fn(), afterAnim: () => Promise.resolve() }));
const setStatus = vi.fn();
vi.mock('../store', () => ({ store: { setStatus: (...a: unknown[]) => setStatus(...a) } }));

const { renderReadingBanner } = await import('./readingBanner');
const fx = await import('./fx');

const book: Book = { id: 'r1', title: 'Circe <i>', author: 'M', genre: 'Fantasy', color: '#aa3366', status: 'reading', addedAt: 1 };
const flush = () => new Promise((r) => setTimeout(r, 0));
let root: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = '<section id="slot"></section>';
  root = document.getElementById('slot')!;
  setStatus.mockClear();
});

describe('renderReadingBanner', () => {
  it('renders nothing with no book', () => {
    renderReadingBanner(root, undefined);
    expect(root.children.length).toBe(0);
  });

  it('shows label, escaped title and buttons; re-render with the same book is a no-op', () => {
    renderReadingBanner(root, book);
    expect(root.querySelector('.rb-label')!.textContent).toBe('Currently reading');
    expect(root.querySelector('.rb-title')!.textContent).toBe('Circe <i>');
    expect(root.querySelector('i')).toBeNull();
    const first = root.querySelector('.rb-wrap');
    renderReadingBanner(root, { ...book });
    expect(root.querySelector('.rb-wrap')).toBe(first);
  });

  it('Finished it! sets finished with a burst; Put back sets unread', () => {
    renderReadingBanner(root, book);
    const [fin, back] = root.querySelectorAll<HTMLButtonElement>('button');
    expect(fin.textContent).toBe('Finished it!');
    expect(back.textContent).toBe('Put back');
    fin.click();
    expect(setStatus).toHaveBeenLastCalledWith('r1', 'finished');
    expect(fx.burstFrom).toHaveBeenCalled();
    back.click();
    expect(setStatus).toHaveBeenLastCalledWith('r1', 'unread');
  });

  it('removes the banner when the book is gone', async () => {
    renderReadingBanner(root, book);
    renderReadingBanner(root, undefined);
    await flush();
    expect(root.querySelector('.rb-wrap')).toBeNull();
  });
});
