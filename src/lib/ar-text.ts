/**
 * تطبيع النص العربي للمقارنة — مصدر واحد تستعمله كل الوحدات
 * (التسميع، الدرجة الذكية، الحفظ بالمقارنة). لا تُستعمل أبداً
 * لكتابة نص يُعرض للمستخدم.
 */

const HARAKAT = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;
const NON_ARABIC = /[^ء-ي\s]/g;

/** إزالة التشكيل وتوحيد الصور الإملائية للمقارنة فقط */
export function normalizeArabic(input: string): string {
  return input
    .replace(HARAKAT, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(NON_ARABIC, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** تقسيم إلى كلمات بعد التنقية — ما يحتاجه كل محرك مقارنة */
export function tokenizeArabic(input: string): string[] {
  const n = normalizeArabic(input);
  return n ? n.split(' ').filter(Boolean) : [];
}
