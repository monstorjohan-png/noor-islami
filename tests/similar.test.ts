/**
 * اختبارات متشابه القرآن — البيانات يجب أن تبقى متوافقة مع نص المصحف نفسه.
 * التشغيل: npx vitest run tests/similar.test.ts
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { SIMILAR } from '../src/data/similar';

const uthmani = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'public', 'data', 'quran', 'uthmani.json'), 'utf8'),
) as Array<Array<string>>;
const surahs = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'public', 'data', 'quran', 'surahs.json'), 'utf8'),
) as Array<{ n: number; verses: number }>;

/** موضع [سورة، آية] → فهرس عالمي في المصفوفة */
function globalIndex(s: number, a: number): number {
  let acc = 0;
  for (const su of surahs) {
    if (su.n === s) return acc + a - 1;
    acc += su.verses;
  }
  throw new Error(`surah ${s} not found`);
}

describe('SIMILAR data', () => {
  it('contains a meaningful number of clusters', () => {
    expect(SIMILAR.length).toBeGreaterThanOrEqual(50);
  });

  it('all positions are valid ayah references within the mushaf', () => {
    for (const c of SIMILAR) {
      for (const [s, a] of c.positions) {
        const su = surahs.find((x) => x.n === s);
        expect(su, `surah ${s}`).toBeTruthy();
        expect(a).toBeGreaterThanOrEqual(1);
        expect(a).toBeLessThanOrEqual(su!.verses);
        expect(globalIndex(s, a)).toBeLessThan(6236);
      }
    }
  });

  it('preview equals the first position’s text in uthmani script', () => {
    for (const c of SIMILAR) {
      const [s, a] = c.positions[0];
      expect(c.preview).toBe(uthmani[globalIndex(s, a)][0]);
    }
  });

  it('every cluster has at least two positions (it is “similar” after all)', () => {
    for (const c of SIMILAR) {
      expect(c.positions.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('no duplicate positions inside a cluster', () => {
    for (const c of SIMILAR) {
      const keys = c.positions.map(([s, a]) => `${s}:${a}`);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
});
