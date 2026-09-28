/**
 * سجل المصادر — المصدر الوحيد للحقيقة.
 * لا يُضاف أي نص إلى التطبيق إلا عبر هذا السجل.
 * كل مصدر يجب أن يكون: public domain / CC-BY / CCCAND مستند مرخّص.
 */

export const QURAN_CDN = 'https://cdn.jsdelivr.net/gh/fawazahmed0/quran-api@1';
export const HADITH_CDN = 'https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1';

/** ترخيص: Unlicense (Public Domain) — fawazahmed0 */
export const QURAN = {
  license: 'Unlicense (Public Domain)',
  licenseUrl: 'https://github.com/fawazahmed0/quran-api/blob/1/LICENSE',
  editions: {
    // نص المصحف برواية حفص عن عاصم — المصدر: مجمع الملك فهد لطباعة المصحف الشريف
    uthmani: {
      key: 'ara-quranuthmanihaf',
      file: 'ara-quranuthmanihaf.json',
      label: { ar: 'المصحف العثماني (حفص عن عاصم)', en: 'Uthmani (Hafs)' },
      origin: 'https://qurancomplex.gov.sa/',
    },
    // تفسير الجلالين — المحلبي والسيوطي (نص كلاسيكي ملكية عامة)
    tafsirJalalayn: {
      key: 'ara-jalaladdinalmah',
      file: 'ara-jalaladdinalmah.json',
      label: { ar: 'تفسير الجلالين — المحلبي والسيوطي', en: 'Tafsir al-Jalalayn' },
      origin: 'https://tanzil.net',
    },
    enAbdelHaleem: {
      key: 'eng-abdelhaleem',
      file: 'eng-abdelhaleem.json',
      label: { ar: 'عبد الحميد الحليم (إنجليزي)', en: 'Abdul Haleem (EN)' },
      origin: 'https://tanzil.net',
    },
    enAbdulHye: {
      key: 'eng-abdulhye',
      file: 'eng-abdulhye.json',
      label: { ar: 'محمد عبد الحق (إنجليزي)', en: 'Muhammad Abdul Hye (EN)' },
      origin: 'https://tanzil.net',
    },
  },
  info: `${QURAN_CDN}/info.json`,
};

