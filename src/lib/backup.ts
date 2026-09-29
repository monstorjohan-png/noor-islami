/**
 * النسخ الاحتياطي
 * ------------------------------------------------------------------
 * «مسح الذاكرة» يمحو كل شيء بضغطة واحدة ولا رجعة فيه: الموقع، وتقدّم
 * الأذكار، وعدّاد التسبيح، والمحفوظات، وخطة الحفظ. هذه الوحدة تعطي
 * المستخدم طريقاً لاسترجاع ما فقده: تصدير نسخة إلى ملف، واستيراده على
 * أي جهاز آخر أو بعد أي مسح.
 *
 * ثلاث قواعد لا تُخترق:
 *
 *   ١ • **التصدير قراءة فقط.** لا يلمس التخزين، ولا يمحو، ولا يعيد كتابة.
 *   ٢ • **الاستيراد لا يكتب قبل التحقق الكامل.** ملف واحد خاطئ = لا تغيير
 *      ولا رمي؛ نكتفي برسالة تقول ما الذي رفضناه ولماذا.
 *   ٣ • **الاستيراد دمج لا استبدال.** كل عدّاد يأخذ الأكبر، والمحفوظات
 *      تُضاف بمعرّف فريد، وما لدى المستخدم لا يُمحى أبداً.
 *
 * اللغة والمظهر ولوحة الألوان لا تُستورد إطلاقاً: هي إعدادات مستهلك
 * تخصّ الجهاز الذي يفتح التطبيق، ونسخة من جهاز آخر قد تعني لغة لا يقرؤها
 * من يشاهد الشاشة. نذكرها في تقرير ما لم يُطبَّق حتى يعرف أنها لم تُنسَ
 * خطأً.
 *
 * لا نصّ ديني في هذا الملف: كل نصّ يأتي من خطّ الأنابيب.
 */

import { useSettings } from './store';
import type { Bookmark } from './store';
import { HIFZ_KEY, loadHifz, sanitizeHifz, saveHifz } from './hifz';
import type { HifzEntry, HifzState } from './hifz';
import { clamp, stripDangerKeys } from './safe';

/* ---------- ثوابت ---------- */

/** اسم التطبيق داخل الملف — يُرفض أي ملف لا يحمله بالضبط */
export const BACKUP_APP = 'noor-islami';

/** نسخة الملف التي يفهمها هذا التطبيق */
export const BACKUP_VERSION = 1 as const;

/** مفتاح تخزين الإعدادات — نفس المفتاح الذي تكتب فيه المخزن الدائم */
export const SETTINGS_KEY = 'noor-settings';

/**
 * سقف حجم الملف المقبول. خمس ميغابايتات أضعاف ما يحتاجه هذا التطبيق،
 * وفوقها `JSON.parse` يوقف الواجهة ثوانٍ — فيُرفض قبل أي تحليل.
 * هذا هو الدرس الذي تعلّمناه من تجميد زرّ التنزيل الشامل.
 */
export const MAX_BACKUP_CHARS = 5 * 1024 * 1024;

/** سقف المحفوظات بعد الدمج — نفس سقف المخزن الدائم */
const BOOKMARK_CAP = 2000;

/** أنواع المحفوظات المقبولة — مطابقة لقائمة المخزن */
const BOOKMARK_KINDS = new Set(['ayah', 'hadith', 'surah', 'page']);

/* ---------- الأنواع ---------- */

/** محتوى ملف النسخة كما يُكتب على القرص */
export interface BackupFile {
  v: typeof BACKUP_VERSION;
  createdAt: number;
  app: string;
  settings: unknown;
  hifz: unknown;
  keys: string[];
}

export type ParseResult = { ok: true; data: BackupFile } | { ok: false; error: string };

export type ApplyResult = { applied: string[]; skipped: string[] };

/** لقطة من حالة الإعدادات كما يراها المخزن */
type SettingsSnapshot = ReturnType<typeof useSettings.getState>;

/* ---------- الأخطاء ---------- */

export type BackupErrorCode = 'tooLarge' | 'notJson' | 'notObject' | 'version' | 'app';

/**
 * نصّ كل خطأ بلغتين.
 * `parseBackup` يرجع **رمز الخطأ** لا نصّه: كود مستقرّ يُختبر، وواجهة
 * تختار لغتها. هكذا لا يعرض المستخدم رمزاً غريباً ولا جملة واحدة
 * بلغتين تختلط فيها الحروف.
 */
