import { describe, it, expect } from 'vitest';
import { ringRadius, frontIndex, facing, angleFromMatrix, readableText } from './ringMath';
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
    expect(readableText('#ffe119')).toBe('#1b1030');
    expect(readableText('#42d4f4')).toBe('#1b1030');
    expect(readableText('#4363d8')).toBe('#ffffff');
    expect(readableText('#911eb4')).toBe('#ffffff');
    expect(readableText('nope')).toBe('#ffffff');
  });
});
