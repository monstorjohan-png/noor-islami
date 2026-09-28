/**
 * تسميات الأزرار العربية — ملف مستقل لتفادي تلف التصغير (minification).
 * جميع النصوص العربية هنا بالهروب الموحد \uXXXX لتنجو من esbuild.
 */

export const BTN_LABELS = {
  /** زر مشاركة النص */
  shareText: '\u0646\u0635',        // نص
  /** زر مشاركة الصورة */
  shareImage: '\u0645\u0634\u0627\u0631\u0643\u0629',  // مشاركة
  /** زر النسخ */
  copy: '\u0646\u0633\u062E',        // نسخ
  /** زر الحفظ/الإشارة المرجعية */
  bookmark: '\u062D\u0641\u0638',     // حفظ
  /** زر التفسير */
  tafsir: '\u0627\u0644\u062A\u0641\u0633\u064A\u0631', // التفسير
  /** زر الاستماع */
  listen: '\u0627\u0633\u062A\u0645\u0627\u0639',      // استماع
} as const;

/** تسميات الأزرار الإنجليزية */
export const BTN_LABELS_EN = {
  shareText: 'Text',
  shareImage: 'Share',
  copy: 'Copy',
  bookmark: 'Save',
  tafsir: 'Tafsir',
  listen: 'Listen',
} as const;

/** دالة مساعدة لتسمية زر حسب اللغة */
export function getBtnLabel(key: keyof typeof BTN_LABELS, lang: 'ar' | 'en'): string {
  return lang === 'en' ? BTN_LABELS_EN[key] : BTN_LABELS[key];
}