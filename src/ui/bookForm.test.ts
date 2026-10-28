import { describe, it, expect, vi } from 'vitest';
import { bookForm } from './bookForm';

const submit = (f: HTMLElement): void => {
  f.dispatchEvent(new Event('submit', { cancelable: true }));
};

describe('bookForm', () => {
  it('pre-fills, escapes text in the preview, and saves the cleaned input', () => {
    const onSave = vi.fn();
    const f = bookForm({ title: '<b>Dune</b>', author: 'Frank Herbert', genre: 'Sci-Fi', isbn: '9780441172719' }, onSave);
    expect(f.querySelector('.bc-title')!.textContent).toBe('<b>Dune</b>');
    expect(f.querySelector('.bf-preview b')).toBeNull();
    expect(f.querySelector<HTMLSelectElement>('select')!.value).toBe('Sci-Fi');
    submit(f);
    expect(onSave).toHaveBeenCalledWith({ title: '<b>Dune</b>', author: 'Frank Herbert', genre: 'Sci-Fi', isbn: '9780441172719' });
  });

  it('blocks save without title/author', () => {
    const onSave = vi.fn();
    const f = bookForm({}, onSave);
    submit(f);
    expect(onSave).not.toHaveBeenCalled();
    expect(f.querySelector('.bf-err')!.textContent).toBe('Add a title and an author.');
  });

  it('uses a custom genre and shows it for a non-standard initial genre', () => {
    const onSave = vi.fn();
    const f = bookForm({ title: 'T', author: 'A', genre: 'Cozy' }, onSave);
    const sel = f.querySelector<HTMLSelectElement>('select')!;
    expect(sel.value).toBe('__custom__');
    expect(f.querySelector<HTMLElement>('.bf-custom')!.hidden).toBe(false);
    submit(f);
    expect(onSave).toHaveBeenCalledWith({ title: 'T', author: 'A', genre: 'Cozy' });
  });
});
