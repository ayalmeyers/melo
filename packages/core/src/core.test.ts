import { describe, expect, it } from 'vitest';
import { brier, consensus, ear, skill } from './scoring';
import { cover, coverSvg, hash } from './cover';
import { ago, mmss, parseTimestamp, starsText } from './format';
import { ALBUMS, ARTISTS, GENRES } from './catalog-data.js';

describe('scoring', () => {
  it('matches the database Ear score for the reference case', () => {
    // 20% on a NO and 80% on a YES: Brier 0.04 each, skill 0.84, Ear 92 (same as supabase/tests/security.sql)
    const mean = (brier(20, false) + brier(80, true)) / 2;
    expect(mean).toBeCloseTo(0.04);
    expect(skill(mean)).toBeCloseTo(0.84);
    expect(ear(mean)).toBe(92);
  });
  it('treats coin-flip forecasting as 50', () => { expect(ear(0.25)).toBe(50); });
  it('clamps confident wrong answers to 0', () => { expect(ear(brier(99, false))).toBe(0); });
  it('weights proven forecasters more', () => {
    expect(consensus([{ p: 90, skill: 1 }, { p: 10, skill: 0 }])).toBe(70);
    expect(consensus([])).toBeNull();
  });
});

describe('covers', () => {
  it('is deterministic and never empty', () => {
    for (const [id, title] of ALBUMS) {
      const a = cover(id, title), b = cover(id, title);
      expect(a).toEqual(b);
      expect(a.shapes.length).toBeGreaterThan(0);
      expect(coverSvg(a, id)).toContain('<svg');
    }
  });
  it('hash is unsigned', () => { for (const s of ['blonde', 'kida', 'uvst', 'x']) expect(hash(s)).toBeGreaterThanOrEqual(0); });
});

describe('format', () => {
  it('formats time', () => {
    expect(mmss(3725)).toBe('1:02:05');
    expect(parseTimestamp('61:20')).toBe(3680);
    expect(parseTimestamp('nope')).toBeNull();
    expect(starsText(9)).toBe('4.5');
    expect(ago(Date.now() - 2 * 36e5)).toBe('2h');
  });
});

describe('catalog', () => {
  it('only references real artists and genres', () => {
    for (const [, , aid, , genre] of ALBUMS) { expect(ARTISTS[aid]).toBeTruthy(); expect(GENRES[genre]).toBeTruthy(); }
    for (const a of Object.values(ARTISTS)) for (const g of a.genres) expect(GENRES[g]).toBeTruthy();
  });
});
