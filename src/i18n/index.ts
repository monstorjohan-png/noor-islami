import type { Lang } from '../lib/types';

type Dict = Record<string, { ar: string; en: string }>;

/**
 * رسائل التطبيق المشتركة: العربية أولاً والإنجليزية ثانياً.
 * المفاتيح مشتقّة من الكائن نفسه، فأي خطأ في اسم مفتاح يظهر عند البناء.
 */
export const T = {
  appName: { ar: 'نور', en: 'NOOR' },
  tagline: { ar: 'رفيقك اليومي للقرآن والحديث', en: 'Your daily companion for Quran & Sunnah' },

  // تنقل
  home: { ar: 'الرئيسية', en: 'Home' },
  quran: { ar: 'القرآن', en: 'Quran' },
  hadith: { ar: 'الحديث', en: 'Hadith' },
  prayer: { ar: 'الصلاة', en: 'Prayer' },
  qibla: { ar: 'القبلة', en: 'Qibla' },
  tasbih: { ar: 'المسبحة', en: 'Tasbih' },
  adhkar: { ar: 'الأذكار', en: 'Adhkar' },
  names: { ar: 'أسماء الله', en: 'Names of Allah' },
  calendar: { ar: 'التقويم', en: 'Calendar' },
  search: { ar: 'البحث', en: 'Search' },
  bookmarks: { ar: 'المحفوظات', en: 'Bookmarks' },
  settings: { ar: 'الإعدادات', en: 'Settings' },
  download: { ar: 'التنزيل', en: 'Download' },
  more: { ar: 'المزيد', en: 'More' },

  // عام
  searchPlaceholder: { ar: 'ابحث في القرآن والحديث…', en: 'Search Quran & Hadith…' },
  loading: { ar: 'جارٍ التحميل…', en: 'Loading…' },
  error: { ar: 'حدث خطأ', en: 'An error occurred' },
  retry: { ar: 'إعادة المحاولة', en: 'Retry' },
  close: { ar: 'إغلاق', en: 'Close' },
  back: { ar: 'رجوع', en: 'Back' },
  next: { ar: 'التالي', en: 'Next' },
  prev: { ar: 'السابق', en: 'Previous' },
  results: { ar: 'نتيجة', en: 'results' },
  noResults: { ar: 'لا نتائج', en: 'No results' },
  verse: { ar: 'آية', en: 'Verse' },
  surah: { ar: 'سورة', en: 'Surah' },
  hadithNo: { ar: 'حديث', en: 'Hadith' },
  juz: { ar: 'الجزء', en: 'Juz' },
  page: { ar: 'الصفحة', en: 'Page' },
  makki: { ar: 'مكية', en: 'Meccan' },
  madani: { ar: 'مدنية', en: 'Medinan' },
  verses: { ar: 'آية', en: 'verses' },

  // القرآن
  surahs: { ar: 'السور', en: 'Surahs' },
  juzList: { ar: 'الأجزاء', en: 'Juzs' },
  tafsir: { ar: 'التفسير', en: 'Tafsir' },
  translation: { ar: 'الترجمة', en: 'Translation' },
  showTafsir: { ar: 'إظهار التفسير', en: 'Show tafsir' },
  hideTafsir: { ar: 'إخفاء التفسير', en: 'Hide tafsir' },
  bookmark: { ar: 'حفظ', en: 'Bookmark' },
  bookmarked: { ar: 'محفوظ', en: 'Saved' },
  copy: { ar: 'نسخ', en: 'Copy' },
  copied: { ar: 'تم النسخ', en: 'Copied' },
  share: { ar: 'مشاركة', en: 'Share' },
  playRecitation: { ar: 'استماع', en: 'Listen' },
  stopRecitation: { ar: 'إيقاف', en: 'Stop' },
  mushafMode: { ar: 'المصحف', en: 'Mushaf' },
  continueReading: { ar: 'متابعة القراءة', en: 'Continue reading' },
  tafsirSource: { ar: 'تفسير الجلالين — المحلبي والسيوطي', en: 'Tafsir al-Jalalayn' },

  // الحديث
  books: { ar: 'الكتب', en: 'Collections' },
  grade: { ar: 'الدرجة', en: 'Grade' },
  sahih: { ar: 'صحيح', en: 'Sahih' },
  hasan: { ar: 'حسن', en: 'Hasan' },
  daif: { ar: 'ضعيف', en: 'Daif' },
  unspecified: { ar: 'غير مُبيَّن', en: 'Not stated' },
  gradeBy: { ar: 'التصنيف', en: 'Graded by' },
  isnad: { ar: 'السند', en: 'Isnad' },
  matn: { ar: 'المتن', en: 'Matn' },
  allGrades: { ar: 'كل الدرجات', en: 'All grades' },
  sahihOnly: { ar: 'الصحيح فقط', en: 'Sahih only' },
  author: { ar: 'المؤلف', en: 'Author' },

  // الصلاة
  nextPrayer: { ar: 'الصلاة القادمة', en: 'Next prayer' },
  remaining: { ar: 'المتبقي', en: 'Remaining' },
  now: { ar: 'الوقت الحالي', en: 'Current time' },
  method: { ar: 'طريقة الحساب', en: 'Calculation method' },
  madhab: { ar: 'المذهب', en: 'Madhab' },
  setLocation: { ar: 'حدّد موقعك لحساب المواقيت', en: 'Set your location for prayer times' },
  useGPS: { ar: 'تحديد تلقائي', en: 'Use GPS' },
  pickCity: { ar: 'اختر مدينة', en: 'Pick a city' },
  athan: { ar: 'الأذان', en: 'Athan' },
  athanOn: { ar: 'الأذان مُفعّل', en: 'Athan enabled' },
  athanOff: { ar: 'الأذان متوقف', en: 'Athan disabled' },
  qiblaDistance: { ar: 'المسافة للكعبة', en: 'Distance to Kaaba' },
  qiblaDirection: { ar: 'اتجاه القبلة', en: 'Qibla direction' },
  allowCompass: { ar: 'اسمح بالوصول للجاذبة (البوصلة)', en: 'Allow compass access' },
  compassNeeds: { ar: 'يحتاج التطبيق على هاتف لقياس الاتجاه', en: 'A phone is needed to measure direction' },
  north: { ar: 'شمال', en: 'N' },

  // التقويم
  hijri: { ar: 'هجري', en: 'Hijri' },
  gregorian: { ar: 'ميلادي', en: 'Gregorian' },
  today: { ar: 'اليوم', en: 'Today' },
  events: { ar: 'المناسبات', en: 'Events' },

  // الأذكار
  morning: { ar: 'أذكار الصباح', en: 'Morning adhkar' },
  evening: { ar: 'أذكار المساء', en: 'Evening adhkar' },
  afterPrayer: { ar: 'أذكار بعد الصلاة', en: 'After prayer' },
  sleep: { ar: 'أذكار النوم', en: 'Before sleep' },
  waking: { ar: 'أذكار الاستيقاظ', en: 'On waking' },
  mosque: { ar: 'أذكار المسجد', en: 'Mosque' },
  atHome: { ar: 'أذكار المنزل', en: 'At home' },
  travel: { ar: 'أذكار السفر', en: 'Travel' },
  rain: { ar: 'أذكار المطر', en: 'Rain & wind' },
  distress: { ar: 'أذكار الهم والحزن', en: 'Distress' },
  quranDhikr: { ar: 'ورد القرآن', en: 'Quran recitation' },
  source: { ar: 'المصدر', en: 'Source' },
  reference: { ar: 'المرجع', en: 'Reference' },
  repeat: { ar: 'التكرار', en: 'Repeat' },
  reset: { ar: 'تصفير', en: 'Reset' },
  done: { ar: 'تم', en: 'Done' },
  totalToday: { ar: 'مجموع اليوم', en: 'Total today' },

  // الأسماء
  meaning: { ar: 'المعنى', en: 'Meaning' },
  appearsIn: { ar: 'ورد في', en: 'Mentioned in' },

  // الإعدادات
  language: { ar: 'اللغة', en: 'Language' },
  theme: { ar: 'المظهر', en: 'Theme' },
  dark: { ar: 'داكن', en: 'Dark' },
  light: { ar: 'فاتح', en: 'Light' },
  fontSize: { ar: 'حجم خط المصحف', en: 'Mushaf font size' },
  notifications: { ar: 'تنبيهات الأذان', en: 'Athan notifications' },
  volume: { ar: 'مستوى الصوت', en: 'Volume' },
  dailyReminders: { ar: 'ورد يومي', en: 'Daily reminder' },
  dataAndPrivacy: { ar: 'البيانات والخصوصية', en: 'Data & privacy' },
  about: { ar: 'عن التطبيق', en: 'About' },
  clearData: { ar: 'حذف البيانات المخزّنة', en: 'Clear cached data' },
  clearDataConfirm: { ar: 'سيُحذف كل المحتوى المخزّن وتُعاد التنزيلات. متابعة؟', en: 'All cached content will be removed. Continue?' },
  storage: { ar: 'المساحة المستخدمة', en: 'Storage used' },

  // التنزيل
  downloadForOffline: { ar: 'التنزيل للاستخدام دون إنترنت', en: 'Download for offline use' },
  downloadAll: { ar: 'تنزيل الكل', en: 'Download all' },
  downloaded: { ar: 'مُنزَّل', en: 'Downloaded' },
  notDownloaded: { ar: 'غير مُنزَّل', en: 'Not downloaded' },
  offlineReady: { ar: 'يعمل بدون إنترنت', en: 'Works offline' },
  size: { ar: 'الحجم', en: 'Size' },
  totalSize: { ar: 'الإجمالي', en: 'Total' },
  freeSpace: { ar: 'المتاح', en: 'Free' },

  // المحتوى
  contentSources: { ar: 'مصادر المحتوى', en: 'Content sources' },
  contentPolicy: {
    ar: 'كل نص في التطبيق من مصدر موثّق يُراجَع عليه. ما لا نُتيقن مصدره لا يُدرَج.',
    en: 'Every text comes from a documented source. What we cannot verify is not included.',
  },
  gapsNote: {
    ar: 'بعض الأحاديث ناقصة في الطبعات المفتوحة، وقد أُسقطت وسُجّلت أرقامها بدل ملئها.',
    en: 'Some hadith are missing in the open editions; they were dropped and their numbers logged, not filled in.',
  },
  disclaimer: {
    ar: 'للتوثيق العلمي: يُرجى الرجوع لأهل العلم في الفتاوى والمسائل الخلافية.',
    en: 'For scholarly accuracy: refer to qualified scholars for fatwa and disputed matters.',
  },

  // الحساب
  account: { ar: 'الحساب', en: 'Account' },
  signIn: { ar: 'تسجيل الدخول', en: 'Sign in' },
  signUp: { ar: 'إنشاء حساب', en: 'Sign up' },
  signOut: { ar: 'تسجيل الخروج', en: 'Sign out' },
  deleteAccount: { ar: 'حذف الحساب', en: 'Delete account' },
  guest: { ar: 'ضيف', en: 'Guest' },
  email: { ar: 'البريد الإلكتروني', en: 'Email' },
  password: { ar: 'كلمة المرور', en: 'Password' },
  sync: { ar: 'المزامنة', en: 'Sync' },
} as const;

/** مفاتيح القاموس المشترك — تُستعمل في الأنواع فتسقط الأخطاء في زمن البناء */
export type MsgKey = keyof typeof T;

export function t(key: string, lang: Lang): string {
  const dict = T as unknown as Dict;
  return dict[key]?.[lang] ?? dict[key]?.ar ?? key;
}
