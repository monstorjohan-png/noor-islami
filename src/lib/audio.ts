/**
 * تلاوة تعمل دون إنترنت.
 * ------------------------------------------------------------------
 * ملفات التلاوة على `cdn.islamic.network`. عامل الخدمة يخزّنها عند
 * التشغيل، لكن بلا تنزيل مسبق لا تعمل التلاوة في الطائرة ولا ببطء الشبكة.
 *
 * هنا نُنزّل ملفات السورة كاملةً إلى ذاكرة عامل الخدمة (Cache Storage)
 * قبل الحاجة إليها، فتعمل التلاوة بلا إنترنت بعدها. الصوت ليس في IndexedDB
 * لأنه ملفات ثنائية كبيرة، وذاكرة عامل الخدمة مخصّصة لها.
 *
 * كل شيء يبلّغ عن الفشل بوضوح: لا ادّعاء بأن التلاوة جاهزة وهي ليست.
 */

const CACHE = 'noor-audio';
const HOST = 'https://cdn.islamic.network';

/**
 * القرّاء المتاحون فعلياً.
 * ------------------------------------------------------------------
 * كل سطر هنا مُختبَر بطلب حقيقي إلى الشبكة، لا منسوخ من قائمة عامة.
 * الفرق الجوهري: **لكل قارئ معدل خاص لملفات الآيات، وثلاثة فقط لهم
 * ملف سورة كاملة**. افتراض معدل واحد للجميع كان يجعل روابط أربعة
 * قرّاء روابط ميتة على خادم الملفات.
 *
 * - `ayahRate`  معدل ملفات الآيات، وهو الموجود لكل قارئ في هذه القائمة
 * - `surahRate` معدل ملف السورة الكاملة، وهو موجود لثلاثة فقط
 *
 * إعادة الفحص عند تغيّر القائمة: `node scripts/probe-reciters.mjs`
 */
export const RECITERS = [
  {
    id: 'ar.alafasy',
    ayahRate: 128,
    surahRate: 128,
    ar: 'مشاري راشد العفاسي',
    en: 'Mishary Rashid Alafasy',
  },
  {
    id: 'ar.abdulbasitmurattal',
    ayahRate: 64,
    surahRate: 128,
    ar: 'عبد الباسط عبد الصمد — مرتل',
    en: 'Abdul Basit Abdul Samad (Murattal)',
  },
  {
    id: 'ar.abdulbasitmujawwad',
    ayahRate: 64,
    surahRate: 128,
    ar: 'عبد الباسط عبد الصمد — مجوّد',
    en: 'Abdul Basit Abdul Samad (Mujawwad)',
  },
  { id: 'ar.husary', ayahRate: 128, ar: 'محمود خليل الحصري', en: 'Mahmoud Khalil Al-Husary' },
  { id: 'ar.minshawi', ayahRate: 128, ar: 'محمد صديق المنشاوي', en: 'Al-Minshawi (Murattal)' },
  { id: 'ar.saoodshuraym', ayahRate: 64, ar: 'سعود الشريم', en: 'Saood Ash-Shuraym' },
  { id: 'ar.hudhaify', ayahRate: 128, ar: 'علي الحذيفي', en: 'Ali Al-Hudhaify' },
  { id: 'ar.mahermuaiqly', ayahRate: 128, ar: 'ماهر المعيقلي', en: 'Maher Al-Muaiqly' },
  { id: 'ar.shaatree', ayahRate: 128, ar: 'أبو بكر الشاطري', en: 'Abu Bakr Al-Shatri' },
  { id: 'ar.muhammadayyoub', ayahRate: 128, ar: 'محمد أيوب', en: 'Muhammad Ayyoub' },
] as const;

export type Reciter = (typeof RECITERS)[number];
export type ReciterId = Reciter['id'];

const DEFAULT_RECITER: ReciterId = 'ar.alafasy';

/**
 * القارئ يأتي من التخزين المحلي بعد إعادة الترطيب.
 * لا يُبنى الرابط أبداً بمعرّف غير معروف — نرجع للقارئ الافتراضي.
 */
function resolveReciter(reciter: ReciterId): Reciter {
  return RECITERS.find((r) => r.id === reciter) ?? RECITERS[0];
}

/** القرّاء الذين لهم ملف سورة كاملة — عليهم وحدهم يظهر زرّ الحفظ دون إنترنت */
export const SURAH_RECITERS = RECITERS.filter((r) => 'surahRate' in r);

/** هل لهذا القارئ ملف سورة كاملة على الشبكة؟ */
export function hasSurahAudio(reciter: ReciterId): boolean {
  return 'surahRate' in resolveReciter(reciter);
}

