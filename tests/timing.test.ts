import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import type { ReciterId } from '../src/lib/audio';

const KEY = 'noor-ayah-timing';

/**
 * تخزين محلي في الذاكرة — بيئة الاختبار بلا متصفح.
 * نفس نمط `auth.test.ts`، فلا نحتاج jsdom ولا نُحمّل المتصفح كلّه.
 */
function installStorage(): void {
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
}

beforeAll(installStorage);

/**
 * الوحدة تحتفظ بجداولها في الذاكرة بعد أول قراءة — وهذا مقصود،
 * فالدالة تُستدعى أربع مرات في الثانية أثناء التلاوة.
 * لذلك نُعيد تحميل الوحدة في كل اختبار بعد نثر الجدول، حتى نختبر
 * قراءة التخزين كما تجري في المتصفح فعلاً لا كما جرت مرة واحدة.
 */
async function freshTiming() {
  vi.resetModules();
  return import('../src/lib/timing');
}

function seed(reciter: ReciterId, surah: number, table: number[]): void {
  localStorage.setItem(
    KEY,
    JSON.stringify({ v: 1, t: { [`${reciter}/${surah}`]: table } }),
  );
}

beforeEach(() => localStorage.clear());

describe('مزامنة التلاوة: اختيار الآية', () => {
  it('بلا قياس: القسمة المتساوية هي المتوقَّع', async () => {
    const { boundariesFor } = await freshTiming();
    const b = boundariesFor('ar.alafasy', 1, 4, 100);
    expect(b.measured).toBe(false);
    expect(b.starts).toEqual([0, 25, 50, 75]);
  });

  it('بلا قياس: صفر آيات لا يرمي', async () => {
    const { boundariesFor, ayahAt } = await freshTiming();
    const b = boundariesFor('ar.alafasy', 1, 0, 100);
    expect(b.starts).toEqual([]);
    expect(ayahAt(b, 50)).toBe(0);
  });

  it('بلا قياس: المدة صفر لا يقسم على صفر', async () => {
    const { boundariesFor } = await freshTiming();
    const b = boundariesFor('ar.alafasy', 1, 3, 0);
    expect(b.starts).toHaveLength(3);
    expect(b.starts.every((s) => Number.isFinite(s))).toBe(true);
  });

  it('مع قياس: الجدول يُستخدم كما هو', async () => {
    seed('ar.alafasy', 1, [10, 20, 30]);
    const { boundariesFor } = await freshTiming();
    const b = boundariesFor('ar.alafasy', 1, 3, 60);
    expect(b.measured).toBe(true);
    expect(b.starts).toEqual([0, 10, 30]);
  });

  it('مع قياس: فارق المدة يُوزَّع ولا يُجمَّد في آية واحدة', async () => {
    // مجموع الآيات ٥٠ ثانية لكن الملف ٦٠ — الفرق يمتدّ على الآيات كلها
    seed('ar.alafasy', 1, [10, 10, 10, 10, 10]);
    const { boundariesFor } = await freshTiming();
    const b = boundariesFor('ar.alafasy', 1, 5, 60);
    expect(b.measured).toBe(true);
    expect(b.starts[0]).toBeCloseTo(0, 5);
    expect(b.starts[4]).toBeCloseTo(48, 5);
    const gaps = b.starts.slice(1).map((s, i) => s - b.starts[i]);
    for (const g of gaps) expect(g).toBeCloseTo(12, 5);
  });

  it('مع قياس: جدول بطول مختلف يُرفض ولا يُستعمل', async () => {
    seed('ar.alafasy', 1, [10, 20]);
    const { boundariesFor } = await freshTiming();
    // السورة فيها ثلاث آيات الآن والقياس لآيتين — قياس بائد
    const b = boundariesFor('ar.alafasy', 1, 3, 60);
    expect(b.measured).toBe(false);
  });

  it('مع قياس: مجموع الصفري يُرفض', async () => {
    seed('ar.alafasy', 1, [0, 0, 0]);
    const { boundariesFor } = await freshTiming();
    expect(boundariesFor('ar.alafasy', 1, 3, 60).measured).toBe(false);
  });

  it('مع قياس: القارئ الآخر لا يرث جدول القارئ الأول', async () => {
    seed('ar.alafasy', 1, [10, 20, 30]);
    const { boundariesFor } = await freshTiming();
    expect(boundariesFor('ar.husary', 1, 3, 60).measured).toBe(false);
  });

  it('مع قياس: السورة الأخرى لا ترث', async () => {
    seed('ar.alafasy', 1, [10, 20, 30]);
    const { boundariesFor } = await freshTiming();
    expect(boundariesFor('ar.alafasy', 2, 3, 60).measured).toBe(false);
  });

  it('الجدول المحفوظ يُقرأ عبر المخزن المفتوح', async () => {
    seed('ar.alafasy', 5, [2, 4, 6]);
    const { cachedTiming } = await freshTiming();
    expect(cachedTiming('ar.alafasy', 5)).toEqual([2, 4, 6]);
  });
});

