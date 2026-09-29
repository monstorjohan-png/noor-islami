/**
 * اختبارات متابعة الحفظ.
 * تُشغَّل: npx vitest run tests/hifz.test.ts
 *
 * منطق خالص بلا React: التنقية، والعدّ، والخطة، وجدولة المراجعة.
 * النمط في تخزين وهمي هو نفسه في tests/auth.test.ts.
 */
import { describe, it, expect } from 'vitest';
import {
  AYAH_MAX,
  DAY_MS,
  DEFAULT_DAILY_TARGET,
  HIFZ_KEY,
  SURAH_MAX,
  dueForReview,
  loadHifz,
  memorizedCount,
  planStatus,
  sanitizeHifz,
  saveHifz,
  surahProgress,
  todayIndex,
} from '../src/lib/hifz';
import type { HifzState } from '../src/lib/hifz';

/** تخزين محلي في الذاكرة: بيئة الاختبار بلا متصفح */
function withFakeStorage(fn: () => void): void {
  const original = (globalThis as Record<string, unknown>).localStorage;
  const map = new Map<string, string>();
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k: string, v: string) => {
      map.set(k, String(v));
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
    clear: () => map.clear(),
  };
  try {
    fn();
  } finally {
    (globalThis as Record<string, unknown>).localStorage = original;
  }
}

/** مدخل سليم يُبنى عليه */
function entry(surah: number, maxAyah: number, updatedAt: number) {
  return { surah, maxAyah, updatedAt };
}

/** حالة سليمة كاملة */
function valid(): HifzState {
  return {
    entries: [entry(1, 3, 1_700_000_000_000), { ...entry(2, 5, 1_700_000_000_000), extra: [9, 11] }],
    startDay: 19_700,
    dailyTarget: 12,
    completedRuns: 1,
    lastCompletedAt: 1_700_000_000_000,
  };
}

/* ---------- التنقية: ترفض ما لا معنى له ---------- */

