import { loadData } from './db';
import type { QuranRow, PosRow, Surah, QuranMeta, Hadith, HadithBookMeta } from './types';

export const getPositions = () => loadData<PosRow[]>('quran/positions.json');
export const getSurahs = () => loadData<Surah[]>('quran/surahs.json');
export const getQuranMeta = () => loadData<QuranMeta>('quran/meta.json');
export const getHadithIndex = () => loadData<HadithBookMeta[]>('hadith/index.json');
export const getHadith = (book: string) => loadData<Hadith[]>(`hadith/${book}.json`);

/* ---------- تحميل المصحف بالأجزاء ---------- */

/**
 * فهرس الأجزاء: أيّ جزء يحوي الآية رقم gi.
 * يجعل فتح سورة يقرأ ~1 ميغا بدل 6.3 ميغا.
 */
interface ShardIndex {
  shardSize: number;
  shards: number;
  total: number;
  offset: number[];
}

let shardIndex: ShardIndex | null = null;
const shardCache = new Map<number, QuranRow[]>();

export async function getShardIndex(): Promise<ShardIndex> {
  if (!shardIndex) shardIndex = await loadData<ShardIndex>('quran/shard-index.json');
  return shardIndex;
}

/** الشريحة الحاوية لصف معيّن، مع ذاكرة مؤقتة */
async function shardOf(gi: number): Promise<QuranRow[]> {
  const idx = await getShardIndex();
  const n = Math.min(idx.shards - 1, Math.max(0, Math.floor(gi / idx.shardSize)));
  let rows = shardCache.get(n);
  if (!rows) {
    rows = await loadData<QuranRow[]>(`quran/shards/${String(n).padStart(3, '0')}.json`);
    shardCache.set(n, rows);
  }
  return rows;
}

/** الصف العام gi من المصحف، بلا تحميل الملف كاملاً */
export async function getAyahRow(gi: number): Promise<QuranRow | null> {
  const idx = await getShardIndex();
  if (gi < 0 || gi >= idx.total) return null;
  const rows = await shardOf(gi);
  const local = gi - Math.floor(gi / idx.shardSize) * idx.shardSize;
  return rows[local] ?? null;
}

/**
 * المصحف كاملاً — للبحث فقط.
 * يجلب `search.json` (بلا تفسير ولا ترجمة) فتقلّ الذاكرة نحو 3.4 ميغا،
 * ويبقي `uthmani.json` متاحاً لمن يحتاج الصف الكامل.
 */
export const getQuran = () => loadData<QuranRow[]>('quran/uthmani.json');

/** مصحف البحث: [normalized, skeleton, globalIndex] لكل آية */
export type SearchRow = [string, string, number];
export const getQuranSearchIndex = () => loadData<SearchRow[]>('quran/search.json');

export const PRAYER_KEYS = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
export type PrayerKey = (typeof PRAYER_KEYS)[number];

/* ---------- فهرس الإزاحة: (سورة، آية) -> موضع في المصفوفة ---------- */

let offsets: number[] | null = null;

export async function getOffsets(): Promise<number[]> {
  if (offsets) return offsets;
  const surahs = await getSurahs();
  const o: number[] = new Array(surahs.length + 1);
  let acc = 0;
  for (const s of surahs) {
    o[s.n] = acc;
    acc += s.verses;
  }
  offsets = o;
  return o;
}

export function ayahIndex(offset: number[], s: number, a: number): number {
  return offset[s] + a - 1;
}

/* ---------- استخراج آية ---------- */

export interface AyahView {
  s: number;
  a: number;
  text: string;
  tafsir: string;
  en1: string;
  en2: string;
  normalized: string;
  skeleton: string;
  juz: number;
  page: number;
  line: number;
  ruku: number;
  sajda: boolean;
  globalIndex: number;
}

export function rowToAyah(row: QuranRow, pos: PosRow, s: number, a: number, gi: number): AyahView {
  return {
    s, a,
    text: row[0],
    tafsir: row[1],
    en1: row[2],
    en2: row[3],
    normalized: row[4],
    skeleton: row[5],
    juz: pos[0],
    page: pos[1],
    line: pos[2],
    ruku: pos[3],
    sajda: pos[4] === 1,
    globalIndex: gi,
  };
}