export const BACKUP_ERRORS: Record<BackupErrorCode, { ar: string; en: string }> = {
  tooLarge: {
    ar: 'الملف أكبر من خمسة ميغابايتات — لا يمكن أن يكون ملف نسخة',
    en: 'The file is larger than five megabytes — it cannot be a backup file',
  },
  notJson: {
    ar: 'المحتوى ليس ملف نسخة صالحاً — انسخه كاملاً دون تعديل',
    en: 'The content is not a valid backup file — copy it whole, without edits',
  },
  notObject: {
    ar: 'الملف لا يحمل بنية نسخة احتياطية',
    en: 'The file does not have a backup structure',
  },
  version: {
    ar: 'الملف من نسخة أحدث من هذا التطبيق — حدّث التطبيق ثم أعد المحاولة',
    en: 'The file comes from a newer version of the app — update it and try again',
  },
  app: {
    ar: 'الملف ليس نسخة من هذا التطبيق',
    en: 'This file is not a backup of this app',
  },
};

/** يحوّل رمز الخطأ إلى نصّ بلغة الواجهة — ورمز مجهول لا يُعرض خاماً */
export function backupErrorText(code: string, lang: 'ar' | 'en'): string {
  const known = BACKUP_ERRORS[code as BackupErrorCode];
  if (!known) return '';
  return lang === 'ar' ? known.ar : known.en;
}

/* ---------- ما لا يُستورد أبداً ---------- */

/**
 * مجموعات الحقول التي لا تُستورد ولا في ملف نظيف:
 *   • `lang` و`theme` و`palette` — استهلاك تخصّ الجهاز الذي يُفتح عليه.
 *   • `preferences` — المذهب وطريقة الحساب والقارئ والأذان والتنبيهات.
 *   • `readingView` — حجم الخط ووضع المصحف وإظهار التفسير والترجمة.
 * تذكر كل مجموعة في تقرير ما لم يُطبَّق مع سببها.
 */
export const NEVER_IMPORTED = ['lang', 'theme', 'palette', 'preferences', 'readingView'] as const;

/** سبب تجاهل كل مجموعة، ليعرضه التطبيق بلغته */
export const SKIP_REASONS: Record<string, { ar: string; en: string }> = {
  lang: {
    ar: 'لغة التطبيق — نسخة من جهاز آخر قد تعني لغة لا يقرؤها المستخدم',
    en: 'App language — a backup from another device may name a language the user cannot read',
  },
  theme: {
    ar: 'المظهر — يبقى ما اختاره المستخدم على هذا الجهاز',
    en: 'Theme — stays as the user chose it on this device',
  },
  palette: {
    ar: 'لوحة الألوان تخصّ هذا الجهاز',
    en: 'The palette belongs to this device',
  },
  preferences: {
    ar: 'تفضيلات الصلاة والأذان تبقى من هذا الجهاز',
    en: 'Prayer and adhan preferences stay on this device',
  },
  readingView: {
    ar: 'حجم الخط وطريقة العرض تبقى من هذا الجهاز',
    en: 'Font size and reading view stay on this device',
  },
};

/* ---------- أدوات داخلية ---------- */

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** عدد صحيح ضمن مجال، وإلا فالافتراضي */
function intIn(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : NaN;
  return Number.isFinite(n) ? clamp(Math.round(n), min, max) : fallback;
}

/** أكبر عددين صامدين — قيمة لا معنى لها تُعدّ صفراً */
function maxNum(a: unknown, b: unknown): number {
  const x = typeof a === 'number' && Number.isFinite(a) ? a : 0;
  const y = typeof b === 'number' && Number.isFinite(b) ? b : 0;
  return Math.max(x, y);
}

/** تساوي بلا تكرار: هل القاموسان واحد؟ */
function sameCounters(a: Record<string, number>, b: Record<string, number>): boolean {
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => k in b && a[k] === b[k]);
}