describe('التنقية: المدخلات المرفوضة', () => {
  it('لا كائن أصلاً: القيم الافتراضية بلا رمي', () => {
    for (const v of [null, undefined, 42, 'نص', true]) {
      const s = sanitizeHifz(v);
      expect(s.entries).toEqual([]);
      expect(s.dailyTarget).toBe(DEFAULT_DAILY_TARGET);
      expect(s.completedRuns).toBe(0);
      expect(s.lastCompletedAt).toBeNull();
      expect(Number.isInteger(s.startDay)).toBe(true);
    }
  });

  it('مصفوفة ليست حالة: تُقرأ كحالة فارغة', () => {
    const s = sanitizeHifz([{ surah: 1, maxAyah: 5, updatedAt: 1 }]);
    expect(s.entries).toEqual([]);
  });

  it('رقم سورة خارج المدى أو بلا معنى: المدخل يُحذف ولا يُقصّ', () => {
    const bad = [0, -1, SURAH_MAX + 1, 999, NaN, 1.5, '__proto__', '18', null];
    for (const surah of bad) {
      const s = sanitizeHifz({ entries: [{ surah, maxAyah: 5, updatedAt: 1 }] });
      expect(s.entries, `سورة ${String(surah)}`).toEqual([]);
    }
  });

  it('مفتاح خطير في المدخل لا يصل إلى الكائن', () => {
    const s = sanitizeHifz(JSON.parse('{"__proto__":{"polluted":true},"dailyTarget":9}'));
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(s.dailyTarget).toBe(9);
  });

  it('رقم آية خارج المدى: التسلسل يُقصّ والمتفرّق يُحذف', () => {
    const s = sanitizeHifz({
      entries: [{ surah: 1, maxAyah: 400, extra: [1, 287, 0, -3, 300, 2.5, 'x'], updatedAt: 1 }],
    });
    // السطر قُصّ إلى أطول سورة، ولم يبقَ موضع لمتفرّق فوقه
    expect(s.entries[0].maxAyah).toBe(AYAH_MAX);
    expect(s.entries[0].extra).toBeUndefined();
  });

  it('الآية ٢٨٧ وما فوقها لا تدخل المتفرّق مهما كان التسلسل', () => {
    const s = sanitizeHifz({
      entries: [{ surah: 1, maxAyah: 5, extra: [286, 287, 288, 1e6], updatedAt: 1 }],
    });
    expect(s.entries[0].extra).toEqual([286]);
  });

  it('المتفرّق بلا تكرار، وما دون التسلسل محسوب أصلاً فلا يُخزَّن', () => {
    const s = sanitizeHifz({
      entries: [{ surah: 1, maxAyah: 5, extra: [7, 7, 3, 9, 5, 4, NaN, null, {}], updatedAt: 1 }],
    });
    // ٣ و٤ و٥ داخل التسلسل، والسبعة تكرّرت
    expect(s.entries[0].extra).toEqual([7, 9]);
  });

  it('هدف اليوم خارج المجال يقع داخله', () => {
    expect(sanitizeHifz({ dailyTarget: 0 }).dailyTarget).toBe(1);
    expect(sanitizeHifz({ dailyTarget: 5000 }).dailyTarget).toBe(50);
    expect(sanitizeHifz({ dailyTarget: -3 }).dailyTarget).toBe(1);
    expect(sanitizeHifz({ dailyTarget: 'عشرون' }).dailyTarget).toBe(DEFAULT_DAILY_TARGET);
    expect(sanitizeHifz({ dailyTarget: 20 }).dailyTarget).toBe(20);
  });

  it('بقية الحقول الرقمية تُقصّ إلى مجالها', () => {
    const s = sanitizeHifz({
      startDay: -10,
      completedRuns: -5,
      lastCompletedAt: -1,
    });
    expect(s.startDay).toBe(0);
    expect(s.completedRuns).toBe(0);
    expect(s.lastCompletedAt).toBeNull();
    expect(sanitizeHifz({ lastCompletedAt: NaN }).lastCompletedAt).toBeNull();
    expect(sanitizeHifz({ lastCompletedAt: 'الآن' }).lastCompletedAt).toBeNull();
  });

  it('سورة مكرّرة تُدمج فلا تُعدّ مرتين، والسقف مئة وأربع عشرة', () => {
    const many = Array.from({ length: 200 }, (_, i) => entry(i + 1, 2, 10));
    const s = sanitizeHifz({
      entries: [...many, entry(1, 9, 99), entry(2, 4, 50)],
    });
    expect(s.entries).toHaveLength(SURAH_MAX);
    // مدخلا السورة الأولى دُمجا: الأعلى والطابع الأحدث
    expect(s.entries[0]).toEqual({ surah: 1, maxAyah: 9, updatedAt: 99 });
    expect(s.entries.map((e) => e.surah)).toEqual(
      Array.from({ length: SURAH_MAX }, (_, i) => i + 1),
    );
  });
});

/* ---------- التنقية: تقبل السليم ---------- */

describe('التنقية: المدخل السليم', () => {
  it('يبقى كما هو بلا تغيير', () => {
    const src = valid();
    expect(sanitizeHifz(src)).toEqual(src);
  });

  it('يبقى كما هو بعد رحلة في التخزين', () => {
    const src = valid();
    expect(sanitizeHifz(JSON.parse(JSON.stringify(src)))).toEqual(src);
  });

  it('يكتب ويقرأ بلا فقد', () => {
    withFakeStorage(() => {
      const src = valid();
      saveHifz(src);
      expect(loadHifz()).toEqual(src);
    });
  });

  it('يكتب الحالة المنقّاة لا ما أعطاه النداء', () => {
    withFakeStorage(() => {
      saveHifz({ ...valid(), dailyTarget: 5000 });
      expect(loadHifz().dailyTarget).toBe(50);
    });
  });
});

/* ---------- التخزين التالف ---------- */

