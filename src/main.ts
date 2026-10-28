import './style.css';
import type { Book } from './types';
import { store } from './store';
import { poolFor, pickWinner, ringFor } from './pick';
import { sound } from './sound';
import { createCarousel } from './ui/carousel';
import { createFilter } from './ui/filter';
import { emitSpinLanded, setSpinHandler } from './app';

export { onSpinLanded, spinAgain } from './app';

const DEMO: { title: string; author: string; genre: string; isbn: string }[] = [
  { title: 'Dune', author: 'Frank Herbert', genre: 'Sci-Fi', isbn: '9780441172719' },
  { title: 'Pride and Prejudice', author: 'Jane Austen', genre: 'Romance', isbn: '9780141439518' },
  { title: 'The Hobbit', author: 'J.R.R. Tolkien', genre: 'Fantasy', isbn: '9780547928227' },
  { title: 'Gone Girl', author: 'Gillian Flynn', genre: 'Mystery/Thriller', isbn: '9780307588371' },
  { title: 'Sapiens', author: 'Yuval Noah Harari', genre: 'History', isbn: '9780062316097' },
  { title: 'Project Hail Mary', author: 'Andy Weir', genre: 'Sci-Fi', isbn: '9780593135204' },
  { title: 'Circe', author: 'Madeline Miller', genre: 'Fantasy', isbn: '9780316556347' },
  { title: 'Educated', author: 'Tara Westover', genre: 'Memoir/Biography', isbn: '9780399590504' },
];

if (new URLSearchParams(location.search).has('demo') && store.books().length === 0) {
  for (const d of DEMO) {
    store.add({ ...d, coverUrl: `https://covers.openlibrary.org/b/isbn/${d.isbn}-M.jpg?default=false` });
  }
}

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <main class="screen">
    <header class="top">
      <h1 class="brand">Book<span>Roulette</span></h1>
    </header>
    <section id="reading-slot" class="reading-slot" aria-live="polite"></section>
    <nav id="filter"></nav>
    <section id="carousel" aria-label="Book roulette"></section>
    <footer class="controls">
      <button id="spin" class="spin-btn" type="button"><span>SPIN</span></button>
      <p id="pool-note" class="pool-note"></p>
    </footer>
  </main>`;

const spinBtn = app.querySelector<HTMLButtonElement>('#spin')!;
const poolNote = app.querySelector<HTMLParagraphElement>('#pool-note')!;
const carousel = createCarousel(app.querySelector<HTMLElement>('#carousel')!);
let genres = new Set<string>();
let spinning = false;

const filter = createFilter(app.querySelector<HTMLElement>('#filter')!, (g) => {
  genres = g;
  refresh();
});

function updateButton(poolSize: number): void {
  spinBtn.disabled = spinning || poolSize === 0;
  filter.setDisabled(spinning);
  spinBtn.classList.toggle('busy', spinning);
  poolNote.textContent = poolSize === 0 ? '' : `${poolSize} book${poolSize === 1 ? '' : 's'} in the mix`;
}

function refresh(): void {
  const pool = poolFor(store.books(), genres);
  carousel.render(ringFor(pool, null));
  updateButton(pool.length);
}

async function doSpin(): Promise<Book | null> {
  if (spinning) return null;
  const pool = poolFor(store.books(), genres);
  const winner = pickWinner(pool);
  if (!winner) return null;
  spinning = true;
  updateButton(pool.length);
  let landed = false;
  try {
    landed = await carousel.spin(ringFor(pool, winner), winner);
  } finally {
    spinning = false;
    updateButton(poolFor(store.books(), genres).length);
  }
  if (!landed) return null;
  emitSpinLanded(winner);
  return winner;
}
setSpinHandler(doSpin);

spinBtn.addEventListener('click', () => {
  sound.unlock();
  void doSpin();
});
// iOS only allows audio after a gesture: unlock on the first tap anywhere.
const unlockOnce = (): void => sound.unlock();
document.addEventListener('touchend', unlockOnce, { once: true, passive: true });
document.addEventListener('click', unlockOnce, { once: true });

store.subscribe(() => {
  filter.update(store.books());
  refresh();
});
filter.update(store.books());
refresh();
