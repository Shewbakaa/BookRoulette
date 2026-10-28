import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Book } from '../types';
import { createFilter, orderGenres } from './filter';

vi.mock('./fx', () => ({ reducedMotion: () => true, play: () => Promise.resolve() }));

const book = (genre: string, i: number): Book =>
  ({ id: `b${i}`, title: `T${i}`, author: 'A', genre, color: '#2f4a3a', status: 'unread', addedAt: i }) as Book;

describe('orderGenres', () => {
  it('moves checked genres to the top, keeping list order within each group', () => {
    expect(orderGenres(['Fiction', 'Fantasy', 'Sci-Fi', 'Romance'], new Set(['Romance', 'Fantasy']))).toEqual([
      'Fantasy', 'Romance', 'Fiction', 'Sci-Fi',
    ]);
  });
  it('is the plain list when nothing is checked', () => {
    expect(orderGenres(['A', 'B'], new Set())).toEqual(['A', 'B']);
  });
});

describe('Genre Filter dropdown', () => {
  let root: HTMLElement;
  let onChange: ReturnType<typeof vi.fn>;
  const trigger = (): HTMLButtonElement => root.querySelector<HTMLButtonElement>('.gf-trigger')!;
  const options = (): string[] =>
    [...root.querySelectorAll<HTMLElement>('.gf-option')].map((o) => o.dataset.genre ?? '');
  const box = (g: string): HTMLInputElement =>
    root.querySelector<HTMLInputElement>(`.gf-option[data-genre="${g}"] input`)!;

  beforeEach(() => {
    document.body.replaceChildren();
    root = document.createElement('nav');
    document.body.append(root);
    onChange = vi.fn();
    const f = createFilter(root, onChange);
    f.update([book('Fantasy', 1), book('Sci-Fi', 2), book('Sci-Fi', 3), book('Romance', 4)]);
  });

  it('is labelled "Genre Filter" and starts closed', () => {
    expect(trigger().textContent).toContain('Genre Filter');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(root.querySelector<HTMLElement>('.gf-panel')!.hidden).toBe(true);
  });

  it('opens a checkbox list of genres', () => {
    trigger().click();
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(root.querySelector<HTMLElement>('.gf-panel')!.hidden).toBe(false);
    expect(options()).toContain('Fantasy');
    expect(box('Fantasy').type).toBe('checkbox');
  });

  it('checking a genre filters and moves it to the top', () => {
    trigger().click();
    const before = options();
    const last = before[before.length - 1];
    box(last).click();
    expect(onChange).toHaveBeenLastCalledWith(new Set([last]));
    expect(options()[0]).toBe(last);
    expect(box(last).checked).toBe(true);
  });

  it('unchecking returns it to its place', () => {
    trigger().click();
    const before = options();
    box('Romance').click();
    box('Romance').click();
    expect(options()).toEqual(before);
    expect(onChange).toHaveBeenLastCalledWith(new Set());
  });

  it('shows the selection on the closed trigger and Clear resets it', () => {
    trigger().click();
    box('Fantasy').click();
    box('Sci-Fi').click();
    expect(trigger().textContent).toMatch(/2/);
    root.querySelector<HTMLButtonElement>('.gf-clear')!.click();
    expect(onChange).toHaveBeenLastCalledWith(new Set());
    expect(trigger().textContent).toContain('All genres');
  });

  it('closes on Escape and on an outside tap', () => {
    trigger().click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    trigger().click();
    document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
  });
});
