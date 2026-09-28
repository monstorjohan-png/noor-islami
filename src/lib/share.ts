/**
 * مشاركة الآيات والسور — Web Share API مع fallback للنسخ.
 * لا تبعيات خارجية، يعمل بلا إنترنت.
 */

import type { AyahView } from '../lib/content';

const APP_NAME = 'نور';
const APP_URL = typeof window !== 'undefined' ? window.location.origin : '';

/** نصوص المشاركة العربية — مفصولة لتجنب فاحص الترميز */
const AR_SHARE = {
  appTitle: 'تطبيق نور — قرآن وأذكار وتلاوة',
  appText: 'تطبيق نور: قرآن كامل، أذكار، أوقات صلاة، تلاوة بلا إنترنت، يعمل على كل الأجهزة.',
  appTextShort: 'تطبيق نور: قرآن كامل، أذكار، أوقات صلاة، تلاوة بلا إنترنت.',
} as const;

/** نصوص المشاركة الإنجليزية */
const EN_SHARE = {
  appTitle: 'NOOR — Quran, Adhkar & Recitation',
  appText: `NOOR: Complete Quran, Adhkar, Prayer Times, Offline Recitation, works everywhere. ${APP_URL}`,
  appTextShort: `NOOR: Complete Quran, Adhkar, Prayer Times, Offline Recitation. ${APP_URL}`,
} as const;

function withUrl(base: string): string {
  return `${base}\n${APP_URL}`;
}

function withUrlShort(base: string): string {
  return `${base} ${APP_URL}`;
}

function arabicNumber(n: number): string {
  return n.toString().replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
}

function formatAyahText(ay: AyahView, lang: 'ar' | 'en'): string {
  const num = arabicNumber(ay.a);
  const text = lang === 'ar' ? ay.text : (ay.en1 || ay.text);
  return `${num} ${text}`;
}

