import { CalculationMethod, Coordinates, PrayerTimes, Madhab } from 'adhan';

type CalcParams = ReturnType<typeof CalculationMethod.MuslimWorldLeague>;

/** أساليب الحساب المعتمدة عند أئمة المذاهب */
export const CALC_METHODS = {
  MuslimWorldLeague: { ar: 'رابطة العالم الإسلامي', en: 'Muslim World League' },
  Egyptian: { ar: 'الهيئة المصرية العامة للمساحة', en: 'Egyptian General Authority' },
  Karachi: { ar: 'جامعة العلوم الإسلامية — كراتشي', en: 'University of Islamic Sciences, Karachi' },
  UmmAlQura: { ar: 'أم القرى — مكة المكرمة', en: 'Umm al-Qura, Makkah' },
  Dubai: { ar: 'دائرة الإمارات الإسلامية', en: 'UAE Islamic Affairs' },
  Qatar: { ar: 'قطر', en: 'Qatar' },
  Kuwait: { ar: 'الكويت', en: 'Kuwait' },
  MoonsightingCommittee: { ar: 'لجنة رؤية القمر', en: 'Moonsighting Committee' },
  Singapore: { ar: 'سنغافورة', en: 'Singapore' },
  Turkey: { ar: 'ديانت تركيا', en: 'Turkey (Diyanet)' },
  Tehran: { ar: 'معهد الجيوفيزياء — طهران', en: 'Tehran' },
  Jafari: { ar: 'الطريقة الجعفري', en: 'Jafari' },
} as const;

export type CalcMethodKey = keyof typeof CALC_METHODS;

export const MADHABS = {
  shafii: { ar: 'الجمهور (مذهب الشافعية وأدق المذاهب)', short: 'الجمهور' },
  hanafi: { ar: 'الحنفية', short: 'حنفي' },
  maliki: { ar: 'المالكية', short: 'مالكي' },
  hanbali: { ar: 'الحنابلة', short: 'حنبلي' },
} as const;

export const PRAYERS = [
  { key: 'fajr', ar: 'الفجر', en: 'Fajr', icon: '🌄' },
  { key: 'sunrise', ar: 'الشروق', en: 'Sunrise', icon: '🌅' },
  { key: 'dhuhr', ar: 'الظهر', en: 'Dhuhr', icon: '☀️' },
  { key: 'asr', ar: 'العصر', en: 'Asr', icon: '🌤️' },
  { key: 'maghrib', ar: 'المغرب', en: 'Maghrib', icon: '🌇' },
  { key: 'isha', ar: 'العشاء', en: 'Isha', icon: '🌙' },
] as const;

export type PrayerName = (typeof PRAYERS)[number]['key'];

export interface DayTimes {
  date: Date;
  fajr: Date;
  sunrise: Date;
  dhuhr: Date;
  asr: Date;
  maghrib: Date;
  isha: Date;
}

function toMethod(key: string): CalcParams {
  return ((CalculationMethod as unknown as Record<string, () => CalcParams>)[key]?.() ?? CalculationMethod.MuslimWorldLeague());
}

export function computeTimes(
  date: Date,
  lat: number,
  lon: number,
  method: string,
  madhab: 'shafii' | 'hanafi' | 'maliki' | 'hanbali' = 'shafii',
): DayTimes {
  const coords = new Coordinates(lat, lon);
  const params = toMethod(method);
  params.madhab = madhab === 'hanafi' ? Madhab.Hanafi : Madhab.Shafi;
  const pt = new PrayerTimes(coords, date, params);
  return {
    date,
    fajr: pt.fajr,
    sunrise: pt.sunrise,
    dhuhr: pt.dhuhr,
    asr: pt.asr,
    maghrib: pt.maghrib,
    isha: pt.isha,
  };
}

/**
 * الصلاة القادمة.
 * بعد العشاء تعيد الدالة فجر الغد — يجب حسابه بنفس الموقع والطريقة
 * وإلا أعادت وقتاً محسوباً من موقع (0,0) وهو خطأ جسيم.
 */
export function nextPrayer(
  t: DayTimes,
  now = new Date(),
  opts?: { lat?: number; lon?: number; method?: string; madhab?: string },
): { key: PrayerName; date: Date; remaining: number } | null {
  const map: Array<[PrayerName, Date]> = [
    ['fajr', t.fajr], ['sunrise', t.sunrise], ['dhuhr', t.dhuhr],
    ['asr', t.asr], ['maghrib', t.maghrib], ['isha', t.isha],
  ];
  for (const [key, date] of map) {
    if (date.getTime() > now.getTime()) return { key, date, remaining: date.getTime() - now.getTime() };
  }
  if (opts?.lat !== undefined && opts.lon !== undefined) {
    const tomorrow = computeTimes(
      new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1),
      opts.lat, opts.lon, opts.method ?? 'MuslimWorldLeague',
      (opts.madhab as 'shafii' | 'hanafi' | 'maliki' | 'hanbali') ?? 'shafii',
    );
    const ms = tomorrow.fajr.getTime() - now.getTime();
    if (ms > 0) return { key: 'fajr', date: tomorrow.fajr, remaining: ms };
  }
  return null;
}

