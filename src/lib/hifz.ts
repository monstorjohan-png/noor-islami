/**
 * متابعة حفظ القرآن.
 * ------------------------------------------------------------------
 * حالة مستقلة عن إعدادات التطبيق: لها مفتاح تخزين خاص بها، لأنها ميزة
 * قائمة بذاتها لا حقل في الإعدادات.
 *
 * فلسفة التنقية هنا نفسها في ملف store: التخزين المحلي قابل للتحرير من أي
 * نص على نفس الأصل، فلا يُؤخذ حقل كما ورد. كل قيمة تُعاد بناؤها من عدد
 * محسوب ضمن مجال معلوم.
 *
 * قاعدتان تفصلان بين نوعي الإصلاح:
 *   • ما يحدّد **هوية** السورة يُحذف ولا يُقصّ. رقم مجهول ليس سورة قريبة منه.
 *   • ما يعدّ **مقداراً** يُقصّ إلى مجاله. الصفر في هدف اليوم لا يبقى صفراً.
 *
 * لا نصّ قرآني في هذا الملف ولا في الصفحة: نصّ الآية يُقرأ من `content.ts`
 * عند العرض وحده.
 */

import { clamp } from './safe';

/* ---------- الحدود ---------- */

/** مفتاح التخزين — منفصل عن إعدادات التطبيق */
export const HIFZ_KEY = 'noor-hifz';

/** عدد السور */
export const SURAH_MAX = 114;
/** أطول سورة في المصحف */
export const AYAH_MAX = 286;
/** سقف المدخلات: سورة واحدة لكل رقم */
export const MAX_ENTRIES = 114;
/** مجال الهدف اليومي */
export const DAILY_MIN = 1;
export const DAILY_MAX = 50;
/** سقف رقم اليوم: أبعد منة ألف يوم في عمر المستخدم، فليس إلا حاجباً تالفاً */
export const START_DAY_MAX = 100_000;
/** الهدف اليومي الافتراضي */
export const DEFAULT_DAILY_TARGET = 20;
/** مللي ثانية في اليوم */
export const DAY_MS = 86_400_000;
/** سقف قائمة المراجعة: يمنع بناء قائمة ضخمة من تخزين مؤتنف */
export const REVIEW_MAX = 2000;
/** أقصى طابع زمني مقبول — يحجب الأرقام التي تعطيها قيمة عشوائية */
const STAMP_MAX = 4e12;

/* ---------- الأنواع ---------- */

/** محفوظات سورة واحدة */
export interface HifzEntry {
  surah: number;
  /** أعلى آية محفوظة — الأرقام من واحد إليها محفوظة */
  maxAyah: number;
  /** محفوظات متفرقة خارج التسلسل */
  extra?: number[];
  updatedAt: number;
}

/** حالة متابعة الحفظ كما تُخزَّن */
export interface HifzState {
  entries: HifzEntry[];
  /** يوم بدء الخطة — رقم اليوم منذ تاريخ مرجعي ثابت */
  startDay: number;
  /** عدد الآيات المستهدفة يومياً */
  dailyTarget: number;
  /** الختمة الأولى اكتملت */
  completedRuns: number;
  /** آخر ختمة اكتملت */
  lastCompletedAt: number | null;
}

/** آية واحدة تستحق المراجعة */
export interface ReviewItem {
  surah: number;
  ayah: number;
}

/* ---------- أدوات داخلية ---------- */

/**
 * عدد صحيح ضمن مجال. ما لا معنى له يقع على الافتراضي، وما تجاوز المجال
 * يُقصّ إليه — فحجم التخزين ليس وعداً بالدقة.
 */
function intOf(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'number' ? v : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** يوم واحد: عدد الأيام منذ تاريخ مرجعي ثابت، بلا تقويم ولا مناطق زمنية */
export const todayIndex = (): number =>
  clamp(Math.floor(Date.now() / DAY_MS), 0, START_DAY_MAX);

/** الحالة الافتراضية لمستخدم لم يبدأ بعد */
function defaultState(): HifzState {
  return {
    entries: [],
    startDay: todayIndex(),
    dailyTarget: DEFAULT_DAILY_TARGET,
    completedRuns: 0,
    lastCompletedAt: null,
  };
}

/* ---------- التنقية ---------- */

/**
 * المحفوظات المتفرقة: ما دون أو يساوي أعلى آية محفوظة محسوب أصلاً،
 * وتخزينه تكرار يضاعف العدّ. وما خرج من المدى يُهمل ولا يُقصّ، فرقم
 * متجاوز لا يدل على آية قريبة منه.
 */
function pickExtra(v: unknown, run: number): number[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<number>();
  for (const raw of v) {
    const n = typeof raw === 'number' ? raw : NaN;
    if (!Number.isInteger(n) || n < 1 || n > AYAH_MAX) continue;
    if (n > run) seen.add(n);
  }
  return [...seen].sort((a, b) => a - b);
}

/** مدخل واحد — أو لا شيء */
function pickEntry(v: unknown): HifzEntry | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const surah = typeof o.surah === 'number' ? o.surah : NaN;
  if (!Number.isInteger(surah) || surah < 1 || surah > SURAH_MAX) return null;
  const maxAyah = intOf(o.maxAyah, 0, AYAH_MAX, 0);
  const updatedAt = intOf(o.updatedAt, 0, STAMP_MAX, 0);
  const extra = pickExtra(o.extra, maxAyah);
  const out: HifzEntry = { surah, maxAyah, updatedAt };
  if (extra.length) out.extra = extra;
  return out;
}