describe('مزامنة التلاوة: البحث عن الآية', () => {
  it('الزمن قبل البداية الأولى يعطي الآية الأولى', async () => {
    const { boundariesFor, ayahAt } = await freshTiming();
    const b = boundariesFor('ar.alafasy', 1, 4, 100);
    expect(ayahAt(b, -5)).toBe(0);
    expect(ayahAt(b, 0)).toBe(0);
  });

  it('الزمن بعد النهاية يبقى على آخر آية ولا يقع خارجها', async () => {
    const { boundariesFor, ayahAt } = await freshTiming();
    const b = boundariesFor('ar.alafasy', 1, 4, 100);
    expect(ayahAt(b, 99.99)).toBe(3);
    expect(ayahAt(b, 1000)).toBe(3);
  });

  it('بداية كل آية تُرجع تلك الآية تماماً', async () => {
    const { boundariesFor, ayahAt } = await freshTiming();
    const b = boundariesFor('ar.alafasy', 1, 4, 100);
    for (let i = 0; i < 4; i += 1) {
      expect(ayahAt(b, b.starts[i])).toBe(i);
    }
  });

  it('البحث الثنائي يطابق البحث الخطي على جدول مقيس', async () => {
    seed('ar.alafasy', 2, [3, 17, 2, 40, 9, 25, 6]);
    const { boundariesFor, ayahAt } = await freshTiming();
    const b = boundariesFor('ar.alafasy', 2, 7, 102);
    expect(b.measured).toBe(true);
    for (let t = 0; t <= 102; t += 0.5) {
      let want = 0;
      for (let i = 0; i < b.starts.length; i += 1) {
        if (b.starts[i] <= t) want = i;
      }
      expect(ayahAt(b, t)).toBe(want);
    }
  });

  it('القسمة المتساوية تحافظ على ترتيب الآيات بلا قفز', async () => {
    const { boundariesFor, ayahAt } = await freshTiming();
    const b = boundariesFor('ar.alafasy', 1, 7, 70);
    let prev = -1;
    for (let t = 0; t <= 70; t += 0.25) {
      const i = ayahAt(b, t);
      expect(i).toBeGreaterThanOrEqual(prev);
      prev = i;
    }
  });

  it('جدول فاسد في التخزين لا يوقف التطبيق', async () => {
    localStorage.setItem(KEY, '{ليس JSON');
    const { boundariesFor } = await freshTiming();
    const b = boundariesFor('ar.alafasy', 1, 3, 30);
    expect(b.measured).toBe(false);
    expect(b.starts).toHaveLength(3);
  });

  it('إصدار مختلف من التخزين يُتجاهل', async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ v: 99, t: { 'ar.alafasy/1': [1, 2, 3] } }),
    );
    const { cachedTiming } = await freshTiming();
    expect(cachedTiming('ar.alafasy', 1)).toBeNull();
  });
});
