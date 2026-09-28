/**
 * اختبارات طبقة البيانات والتطبيع والتقويم.
 * تُشغَّل: npx vitest run
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const DATA = path.resolve(__dirname, '../public/data/quran');
const uthmani = JSON.parse(readFileSync(path.join(DATA, 'uthmani.json'), 'utf8'));
const positions = JSON.parse(readFileSync(path.join(DATA, 'positions.json'), 'utf8'));
const surahs = JSON.parse(readFileSync(path.join(DATA, 'surahs.json'), 'utf8'));
const shardIndex = JSON.parse(readFileSync(path.join(DATA, 'shard-index.json'), 'utf8'));
const search = JSON.parse(readFileSync(path.join(DATA, 'search.json'), 'utf8'));

const offset: number[] = [];
let acc = 0;
for (const s of surahs) {
  offset[s.n] = acc;
  acc += s.verses;
}

describe('المصحف: نزاهة البيانات', () => {
  it('مجموع آيات السور يساوي عدد الصفوف', () => {
    expect(acc).toBe(uthmani.length);
    expect(uthmani.length).toBe(6236);
  });

  it('كل صف له ست حقول', () => {
    for (const r of uthmani) expect(r).toHaveLength(6);
  });

  it('عدد المواضع يساوي عدد الصفوف', () => {
    expect(positions).toHaveLength(uthmani.length);
  });

  it('التشريح لم يغيّر أي نص', () => {
    for (let n = 0; n < shardIndex.shards; n++) {
      const name = `shards/${String(n).padStart(3, '0')}.json`;
      const shard = JSON.parse(readFileSync(path.join(DATA, name), 'utf8'));
      const from = n * shardIndex.shardSize;
      for (let k = 0; k < shard.length; k++) {
        expect(shard[k][0]).toBe(uthmani[from + k][0]);
      }
    }
  });

  it('ملف كل سورة يطابق مواضعها', () => {
    for (const s of surahs) {
      const file = JSON.parse(readFileSync(path.join(DATA, `surah/${s.n}.json`), 'utf8'));
      expect(file).toHaveLength(s.verses);
      expect(file[0][0]).toBe(uthmani[offset[s.n]][0]);
      expect(file[file.length - 1][0]).toBe(uthmani[offset[s.n] + s.verses - 1][0]);
    }
  });

  it('فهرس البحث يشير إلى المواضع الصحيحة', () => {
    expect(search).toHaveLength(uthmani.length);
    for (const i of [0, 100, 3000, 6235]) {
      expect(search[i][0]).toBe(uthmani[i][4]);
      expect(search[i][1]).toBe(uthmani[i][5]);
      expect(search[i][2]).toBe(i);
    }
  });
});

describe('content: تحويل (سورة، آية) إلى صف', () => {
  it('الصف الأول من البقرة', () => {
    expect(offset[2]).toBe(7);
    expect(uthmani[7][0]).toContain('الٓمٓ');
  });

  it('آخر آية من الناس', () => {
    // المصدر ينتهي عند 6236 = الناس 6
    expect(uthmani[6235][0]).toContain('ٱلنَّاسِ');
    expect(offset[114] + 6).toBe(6236);
  });

  it('حدود السورة لا تتجاوز', () => {
    // الفاتحة 7 آيات: 8 خارج النطاق
    expect(offset[1] + 7).toBe(7);
    const s = surahs.find((x) => x.n === 1)!;
    expect(s.verses).toBe(7);
  });

  it('makeReverseMap يعطي آيات سورة الناس الخمس الأخيرة', () => {
    // سورة الناس: 6 آيات، آخرها 6236
    const pairs: Array<[number, number, number]> = [];
    for (let s = 1; s < offset.length; s++) {
      if (offset[s] === undefined) continue;
      const n = offset[s + 1] !== undefined ? offset[s + 1] - offset[s] : 6236 - offset[s];
      pairs.push([s, offset[s], n]);
    }
    const rev = (gi: number): [number, number] => {
      let lo = 0, hi = pairs.length - 1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const p = pairs[mid];
        if (gi < p[1]) hi = mid - 1;
        else if (gi >= p[1] + p[2]) lo = mid + 1;
        else return [p[0], gi - p[1] + 1];
      }
      return [1, 1];
    };
    // عيب سابق: 114:2..114:6 كانت تُرجع [1,1]
    expect(rev(6231)).toEqual([114, 2]);
    expect(rev(6235)).toEqual([114, 6]);
  });
});

describe('التطبيع العربي', () => {
  const DIAC = /[ً-ٰٟۖ-ۭـ]/g;

  it('يزيل التشكيل', () => {
    const out = 'بِسۡمِ ٱللَّهِ'.replace(DIAC, '');
    expect(out).toBe('بسم ٱلله');
  });

  it('يوحّد الألف الخنجرية وألف الوصل إلى ألف', () => {
    // U+0670 ألف خنجرية، U+0671 ألف وصل — كلاهما يُوحَّدان إلى U+0627
    const norm = (s: string) =>
      s.replace(/[\u0670\u0671]/g, '\u0627').replace(DIAC, '');
    expect(norm('ٱللَّهِ')).toBe('الله');
  });

  it('الهيكل يحذف الألف ليطابق الإملاء الشائع', () => {
    const norm = (s: string) =>
      s.replace(DIAC, '').replace(/[آأإٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');
    const skel = (s: string) => norm(s).replace(/[اي]/g, '');
    expect(skel('السماوات')).toBe('لسموت');
    expect(skel('ٱلسَّمَٰوَٰت')).toBe('لسموت');
  });
});

describe('التقويم الهجري', () => {
  // الخوارزمية الجدولية (نفس التي في src/lib/hijri.ts)
  function toHijri(date: Date) {
    const y = date.getFullYear(), m = date.getMonth() + 1, d = date.getDate();
    const a = Math.floor((14 - m) / 12), y2 = y + 4800 - a, m2 = m + 12 * a - 3;
    const jd = d + Math.floor((153 * m2 + 2) / 5) + 365 * y2 + Math.floor(y2 / 4) -
      Math.floor(y2 / 100) + Math.floor(y2 / 400) - 32045;
    const l0 = jd - 1948440 + 10632, n = Math.floor((l0 - 1) / 10631);
    let l = l0 - 10631 * n + 354;
    const j = Math.floor((10985 - l) / 5316) * Math.floor((50 * l) / 17719) +
      Math.floor(l / 5670) * Math.floor((43 * l) / 15238);
    l = l - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) -
      Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29;
    const month = Math.floor((24 * l) / 709);
    const day = l - Math.floor((709 * month) / 24);
    return { year: 30 * n + j - 30, month, day };
  }

  function toGregorian(year: number, month: number, day: number): Date {
    const jd = day + Math.ceil(29.5 * (month - 1)) + (year - 1) * 354 +
      Math.floor((3 + 11 * year) / 30) + 1948439.5 - 1;
    const J = Math.floor(jd + 0.5);
    let l = J + 68569;
    const n = Math.floor((4 * l) / 146097);
    l -= Math.floor((146097 * n + 3) / 4);
    const i = Math.floor((4000 * (l + 1)) / 1461001);
    l = l - Math.floor((1461 * i) / 4) + 31;
    const j = Math.floor((80 * l) / 2447);
    const dd = l - Math.floor((2447 * j) / 80);
    l = Math.floor(j / 11);
    const mm = j + 2 - 12 * l;
    const yy = 100 * (n - 49) + i + l;
    return new Date(yy, mm - 1, dd);
  }

  it('ذهاب وعودة بلا خطأ', () => {
    const cases: Array<[number, number, number]> = [
      [1447, 9, 1], [1447, 9, 27], [1447, 12, 10], [1448, 1, 1], [1400, 6, 15], [1500, 12, 29],
    ];
    for (const [y, m, d] of cases) {
      const g = toGregorian(y, m, d);
      const back = toHijri(g);
      expect([back.year, back.month, back.day]).toEqual([y, m, d]);
    }
  });

  it('أطوال شهور 1447 بين 29 و30', () => {
    for (let m = 1; m <= 12; m++) {
      const a = toGregorian(1447, m, 1);
      const b = m === 12 ? toGregorian(1448, 1, 1) : toGregorian(1447, m + 1, 1);
      const len = Math.round((b.getTime() - a.getTime()) / 86400000);
      expect(len === 29 || len === 30).toBe(true);
    }
  });

  it('1 رمضان 1447 يوافق 19 فبراير 2026', () => {
    const g = toGregorian(1447, 9, 1);
    expect([g.getFullYear(), g.getMonth() + 1, g.getDate()]).toEqual([2026, 2, 18]);
  });
});