export function currentPrayer(t: DayTimes, now = new Date()) {
  const order: PrayerName[] = ['isha', 'maghrib', 'asr', 'dhuhr', 'sunrise', 'fajr'];
  const map: Record<PrayerName, Date> = {
    fajr: t.fajr, sunrise: t.sunrise, dhuhr: t.dhuhr,
    asr: t.asr, maghrib: t.maghrib, isha: t.isha,
  };
  for (const k of order) if (now.getTime() >= map[k].getTime()) return k;
  return 'isha';
}

export function formatRemaining(ms: number): { h: string; m: string; s: string; past: boolean } {
  const past = ms < 0;
  const t = Math.abs(ms) / 1000;
  return {
    h: String(Math.floor(t / 3600)).padStart(2, '0'),
    m: String(Math.floor((t % 3600) / 60)).padStart(2, '0'),
    s: String(Math.floor(t % 60)).padStart(2, '0'),
    past,
  };
}

/* ---------- القبلة ---------- */

const KAABA = { lat: 21.4224779, lon: 39.8251832 };

const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

/** اتجاه القبلة بالدرجات من الشمال الحقيقي */
export function qiblaBearing(lat: number, lon: number): number {
  const φ1 = toRad(lat), φ2 = toRad(KAABA.lat);
  const Δλ = toRad(KAABA.lon - lon);
  const y = Math.sin(Δλ);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** المسافة بالكيلومترات */
export function distanceToKaaba(lat: number, lon: number): number {
  const R = 6371;
  const dLat = toRad(KAABA.lat - lat);
  const dLon = toRad(KAABA.lon - lon);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat)) * Math.cos(toRad(KAABA.lat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}

/* ---------- الموقع ---------- */

export function locate(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('جهازك لا يدعم تحديد الموقع'));
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 12000,
      maximumAge: 1000 * 60 * 30,
    });
  });
}