/** كتب الحديث — نص عربي كامل بالأسانيد + درجات التصنيف مُهيكلة */
export const HADITH = {
  license: 'Unlicense (Public Domain)',
  licenseUrl: 'https://github.com/fawazahmed0/hadith-api/blob/1/LICENSE',
  books: [
    {
      key: 'bukhari',
      ara: 'ara-bukhari',
      eng: 'eng-bukhari',
      label: { ar: 'صحيح البخاري', en: 'Sahih al-Bukhari' },
      author: { ar: 'الإمام محمد بن إسماعيل البخاري', en: 'Imam al-Bukhari' },
      death: { ar: 'توفي 256 هـ', en: 'd. 256 AH' },
      grade: 'sahih',
      note: {
        ar: 'أصح كتب الحديث، وما فيه من Criticism فبينه أهل العلم، فلا يُترك.',
        en: 'The most authentic collection after the Quran.',
      },
    },
    {
      key: 'muslim',
      ara: 'ara-muslim',
      eng: 'eng-muslim',
      label: { ar: 'صحيح مسلم', en: 'Sahih Muslim' },
      author: { ar: 'الإمام مسلم بن الحجاج النيسابوري', en: 'Imam Muslim' },
      death: { ar: 'توفي 261 هـ', en: 'd. 261 AH' },
      grade: 'sahih',
      note: { ar: 'صحيح بترتيب المصنف، ما خلا من تكلم فيه أهل العلم.', en: 'Authentic, arranged by the author.' },
    },
    {
      key: 'abudawud',
      ara: 'ara-abudawud',
      eng: 'eng-abudawud',
      label: { ar: 'سنن أبي داود', en: 'Sunan Abi Dawud' },
      author: { ar: 'الإمام سليمان بن الأشعث أبو داود', en: 'Imam Abu Dawud' },
      death: { ar: 'توفي 275 هـ', en: 'd. 275 AH' },
      grade: 'mixed',
      note: { ar: 'فيه الصحيح والحسن والضعيف، ويُعرض على قواعد أهل العلم.', en: 'Mixed: sahih, hasan and weak.' },
    },
    {
      key: 'tirmidhi',
      ara: 'ara-tirmidhi',
      eng: 'eng-tirmidhi',
      label: { ar: 'جامع الترمذي', en: "Jami' at-Tirmidhi" },
      author: { ar: 'الإمام أبو عيسى محمد بن عيسى الترمذي', en: 'Imam at-Tirmidhi' },
      death: { ar: 'توفي 279 هـ', en: 'd. 279 AH' },
      grade: 'mixed',
      note: { ar: 'الترمذي يُبيّن درجة كل حديث في آخره، وهو من أجود كتب السنن.', en: "at-Tirmidhi grades each hadith." },
    },
    {
      key: 'nasai',
      ara: 'ara-nasai',
      eng: 'eng-nasai',
      label: { ar: 'سنن النسائي', en: "Sunan an-Nasa'i" },
      author: { ar: 'الإمام أحمد بن شعيب النسائي', en: 'Imam an-Nasa\'i' },
      death: { ar: 'توفي 303 هـ', en: 'd. 303 AH' },
      grade: 'mixed',
      note: { ar: 'من أجود كتب السنن، وأقلّها ضعيفاً.', en: 'Among the best, with few weak reports.' },
    },
    {
      key: 'ibnmajah',
      ara: 'ara-ibnmajah',
      eng: 'eng-ibnmajah',
      label: { ar: 'سنن ابن ماجه', en: 'Sunan Ibn Majah' },
      author: { ar: 'الإمام محمد بن يزيد ابن ماجه القزويني', en: 'Imam Ibn Majah' },
      death: { ar: 'توفي 273 هـ', en: 'd. 273 AH' },
      grade: 'mixed',
      note: { ar: 'فيه ما فيه، ويجب التثبّت في أحاديثه.', en: 'Requires careful verification.' },
    },
    {
      key: 'malik',
      ara: 'ara-malik',
      eng: 'eng-malik',
      label: { ar: 'موطأ الإمام مالك', en: 'Muwwatta of Malik' },
      author: { ar: 'الإمام مالك بن أنس الأصماني', en: 'Imam Malik' },
      death: { ar: 'توفي 179 هـ', en: 'd. 179 AH' },
      grade: 'sahih',
      note: { ar: 'أقدم كتب الحديث بعد القرآن، وموطأ مالك موطأ جائز.', en: 'The oldest hadith book after the Quran.' },
    },
    {
      key: 'nawawi',
      ara: 'ara-nawawi',
      eng: 'eng-nawawi',
      label: { ar: 'الأربعون النووية', en: "An-Nawawi's 40" },
      author: { ar: 'الإمام يحيى بن شرف النووي', en: 'Imam an-Nawawi' },
      death: { ar: 'توفي 676 هـ', en: 'd. 676 AH' },
      grade: 'mixed',
      note: { ar: 'أربعون حديثاً جامعة، أكثرها صحيح.', en: 'Forty foundational hadith.' },
    },
    {
      key: 'qudsi',
      ara: 'ara-qudsi',
      eng: 'eng-qudsi',
      label: { ar: 'الأحاديث القدسية', en: 'Qudsi (Sacred Reports)' },
      author: { ar: 'مجموع الأحاديث القدسية', en: 'Sacred reports' },
      death: { ar: null, en: null },
      grade: 'mixed',
      note: { ar: 'أحاديث مقدسة، تُروى عن النبي ﷺ مباشرة.', en: 'Sacred reports narrated directly from the Prophet ﷺ.' },
    },
  ],
};

export const AUDIO = {
  // تسجيلات من everyayah.com (مصدر مفتوح) — تُشغَّل عند الاتصال أو بعد التنزيل
  note: 'التلاوة تُبثّ عبر الشبكة أو تُنزَّل مسبقاً للاستخدام دون إنترنت.',
};