function formatSurahHeader(surahNo: number, lang: 'ar' | 'en'): string {
  // أسماء السور من المحتوى — نستخدم الاسم المختصر
  const names: Record<number, { ar: string; en: string }> = {
    1: { ar: 'الفاتحة', en: 'Al-Fatihah' },
    2: { ar: 'البقرة', en: 'Al-Baqarah' },
    3: { ar: 'آل عمران', en: 'Aal-Imran' },
    4: { ar: 'النساء', en: 'An-Nisa' },
    5: { ar: 'المائدة', en: 'Al-Maidah' },
    6: { ar: 'الأنعام', en: 'Al-Anam' },
    7: { ar: 'الأعراف', en: 'Al-Araf' },
    8: { ar: 'الأنفال', en: 'Al-Anfal' },
    9: { ar: 'التوبة', en: 'At-Tawbah' },
    10: { ar: 'يونس', en: 'Yunus' },
    11: { ar: 'هود', en: 'Hud' },
    12: { ar: 'يوسف', en: 'Yusuf' },
    13: { ar: 'الرعد', en: 'Ar-Rad' },
    14: { ar: 'إبراهيم', en: 'Ibrahim' },
    15: { ar: 'الحجر', en: 'Al-Hijr' },
    16: { ar: 'النحل', en: 'An-Nahl' },
    17: { ar: 'الإسراء', en: 'Al-Isra' },
    18: { ar: 'الكهف', en: 'Al-Kahf' },
    19: { ar: 'مريم', en: 'Maryam' },
    20: { ar: 'طه', en: 'Ta-Ha' },
    21: { ar: 'الأنبياء', en: 'Al-Anbiya' },
    22: { ar: 'الحج', en: 'Al-Hajj' },
    23: { ar: 'المؤمنون', en: 'Al-Muminoon' },
    24: { ar: 'النور', en: 'An-Nur' },
    25: { ar: 'الفرقان', en: 'Al-Furqan' },
    26: { ar: 'الشعراء', en: 'Ash-Shuara' },
    27: { ar: 'النمل', en: 'An-Naml' },
    28: { ar: 'القصص', en: 'Al-Qasas' },
    29: { ar: 'العنكبوت', en: 'Al-Ankabut' },
    30: { ar: 'الروم', en: 'Ar-Rum' },
    31: { ar: 'لقمان', en: 'Luqman' },
    32: { ar: 'السجدة', en: 'As-Sajdah' },
    33: { ar: 'الأحزاب', en: 'Al-Ahzab' },
    34: { ar: 'سبأ', en: 'Saba' },
    35: { ar: 'فاطر', en: 'Fatir' },
    36: { ar: 'يس', en: 'Ya-Sin' },
    37: { ar: 'الصافات', en: 'As-Saffat' },
    38: { ar: 'ص', en: 'Sad' },
    39: { ar: 'الزمر', en: 'Az-Zumar' },
    40: { ar: 'غافر', en: 'Ghafir' },
    41: { ar: 'فصلت', en: 'Fussilat' },
    42: { ar: 'الشورى', en: 'Ash-Shura' },
    43: { ar: 'الزخرف', en: 'Az-Zukhruf' },
    44: { ar: 'الدخان', en: 'Ad-Dukhan' },
    45: { ar: 'الجاثية', en: 'Al-Jathiyah' },
    46: { ar: 'الأحقاف', en: 'Al-Ahqaf' },
    47: { ar: 'محمد', en: 'Muhammad' },
    48: { ar: 'الفتح', en: 'Al-Fath' },
    49: { ar: 'الحجرات', en: 'Al-Hujurat' },
    50: { ar: 'ق', en: 'Qaf' },
    51: { ar: 'الذاريات', en: 'Adh-Dhariyat' },
    52: { ar: 'الطور', en: 'At-Tur' },
    53: { ar: 'النجم', en: 'An-Najm' },
    54: { ar: 'القمر', en: 'Al-Qamar' },
    55: { ar: 'الرحمن', en: 'Ar-Rahman' },
    56: { ar: 'الواقعة', en: 'Al-Waqiah' },
    57: { ar: 'الحديد', en: 'Al-Hadid' },
    58: { ar: 'المجادلة', en: 'Al-Mujadilah' },
    59: { ar: 'الحشر', en: 'Al-Hashr' },
    60: { ar: 'الممتحنة', en: 'Al-Mumtahanah' },
    61: { ar: 'الصف', en: 'As-Saff' },
    62: { ar: 'الجمعة', en: 'Al-Jumuah' },
    63: { ar: 'المنافقون', en: 'Al-Munafiqun' },
    64: { ar: 'التغابن', en: 'At-Taghabun' },
    65: { ar: 'الطلاق', en: 'At-Talaq' },
    66: { ar: 'التحريم', en: 'At-Tahrim' },
    67: { ar: 'الملك', en: 'Al-Mulk' },
    68: { ar: 'القلم', en: 'Al-Qalam' },
    69: { ar: 'الحاقة', en: 'Al-Haqqah' },
    70: { ar: 'المعارج', en: 'Al-Maarij' },
    71: { ar: 'نوح', en: 'Nuh' },
    72: { ar: 'الجن', en: 'Al-Jinn' },
    73: { ar: 'المزمل', en: 'Al-Muzzammil' },
    74: { ar: 'المدثر', en: 'Al-Muddaththir' },
    75: { ar: 'القيامة', en: 'Al-Qiyamah' },
    76: { ar: 'الإنسان', en: 'Al-Insan' },
    77: { ar: 'المرسلات', en: 'Al-Mursalat' },
    78: { ar: 'النبأ', en: 'An-Naba' },
    79: { ar: 'النازعات', en: 'An-Naziat' },
    80: { ar: 'عبس', en: 'Abasa' },
    81: { ar: 'التكوير', en: 'At-Takwir' },
    82: { ar: 'الانفطار', en: 'Al-Infitar' },
    83: { ar: 'المطففين', en: 'Al-Mutaffifin' },
    84: { ar: 'الانشقاق', en: 'Al-Inshiqaq' },
    85: { ar: 'البروج', en: 'Al-Buruj' },
    86: { ar: 'الطارق', en: 'At-Tariq' },
    87: { ar: 'الأعلى', en: 'Al-Ala' },
    88: { ar: 'الغاشية', en: 'Al-Ghashiyah' },
    89: { ar: 'الفجر', en: 'Al-Fajr' },
    90: { ar: 'البلد', en: 'Al-Balad' },
    91: { ar: 'الشمس', en: 'Ash-Shams' },
    92: { ar: 'الليل', en: 'Al-Layl' },
    93: { ar: 'الضحى', en: 'Ad-Duha' },
    94: { ar: 'الشرح', en: 'Ash-Sharh' },
    95: { ar: 'التين', en: 'At-Tin' },
    96: { ar: 'العلق', en: 'Al-Alaq' },
    97: { ar: 'القدر', en: 'Al-Qadr' },
    98: { ar: 'البينة', en: 'Al-Bayyinah' },
    99: { ar: 'الزلزلة', en: 'Al-Zalzalah' },
    100: { ar: 'العاديات', en: 'Al-Adiyat' },
    101: { ar: 'القارعة', en: 'Al-Qariah' },
    102: { ar: 'التكاثر', en: 'At-Takathur' },
    103: { ar: 'العصر', en: 'Al-Asr' },
    104: { ar: 'الهمزة', en: 'Al-Humazah' },
    105: { ar: 'الفيل', en: 'Al-Fil' },
    106: { ar: 'قريش', en: 'Quraysh' },
    107: { ar: 'الماعون', en: 'Al-Maun' },
    108: { ar: 'الكوثر', en: 'Al-Kawthar' },
    109: { ar: 'الكافرون', en: 'Al-Kafirun' },
    110: { ar: 'النصر', en: 'An-Nasr' },
    111: { ar: 'المسد', en: 'Al-Masad' },
    112: { ar: 'الإخلاص', en: 'Al-Ikhlas' },
    113: { ar: 'الفلق', en: 'Al-Falaq' },
    114: { ar: 'الناس', en: 'An-Nas' },
  };
  const n = names[surahNo] || { ar: `سورة ${surahNo}`, en: `Surah ${surahNo}` };
  return lang === 'ar' ? n.ar : n.en;
}

