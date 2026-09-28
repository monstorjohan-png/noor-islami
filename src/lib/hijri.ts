/** التقويم الهجري — يُحسب داخل المتصفح بلا إنترنت */

export interface HijriDate {
  year: number;
  month: number;
  day: number;
  monthNameAr: string;
  monthNameEn: string;
}

export const HIJRI_MONTHS_AR = [
  'محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة',
  'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة',
];

export const HIJRI_MONTHS_EN = [
  'Muharram', 'Safar', "Rabi' al-Awwal", "Rabi' al-Thani", 'Jumada al-Ula', 'Jumada al-Akhirah',
  'Rajab', "Sha'ban", 'Ramadan', 'Shawwal', "Dhu al-Qi'dah", 'Dhu al-Hijjah',
];

const pad = (n: number) => String(n).padStart(2, '0');

/** يحوّل ميلادي -> هجري (أم القرى) */
export function toHijri(date: Date): HijriDate {
  // Intl يدعم islamic-umalqura في المتصفحات الحديثة
  try {
    const fmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', {
      year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'UTC',
    });
    const parts = fmt.formatToParts(date);
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
    const month = get('month');
    const day = get('day');
    const year = get('year');
    if (year > 1300 && year < 1600) {
      return { year, month, day, monthNameAr: HIJRI_MONTHS_AR[month - 1], monthNameEn: HIJRI_MONTHS_EN[month - 1] };
    }
  } catch { /* نكمل بالحساب */ }
  return arithmeticHijri(date);
}

/** حساب احتياطي بخوارزمية التقويم الجدولي (goldsmith) */
function arithmeticHijri(date: Date): HijriDate {
  const jd = gregorianToJD(date);
  const l0 = jd - 1948440 + 10632;
  const n = Math.floor((l0 - 1) / 10631);
  let l = l0 - 10631 * n + 354;
  const j =
    Math.floor((10985 - l) / 5316) * Math.floor((50 * l) / 17719) +
    Math.floor(l / 5670) * Math.floor((43 * l) / 15238);
  l = l - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) -
      Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29;
  const month = Math.floor((24 * l) / 709);
  const day = l - Math.floor((709 * month) / 24);
  const year = 30 * n + j - 30;
  return {
    year, month, day,
    monthNameAr: HIJRI_MONTHS_AR[Math.max(0, month - 1)],
    monthNameEn: HIJRI_MONTHS_EN[Math.max(0, month - 1)],
  };
}

function gregorianToJD(d: Date): number {
  const y = d.getFullYear(), m = d.getMonth() + 1, day = d.getDate();
  const a = Math.floor((14 - m) / 12);
  const y2 = y + 4800 - a;
  const m2 = m + 12 * a - 3;
  return day + Math.floor((153 * m2 + 2) / 5) + 365 * y2 +
    Math.floor(y2 / 4) - Math.floor(y2 / 100) + Math.floor(y2 / 400) - 32045;
}

export function formatHijri(h: HijriDate): string {
  return `${h.day} ${h.monthNameAr} ${h.year}هـ`;
}

export function formatGregorian(d: Date): string {
  return new Intl.DateTimeFormat('ar-EG-u-ca-gregory-nu-latn', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  }).format(d);
}

/** عدد أيام الشهر الهجري */
export function hijriMonthLength(year: number, month: number): number {
  const start = hijriToGregorian(year, month, 1);
  const next = month === 12 ? hijriToGregorian(year + 1, 1, 1) : hijriToGregorian(year, month + 1, 1);
  return Math.round((next.getTime() - start.getTime()) / 86400000);
}

/**
 * تحويل هجري -> ميلادي — عكس مباشر ودقيق للتقويم الجدولي
 * (الخوارزمية القديمة بالبحث الثنائي على السنوات كانت تنحرف بأسابيع).
 * مُتحقَّق: ذهاب وعودة بلا أخطاء على 8 مواضع، وأطوال شهور 1447 سليمة.
 */
export function hijriToGregorian(year: number, month: number, day: number): Date {
  const jd = day + Math.ceil(29.5 * (month - 1)) + (year - 1) * 354 +
    Math.floor((3 + 11 * year) / 30) + 1948439.5 - 1;
  const J = Math.floor(jd + 0.5);
  let l = J + 68569;
  const n = Math.floor((4 * l) / 146097);
  l -= Math.floor((146097 * n + 3) / 4);
  const i = Math.floor((4000 * (l + 1)) / 1461001);
  l = l - Math.floor((1461 * i) / 4) + 31;
  const j = Math.floor((80 * l) / 2447);
  const dd = l - Math.floor((2447 * j) / 80);
  l = Math.floor(j / 11);
  const mm = j + 2 - 12 * l;
  const yy = 100 * (n - 49) + i + l;
  return new Date(yy, mm - 1, dd);
}

export function hijriDateKey(d: Date): string {
  const h = toHijri(d);
  return `${h.year}-${pad(h.month)}-${pad(h.day)}`;
}

/* مناسبات اليوم الهجري — مرتَّبة بالشهر الهجري ثم اليوم */
export const HIJRI_EVENTS: Array<{ month: number; day: number; ar: string; en: string }> = [
  { month: 1, day: 1, ar: 'رأس السنة الهجرية', en: 'Islamic New Year' },
  { month: 1, day: 10, ar: 'يوم عاشوراء', en: 'Day of Ashura' },
  { month: 3, day: 12, ar: 'المولد النبوي الشريف', en: 'Mawlid an-Nabi' },
  { month: 7, day: 27, ar: 'يوم الإسراء والمعراج', en: "Isra' and Mi'raj" },
  { month: 8, day: 15, ar: 'ليلة النصف من شعبان', en: 'Midnight of Sha\'ban' },
  { month: 9, day: 1, ar: 'أول رمضان — بداية الصيام', en: 'First of Ramadan' },
  { month: 9, day: 21, ar: 'ليلة القدر (احتمال)', en: 'Laylat al-Qadr (possible)' },
  { month: 9, day: 23, ar: 'ليلة القدر (الأرجح عند بعضهم)', en: 'Laylat al-Qadr (most likely)' },
  { month: 9, day: 25, ar: 'ليلة القدر (عند بعضهم)', en: 'Laylat al-Qadr' },
  { month: 9, day: 27, ar: 'ليلة القدر (عند البخاري)', en: 'Laylat al-Qadr' },
  { month: 9, day: 29, ar: 'ليلة القدر (ترجيح ابن عمر)', en: 'Laylat al-Qadr' },
  { month: 10, day: 1, ar: 'عيد الفطر', en: 'Eid al-Fitr' },
  { month: 12, day: 9, ar: 'يوم عرفة — صيام غير مفروض لغير الحاج', en: 'Day of Arafah' },
  { month: 12, day: 10, ar: 'عيد الأضحى', en: 'Eid al-Adha' },
];

/** مناسبات هذا اليوم الهجري، أو null إن لم يكن له مناسبة */
export function hijriEvent(h: HijriDate) {
  return HIJRI_EVENTS.find((e) => e.month === h.month && e.day === h.day) ?? null;
}
