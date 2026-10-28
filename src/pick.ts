import type { Book } from './types';

export const RING_MAX = 12;

type Rng = () => number;

export function poolFor(books: Book[], genres: Set<string>): Book[] {
  return books.filter(
    (b) => b.status === 'unread' && (genres.size === 0 || genres.has(b.genre)),
  );
}

export function pickWinner(pool: Book[], rng: Rng = Math.random): Book | null {
  if (pool.length === 0) return null;
  return pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
}

function shuffle<T>(arr: T[], rng: Rng): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function ringFor(pool: Book[], winner: Book | null, rng: Rng = Math.random): Book[] {
  if (!winner) {
    return [...pool].sort((a, b) => b.addedAt - a.addedAt).slice(0, RING_MAX);
  }
  const others = shuffle(pool.filter((b) => b.id !== winner.id), rng).slice(0, RING_MAX - 1);
  return shuffle([winner, ...others], rng);
}

export function spinTargetAngle(
  currentAngle: number,
  ringSize: number,
  winnerIndex: number,
  extraTurns: number,
): number {
  const target = -((winnerIndex * 360) / ringSize);
  const limit = currentAngle - extraTurns * 360;
  // largest value <= limit congruent to target mod 360
  const k = Math.floor((limit - target) / 360);
  return target + k * 360;
}