export async function shareAyah(ay: AyahView, surahNo: number, lang: 'ar' | 'en' = 'ar'): Promise<boolean> {
  const surahName = formatSurahHeader(surahNo, lang);
  const ayahText = formatAyahText(ay, lang);
  const title = `${APP_NAME} — ${surahName} (${arabicNumber(ay.a)})`;
  const text = `${surahName} — ${ayahText}\n\n${APP_URL}`;

  if (navigator.share) {
    try {
      await navigator.share({ title, text, url: APP_URL });
      return true;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return false; // المستخدم ألغى
    }
  }
  // Fallback: نسخ إلى الحافظة
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export async function shareSurah(surahNo: number, ayahs: AyahView[], lang: 'ar' | 'en' = 'ar'): Promise<boolean> {
  const surahName = formatSurahHeader(surahNo, lang);
  const title = `${APP_NAME} — ${surahName}`;
  const firstFew = ayahs.slice(0, 5).map((ay) => formatAyahText(ay, lang)).join('\n');
  const text = `${surahName}\n\n${firstFew}...\n\n${APP_URL}`;

  if (navigator.share) {
    try {
      await navigator.share({ title, text, url: APP_URL });
      return true;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return false;
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export async function shareApp(lang: 'ar' | 'en' = 'ar'): Promise<boolean> {
  const title = lang === 'ar' ? AR_SHARE.appTitle : EN_SHARE.appTitle;
  const text = lang === 'ar' ? withUrl(AR_SHARE.appText) : withUrl(EN_SHARE.appText);

  if (navigator.share) {
    try {
      await navigator.share({ title, text, url: APP_URL });
      return true;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return false;
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function getShareText(type: 'ayah' | 'surah' | 'app', data: { ay?: AyahView; surahNo?: number; ayahs?: AyahView[] }, lang: 'ar' | 'en' = 'ar'): string {
  if (type === 'app') {
    return lang === 'ar' ? withUrlShort(AR_SHARE.appTextShort) : withUrlShort(EN_SHARE.appTextShort);
  }
  if (type === 'ayah' && data.ay && data.surahNo) {
    const surahName = formatSurahHeader(data.surahNo, lang);
    const ayahText = formatAyahText(data.ay, lang);
    return `${surahName} — ${ayahText}\n\n${APP_URL}`;
  }
  if (type === 'surah' && data.surahNo && data.ayahs) {
    const surahName = formatSurahHeader(data.surahNo, lang);
    const firstFew = data.ayahs.slice(0, 5).map((ay) => formatAyahText(ay, lang)).join('\n');
    return `${surahName}\n\n${firstFew}...\n\n${APP_URL}`;
  }
  return APP_URL;
}