/** Pure geometry/colour helpers for the 3D carousel (unit-tested). */

/** Distance from ring centre to each card so neighbours don't overlap. */
export function ringRadius(n: number, cardW: number, gap = 18): number {
  if (n <= 1) return 0;
  if (n === 2) return Math.round(cardW * 0.7);
  return Math.round((cardW + gap) / 2 / Math.tan(Math.PI / n));
}

const mod = (a: number, m: number): number => ((a % m) + m) % m;

/**
 * Index of the card facing the viewer for a ring rotated by `angleDeg`.
 * Card i sits at rotateY(i*360/n); the ring faces card i when angle ≡ -i*360/n.
 */
export function frontIndex(angleDeg: number, n: number): number {
  if (n <= 0) return -1;
  return mod(Math.round(-angleDeg / (360 / n)), n);
}

/** 0 (fully lit, facing front) … 1 (facing away) for card i at ring angle. */
export function facing(angleDeg: number, i: number, n: number): number {
  if (n <= 0) return 0;
  const rel = ((angleDeg + (i * 360) / n) * Math.PI) / 180;
  return (1 - Math.cos(rel)) / 2;
}

/** Rotation angle (deg) encoded in a CSS rotateY matrix (m11 = cos, m13 = -sin). */
export function angleFromMatrix(m11: number, m13: number): number {
  return (Math.atan2(-m13, m11) * 180) / Math.PI;
}

/** Dark or light text for legibility on a #rrggbb background. */
export function readableText(hex: string): '#21170a' | '#efe4cf' {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return '#efe4cf';
  const v = parseInt(m[1], 16);
  const lin = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const L = 0.2126 * lin((v >> 16) & 255) + 0.7152 * lin((v >> 8) & 255) + 0.0722 * lin(v & 255);
  return L > 0.4 ? '#21170a' : '#efe4cf';
}

const OLD_PALETTE = ['#e6194b', '#f58231', '#ffe119', '#3cb44b', '#42d4f4', '#4363d8', '#911eb4', '#f032e6'];
const CLOTH_PALETTE = ['#a4532f', '#2f4a3a', '#1e2a44', '#6b2430', '#a07a2a', '#3f4a52', '#4f3550', '#5b5a32'];

/** Display colour for a stored book colour: the old neon palette maps to the cloth palette; anything else passes through. */
export function clothColor(hex: string): string {
  const i = OLD_PALETTE.indexOf(hex.trim().toLowerCase());
  return i >= 0 ? CLOTH_PALETTE[i] : hex;
}
