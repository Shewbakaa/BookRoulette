import { describe, it, expect } from 'vitest';
import { normalizeIsbn } from './isbn';

describe('normalizeIsbn', () => {
  it('accepts ISBN-13 with hyphens', () => {
    expect(normalizeIsbn('978-0-441-17271-9')).toBe('9780441172719');
  });
  it('converts ISBN-10 to 13', () => {
    expect(normalizeIsbn('0441172717')).toBe('9780441172719');
  });
  it('handles ISBN-10 with X check digit', () => {
    expect(normalizeIsbn('080442957X')).toBe('9780804429573');
    expect(normalizeIsbn('080442957x')).toBe('9780804429573');
  });
  it('accepts 979 prefix', () => {
    expect(normalizeIsbn('9791090636071')).toBe('9791090636071');
  });
  it('rejects UPC', () => {
    expect(normalizeIsbn('012345678905')).toBeNull();
  });
  it('rejects non-book EAN-13', () => {
    expect(normalizeIsbn('4006381333931')).toBeNull();
  });
  it('rejects bad check digits', () => {
    expect(normalizeIsbn('9780441172718')).toBeNull();
    expect(normalizeIsbn('0441172718')).toBeNull();
  });
  it('rejects empty and garbage', () => {
    expect(normalizeIsbn('')).toBeNull();
    expect(normalizeIsbn('abc')).toBeNull();
  });
});