/** أقرب مدينة معروفة — تُستخدم عند رفض إذن الموقع */
export const CITIES: Array<{ ar: string; en: string; lat: number; lon: number; country: string }> = [
  { ar: 'مكة المكرمة', en: 'Makkah', lat: 21.4225, lon: 39.8262, country: 'السعودية' },
  { ar: 'المدينة المنورة', en: 'Madinah', lat: 24.4686, lon: 39.6142, country: 'السعودية' },
  { ar: 'الرياض', en: 'Riyadh', lat: 24.7136, lon: 46.6753, country: 'السعودية' },
  { ar: 'القاهرة', en: 'Cairo', lat: 30.0444, lon: 31.2357, country: 'مصر' },
  { ar: 'الإسكندرية', en: 'Alexandria', lat: 31.2001, lon: 29.9187, country: 'مصر' },
  { ar: 'دبي', en: 'Dubai', lat: 25.2048, lon: 55.2708, country: 'الإمارات' },
  { ar: 'أبوظبي', en: 'Abu Dhabi', lat: 24.4539, lon: 54.3773, country: 'الإمارات' },
  { ar: 'الدوحة', en: 'Doha', lat: 25.2854, lon: 51.5310, country: 'قطر' },
  { ar: 'الكويت', en: 'Kuwait City', lat: 29.3759, lon: 47.9774, country: 'الكويت' },
  { ar: 'المنامة', en: 'Manama', lat: 26.2285, lon: 50.5860, country: 'البحرين' },
  { ar: 'مسقط', en: 'Muscat', lat: 23.5880, lon: 58.3829, country: 'عُمان' },
  { ar: 'عمّان', en: 'Amman', lat: 31.9454, lon: 35.9284, country: 'الأردن' },
  { ar: 'القدس', en: 'Jerusalem', lat: 31.7683, lon: 35.2137, country: 'فلسطين' },
  { ar: 'غزة', en: 'Gaza', lat: 31.5017, lon: 34.4668, country: 'فلسطين' },
  { ar: 'بيروت', en: 'Beirut', lat: 33.8938, lon: 35.5018, country: 'لبنان' },
  { ar: 'دمشق', en: 'Damascus', lat: 33.5138, lon: 36.2765, country: 'سوريا' },
  { ar: 'بغداد', en: 'Baghdad', lat: 33.3152, lon: 44.3661, country: 'العراق' },
  { ar: 'البصرة', en: 'Basra', lat: 30.5085, lon: 47.7804, country: 'العراق' },
  { ar: 'أربيل', en: 'Erbil', lat: 36.1911, lon: 44.0092, country: 'العراق' },
  { ar: 'تونس', en: 'Tunis', lat: 36.8065, lon: 10.1815, country: 'تونس' },
  { ar: 'الجزائر', en: 'Algiers', lat: 36.7538, lon: 3.0588, country: 'الجزائر' },
  { ar: 'الدار البيضاء', en: 'Casablanca', lat: 33.5731, lon: -7.5898, country: 'المغرب' },
  { ar: 'الرباط', en: 'Rabat', lat: 34.0209, lon: -6.8416, country: 'المغرب' },
  { ar: 'مراكش', en: 'Marrakesh', lat: 31.6295, lon: -7.9811, country: 'المغرب' },
  { ar: 'طرابلس', en: 'Tripoli', lat: 32.8872, lon: 13.1913, country: 'ليبيا' },
  { ar: 'نواكشوط', en: 'Nouakchott', lat: 18.0790, lon: -15.9785, country: 'موريتانيا' },
  { ar: 'الخرطوم', en: 'Khartoum', lat: 15.5007, lon: 32.5599, country: 'السودان' },
  { ar: 'أديس أبابا', en: 'Addis Ababa', lat: 9.0300, lon: 38.7400, country: 'إثيوبيا' },
  { ar: 'نيروبي', en: 'Nairobi', lat: -1.2921, lon: 36.8219, country: 'كينيا' },
  { ar: 'لوساكا', en: 'Lusaka', lat: -15.3875, lon: 28.3228, country: 'زامبيا' },
  { ar: 'داكار', en: 'Dakar', lat: 14.7167, lon: -17.4677, country: 'السنغال' },
  { ar: 'قازان', en: 'Kazan', lat: 55.7887, lon: 49.1221, country: 'روسيا' },
  { ar: 'موسكو', en: 'Moscow', lat: 55.7558, lon: 37.6173, country: 'روسيا' },
  { ar: 'إسطنبول', en: 'Istanbul', lat: 41.0082, lon: 28.9784, country: 'تركيا' },
  { ar: 'أنقرة', en: 'Ankara', lat: 39.9334, lon: 32.8597, country: 'تركيا' },
  { ar: 'طهران', en: 'Tehran', lat: 35.6892, lon: 51.3890, country: 'إيران' },
  { ar: 'كراتشي', en: 'Karachi', lat: 24.8607, lon: 67.0011, country: 'باكستان' },
  { ar: 'إسلام آباد', en: 'Islamabad', lat: 33.6844, lon: 73.0479, country: 'باكستان' },
  { ar: 'لاهور', en: 'Lahore', lat: 31.5204, lon: 74.3587, country: 'باكستان' },
  { ar: 'دلهي', en: 'Delhi', lat: 28.6139, lon: 77.2090, country: 'الهند' },
  { ar: 'حيدر آباد', en: 'Hyderabad', lat: 17.3850, lon: 78.4867, country: 'الهند' },
  { ar: 'جاكرتا', en: 'Jakarta', lat: -6.2088, lon: 106.8456, country: 'إندونيسيا' },
  { ar: 'كوالالمبور', en: 'Kuala Lumpur', lat: 3.1390, lon: 101.6869, country: 'ماليزيا' },
  { ar: 'سنغافورة', en: 'Singapore', lat: 1.3521, lon: 103.8198, country: 'سنغافورة' },
  { ar: 'مانيلا', en: 'Manila', lat: 14.5995, lon: 120.9842, country: 'الفلبين' },
  { ar: 'طوكيو', en: 'Tokyo', lat: 35.6762, lon: 139.6503, country: 'اليابان' },
  { ar: 'سيول', en: 'Seoul', lat: 37.5665, lon: 126.9780, country: 'كوريا الجنوبية' },
  { ar: 'بكين', en: 'Beijing', lat: 39.9042, lon: 116.4074, country: 'الصين' },
  { ar: 'باريس', en: 'Paris', lat: 48.8566, lon: 2.3522, country: 'فرنسا' },
  { ar: 'لندن', en: 'London', lat: 51.5074, lon: -0.1278, country: 'بريطانيا' },
  { ar: 'برلين', en: 'Berlin', lat: 52.5200, lon: 13.4050, country: 'ألمانيا' },
  { ar: 'مدريد', en: 'Madrid', lat: 40.4168, lon: -3.7038, country: 'إسبانيا' },
  { ar: 'نيويورك', en: 'New York', lat: 40.7128, lon: -74.0060, country: 'أمريكا' },
  { ar: 'شيكاغو', en: 'Chicago', lat: 41.8781, lon: -87.6298, country: 'أمريكا' },
  { ar: 'تورنتو', en: 'Toronto', lat: 43.6532, lon: -79.3832, country: 'كندا' },
  { ar: 'سيدني', en: 'Sydney', lat: -33.8688, lon: 151.2093, country: 'أستراليا' },
  { ar: 'ملبورن', en: 'Melbourne', lat: -37.8136, lon: 144.9631, country: 'أستراليا' },
];

export function nearestCity(lat: number, lon: number) {
  let best = CITIES[0];
  let bestD = Infinity;
  for (const c of CITIES) {
    const d = (c.lat - lat) ** 2 + (c.lon - lon) ** 2;
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}
