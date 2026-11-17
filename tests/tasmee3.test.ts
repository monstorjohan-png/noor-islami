/**
 * اختبارات التسميع — دوال نقية فقط، لا React ولا شبكة.
 * التشغيل: npx vitest run tests/tasmee3.test.ts
 */
import { describe, it, expect } from 'vitest';
import {
  buildCloze,
  checkWrittenWords,
  endSession,
  maskableIndices,
  recordGrade,
  sanitizeTasmee3,
  shuffle,
  tokenizeAyah,
  weakestAyahs,
  weakestAyahsAll,
  MAX_ENTRIES,
} from '../src/lib/tasmee3';
import type { Tasmee3State } from '../src/lib/tasmee3';

const EMPTY: Tasmee3State = { perAyah: {}, sessions: 0, lastMode: null, lastSurah: 1, updatedAt: 0, streak: 0, lastActiveDay: 0 };
const seq = () => {
  let i = 0;
  const vals = [0.1, 0.5, 0.9, 0.3, 0.7, 0.2, 0.8, 0.4, 0.6];
  return () => vals[i++ % vals.length];
};

describe('tokenizeAyah / maskableIndices', () => {
  it('splits on Arabic diacritics-free whitespace and drops empty tokens', () => {
    expect(tokenizeAyah('بسم الله الرحمن الرحيم')).toEqual(['بسم', 'الله', 'الرحمن', 'الرحيم']);
    expect(tokenizeAyah('  ٱلْحَمْدُ لِلَّهِ  ')).toEqual(['ٱلْحَمْدُ', 'لِلَّهِ']);
  });

  it('keeps only words long enough to mask', () => {
    const words = ['من', 'الله', 'الرحمن', 'هو', 'العالمين'];
    expect(maskableIndices(words)).toEqual([1, 2, 4]);
  });
});

describe('buildCloze', () => {
  const text = 'ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ';
  const pool = ['ٱلْحَمْدُ', 'لِلَّهِ', 'رَبِّ', 'ٱلْعَٰلَمِينَ', 'ٱلرَّحْمَٰنُ', 'ٱلرَّحِيمُ', 'مَٰلِكُ', 'يَوْمِ', 'ٱلدِّينِ'];

  it('returns a question with 4 options containing the answer exactly once', () => {
    const q = buildCloze(text, pool, seq());
    expect(q).not.toBeNull();
    expect(q!.options).toHaveLength(4);
    expect(q!.options.filter((o) => o === q!.answer)).toHaveLength(1);
    expect(q!.masked).toContain('…');
    expect(q!.masked).not.toContain(q!.answer);
  });

  it('masks a word that exists in the original verse', () => {
    const q = buildCloze(text, pool, seq());
    expect(tokenizeAyah(text)).toContain(q!.answer);
  });

  it('refuses to fabricate options when the pool is too small', () => {
    expect(buildCloze('بِسْمِ ٱللَّهِ', ['بِسْمِ', 'ٱللَّهِ'], seq())).toBeNull();
  });
});

describe('shuffle', () => {
  it('is a permutation of the input', () => {
    const input = ['a', 'b', 'c', 'd', 'e', 'f'];
    const out = shuffle(input, seq());
    expect(out.slice().sort()).toEqual(input.slice().sort());
    expect(out).toHaveLength(input.length);
  });
});

describe('sanitizeTasmee3', () => {
  it('drops malformed entries and clamps values', () => {
    const raw = {
      perAyah: {
        '2:255': { ease: 2, last: 1000 },
        '999:1': { ease: 1, last: 5 },     // خارج النطاق — يُرفض
        'bad': { ease: 2, last: 5 },       // مفتاح عشوائي — يُرفض
        '1:1': { ease: 9, last: 5 },       // تدريج غير معروف — يُرفض
      },
      sessions: 3.7,
      lastMode: 'cloze',
      lastSurah: 999,
      updatedAt: -5,
    };
    const s = sanitizeTasmee3(JSON.parse(JSON.stringify(raw)));
    expect(s.perAyah['2:255']).toEqual({ ease: 2, last: 1000 });
    expect(Object.keys(s.perAyah)).toHaveLength(1);
    expect(s.sessions).toBe(3);
    expect(s.lastMode).toBe('cloze');
    expect(s.lastSurah).toBe(114);
    expect(s.updatedAt).toBe(0);
  });

  it('survives garbage input', () => {
    expect(sanitizeTasmee3(null)).toEqual(EMPTY);
    expect(sanitizeTasmee3('nope')).toEqual(EMPTY);
    expect(sanitizeTasmee3(42)).toEqual(EMPTY);
  });

  it('caps perAyah at MAX_ENTRIES', () => {
    const perAyah: Record<string, unknown> = {};
    for (let i = 0; i < MAX_ENTRIES + 50; i++) {
      const s = (i % 114) + 1;
      const a = (i % 286) + 1;
      perAyah[`${s}:${a}`] = { ease: 1, last: i };
    }
    const s = sanitizeTasmee3({ perAyah });
    expect(Object.keys(s.perAyah).length).toBeLessThanOrEqual(MAX_ENTRIES);
  });
});

