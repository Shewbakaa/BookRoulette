import type { Book, BookInput } from '../types';
import { GENRES } from '../genres';
import { cleanInput } from '../addFlow';
import { colorFor } from '../store';
import { bookCard } from './bookCard';
import { pressSpring } from './fx';

const CUSTOM = '__custom__';

function field(labelText: string, control: HTMLElement, extraClass = ''): HTMLLabelElement {
  const l = document.createElement('label');
  l.className = `bf-field${extraClass ? ` ${extraClass}` : ''}`;
  const s = document.createElement('span');
  s.className = 'bf-label';
  s.textContent = labelText;
  l.append(s, control);
  return l;
}

function input(name: string, value: string, placeholder: string): HTMLInputElement {
  const i = document.createElement('input');
  i.type = 'text';
  i.name = name;
  i.value = value;
  i.placeholder = placeholder;
  i.maxLength = 200;
  i.autocomplete = 'off';
  i.spellcheck = false;
  i.className = 'bf-input';
  return i;
}

/** A temporary Book-shaped object so the shared card renderer can draw a preview. */
function previewBook(v: { title: string; author: string; genre: string; coverUrl?: string }): Book {
  const title = v.title.trim() || 'Title';
  return {
    id: 'preview',
    title,
    author: v.author.trim() || 'Author',
    genre: v.genre,
    color: colorFor(title),
    status: 'unread',
    addedAt: 0,
    ...(v.coverUrl ? { coverUrl: v.coverUrl } : {}),
  };
}

/**
 * Book details form: title + author (required), genre select (GENRES + "Custom…"), optional ISBN,
 * and a live cover preview drawn with bookCard. Calls onSave with a cleaned BookInput.
 */
export function bookForm(initial: Partial<BookInput>, onSave: (b: BookInput) => void): HTMLElement {
  const form = document.createElement('form');
  form.className = 'bf';
  form.noValidate = true;

  const coverUrl = initial.coverUrl;
  const preview = document.createElement('div');
  preview.className = 'bf-preview';

  const title = input('title', initial.title ?? '', 'e.g. The Hobbit');
  title.autocapitalize = 'words';
  title.classList.add('bf-input-title');
  const author = input('author', initial.author ?? '', 'e.g. J.R.R. Tolkien');
  author.autocapitalize = 'words';

  const genre = document.createElement('select');
  genre.name = 'genre';
  genre.className = 'bf-input bf-select';
  for (const g of GENRES) {
    const o = document.createElement('option');
    o.value = g;
    o.textContent = g;
    genre.append(o);
  }
  const co = document.createElement('option');
  co.value = CUSTOM;
  co.textContent = 'Custom…';
  genre.append(co);

  const custom = input('customGenre', '', 'Your genre');
  custom.maxLength = 40;
  const customField = field('Custom genre', custom, 'bf-custom');

  const g0 = initial.genre?.trim();
  if (g0 && GENRES.includes(g0)) genre.value = g0;
  else if (g0) { genre.value = CUSTOM; custom.value = g0; }
  else genre.value = 'Other';
  customField.hidden = genre.value !== CUSTOM;

  const isbn = input('isbn', initial.isbn ?? '', 'Optional');
  isbn.inputMode = 'numeric';
  isbn.maxLength = 20;

  const err = document.createElement('p');
  err.className = 'bf-err';
  err.setAttribute('role', 'alert');

  const save = document.createElement('button');
  save.type = 'submit';
  save.className = 'btn btn-primary springy bf-save';
  save.textContent = 'Add to my books';
  pressSpring(save);

  const fields = document.createElement('div');
  fields.className = 'bf-fields';
  fields.append(
    field('Title', title),
    field('Author', author),
    field('Genre', genre),
    customField,
    field('ISBN', isbn, 'bf-isbn'),
  );

  const top = document.createElement('div');
  top.className = 'bf-top';
  top.append(preview, fields);
  form.append(top, err, save);

  const genreValue = (): string => (genre.value === CUSTOM ? custom.value : genre.value);

  let last = '';
  const drawPreview = (): void => {
    const b = previewBook({ title: title.value, author: author.value, genre: genreValue(), coverUrl });
    const key = `${b.title}|${b.author}|${b.coverUrl ?? ''}`;
    if (key === last) return;
    last = key;
    const card = bookCard(b);
    card.classList.add('bf-card');
    preview.replaceChildren(card);
  };
  drawPreview();

  title.addEventListener('input', drawPreview);
  author.addEventListener('input', drawPreview);
  [title, author].forEach((i) => i.addEventListener('input', () => i.classList.remove('bad')));
  genre.addEventListener('change', () => {
    customField.hidden = genre.value !== CUSTOM;
    if (!customField.hidden) custom.focus();
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const r = cleanInput({ title: title.value, author: author.value, genre: genreValue(), isbn: isbn.value, coverUrl });
    if (!r.ok) {
      err.textContent = r.missing.length === 2 ? 'Add a title and an author.' : `Add the ${r.missing[0]}.`;
      for (const m of r.missing) {
        const el = m === 'title' ? title : author;
        el.classList.remove('bad');
        void el.offsetWidth;
        el.classList.add('bad');
      }
      (r.missing[0] === 'title' ? title : author).focus();
      return;
    }
    err.textContent = '';
    onSave(r.input);
  });
  return form;
}