describe('التخزين: لا يكسر التطبيق', () => {
  it('نصّ ليس بصيغة json: افتراضيات بلا رمي', () => {
    withFakeStorage(() => {
      localStorage.setItem(HIFZ_KEY, '{ليس بصيغة صحيحة');
      expect(() => loadHifz()).not.toThrow();
      const s = loadHifz();
      expect(s.entries).toEqual([]);
      expect(s.dailyTarget).toBe(DEFAULT_DAILY_TARGET);
      expect(s.completedRuns).toBe(0);
    });
  });

  it('مفتاح غائب: افتراضيات', () => {
    withFakeStorage(() => {
      expect(loadHifz().entries).toEqual([]);
      expect(loadHifz().dailyTarget).toBe(DEFAULT_DAILY_TARGET);
    });
  });

  it('قيمة تالفة داخل كيان سليم: تُصلح ولا ترمي', () => {
    withFakeStorage(() => {
      localStorage.setItem(HIFZ_KEY, JSON.stringify({ entries: 'ليست قائمة', dailyTarget: 0 }));
      expect(loadHifz().entries).toEqual([]);
      expect(loadHifz().dailyTarget).toBe(1);
    });
  });

  it('تخزين ممنوع: الحفظ لا يرمي والحالة الافتراضية تُقرأ', () => {
    const original = (globalThis as Record<string, unknown>).localStorage;
    (globalThis as Record<string, unknown>).localStorage = {
      getItem: () => {
        throw new Error('ممنوع');
      },
      setItem: () => {
        throw new Error('ممنوع');
      },
    };
    try {
      expect(() => saveHifz(valid())).not.toThrow();
      expect(loadHifz().entries).toEqual([]);
    } finally {
      (globalThis as Record<string, unknown>).localStorage = original;
    }
  });

  it('يوم اليوم عدد صحيح غير سالب', () => {
    const d = todayIndex();
    expect(Number.isInteger(d)).toBe(true);
    expect(d).toBeGreaterThan(0);
    expect(d).toBeLessThan(100_000);
  });
});

/* ---------- العدّ ---------- */

describe('العدّ', () => {
  it('التسلسل من واحد إلى أعلى آية', () => {
    expect(memorizedCount(entry(1, 5, 0))).toBe(5);
    expect(memorizedCount(entry(1, 0, 0))).toBe(0);
    expect(memorizedCount(undefined)).toBe(0);
  });

  it('المتفرّق يُضاف بلا عدّ مضاعف', () => {
    expect(memorizedCount({ surah: 1, maxAyah: 5, extra: [7, 9], updatedAt: 0 })).toBe(7);
    // التكرار في التخزين لا يضاعف العدّ
    expect(memorizedCount({ surah: 1, maxAyah: 5, extra: [7, 7, 7], updatedAt: 0 })).toBe(6);
    // وما دون التسلسل محسوب أصلاً فلا يُعدّ مرتين
    expect(memorizedCount({ surah: 1, maxAyah: 5, extra: [2, 3, 5], updatedAt: 0 })).toBe(5);
  });

  it('مدخل تالف لا يكسر العدّ', () => {
    expect(memorizedCount({ surah: 1, maxAyah: 5, extra: 'ليست قائمة', updatedAt: 0 } as never)).toBe(5);
    expect(memorizedCount(null as never)).toBe(0);
  });

  it('نسبة السورة بين الصفر والواحد', () => {
    expect(surahProgress(entry(2, 50, 0), 100)).toBeCloseTo(0.5, 6);
    expect(surahProgress(entry(2, 100, 0), 100)).toBe(1);
    expect(surahProgress(undefined, 100)).toBe(0);
  });

  it('محفوظات أكثر من عدد السورة لا تتجاوز الواحد', () => {
    // الفاتحة سبع آيات، وسجلّ فيه خمسون
    expect(surahProgress(entry(1, 50, 0), 7)).toBe(1);
    expect(surahProgress(entry(1, 50, 0), 0)).toBe(0);
    expect(surahProgress(entry(1, 50, 0), NaN)).toBe(0);
  });
});

/* ---------- الخطة ---------- */

