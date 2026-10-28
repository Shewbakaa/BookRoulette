import { describe, it, expect } from 'vitest';
import { ringRadius, frontIndex, facing, angleFromMatrix, readableText, clothColor, tileRing } from './ringMath';
import { spinTargetAngle } from '../pick';

describe('ringRadius', () => {
  it('is 0 for a single card and positive otherwise', () => {
    expect(ringRadius(1, 120)).toBe(0);
    expect(ringRadius(2, 120)).toBeGreaterThan(0);
  });
  it('grows with ring size so neighbours do not overlap', () => {
    const r8 = ringRadius(8, 120), r12 = ringRadius(12, 120);
    expect(r12).toBeGreaterThan(r8);
    // chord between neighbours >= card width
    expect(2 * r12 * Math.sin(Math.PI / 12)).toBeGreaterThanOrEqual(120);
  });
});

describe('frontIndex', () => {
  it('maps the spin target angle to the winner index', () => {
    for (const n of [1, 2, 5, 8, 12]) {
      for (let w = 0; w < n; w++) {
        expect(frontIndex(spinTargetAngle(-37, n, w, 5), n)).toBe(w);
      }
    }
  });
  it('handles positive angles and rounding to nearest card', () => {
    expect(frontIndex(0, 8)).toBe(0);
    expect(frontIndex(-44, 8)).toBe(1);
    expect(frontIndex(20, 8)).toBe(0);
    expect(frontIndex(25, 8)).toBe(7);
    expect(frontIndex(0, 0)).toBe(-1);
  });
});

describe('facing', () => {
  it('is 0 for the front card and 1 for the card behind', () => {
    expect(facing(-90, 1, 4)).toBeCloseTo(0);
    expect(facing(-90, 3, 4)).toBeCloseTo(1);
    expect(facing(0, 1, 4)).toBeCloseTo(0.5);
  });
});

describe('angleFromMatrix', () => {
  it('recovers a rotateY angle', () => {
    for (const deg of [0, 30, -75, 170, -170]) {
      const r = (deg * Math.PI) / 180;
      expect(angleFromMatrix(Math.cos(r), -Math.sin(r))).toBeCloseTo(deg);
    }
  });
});

describe('readableText', () => {
  it('uses dark text on bright colours and white on dark ones', () => {
    expect(readableText('#ffe119')).toBe('#21170a');
    expect(readableText('#42d4f4')).toBe('#21170a');
    expect(readableText('#4363d8')).toBe('#efe4cf');
    expect(readableText('#911eb4')).toBe('#efe4cf');
    expect(readableText('nope')).toBe('#efe4cf');
  });
});

describe('clothColor', () => {
  it('maps the old neon palette index-for-index and passes others through', () => {
    expect(clothColor('#e6194b')).toBe('#a4532f');
    expect(clothColor('#F032E6')).toBe('#5b5a32');
    expect(clothColor('#a4532f')).toBe('#a4532f');
    expect(clothColor('#123456')).toBe('#123456');
  });
});

describe('tileRing', () => {
  const ids = (n: number): string[] => Array.from({ length: n }, (_, i) => `b${i}`);
  it('repeats small rings so a full circle of covers is visible', () => {
    const t = tileRing(ids(3));
    expect(t.length).toBeGreaterThanOrEqual(8);
    expect(t.length % 3).toBe(0);
    for (const id of ids(3)) expect(t.filter((x) => x === id).length).toBe(t.length / 3);
  });
  it('keeps neighbours distinct when repeating', () => {
    const t = tileRing(ids(2));
    t.forEach((x, i) => expect(x).not.toBe(t[(i + 1) % t.length]));
  });
  it('leaves single books and rings of 8+ alone', () => {
    expect(tileRing(ids(1))).toEqual(ids(1));
    expect(tileRing(ids(8))).toEqual(ids(8));
    expect(tileRing(ids(12))).toEqual(ids(12));
    expect(tileRing([])).toEqual([]);
  });
});
