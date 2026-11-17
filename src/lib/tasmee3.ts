/**
 * التسميع والاستذكار — منطق بلا واجهة.
 * يخزّن حالة التسميع في مفتاح مستقل `noor-tasmee3` كي لا يلمس بيانات
 * متابعة الحفظ (`noor-hifz`) ولا الإعدادات. كل الدوال نقية ما أمكن
 * لتبقى قابلة للاختبار كما في بقية المشروع.
 */
import { isSafeKey } from './safe';
import { tokenizeArabic } from './ar-text';

export const TASMEE3_KEY = 'noor-tasmee3';
export const MIN_WORD_LEN = 3;
export const MAX_ENTRIES = 6236;
export const DAY_MS = 86_400_000;

export type Tasmee3Mode = 'reveal' | 'cloze' | 'order' | 'record' | 'write';

export type Ease = 0 | 1 | 2; // 0 = لم يتقن · 1 = جيد · 2 = أتقنت

export interface AyahStat {
  ease: Ease;
  /** آخر زمن تسميع — رقم اليوم منذ حقبة 1970 */
  last: number;
}

export interface Tasmee3State {
  perAyah: Record<string, AyahStat>;
  sessions: number;
  lastMode: Tasmee3Mode | null;
  lastSurah: number;
  updatedAt: number;
  /** أيام متتالية سُجّعت فيها عملية تسميع واحدة على الأقل */
  streak: number;
  /** آخر يوم (رقم اليوم) سُجّل فيه تسميع/جلسة */
  lastActiveDay: number;
}

const EMPTY: Tasmee3State = {
  perAyah: {},
  sessions: 0,
  lastMode: null,
  lastSurah: 1,
  updatedAt: 0,
  streak: 0,
  lastActiveDay: 0,
};

export function todayIndex(): number {
  return Math.floor(Date.now() / DAY_MS);
}

const AYAH_KEY = /^([1-9]|[1-9]\d):([1-9]|[1-9]\d|[12]\d\d)$/;

/** يزيح سلسلة الأيام عند أي نشاط — تُستدعى بعد قبول العملية لا قبلها */
function touchStreak(s: Tasmee3State): Tasmee3State {
  const today = todayIndex();
  if (s.lastActiveDay === today) return s;
  return {
    ...s,
    streak: s.lastActiveDay === today - 1 ? s.streak + 1 : 1,
    lastActiveDay: today,
  };
}

/** المفتاح صالح إن كان في نطاق المصحف: سورة 1–114، آية 1–286 */
function isAyahKey(key: string): boolean {
  const [s, a] = key.split(':');
  const surah = Number(s);
  const ayah = Number(a);
  return Number.isInteger(surah) && surah >= 1 && surah <= 114 && Number.isInteger(ayah) && ayah >= 1 && ayah <= 286;
}
const MODES: ReadonlySet<string> = new Set(['reveal', 'cloze', 'order', 'record', 'write']);

/** إعادة بناء الحالة من التخزين أو من ملف مستورد — لا يُوثَق بأي قيمة كما وردت */
export function sanitizeTasmee3(v: unknown): Tasmee3State {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const perAyah: Record<string, AyahStat> = {};
  const raw = o['perAyah'];
  if (raw && typeof raw === 'object') {
    for (const [key, val] of Object.entries(raw)) {
      if (!AYAH_KEY.test(key) || !isAyahKey(key) || !isSafeKey(key)) continue;
      if (!val || typeof val !== 'object') continue;
      const ease = (val as Record<string, unknown>)['ease'];
      const last = (val as Record<string, unknown>)['last'];
      const e = ease === 0 || ease === 1 || ease === 2 ? ease : null;
      const l = typeof last === 'number' && Number.isFinite(last) ? Math.min(Math.max(0, Math.floor(last)), 100_000) : null;
      if (e === null || l === null) continue;
      perAyah[key] = { ease: e as Ease, last: l };
      if (Object.keys(perAyah).length >= MAX_ENTRIES) break;
    }
  }
  const mode = o['lastMode'];
  const lastMode = typeof mode === 'string' && MODES.has(mode) ? (mode as Tasmee3Mode) : null;
  const sessions = typeof o['sessions'] === 'number' && Number.isFinite(o['sessions'])
    ? Math.min(Math.max(0, Math.floor(o['sessions'])), 1_000_000)
    : 0;
  const streak = typeof o['streak'] === 'number' && Number.isFinite(o['streak'])
    ? Math.min(Math.max(0, Math.floor(o['streak'])), 100_000)
    : 0;
  const lastActiveDay = typeof o['lastActiveDay'] === 'number' && Number.isFinite(o['lastActiveDay'])
    ? Math.min(Math.max(0, Math.floor(o['lastActiveDay'])), 100_000)
    : 0;
  const lastSurah = typeof o['lastSurah'] === 'number' && Number.isFinite(o['lastSurah'])
    ? Math.min(Math.max(1, Math.floor(o['lastSurah'])), 114)
    : 1;
  const updatedAt = typeof o['updatedAt'] === 'number' && Number.isFinite(o['updatedAt']) ? Math.max(0, o['updatedAt']) : 0;
  return { perAyah, sessions, lastMode, lastSurah, updatedAt, streak, lastActiveDay };
}