/** هل القائمتان واحدة؟ الترتيب جزء من الهوية هنا */
function sameBookmarks(a: Bookmark[], b: Bookmark[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((x, i) => {
    const y = b[i];
    return y !== undefined && x.id === y.id && x.at === y.at && x.label === y.label;
  });
}

/**
 * قراءة مفتاح من التخزين المحلي بلا رمي.
 * تخزين تالف أو ممنوع = لا شيء، لا استثناء: المستخدم فقد بياناته مرةً،
 * ولا يفيد أن نسخةَه الاحتياطية تنهار بسببها.
 */
function readStored(key: string): Record<string, unknown> | null {
  if (typeof localStorage === 'undefined') return null;
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(key);
  } catch {
    return null;
  }
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;
  // المخزن الدائم يلفّ الحالة بحقل، ومتابعة الحفظ تُكتب مكشوفة
  const inner = isRecord(parsed['state']) ? (parsed['state'] as Record<string, unknown>) : parsed;
  return Object.keys(inner).length > 0 ? inner : null;
}

/* ---------- الدمج ---------- */

/** محفوظة واحدة معادة بناؤها من قيم محسوبة — لا يُؤخذ حقل كما ورد */
function pickBookmark(v: unknown): Bookmark | null {
  if (!isRecord(v)) return null;
  const kind = v['kind'];
  if (typeof kind !== 'string' || !BOOKMARK_KINDS.has(kind)) return null;
  const ref = typeof v['ref'] === 'string' ? v['ref'] : '';
  if (!ref || ref.length > 128) return null;
  const label = typeof v['label'] === 'string' ? v['label'].slice(0, 200) : '';
  const at = intIn(v['at'], 0, 4e12, 0);
  return { id: `${kind}:${ref}`.slice(0, 160), kind: kind as Bookmark['kind'], ref, label, at };
}

/** قائمة محفوظات نظيفة بلا تكرار — المعرّف مشتقّ من النوع والمرجع */
function normalizeBookmarks(v: unknown): Bookmark[] {
  if (!Array.isArray(v)) return [];
  const byId = new Map<string, Bookmark>();
  for (const raw of v) {
    const b = pickBookmark(raw);
    if (b && !byId.has(b.id)) byId.set(b.id, b);
  }
  return [...byId.values()].slice(0, BOOKMARK_CAP);
}

/** المحفوظات المحلية ثم ما في النسخة بشرط ألّا يمرّ بمعرّف محفوظ */
function unionBookmarks(local: Bookmark[], incoming: Bookmark[]): Bookmark[] {
  const byId = new Map<string, Bookmark>();
  for (const b of local) byId.set(b.id, b);
  for (const b of incoming) if (!byId.has(b.id)) byId.set(b.id, b);
  return [...byId.values()].slice(0, BOOKMARK_CAP);
}

/**
 * قاموس أعداد يُدمج بالقيمة الأعلى لكل مفتاح.
 * القاعدة: العدّاد لا يتراجع. كتابة صفر فوق تقدّم قائم محذوف،
 * والنسخة من جهاز آخر قد تكون أقدم من تقدّم الجهاز الحالي.
 */
function mergeCounters(local: unknown, incoming: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  for (const src of [local, incoming]) {
    for (const [k, v] of Object.entries(stripDangerKeys<unknown>(src))) {
      if (typeof v !== 'number' || !Number.isFinite(v)) continue;
      out[k] = Math.max(out[k] ?? 0, Math.max(0, v));
    }
  }
  return out;
}

/** الموقع يُؤخذ كما هو إن كان ضمن نطاق الأرض — وإلا يُهمَل ولا يُقصّ */
function pickLocation(v: unknown): SettingsSnapshot['location'] {
  if (!isRecord(v)) return null;
  const lat = v['lat'];
  const lon = v['lon'];
  if (typeof lat !== 'number' || typeof lon !== 'number') return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  const label = typeof v['label'] === 'string' ? v['label'].slice(0, 64) : '';
  return { lat: Math.round(lat * 1000) / 1000, lon: Math.round(lon * 1000) / 1000, label };
}

/**
 * دمج متابعة الحفظ.
 * التقدّم يُدمج بالقيمة الأعلى دائماً، أمّا معطيات الخطة (يوم البدء
 * والهدف اليومي) فتُؤخذ من النسخة إذا كانت الخطة المحلية فارغة: هناك
 * شيء يستعاد، لا شيء يُمحى. وخطة قائمة لها معطياتها، لا نبدّلها بخطة
 * أقدم قد تُرجع المستخدم إلى الوراء.
 */