/**
 * رابط السورة كاملة، أو `null` إن لم يكن لهذا القارئ ملف سورة على الشبكة.
 * `null` ليس خطأً عابراً: القرّاء العشرة مدعومون لتلاوة الآية، وثلاثة منهم
 * فقط لهم ملف السورة، وإعلان غير ذلك للمستخدم تضليل.
 */
export function surahAudioUrl(reciter: ReciterId, surah: number): string | null {
  const r = resolveReciter(reciter);
  if (!('surahRate' in r)) return null;
  const n = Number.isSafeInteger(surah) && surah >= 1 && surah <= 114 ? surah : 1;
  return `${HOST}/quran/audio-surah/${r.surahRate}/${r.id}/${n}.mp3`;
}

/** رابط آية واحدة — الملفات مفهرسة من واحد */
export function ayahAudioUrl(reciter: ReciterId, globalIndex: number): string {
  const r = resolveReciter(reciter);
  const n = Number.isSafeInteger(globalIndex) && globalIndex >= 0 ? globalIndex + 1 : 1;
  return `${HOST}/quran/audio/${r.ayahRate}/${r.id}/${n}.mp3`;
}

export const DEFAULT_RECITER_ID = DEFAULT_RECITER;

async function openCache(): Promise<Cache | null> {
  if (typeof caches === 'undefined') return null;
  try {
    return await caches.open(CACHE);
  } catch (err) {
    console.warn('تعذّر فتح ذاكرة الصوت', err);
    return null;
  }
}

/** هل التلاوة مخزَّنة محلياً؟ */
export async function isAudioCached(url: string): Promise<boolean> {
  const cache = await openCache();
  if (!cache) return false;
  try {
    return Boolean(await cache.match(url));
  } catch {
    return false;
  }
}

export type DownloadState = 'idle' | 'loading' | 'done' | 'error';

/**
 * تنزيل تلاوة سورة كاملة إلى الذاكرة المحلية.
 * `onProgress` يُستدعى بالبايتات المستلمة والمجموع.
 */
export async function downloadSurahAudio(
  reciter: ReciterId,
  surah: number,
  onProgress?: (loaded: number, total: number) => void,
): Promise<DownloadState> {
  const url = surahAudioUrl(reciter, surah);
  // لا ملف سورة لهذا القارئ على الشبكة — لا ادّعاء بتنزيل تمّ
  if (!url) return 'error';
  const cache = await openCache();
  if (!cache) return 'error';

  if (await cache.match(url)) {
    onProgress?.(1, 1);
    return 'done';
  }

  try {
    const res = await fetch(url);
    if (!res.ok) return 'error';

    // شريط التقدّم الحقيقي إن توفّر
    if (onProgress && res.body) {
      const total = Number(res.headers.get('content-length') ?? 0);
      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let loaded = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          loaded += value.byteLength;
          onProgress(loaded, total);
        }
      }
      const blob = new Blob(chunks as BlobPart[], { type: 'audio/mpeg' });
      await cache.put(url, new Response(blob, { headers: { 'Content-Type': 'audio/mpeg' } }));
    } else {
      await cache.put(url, res.clone());
    }
    return 'done';
  } catch (err) {
    console.warn('تعذّر تنزيل التلاوة', err);
    return 'error';
  }
}

/** حذف تلاوة مخزَّنة لتحرير المساحة */
export async function removeAudio(url: string): Promise<void> {
  const cache = await openCache();
  if (!cache) return;
  try {
    await cache.delete(url);
  } catch (err) {
    console.warn('تعذّر حذف التلاوة', err);
  }
}

/** المساحة التي تحتلها التلاوات المخزَّنة */
export async function audioCacheInfo(): Promise<{ entries: number; bytes: number }> {
  const cache = await openCache();
  if (!cache) return { entries: 0, bytes: 0 };
  try {
    const keys = await cache.keys();
    let bytes = 0;
    for (const req of keys) {
      const res = await cache.match(req);
      const buf = res ? await res.blob() : null;
      bytes += buf?.size ?? 0;
    }
    return { entries: keys.length, bytes };
  } catch {
    return { entries: 0, bytes: 0 };
  }
}

/** حذف كل التلاوات المخزَّنة */
export async function clearAudioCache(): Promise<void> {
  if (typeof caches === 'undefined') return;
  try {
    await caches.delete(CACHE);
  } catch (err) {
    console.warn('تعذّر تفريغ ذاكرة الصوت', err);
  }
}