export function loadTasmee3(): Tasmee3State {
  try {
    const raw = localStorage.getItem(TASMEE3_KEY);
    if (!raw) return { ...EMPTY };
    return sanitizeTasmee3(JSON.parse(raw));
  } catch {
    return { ...EMPTY };
  }
}

export function saveTasmee3(s: Tasmee3State): void {
  try {
    localStorage.setItem(TASMEE3_KEY, JSON.stringify(sanitizeTasmee3(s)));
  } catch {
    // امتلأت الذاكرة — الجلسة تُفقد ولا يُكسر التطبيق
  }
}

/** تسجيل تقييم آية: آخر تقييم هو المعتمد، والجلسة تُزاد مرة على الأقل */
export function recordGrade(s: Tasmee3State, surah: number, ayah: number, ease: Ease): Tasmee3State {
  if (!Number.isInteger(surah) || surah < 1 || surah > 114) return s;
  if (!Number.isInteger(ayah) || ayah < 1 || ayah > 286) return s;
  if (ease !== 0 && ease !== 1 && ease !== 2) return s;
  const key = `${surah}:${ayah}`;
  if (Object.keys(s.perAyah).length >= MAX_ENTRIES && !(key in s.perAyah)) return s;
  return touchStreak({
    ...s,
    perAyah: { ...s.perAyah, [key]: { ease, last: todayIndex() } },
    updatedAt: Date.now(),
  });
}

/** إنهاء جلسة: زيادة العداد وختم الوقت — آمنة للاستدعاء أكثر من مرة */
export function endSession(s: Tasmee3State, mode: Tasmee3Mode, surah: number): Tasmee3State {
  if (!MODES.has(mode)) return s;
  return touchStreak({
    ...s,
    sessions: Math.min(s.sessions + 1, 1_000_000),
    lastMode: mode,
    lastSurah: Math.min(Math.max(1, Math.floor(surah) || 1), 114),
    updatedAt: Date.now(),
  });
}

/** أضعف الآيات أولاً — الوقود الأمثل لجلسة استذكار */
export function weakestAyahs(s: Tasmee3State, surah: number, limit = 5): number[] {
  const out: Array<{ a: number; ease: Ease; last: number }> = [];
  for (const [key, v] of Object.entries(s.perAyah)) {
    const [su, ay] = key.split(':');
    if (Number(su) !== surah) continue;
    out.push({ a: Number(ay), ease: v.ease, last: v.last });
  }
  out.sort((x, y) => x.ease - y.ease || x.last - y.last);
  return out.slice(0, Math.max(1, limit)).map((x) => x.a);
}

/* ---------- توليد الأسئلة ---------- */

/** تقسيم آية إلى كلمات — يفصل بأي مسافة ويُسقط الكلمات التافهة */
export function tokenizeAyah(text: string): string[] {
  return text.split(/\s+/u).filter((w) => w.length > 0);
}

/** الكلمات المؤهلة للإخفاء: طول كافٍ لئلا يكون إخفاؤها عبثياً */
export function maskableIndices(words: string[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < words.length; i++) {
    if (words[i].length >= MIN_WORD_LEN + 1) out.push(i);
  }
  return out;
}

