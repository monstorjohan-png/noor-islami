/**
 * مزامنة التلاوة مع الآية المعروضة.
 * ------------------------------------------------------------------
 * المشكلة: ملف السورة ملف صوتي واحد مدموج للآيات، ولا يحمل جدولاً
 * زمنياً. القسمة البسيطة (المدة ÷ عدد الآيات) تُري الآية الجارية
 * متأخرة دقائق، لأن آية طويلة (البقرة ٢٨٦ مثلاً) تليها آيات قصيرة.
 * فالعلامة تتأخر ثم تتقدّم دفعة واحدة، وهذا ما رآه المستخدم.
 *
 * الحل: نقيس مدّة كل آية على حدة من ملفات الآيات — وهي موجودة لكل
 * القرّاء العشرة بلا استثناء — ونجمعها في جدولٍ تراكمي. القياس مرة
 * واحدة لكل (قارئ، سورة) ويُحفظ محلياً، فلا يُعاد إلا مرة.
 *
 * لماذا لا نزنّل ملفات الآيات كلها؟ لأن سورة البقرة ٢٨٦ ملفاً.
 * القياس يقرأ ترويسة الملف فقط عبر عنصر الصوت، فلا ينزل منه إلا
 * كيلوبايتات. أما الباقي فيبقى على الشبكة حتى يُطلب فعلاً.
 *
 * الأمانة: إن فشل القياس أو لم يدعمه المتصفح نرجع إلى القسمة
 * المتساوية ونعلن أنها تقديرية. لا ندّعي دقةً ليست عندنا.
 */

import { ayahAudioUrl } from './audio';
import type { ReciterId } from './audio';

const KEY = 'noor-ayah-timing';
const VERSION = 1;

/** عدد الملفات المقروءة في آنٍ واحد — أكثر من ذلك يُثقل الشبكة */
const CONCURRENCY = 6;

/** مهلة القراءة الواحدة */
const TIMEOUT_MS = 6000;

/** أطول جدول نحتفظ به في التخزين المحلي */
const MAX_TABLES = 300;

type Table = number[];

let mem: Record<string, Table> | null = null;

function load(): Record<string, Table> {
  if (mem) return mem;
  mem = {};
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { v?: number; t?: Record<string, Table> };
      if (parsed && parsed.v === VERSION && parsed.t) mem = parsed.t;
    }
  } catch {
    mem = {};
  }
  return mem;
}

function persist(next: Record<string, Table>): void {
  try {
    const keys = Object.keys(next);
    for (const k of keys.slice(0, Math.max(0, keys.length - MAX_TABLES))) {
      delete next[k];
    }
    localStorage.setItem(KEY, JSON.stringify({ v: VERSION, t: next }));
  } catch (err) {
    // امتلاء الحصة لا يوقف التلاوة — القياس يُعاد في الجلسة القادمة
    console.warn('تعذّر حفظ جدول المدد', err);
  }
}

export const timingKey = (reciter: ReciterId, surah: number) => `${reciter}/${surah}`;

/** المدة المخزَّنة لسورة، أو `null` إن لم تُقَس بعد */
export function cachedTiming(reciter: ReciterId, surah: number): Table | null {
  const t = load()[timingKey(reciter, surah)];
  return Array.isArray(t) && t.length ? t : null;
}

/**
 * مدّة ملف صوتي بلا تنزيله كاملاً.
 * نستخدم عنصر الصوت لا `fetch`: خادم الملفات لا يرسل ترويسات الوصول،
 * فيفشل قراءة البايتات، بينما الوسيط يقرأ الترويسة دون عائق.
 */
function probeDuration(url: string): Promise<number> {
  return new Promise((resolve) => {
    let settled = false;
    const a = new Audio();
    a.preload = 'metadata';
    const finish = (v: number) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      a.removeAttribute('src');
      a.load();
      resolve(v);
    };
    const timer = setTimeout(() => finish(0), TIMEOUT_MS);
    a.onloadedmetadata = () => finish(Number.isFinite(a.duration) ? a.duration : 0);
    a.onerror = () => finish(0);
    a.src = url;
  });
}

export type Boundaries = {
  /** بداية كل آية بالثواني، وطولها يساوي عدد الآيات */
  starts: number[];
  /** الطول الكلي كما يقوله المشغّل */
  total: number;
  /** هل القيم مقيسة فعلاً أم مقدَّرة؟ */
  measured: boolean;
};

/** جدول متساوٍ — الطريقة القديمة، تُستعمل حين لا قياس */
function evenBoundaries(total: number, count: number): Boundaries {
  const starts: number[] = [];
  const step = count > 0 ? total / count : total;
  for (let i = 0; i < count; i += 1) starts.push(i * step);
  return { starts, total, measured: false };
}

/**
 * جدول مُقاس إن أمكن، وإلا مُقدَّر.
 * الملف المخلوط قد يزيد صمتاً أو ينقص منه، فنُوسِّط فوق الآيات كلها
 * فنصحّح الانحراف التدريجي ولا نُجمّده في آية واحدة.
 */
export function boundariesFor(
  reciter: ReciterId,
  surah: number,
  count: number,
  total: number,
): Boundaries {
  const table = cachedTiming(reciter, surah);
  if (!table || table.length !== count || total <= 0) {
    return evenBoundaries(total, count);
  }
  const sum = table.reduce((a, b) => a + b, 0);
  if (!(sum > 0)) return evenBoundaries(total, count);

  const scale = total / sum;
  const starts: number[] = [];
  let acc = 0;
  for (let i = 0; i < count; i += 1) {
    starts.push(acc);
    acc += table[i] * scale;
  }
  return { starts, total, measured: true };
}

/** رقم الآية عند لحظة معيّنة من ملف مخلوط */
export function ayahAt(b: Boundaries, time: number): number {
  const { starts } = b;
  if (!starts.length) return 0;
  if (time <= 0) return 0;
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= time) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/**
 * قياس مدد آيات سورة عند أول تشغيل لها.
 * لا يُعاد إن كانت محفوظة، ويُلغى فوراً إن أُلغي الطلب.
 */
export async function measureTiming(
  reciter: ReciterId,
  ayahs: { globalIndex: number }[],
  surah: number,
  onProgress?: (done: number, total: number) => void,
  signal?: AbortSignal,
): Promise<Table | null> {
  const total = ayahs.length;
  if (!total || signal?.aborted) return null;

  const table = cachedTiming(reciter, surah);
  if (table && table.length === total) return table;

  const out: number[] = new Array(total);
  let next = 0;
  let done = 0;

  const worker = async (): Promise<void> => {
    for (;;) {
      if (signal?.aborted) return;
      const i = next;
      next += 1;
      if (i >= total) return;
      out[i] = await probeDuration(ayahAudioUrl(reciter, ayahs[i].globalIndex));
      done += 1;
      onProgress?.(done, total);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, total) }, () => worker()),
  );

  if (signal?.aborted) return null;
  // آية واحدة بلا قياس تُبقي الجدول ناقصاً — نرفضه ولا نُعلّم sync-synced
  if (out.some((d) => !d || d <= 0)) return null;

  const clean = out.map((d) => Math.round(d * 100) / 100);
  const store = load();
  store[timingKey(reciter, surah)] = clean;
  persist(store);
  return clean;
}
