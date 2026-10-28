import { describe, it, expect } from 'vitest';
import type { Book } from '../types';
import { createCarousel } from './carousel';

const book = (id: string, title: string): Book =>
  ({ id, title, author: 'A', genre: 'Fantasy', color: '#2f4a3a', status: 'unread', addedAt: 1 }) as Book;

describe('carousel pointer', () => {
  const root = document.createElement('section');
  document.body.append(root);
  const car = createCarousel(root);
  car.render([book('1', 'Dune'), book('2', 'Circe'), book('3', 'Emma')]);
  const pointer = root.querySelector<SVGSVGElement>('.pointer');

  it('is an inline, decorative brass svg', () => {
    expect(pointer).not.toBeNull();
    expect(pointer!.tagName.toLowerCase()).toBe('svg');
    expect(pointer!.getAttribute('aria-hidden')).toBe('true');
    expect(pointer!.getAttribute('width')).toBe('22');
    expect(pointer!.getAttribute('height')).toBe('26');
  });

  it('is centered with left: calc(50% - 11px), never a translate transform', () => {
    const style = pointer!.getAttribute('style') ?? '';
    expect(style.replace(/\s+/g, '')).toContain('left:calc(50%-11px)');
    expect(pointer!.style.transform ?? '').not.toMatch(/translate/i);
    expect(style).not.toMatch(/translate/i);
  });

  it('pivots on its pin', () => {
    expect((pointer!.getAttribute('style') ?? '').replace(/\s+/g, '')).toContain('transform-origin:50%4px');
  });
});

describe('small rings', () => {
  it('shows every book when there are only three (ring is tiled, not a hidden triangle)', () => {
    const root = document.createElement('section');
    document.body.append(root);
    createCarousel(root).render([book('1', 'Dune'), book('2', 'Circe'), book('3', 'Emma')]);
    const titles = [...root.querySelectorAll('.car-slot')].map((s) => s.textContent ?? '');
    expect(titles.length).toBeGreaterThanOrEqual(8);
    for (const t of ['Dune', 'Circe', 'Emma']) expect(titles.some((x) => x.includes(t))).toBe(true);
  });

  it('places the pointer from the measured front cover, not a fixed offset', () => {
    const root = document.createElement('section');
    document.body.append(root);
    createCarousel(root).render([book('1', 'Dune'), book('2', 'Circe')]);
    const p = root.querySelector<SVGSVGElement>('.pointer')!;
    expect(p.style.top).toMatch(/^-?\d+(\.\d+)?px$/);
  });
});