function mergeHifz(local: HifzState, incoming: HifzState): HifzState {
  const bySurah = new Map<number, HifzEntry>();
  for (const e of local.entries) bySurah.set(e.surah, e);
  for (const e of incoming.entries) {
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
  const planEmpty = local.entries.length === 0 && local.completedRuns === 0;
  const last = Math.max(local.lastCompletedAt ?? 0, incoming.lastCompletedAt ?? 0);
  return sanitizeHifz({
    entries: [...bySurah.values()],
    startDay: planEmpty ? incoming.startDay : local.startDay,
    dailyTarget: planEmpty ? incoming.dailyTarget : local.dailyTarget,
    completedRuns: Math.max(local.completedRuns, incoming.completedRuns),
    lastCompletedAt: last > 0 ? last : null,
  });
}

/* ---------- التصدير ---------- */

/**
 * يجمع نسخة من كل ما حُفظ في هذا الجهاز.
 * لا يكتب ولا يمحو شيئاً: قراءة فقط. ومفتاح غائب أو تخزين تالف يعطي
 * `null` لا رمياً — نسخة ناقصة خيرٌ من نسخة تفقد المستخدم آخر ما بقي
 * له. وقائمة `keys` تقول ما الذي حُفظ فعلاً.
 */
export async function collectBackup(): Promise<BackupFile> {
  const settings = readStored(SETTINGS_KEY);
  const hifz = readStored(HIFZ_KEY);
  const keys: string[] = [];
  if (settings) keys.push(SETTINGS_KEY);
  if (hifz) keys.push(HIFZ_KEY);
  return {
    v: BACKUP_VERSION,
    createdAt: Date.now(),
    app: BACKUP_APP,
    settings,
    hifz,
    keys,
  };
}

/* ---------- التحقق ---------- */

function fail(error: BackupErrorCode): ParseResult {
  return { ok: false, error };
}

/**
 * يتحقق من نصّ ملف نسخة قبل أي كتابة في المخزن.
 * الترتيب مقصود: الحجم أولاً قبل التحليل، ثم البنية، ثم النسخة، ثم
 * التطبيق، ثم الحقول. أول خطأ يوقف — لا استيراد ناقص ولا مساس.
 */
export function parseBackup(text: string): ParseResult {
  if (typeof text !== 'string' || text.trim() === '') return fail('notJson');
  if (text.length > MAX_BACKUP_CHARS) return fail('tooLarge');

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return fail('notJson');
  }
  if (!isRecord(raw)) return fail('notObject');

  const version = raw['v'];
  if (version === undefined || version === null) return fail('notObject');
  if (typeof version !== 'number' || version !== BACKUP_VERSION) return fail('version');

  const app = raw['app'];
  if (typeof app !== 'string' || app !== BACKUP_APP) return fail('app');

  // الإعدادات: لا تنقية عميقة هنا — دالّة التنقية في المخزن غير مصدَّرة،
  // وكل حقل نلمسه أدناه يُعاد بناؤه من قيمة محسوبة قبل كتابته.
  let settings: Record<string, unknown> | null = null;
  const rawSettings = raw['settings'];
  if (rawSettings !== undefined && rawSettings !== null) {
    if (!isRecord(rawSettings) || Object.keys(rawSettings).length === 0) return fail('notObject');
    settings = rawSettings;
  }

  // متابعة الحفظ: غائبة = نسخة بلا متابعة، وهذا سليم. وحاضرة = تُنقّى
  // بدالتها الأصلية، فهي لا ترمي مهما كان الوارد.
  const rawHifz = raw['hifz'];
  const hifz = rawHifz === undefined || rawHifz === null ? null : sanitizeHifz(rawHifz);

  const stamp = raw['createdAt'];
  const createdAt = typeof stamp === 'number' && Number.isFinite(stamp) ? Math.floor(stamp) : 0;
  const rawKeys = raw['keys'];
  const keys = Array.isArray(rawKeys)
    ? rawKeys.filter((k): k is string => typeof k === 'string').slice(0, 8)
    : [];

  return {
    ok: true,
    data: { v: BACKUP_VERSION, createdAt, app: BACKUP_APP, settings, hifz, keys },
  };
}

/* ---------- الاستيراد ---------- */

