import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import '@fontsource-variable/inter-tight';
import './style.css';
import type { Book } from './types';
import { store } from './store';
import { poolFor, pickWinner, ringFor } from './pick';
import { sound } from './sound';
import { createCarousel } from './ui/carousel';
import { createFilter } from './ui/filter';
import { emitSpinLanded, onSpinLanded, setSpinHandler } from './app';
import { showCelebration, celebrationOpen } from './ui/celebrate';
import { renderReadingBanner } from './ui/readingBanner';
import { askConfirm } from './ui/prompt';
import { pressSpring, reducedMotion } from './ui/fx';
import { needsSwap, swapMessage } from './reading';
import { createDrawer } from './ui/drawer';
import { openAddBook } from './ui/addBook';
import { openLibrary } from './ui/library';
import { openFinished } from './ui/finished';
import { openBackup, importBackup } from './ui/backup';
import { toast } from './ui/toast';

export { onSpinLanded, spinAgain } from './app';

try { void navigator.storage?.persist?.()?.catch(() => {}); } catch { /* ignore */ }

let saveWarned = false;
const warnSave = (): void => {
  if (saveWarned) return;
  saveWarned = true;
  toast("Can't save on this device — your books will be lost when you close the app.", 'warn', 6000);
};
store.onSaveError(warnSave);
if (!store.persistent()) warnSave();

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
      <h1 class="brand">Book <i>Roulette</i></h1>
    </header>
    <nav id="filter"></nav>
    <section id="reading-slot" class="reading-slot" aria-live="polite"></section>
    <section id="carousel" aria-label="Book roulette"></section>
    <footer class="controls">
      <button id="spin" class="spin-btn" type="button"><span>Spin</span></button>
      <p id="pool-note" class="pool-note"></p>
    </footer>
  </main>`;

const spinBtn = app.querySelector<HTMLButtonElement>('#spin')!;
const poolNote = app.querySelector<HTMLParagraphElement>('#pool-note')!;
pressSpring(spinBtn);
const carousel = createCarousel(app.querySelector<HTMLElement>('#carousel')!);
let genres = new Set<string>();
let spinning = false;
let celebrating = false; // from spin start until the celebration overlay has opened

const filter = createFilter(app.querySelector<HTMLElement>('#filter')!, (g) => {
  genres = g;
  refresh();
});

function updateButton(poolSize: number): void {
  spinBtn.disabled = spinning || celebrating || poolSize === 0;
  filter.setDisabled(spinning || celebrating);
  spinBtn.classList.toggle('busy', spinning || celebrating);
  poolNote.textContent = poolSize === 0 ? '' : `${poolSize} unread on the shelf`;
}

function refresh(): void {
  const pool = poolFor(store.books(), genres);
  carousel.render(ringFor(pool, null));
  updateButton(pool.length);
}

async function doSpin(): Promise<Book | null> {
  if (spinning || celebrating || celebrationOpen()) return null;
  const pool = poolFor(store.books(), genres);
  const winner = pickWinner(pool);
  if (!winner) return null;
  spinning = true;
  celebrating = true;
  updateButton(pool.length);
  let landed = false;
  try {
    landed = await carousel.spin(ringFor(pool, winner), winner);
  } catch (e) {
    celebrating = false;
    throw e;
  } finally {
    spinning = false;
    updateButton(poolFor(store.books(), genres).length);
  }
  if (!landed) {
    celebrating = false;
    updateButton(poolFor(store.books(), genres).length);
    return null;
  }
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

const readingSlot = app.querySelector<HTMLElement>('#reading-slot')!;

// After a landing, let the winner's pop play for a beat, then celebrate.
onSpinLanded((winner) => {
  window.setTimeout(() => {
    celebrating = false;
    updateButton(poolFor(store.books(), genres).length);
    showCelebration(winner, {
      genres: () => genres,
      onAlreadyRead: () => store.setStatus(winner.id, 'finished'),
      onStartReading: async () => {
        const cur = store.current();
        if (needsSwap(cur, winner)) {
          const ok = await askConfirm({ message: swapMessage(cur.title), ok: 'Swap', cancel: 'Cancel' });
          if (!ok) return false;
        }
        store.startReading(winner.id);
        return true;
      },
      onClose: () => {},
    });
  }, reducedMotion() ? 150 : 650);
});

store.subscribe(() => {
  filter.update(store.books());
  refresh();
  renderReadingBanner(readingSlot, store.current());
});
filter.update(store.books());
refresh();
renderReadingBanner(readingSlot, store.current());

// Menu drawer.
const countOf = (status: Book['status']): number => store.books().filter((b) => b.status === status).length;
createDrawer([
  { label: 'Add a book', detail: 'Scan \u2197\uFE0E', action: true, open: () => { openAddBook(); } },
  { label: 'Library', detail: () => `${countOf('unread')} unread`, open: () => openLibrary() },
  { label: 'Finished', detail: () => `${countOf('finished')} read`, open: () => openFinished() },
  { label: 'Backup', detail: 'Export · Import', open: () => openBackup() },
  {
    label: 'Sound',
    detail: () => (sound.muted ? 'Off' : 'On'),
    stay: true,
    open: () => {
      sound.toggle();
      if (!sound.muted) { sound.unlock(); sound.land(); }
    },
  },
]);

if (import.meta.env.DEV) {
  (window as unknown as { __testIsbn: (isbn: string) => void; __import: (t: string) => void }).__import = importBackup;
  (window as unknown as { __testIsbn: (isbn: string) => void }).__testIsbn = (isbn: string) => {
    openAddBook({ isbn });
  };
}