describe('الخطة', () => {
  const day = 20_000;

  it('خطة بدأت اليوم: هدف اليوم هو المتبقّي كلّه', () => {
    const plan = planStatus({ entries: [], startDay: day, dailyTarget: 20 }, day);
    expect(plan.daysElapsed).toBe(0);
    expect(plan.expected).toBe(20);
    expect(plan.remaining).toBe(20);
    expect(plan.memorized).toBe(0);
  });

  it('الهدف تراكمي: كل يوم جديد يزيد المطلوب', () => {
    const plan = planStatus({ entries: [], startDay: day - 9, dailyTarget: 20 }, day);
    expect(plan.daysElapsed).toBe(9);
    expect(plan.expected).toBe(200);
    expect(plan.remaining).toBe(200);
  });

  it('ما حُفظ يُنقص المتبقّي ولا يجعله سالباً', () => {
    const s: HifzState = { entries: [entry(1, 30, 0)], startDay: day, dailyTarget: 20 };
    expect(planStatus(s, day).remaining).toBe(0);
    expect(planStatus(s, day).memorized).toBe(30);
    expect(planStatus(s, day + 3).expected).toBe(80);
    expect(planStatus(s, day + 3).remaining).toBe(50);
  });

  it('الخطة الفارغة ولا خطة على الإطلاق', () => {
    const empty = planStatus({ entries: [], startDay: day, dailyTarget: 20 }, day);
    expect(empty.memorized).toBe(0);
    expect(empty.remaining).toBe(empty.expected);
    // حالة تالفة تماماً: لا تنهار
    const junk = planStatus(null as never, day);
    expect(junk.memorized).toBe(0);
    expect(junk.remaining).toBeGreaterThan(0);
  });
});

/* ---------- المراجعة ---------- */

describe('المراجعة: الجدولة', () => {
  const day = 20_000;
  /** مدخل عمره بعينه بالأيام */
  const aged = (surah: number, maxAyah: number, days: number) =>
    entry(surah, maxAyah, (day - days) * DAY_MS);

  const state = (...list: Array<{ surah: number; maxAyah: number; updatedAt: number }>): HifzState => ({
    entries: list,
    startDay: day,
    dailyTarget: 20,
    completedRuns: 0,
    lastCompletedAt: null,
  });

  it('ما حُفظ اليوم لا يستحق المراجعة', () => {
    const s = state(aged(1, 5, 0));
    expect(dueForReview(s, day, 20)).toEqual([]);
  });

  it('آية عمرها أسبوع تستحق', () => {
    const s = state(aged(1, 3, 7));
    expect(dueForReview(s, day, 20)).toEqual([
      { surah: 1, ayah: 1 },
      { surah: 1, ayah: 2 },
      { surah: 1, ayah: 3 },
    ]);
  });

  it('الأقدم أولاً، وعند التساوي برقم السورة', () => {
    const s = state(aged(2, 1, 3), aged(5, 1, 10), aged(3, 1, 3));
    expect(dueForReview(s, day, 5).map((i) => i.surah)).toEqual([5, 2, 3]);
  });

  it('الحدّ اليومي يقطع القمة', () => {
    const s = state(aged(1, 100, 5));
    expect(dueForReview(s, day, 20)).toHaveLength(20);
    expect(dueForReview(s, day, 20).at(-1)).toEqual({ surah: 1, ayah: 20 });
  });

  it('حدّ صفر أو سالب: قائمة فارغة', () => {
    const s = state(aged(1, 5, 9));
    expect(dueForReview(s, day, 0)).toEqual([]);
    expect(dueForReview(s, day, -4)).toEqual([]);
    expect(dueForReview(s, day, NaN)).toEqual([]);
  });

  it('المتفرّق يدخل المراجعة بعد التسلسل', () => {
    const s: HifzState = {
      entries: [{ surah: 1, maxAyah: 2, extra: [9], updatedAt: (day - 4) * DAY_MS }],
      startDay: day,
      dailyTarget: 20,
      completedRuns: 0,
      lastCompletedAt: null,
    };
    expect(dueForReview(s, day, 10).map((i) => i.ayah)).toEqual([1, 2, 9]);
  });

  it('الحالة الفارغة لا تنتج مراجعة', () => {
    expect(dueForReview(state(), day, 20)).toEqual([]);
    expect(dueForReview(null as never, day, 20)).toEqual([]);
  });

  it('سجلّ بلا طابع يُعامل كحفظ اليوم لا كحفظ قديم', () => {
    const s = state(entry(1, 5, 0));
    expect(dueForReview(s, day, 20)).toEqual([]);
  });

  it('الفاصل يقترب بعمر الحفظ: عمر يوم يستحق وعمر يومين يستحق', () => {
    expect(dueForReview(state(aged(1, 1, 1)), day, 5)).toHaveLength(1);
    expect(dueForReview(state(aged(1, 1, 2)), day, 5)).toHaveLength(1);
    expect(dueForReview(state(aged(1, 1, 365)), day, 5)).toHaveLength(1);
  });
});