export interface Cloze {
  /** النص مع الكلمة المستبدلة بـ «…» */
  masked: string;
  /** الخيارات الأربعة معكوسة عشوائياً */
  options: string[];
  /** الكلمة الصحيحة */
  answer: string;
  /** موضع الكلمة في المصفوفة */
  index: number;
}

/** خلط Fisher–Yates */
export function shuffle<T>(arr: readonly T[], rng: () => number = Math.random): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * بناء سؤال «الكلمة الناقصة»: نختار كلمة مؤهلة عشوائياً، ونلتقط
 * ثلاثة مشتتات من كلمات السورة نفسها — بنفس الطول ± 1 أولاً،
 * ثم أي كلمات أخرى — ونستبعد تكرار الكلمة الصحيحة حرفياً.
 */
export function buildCloze(text: string, pool: readonly string[], rng: () => number = Math.random): Cloze | null {
  const words = tokenizeAyah(text);
  const idxs = maskableIndices(words);
  if (idxs.length === 0) return null;

  const index = idxs[Math.floor(rng() * idxs.length)];
  const answer = words[index];

  const uniquePool = Array.from(new Set(pool.filter((w) => w !== answer && w.length >= MIN_WORD_LEN)));
  const near = uniquePool.filter((w) => Math.abs(w.length - answer.length) <= 1);
  const far = uniquePool.filter((w) => Math.abs(w.length - answer.length) > 1);
  const picks = shuffle(near, rng).concat(shuffle(far, rng)).slice(0, 3);
  if (picks.length < 3) return null; // سورة قصيرة جداً — لا نكذب بخيارات مكررة

  const maskedWords = words.slice();
  maskedWords[index] = '…';
  return {
    masked: maskedWords.join(' '),
    options: shuffle([answer, ...picks], rng),
    answer,
    index,
  };
}

/** أضعف الآيات عبر كل المصحف — للوحة الحصيلة و«تركيزك اليوم» */
export function weakestAyahsAll(s: Tasmee3State, limit = 5): Array<{ surah: number; ayah: number; ease: Ease }> {
  const out: Array<{ surah: number; ayah: number; ease: Ease; last: number }> = [];
  for (const [key, v] of Object.entries(s.perAyah)) {
    const [su, ay] = key.split(':');
    out.push({ surah: Number(su), ayah: Number(ay), ease: v.ease, last: v.last });
  }
  out.sort((x, y) => x.ease - y.ease || x.last - y.last || x.surah - y.surah || x.ayah - y.ayah);
  return out.slice(0, Math.max(1, limit)).map(({ surah, ayah, ease }) => ({ surah, ayah, ease }));
}

/* ---------- وضع «اكتب وتلا» ---------- */

export type WriteCell = 'right' | 'wrong' | 'pending';

export interface WriteCheck {
  /** حالة كل كلمة متوقعة: صحيحة / خاطئة / لم تُكتب بعد */
  cells: WriteCell[];
  /** عدد الكلمات التي كتبها المستخدم */
  answered: number;
  /** عدد الكلمات المطابقة للنص */
  correct: number;
  /** نسبة المطابقة (٠–١٠٠) — تُقرب إلى أقرب عدد صحيح */
  pct: number;
  /** اكتملت الكتابة (وصلت كلمات المستخدم لعدد كلمات الآية) */
  complete: boolean;
}

/**
 * مقارنة أمامية كلمةً كلمة بين الآية ومعطيات المستخدم المكتوبة.
 * المطابقة بعد التنقية نفسها المستخدمة في cloze/listen، فلا يفشل
 * من كتب بأشكال إملائية صحيحة مختلفة عن المصحف.
 */
export function checkWrittenWords(expectedText: string, written: string): WriteCheck {
  // tokenizeArabic تُطبِّع أيضاً — وهي الطريقة نفسها المستعملة في بقية المشروع
  const expected = tokenizeArabic(expectedText);
  const got = tokenizeArabic(written);
  const cells: WriteCell[] = [];
  let correct = 0;
  for (let i = 0; i < expected.length; i++) {
    if (i >= got.length) cells.push('pending');
    else if (got[i] === expected[i]) { cells.push('right'); correct += 1; }
    else cells.push('wrong');
  }
  const complete = got.length >= expected.length;
  const pct = expected.length === 0 ? 100 : Math.round((correct / expected.length) * 100);
  return { cells, answered: got.length, correct, pct, complete };
}