/**
 * قائمة المدخلات: تُدمج مداخل السورة الواحدة فلا تُعدّ مرتين، وتُرتَّب
 * برقم السورة فيثبت الترتيب بين قراءتين للحالة نفسها.
 */
function pickEntries(v: unknown): HifzEntry[] {
  if (!Array.isArray(v)) return [];
  const bySurah = new Map<number, HifzEntry>();
  for (const raw of v) {
    const e = pickEntry(raw);
    if (!e) continue;
    const prev = bySurah.get(e.surah);
    if (!prev) {
      bySurah.set(e.surah, e);
      continue;
    }
    const run = Math.max(prev.maxAyah, e.maxAyah);
    const extra = [...new Set([...(prev.extra ?? []), ...(e.extra ?? [])])]
      .filter((n) => n > run)
      .sort((a, b) => a - b);
    const merged: HifzEntry = {
      surah: e.surah,
      maxAyah: run,
      updatedAt: Math.max(prev.updatedAt, e.updatedAt),
    };
    if (extra.length) merged.extra = extra;
    bySurah.set(e.surah, merged);
  }
  return [...bySurah.values()].sort((a, b) => a.surah - b.surah).slice(0, MAX_ENTRIES);
}

/**
 * إعادة بناء الحالة من التخزين المحلي. لا ترمي مهما كان الوارد:
 * قيمة لا معنى لها تُهمَل، وحقل غائب يقع على الافتراضي.
 */
export function sanitizeHifz(v: unknown): HifzState {
  const p = (
    v && typeof v === 'object' && !Array.isArray(v) ? v : {}
  ) as Record<string, unknown>;
  const last = p.lastCompletedAt;
  return {
    entries: pickEntries(p.entries),
    startDay: intOf(p.startDay, 0, START_DAY_MAX, todayIndex()),
    dailyTarget: intOf(p.dailyTarget, DAILY_MIN, DAILY_MAX, DEFAULT_DAILY_TARGET),
    completedRuns: intOf(p.completedRuns, 0, 1_000_000, 0),
    lastCompletedAt:
      typeof last === 'number' && Number.isFinite(last) && last > 0
        ? Math.min(last, STAMP_MAX)
        : null,
  };
}

/* ---------- التخزين ---------- */

/** يقرأ الحالة من التخزين المحلي — تخزين تالف أو ممنوع يُعطى افتراضيات */
export function loadHifz(): HifzState {
  if (typeof localStorage === 'undefined') return defaultState();
  try {
    const raw = localStorage.getItem(HIFZ_KEY);
    if (!raw) return defaultState();
    return sanitizeHifz(JSON.parse(raw));
  } catch (err) {
    console.warn('تعذّرت قراءة متابعة الحفظ — نبدأ من جديد', err);
    return defaultState();
  }
}

/** يكتب الحالة بعد تنقيتها — الفشل لا يوقف التطبيق ولا يُفقد ما حُفظ */
export function saveHifz(s: HifzState): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(HIFZ_KEY, JSON.stringify(sanitizeHifz(s)));
  } catch (err) {
    console.warn('تعذّر حفظ متابعة الحفظ', err);
  }
}

/* ---------- العدّ ---------- */

/**
 * عدد آيات سورة محفوظة: التسلسل من واحد إلى أعلى آية، ثم المتفرّق فوقه.
 * المتفرّع مجموعة لا قائمة، فلا يُعدّ مرتين مهما تكرّر في التخزين.
 */
export function memorizedCount(e: HifzEntry | undefined): number {
  if (!e || typeof e !== 'object') return 0;
  const run = intOf(e.maxAyah, 0, AYAH_MAX, 0);
  const seen = new Set<number>();
  const extra = Array.isArray(e.extra) ? e.extra : [];
  for (const raw of extra) {
    const n = typeof raw === 'number' ? raw : NaN;
    if (Number.isInteger(n) && n > run && n <= AYAH_MAX) seen.add(n);
  }
  return run + seen.size;
}

