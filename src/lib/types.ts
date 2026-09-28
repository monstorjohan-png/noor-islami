/** أنواع البيانات — تطابق مخرجات scripts/fetch-content.mjs */

export type Lang = 'ar' | 'en';
export type L = Record<Lang, string>;

/* المصحف مخزَّن كمصفوفات مضغوطة لتقليل الحجم */
export type QuranRow = [
  text: string,
  tafsirJalalayn: string,
  enAbdelHaleem: string,
  enAbdulHye: string,
  normalized: string,
  skeleton: string,
];

export type PosRow = [juz: number, page: number, line: number, ruku: number, sajda: 0 | 1];

export interface Surah {
  n: number;
  ar: string;
  arSimple: string;
  en: string;
  type: string;
  verses: number;
  place: string;
  juzFrom: number;
  juzTo: number;
  startPage: number;
}

export interface QuranMeta {
  ayahCount: number;
  surahCount: number;
  juzCount: number;
  sajdaCount: number;
  sajdaObligatory: number;
  rukuCount: number;
  pageCount: number;
  editions: Record<string, { key: string; label: L; origin: string }>;
  license: string;
  licenseUrl: string;
}

/* ---------- الحديث ---------- */

export type GradeBase = 'sahih' | 'hasan' | 'daif' | 'unspecified';

export interface HadithGrade {
  /** درجة المصنِّف */
  g: string;
  /** اسم المصنِّف */
  by: string;
  base: GradeBase;
}

export interface Hadith {
  /** رقم الحديث في الكتاب */
  n: number;
  /** رقم الكتاب */
  b: number | null;
  /** النص العربي كاملاً بالإسناد */
  t: string;
  /** نص مُوحَّد للبحث */
  f: string;
  /** أقوى درجة */
  g: GradeBase;
  /** كل الدرجات */
  gr: HadithGrade[];
}

export interface HadithBookMeta {
  key: string;
  label: L;
  author: L;
  death: L;
  grade: 'sahih' | 'mixed';
  note: L;
  count: number;
  sourceCount: number;
  gaps: number;
  bytes: number;
}

/* ---------- المحتوى المُحال إلى مصادر ---------- */

/**
 * كل عنصر مُحتوى من تأليف بشري يجب أن يحمل مرجعه الذي يتحقق منه المستخدم.
 * النصوص المستقاة (قرآن/حديث) تُقرأ من المصفوفات ولا تُنسخ هنا.
 */
export interface AdhkarGroup {
  id: string;
  title: L;
  /** التوقيت المناسب */
  when?: L;
  /** مصدر المجموعة: كتاب معروف أو «أذكار الكتاب والسنة» */
  source: string;
  items: AdhkarItem[];
}

export interface AdhkarItem {
  id: string;
  /** نص عربي */
  ar: string;
  /** معنى الدعاء */
  meaning?: string;
  /** العدد */
  count?: number;
  /** مرجع التحقق: اسم الكتاب + الرقم */
  ref: string;
  /** إن كان النص من المصحف: [سورة، آية] */
  quran?: [number, number];
  /** إن كان من الحديث: [مفتاح الكتاب، رقم الحديث] */
  hadith?: [string, number];
  /**
   * كلمات لازم وجودها في نص المصدر. أداة التدقيق تفحصها آلياً،
   * فإذا أخطأنا في الرقم فشل الفحص ولم يظهر الذكر أصلاً.
   */
  must?: string[];
}

export interface NameOfGod {
  n: number;
  ar: string;
  trans: string;
  meaning: L;
  /** الاسم يظهر في القرآن: [سورة, آية] */
  quran?: [number, number];
}

export interface Scholar {
  id: string;
  name: L;
  kunya?: L;
  laqab?: L;
  birthDeath: L;
  era: L;
  bio: L;
  /** كتبه المعروفة */
  works: L[];
  /** مرجع الترجمة — مصنف تراجم معروف */
  ref: L;
  /** طبقه أهل العلم */
  grading: L;
}

export interface SeerahEvent {
  year: string;
  hijri: string;
  title: L;
  desc: L;
  place?: L;
  ref: L;
}
