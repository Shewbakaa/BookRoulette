/**
 * Minimal hooks between the main screen and later features (Task 6/7).
 *  - onSpinLanded(fn): called with the winner after every spin settles. Returns unsubscribe.
 *  - spinAgain(): triggers a spin exactly like tapping Spin (no-op → null if empty or already spinning).
 */
import type { Book } from './types';

type Landed = (winner: Book) => void;
const landed = new Set<Landed>();
let spinImpl: (() => Promise<Book | null>) | null = null;

export function onSpinLanded(fn: Landed): () => void {
  landed.add(fn);
  return () => { landed.delete(fn); };
}

export function emitSpinLanded(winner: Book): void {
  landed.forEach((fn) => fn(winner));
}

export function setSpinHandler(fn: () => Promise<Book | null>): void {
  spinImpl = fn;
}

export function spinAgain(): Promise<Book | null> {
  return spinImpl ? spinImpl() : Promise.resolve(null);
}