/**
 * يكتب نسخة فوق الجهاز الحالي بعد أن تحقّق `parseBackup` منها كاملة.
 * الدمج لا الاستبدال: العدّادات تأخذ الأكبر، والمحفوظات تُضاف بمعرّف
 * فريد، والموقع والموضع يُستعادان إذا كان местهما خالياً، ومتابعة
 * الحفظ تُدمج بالقيمة الأعلى.
 *
 * لا يكتب شيئاً قبل أن تنتهي كل الحسابات — فخطأ واحد في المنتصف لا
 * يترك الجهاز نصفَ مستورَد.
 */
export async function applyBackup(data: BackupFile): Promise<ApplyResult> {
  const applied: string[] = [];
  const skipped: string[] = [...NEVER_IMPORTED];

  if (!data || typeof data !== 'object') {
    return { applied, skipped };
  }

  const s = useSettings.getState();
  const incoming = isRecord(data.settings) ? data.settings : null;
  const patch: Partial<SettingsSnapshot> = {};

  if (!incoming) {
    // ملف بلا إعدادات: ملف متابعة حفظ وحده، أو نسخة قديمة
    skipped.push(SETTINGS_KEY);
  } else {
    const total = maxNum(s.tasbihTotal, incoming['tasbihTotal']);
    if (total !== s.tasbihTotal) {
      patch.tasbihTotal = total;
      applied.push('tasbihTotal');
    }

    const counts = mergeCounters(s.tasbihCounts, incoming['tasbihCounts']);
    if (!sameCounters(s.tasbihCounts, counts)) {
      patch.tasbihCounts = counts;
      applied.push('tasbihCounts');
    }

    const adhkar = mergeCounters(s.adhkarProgress, incoming['adhkarProgress']);
    if (!sameCounters(s.adhkarProgress, adhkar)) {
      patch.adhkarProgress = adhkar;
      applied.push('adhkarProgress');
    }

    const marks = unionBookmarks(s.bookmarks, normalizeBookmarks(incoming['bookmarks']));
    if (!sameBookmarks(s.bookmarks, marks)) {
      patch.bookmarks = marks;
      applied.push('bookmarks');
    }

    // الموقع: يُستعاد إذا كان خالياً فقط — فموقعٌ حاضر يضيع إن استبدله
    // ملف من جهاز آخر
    if (s.location === null) {
      const loc = pickLocation(incoming['location']);
      if (loc) {
        patch.location = loc;
        applied.push('location');
      }
    }

    // إتمام الإرشاد لا يُتراجع: إن كان محلياً منجزاً فهو منجز
    if (s.onboarded === false && incoming['onboarded'] === true) {
      patch.onboarded = true;
      applied.push('onboarded');
    }

    // موضع القراءة: يُستعاد على بدايته فقط، فما local عليه شيء يُمحى
    const reading = incoming['reading'];
    if (isRecord(reading) && s.reading.lastSurah === 1 && s.reading.lastAyah === 1) {
      const lastSurah = intIn(reading['lastSurah'], 1, 114, 1);
      const lastAyah = intIn(reading['lastAyah'], 1, 286, 1);
      if (lastSurah !== 1 || lastAyah !== 1) {
        patch.reading = { ...s.reading, lastSurah, lastAyah };
        applied.push('reading');
      }
    }
  }

  // متابعة الحفظ: غائبة من الملف = لا خطأ ولا كتابة
  const incomingHifz = data.hifz === undefined || data.hifz === null ? null : sanitizeHifz(data.hifz);
  if (!incomingHifz) {
    skipped.push(HIFZ_KEY);
  } else {
    const localHifz = loadHifz();
    const merged = mergeHifz(localHifz, incomingHifz);
    if (JSON.stringify(merged) !== JSON.stringify(localHifz)) {
      applied.push(HIFZ_KEY);
    }
    saveHifz(merged);
  }

  // الكتابة كلها هنا في النهاية، بعد أن انتهى كل حساب
  if (Object.keys(patch).length > 0) useSettings.setState(patch);

  return { applied, skipped };
}

/* ---------- اسم الملف ---------- */

/**
 * اسم يحمل التاريخ بأحرف لاتينية عمداً.
 * اسم عربي في اسم ملف يفشل على بعض أنظمة الملفات، ويفشل أسوأ حين
 * يبحث عنه المستخدم بعد أن نسيه — والاسم الذي لا يُفتح لا يُسترجع.
 */
export function backupFileName(): string {
  const d = new Date();
  const y = String(d.getFullYear());
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `noor-backup-${y}-${m}-${day}.json`;
}