describe('recordGrade / endSession / weakestAyahs', () => {
  it('records and updates a grade, preserving other ayahs', () => {
    let s = EMPTY;
    s = recordGrade(s, 2, 255, 2);
    s = recordGrade(s, 1, 1, 0);
    s = recordGrade(s, 2, 255, 1); // آخر تقييم هو المعتمد
    expect(s.perAyah['2:255'].ease).toBe(1);
    expect(s.perAyah['1:1'].ease).toBe(0);
  });

  it('rejects out-of-range input silently', () => {
    const s = recordGrade(EMPTY, 200, 1, 2);
    expect(s).toEqual(EMPTY);
  });

  it('ends a session with a valid mode', () => {
    const s = endSession(EMPTY, 'reveal', 36);
    expect(s.sessions).toBe(1);
    expect(s.lastMode).toBe('reveal');
    expect(s.lastSurah).toBe(36);
  });

  it('builds a daily streak across consecutive days', () => {
    const today = Math.floor(Date.now() / 86_400_000);
    // نشاط أخير أمس وعلى 5 أيام متتالية ⇒ يصبح 6 اليوم
    const s = recordGrade({ ...EMPTY, lastActiveDay: today - 1, streak: 5 }, 1, 1, 2);
    expect(s.streak).toBe(6);
    // نشاط ثانٍ في اليوم نفسه — لا يزدوج العدّ
    const s2 = recordGrade(s, 1, 2, 2);
    expect(s2.streak).toBe(6);
  });

  it('orders weakest ayahs: lowest ease first', () => {
    let s = EMPTY;
    s = recordGrade(s, 18, 1, 2);
    s = recordGrade(s, 18, 2, 0);
    s = recordGrade(s, 18, 3, 1);
    expect(weakestAyahs(s, 18, 2)).toEqual([2, 3]);
  });
});

describe("checkWrittenWords (اكتب وتلا)", () => {
  const ayah = "قُلْ هُوَ اللَّهُ أَحَدٌ";

  it("exact typed text scores 100 and completes", () => {
    const r = checkWrittenWords(ayah, "قل هو الله احد");
    expect(r.pct).toBe(100);
    expect(r.complete).toBe(true);
    expect(r.cells).toEqual(["right", "right", "right", "right"]);
  });

  it("spelling variants count as correct (normalized comparison)", () => {
    const r = checkWrittenWords(ayah, "قل هو الله أحد");
    expect(r.pct).toBe(100);
  });

  it("one wrong word is flagged in place", () => {
    const r = checkWrittenWords(ayah, "قل هو الله احد هو");
    expect(r.cells).toEqual(["right", "right", "right", "right"]);
    expect(r.complete).toBe(true);
    const wrong = checkWrittenWords(ayah, "قل هو الرحمن احد");
    expect(wrong.cells).toEqual(["right", "right", "wrong", "right"]);
    expect(wrong.pct).toBe(75);
  });

  it("partial typing keeps the tail pending and never invents words", () => {
    const r = checkWrittenWords(ayah, "قل هو");
    expect(r.cells).toEqual(["right", "right", "pending", "pending"]);
    expect(r.complete).toBe(false);
    expect(r.answered).toBe(2);
  });

  it("empty input is all pending with score 0", () => {
    const r = checkWrittenWords(ayah, "");
    expect(r.pct).toBe(0);
    expect(r.answered).toBe(0);
  });

  it("extra trailing words do not penalize the verse score", () => {
    const r = checkWrittenWords(ayah, "قل هو الله احد الرحمن الرحيم");
    expect(r.pct).toBe(100);
    expect(r.correct).toBe(4);
  });
});