/** نسبة إتمام السورة بين الصفر والواحد. عدد آيات مجهول أو صفر لا يُحسب */
export function surahProgress(e: HifzEntry | undefined, ayahCount: number): number {
  if (typeof ayahCount !== 'number' || !Number.isFinite(ayahCount) || ayahCount <= 0) return 0;
  return clamp(memorizedCount(e) / ayahCount, 0, 1);
}

/* ---------- الخطة ---------- */

/** حالة الخطة في يوم معيّن */
export interface HifzPlan {
  /** عدد الأيام المنقضية منذ بدء الخطة */
  daysElapsed: number;
  /** عدد الآيات المفترض إنجازها حتى اليوم */
  expected: number;
  /** ما بقي من هدف اليوم */
  remaining: number;
  /** عدد الآيات المحفوظة كلها */
  memorized: number;
}

/**
 * حساب يوم واحد من الخطة.
 *
 * الهدف التراكمي: يوم نعدّ له من يوم البدء، فاليوم الأول هدفه هو هدف
 * اليوم كاملاً لا صفراً. ومن تجاوز التقدّم يبقى المتبقّي صفراً ولا
 * يصير سالباً.
 */
export function planStatus(s: HifzState, today: number): HifzPlan {
  const day = intOf(today, 0, START_DAY_MAX, todayIndex());
  const startDay = intOf(s?.startDay, 0, START_DAY_MAX, day);
  const dailyTarget = intOf(s?.dailyTarget, DAILY_MIN, DAILY_MAX, DEFAULT_DAILY_TARGET);
  const entries = Array.isArray(s?.entries) ? s.entries : [];
  let memorized = 0;
  for (const e of entries) memorized += memorizedCount(e);
  const daysElapsed = Math.max(0, day - startDay);
  const expected = (daysElapsed + 1) * dailyTarget;
  return { daysElapsed, expected, remaining: Math.max(0, expected - memorized), memorized };
}

/* ---------- المراجعة ---------- */

/**
 * الفاصل بين مراجعتين لآية: كلّما طال عمر الحفظ اقتربت مراجعته.
 * الحفظ الجديد يبقى خارج المراجعة يومه الأول.
 */
function reviewInterval(ageDays: number): number {
  return Math.max(1, Math.round(ageDays / 2));
}

/**
 * آيات تستحق المراجعة اليوم.
 *
 * النموذج على مستوى السورة لا الآية: السورة تحمل طابع آخر تحديث واحداً،
 * وعمر آية فيها هو عمر سورتها. الأقدم أولاً — هو ما يضعف أسرع — والحدّ
 * اليومي يقطع القمة فما يليه يؤجَّل إلى الغد.
 *
 * `today` رقم يوم، فالنتيجة ثابتة لا تتغيّر بتغيّر الوقت داخل اليوم.
 */
export function dueForReview(s: HifzState, today: number, limit: number): ReviewItem[] {
  const cap = intOf(limit, 0, REVIEW_MAX, 0);
  if (cap <= 0) return [];
  const now = intOf(today, 0, START_DAY_MAX, todayIndex()) * DAY_MS;
  const entries = Array.isArray(s?.entries) ? s.entries : [];

  const rows: Array<{ surah: number; run: number; extra: number[]; age: number }> = [];
  for (const e of entries) {
    if (!e || typeof e !== 'object') continue;
    const surah = intOf(e.surah, 1, SURAH_MAX, 0);
    if (!surah) continue;
    const stamp = intOf(e.updatedAt, 0, STAMP_MAX, 0);
    // لا طابع: لا نعرف عمر الحفظ، فلا نُدّعي استحقاقه للمراجعة
    if (stamp <= 0) continue;
    const age = Math.floor((now - stamp) / DAY_MS);
    // حُفظت اليوم فلا مراجعة بعد، والحدّ الأدنى يوم واحد
    if (age < 1 || age < reviewInterval(age)) continue;
    rows.push({
      surah,
      run: intOf(e.maxAyah, 0, AYAH_MAX, 0),
      extra: Array.isArray(e.extra) ? e.extra : [],
      age,
    });
  }
  // الأقدم أولاً، وعند التساوي برقم السورة ثم رقم الآية
  rows.sort((a, b) => b.age - a.age || a.surah - b.surah);

  const out: ReviewItem[] = [];
  for (const r of rows) {
    for (let a = 1; a <= r.run; a++) {
      out.push({ surah: r.surah, ayah: a });
      if (out.length >= cap) return out;
    }
    for (const raw of r.extra) {
      const a = typeof raw === 'number' ? raw : NaN;
      if (!Number.isInteger(a) || a < 1 || a > AYAH_MAX) continue;
      out.push({ surah: r.surah, ayah: a });
      if (out.length >= cap) return out;
    }
  }
  return out;
}
