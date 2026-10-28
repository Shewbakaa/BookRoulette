function isbn13CheckOk(d: string): boolean {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(d[i]) * (i % 2 === 0 ? 1 : 3);
  return (10 - (sum % 10)) % 10 === Number(d[12]);
}

function isbn10CheckOk(s: string): boolean {
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const c = s[i];
    const v = c === 'X' ? 10 : Number(c);
    sum += v * (10 - i);
  }
  return sum % 11 === 0;
}

/** Returns a canonical ISBN-13 or null if the input is not a valid ISBN. */
export function normalizeIsbn(raw: string): string | null {
  const s = raw.toUpperCase().replace(/[^0-9X]/g, '');
  if (s.length === 13 && /^\d{13}$/.test(s)) {
    if (!/^97[89]/.test(s)) return null;
    return isbn13CheckOk(s) ? s : null;
  }
  if (s.length === 10 && /^\d{9}[\dX]$/.test(s)) {
    if (!isbn10CheckOk(s)) return null;
    const body = '978' + s.slice(0, 9);
    let sum = 0;
    for (let i = 0; i < 12; i++) sum += Number(body[i]) * (i % 2 === 0 ? 1 : 3);
    return body + String((10 - (sum % 10)) % 10);
  }
  return null;
}