/* ---------- أيات سورة ---------- */

export async function getSurahAyahs(s: number): Promise<AyahView[]> {
  const [pos, offset, surahs] = await Promise.all([getPositions(), getOffsets(), getSurahs()]);
  const surah = surahs.find((x) => x.n === s);
  if (!surah) throw new Error(`سورة غير موجودة: ${s}`);
  const start = offset[s];
  // سورة واحدة تُقرأ من ملفها: البقرة 513 كيلوبايت بدل 6.3 ميغا
  const rows = await loadData<QuranRow[]>(`quran/surah/${s}.json`);
  const out: AyahView[] = [];
  for (let i = 0; i < surah.verses; i++) {
    const gi = start + i;
    out.push(rowToAyah(rows[i], pos[gi], s, i + 1, gi));
  }
  return out;
}

export async function getAyah(s: number, a: number): Promise<AyahView | null> {
  const [pos, offset, surahs] = await Promise.all([getPositions(), getOffsets(), getSurahs()]);
  if (s < 1 || s > 114) return null;
  const surah = surahs.find((x) => x.n === s);
  // حد علوي: آية خارج نطاق السورة كانت تُرجع آية السورة التالية موسومة برقم خاطئ
  if (!surah || a < 1 || a > surah.verses) return null;
  const gi = ayahIndex(offset, s, a);
  const row = await getAyahRow(gi);
  if (!row || gi >= pos.length) return null;
  return rowToAyah(row, pos[gi], s, a, gi);
}

/* ---------- آيات جزء / صفحة ---------- */

/**
 * يحوّل فهرس المصحف العام إلى [سورة، آية].
 * `total` هو عدد الآيات الكلي (6236) — بدونه يُحسب طول السورة الأخيرة
 * بواحدة فتضيع آيات سورة الناس الخمس الأخيرة.
 */
export function makeReverseMap(offset: number[], total: number): (gi: number) => [number, number] {
  const pairs: Array<[number, number, number]> = [];
  for (let s = 1; s < offset.length; s++) {
    if (offset[s] === undefined) continue;
    const n = offset[s + 1] !== undefined
      ? offset[s + 1] - offset[s]
      : total > offset[s] ? total - offset[s] : 1;
    pairs.push([s, offset[s], n]);
  }
  return (gi: number) => {
    // الثنائيات مرتبة تصاعدياً حسب الإزاحة
    let lo = 0, hi = pairs.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const p = pairs[mid];
      if (gi < p[1]) hi = mid - 1;
      else if (gi >= p[1] + p[2]) lo = mid + 1;
      else return [p[0], gi - p[1] + 1];
    }
    return [1, 1];
  };
}

/**
 * يمرّ على المصحف شريحةً شريحة، فلا يُحمَّل الملف كاملاً في الذاكرة.
 * الجزء 30 مثلاً يقرأ ثلاث شائح فقط لا ستاً.
 */
async function scanQuran(
  keep: (pos: PosRow, gi: number) => boolean,
): Promise<AyahView[]> {
  const [pos, offset, idx] = await Promise.all([getPositions(), getOffsets(), getShardIndex()]);
  const rev = makeReverseMap(offset, idx.total);
  const out: AyahView[] = [];
  for (let n = 0; n < idx.shards; n++) {
    const rows = await shardOf(n * idx.shardSize);
    const from = n * idx.shardSize;
    for (let k = 0; k < rows.length; k++) {
      const gi = from + k;
      if (gi >= pos.length) break;
      if (!keep(pos[gi], gi)) continue;
      const [s, a] = rev(gi);
      out.push(rowToAyah(rows[k], pos[gi], s, a, gi));
    }
  }
  return out;
}

export async function getByJuz(juz: number): Promise<AyahView[]> {
  return scanQuran((p) => p[0] === juz);
}

export async function getByPage(page: number): Promise<AyahView[]> {
  return scanQuran((p) => p[1] === page);
}

/** السور التي تبدأ في صفحة معيّنة */
export async function getPageSurahs(page: number): Promise<Surah[]> {
  const surahs = await getSurahs();
  return surahs.filter((s) => s.startPage === page);
}
