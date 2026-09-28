import MiniSearch from 'minisearch';
import { normalizeAr, normalizeQuery, isArabicQuery } from './normalize';

/**
 * البحث في القرآن.
 * يُبنى على حقل «الهيكل» (بلا ألف) حتى يجد ما كتبه المستخدم بالإملاء
 * المعتاد مقابل الرسم العثماني (إلٰه ↔ إله، السَّمَاوٰت ↔ السماوات).
 */
export interface QuranDoc {
  id: number;
  s: number;
  a: number;
  skeleton: string;
  normalized: string;
}

let qIndex: MiniSearch<QuranDoc> | null = null;

export function buildQuranIndex(rows: Array<[string, string, string, string, string, string]>): void {
  buildQuranIndexFrom(rows);
}

/** فهرس مصغّر مبني من (سورة، آية، نص) مباشرة — يُستخدم قبل اكتمال التنزيل */
export function buildQuranIndexFrom(rows: Array<[string, string, string, string, string, string]>): void {
  const docs: QuranDoc[] = rows.map((r, i) => ({ id: i, s: 0, a: 0, skeleton: r[5], normalized: r[4] }));
  qIndex = new MiniSearch<QuranDoc>({
    fields: ['skeleton', 'normalized'],
    storeFields: [],
    searchOptions: { boost: { normalized: 1.4 }, prefix: true, fuzzy: 0.2 },
  });
  qIndex.addAll(docs);
}

/**
 * فهرس من الفهرس الخفيف `quran/search.json`:
 *   [normalized, skeleton, globalIndex]
 * ذاكرته أقل بنحو 3.4 ميغا من المصحف الكامل لأنه بلا تفسير ولا ترجمة.
 */
export function buildQuranIndexFromSearch(rows: Array<[string, string, number]>): void {
  const docs: QuranDoc[] = rows.map((r, i) => ({ id: r[2] ?? i, s: 0, a: 0, skeleton: r[1], normalized: r[0] }));
  qIndex = new MiniSearch<QuranDoc>({
    fields: ['skeleton', 'normalized'],
    storeFields: [],
    searchOptions: { boost: { normalized: 1.4 }, prefix: true, fuzzy: 0.2 },
  });
  qIndex.addAll(docs);
}

export function searchQuran(query: string, limit = 100): number[] {
  if (!qIndex) return [];
  const q = normalizeQuery(query);
  if (!q) return [];
  const res = qIndex.search(q);
  return res.slice(0, limit).map((r) => r.id as number);
}

/**
 * بحث خطّي احتياطي على حقل الهيكل.
 * أسرع من الفهرس للنتائج القليلة ويتحمل الاستعلامات الجزئية.
 */
export function searchQuranLinear(
  rows: Array<[string, string, string, string, string, string]>,
  query: string,
  limit = 100,
): number[] {
  const q = normalizeQuery(query);
  if (!q) return [];
  const qs = isArabicQuery(q) ? q.replace(/[\u0627\u0649]/g, '') : q;
  const out: number[] = [];
  for (let i = 0; i < rows.length && out.length < limit; i++) {
    if (rows[i][5].includes(qs) || rows[i][4].includes(q)) out.push(i);
  }
  return out;
}

/**
 * بحث خطّي على الفهرس الخفيف.
 * الفهرس الخفيف صفّه: [normalized, skeleton, globalIndex] — يُرجع المواضع العامة.
 */
export function searchQuranLinearSearch(
  rows: Array<[string, string, number]>,
  query: string,
  limit = 100,
): number[] {
  const q = normalizeQuery(query);
  if (!q) return [];
  const bare = isArabicQuery(q) ? q.replace(/[\u0627\u0649]/g, '') : q;
  const out: number[] = [];
  for (let i = 0; i < rows.length && out.length < limit; i++) {
    if (rows[i][1].includes(bare) || rows[i][0].includes(q)) out.push(rows[i][2] ?? i);
  }
  return out;
}

/* ---------- البحث في الحديث ---------- */

export interface HadithDoc {
  id: number;
  f: string;
}

const hadithIndexes = new Map<string, { idx: MiniSearch<HadithDoc>; rows: number }>();

export function buildHadithIndex(book: string, rows: Array<{ f: string }>): void {
  const idx = new MiniSearch<HadithDoc>({
    fields: ['f'],
    storeFields: [],
    searchOptions: { prefix: true, fuzzy: 0.15 },
  });
  idx.addAll(rows.map((r, i) => ({ id: i, f: r.f })));
  hadithIndexes.set(book, { idx, rows: rows.length });
}

export function searchHadith(book: string, query: string, limit = 100): number[] {
  const entry = hadithIndexes.get(book);
  if (!entry) return [];
  const q = normalizeQuery(query);
  if (!q) return [];
  return entry.idx.search(q).slice(0, limit).map((r) => r.id as number);
}

/** بحث خطّي في الحديث — الأدق، والحديث بلا ألف خنجرية */
export function searchHadithLinear(rows: Array<{ f: string }>, query: string, limit = 100): number[] {
  const q = normalizeQuery(query);
  if (!q) return [];
  const out: number[] = [];
  for (let i = 0; i < rows.length && out.length < limit; i++) {
    if (rows[i].f.includes(q)) out.push(i);
  }
  return out;
}

export function hasHadithIndex(book: string): boolean {
  return hadithIndexes.has(book);
}

/* ---------- تمييز النتائج ---------- */

/** حدّ أعلى لعدد المقاطع — استعلام قصير على نص طويل كان يبني آلاف العناصر */
const MAX_SEGMENTS = 400;

/** يعيد مقاطع النص المُطابقة للتلوين */
export function highlight(text: string, query: string): Array<{ t: string; hit: boolean }> {
  if (!query || !text) return [{ t: text, hit: false }];
  const isAr = isArabicQuery(query);
  const out: Array<{ t: string; hit: boolean }> = [];
  if (isAr) {
    // نبحث في النص الأصلي غير المُوحَّد — لذا نستخدم مطابقة مرنة
    const needle = normalizeAr(query);
    const hay = normalizeAr(text);
    let idx = 0;
    const hayLower = hay.toLowerCase();
    const needleLower = needle.toLowerCase();
    if (!needleLower) return [{ t: text, hit: false }];
    let found = hayLower.indexOf(needleLower);
    if (found < 0) return [{ t: text, hit: false }];
    while (found >= 0) {
      if (found > idx) out.push({ t: text.slice(idx, found), hit: false });
      out.push({ t: text.slice(found, found + needle.length), hit: true });
      idx = found + needle.length;
      if (out.length >= MAX_SEGMENTS) {
        if (idx < text.length) out.push({ t: text.slice(idx), hit: false });
        return out;
      }
      found = hayLower.indexOf(needleLower, idx);
    }
    if (idx < text.length) out.push({ t: text.slice(idx), hit: false });
    return out;
  }
  const needle = query.toLowerCase();
  const lower = text.toLowerCase();
  let i = lower.indexOf(needle);
  if (i < 0) return [{ t: text, hit: false }];
  let start = 0;
  while (i >= 0) {
    if (i > start) out.push({ t: text.slice(start, i), hit: false });
    out.push({ t: text.slice(i, i + query.length), hit: true });
    start = i + query.length;
    if (out.length >= MAX_SEGMENTS) {
      if (start < text.length) out.push({ t: text.slice(start), hit: false });
      return out;
    }
    i = lower.indexOf(needle, start);
  }
  if (start < text.length) out.push({ t: text.slice(start), hit: false });
  return out;
}
