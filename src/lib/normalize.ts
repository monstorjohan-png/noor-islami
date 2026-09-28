/** توحيد النص العربي للبحث: إزالة التشكيل وتوحيد الحروف المتشابهة */

const DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u06D6-\u06ED\u0640\u08F0-\u08F3]/g;
const CONTROLS = /[\u200B-\u200F\u202A-\u202E\uFEFF]/g;
const PUNCT_AR = /[\u061F\u060C\u061B\u061E\u066A-\u066D]/g;

/**
 * ملاحظة جوهرية: المصحف العثماني يكتب الألف الخنجرية (U+0670 ٰ) في مثل
 * «صرٰط» و«السَّمَاوٰت». نحوّلها إلى ألف عادية «صراط» و«السماوات»
 * ولا نحذفها — وإلا لم يجد المستخدم ما كتبه بطبيعة يده.
 */
const DAGGER_ALEF = /\u0670/g;

export function normalizeAr(input?: string | null): string {
  if (!input) return '';
  return input
    .replace(DAGGER_ALEF, '\u0627')
    .replace(DIACRITICS, '')
    .replace(CONTROLS, '')
    .replace(PUNCT_AR, ' ')
    .replace(/[\u0622\u0623\u0625\u0671\u0672\u0673]/g, '\u0627')
    .replace(/\u0629/g, '\u0647')
    .replace(/\u0649/g, '\u064A')
    .replace(/[\u0624]/g, '\u0648')
    .replace(/[\u0626]/g, '\u064A')
    .replace(/[\u0621]/g, '\u0627')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** يعكس النص من اليمين لليسار — للبحث المنطقي */
export function isArabicQuery(q: string): boolean {
  return /[\u0600-\u06FF]/.test(q);
}

export function normalizeQuery(q: string): string {
  return isArabicQuery(q) ? normalizeAr(q) : q.toLowerCase().trim();
}

/** يطابق نصاً مُوحَّداً مع استعلام مُوحَّداً */
export function matches(haystackNorm: string, queryNorm: string): boolean {
  return !!queryNorm && haystackNorm.includes(queryNorm);
}
