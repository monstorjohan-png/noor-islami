/**
 * تشريح بيانات المصحف — ليبقى التطبيق خفيفاً على الهاتف.
 * ------------------------------------------------------------------
 * المشكلة: `quran/uthmani.json` ملف واحد بحجم 6.3 ميغا. فتح أي سورة
 * كان يجلب الملف كله ويُخزّنه مفكوكاً في IndexedDB وفي الذاكرة.
 * الحل: نكتب نفس البيانات في صور أصغر:
 *
 *   quran/shards/000.json … 005.json   — 6 أجزاء متساوية (~1 ميغا لكلٍّ)
 *   quran/surah/1.json … 114.json       — سورة واحدة (النطاق المعتاد)
 *   quran/search.json                   — فهرس البحث فقط (بلا ترجمة ولا تفسير)
 *   quran/uthmani.json                  — المحفوظ كما هو (مصدر شرعي للتوافق)
 *
 * الملفات القديمة لا تُحذف: `content.ts` يقرأ shards، وبقيّة المشروع
 * يعمل على القديم إن لزم. القرار مُوحَّد في `lib/content.ts`.
 *
 *   node scripts/shard-quran.mjs
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public', 'data', 'quran');

const SHARDS = 6;

const rows = JSON.parse(await readFile(path.join(OUT, 'uthmani.json'), 'utf8'));
const positions = JSON.parse(await readFile(path.join(OUT, 'positions.json'), 'utf8'));
const surahs = JSON.parse(await readFile(path.join(OUT, 'surahs.json'), 'utf8'));

if (rows.length !== positions.length) {
  throw new Error(`عدم تطابق: ${rows.length} آية مقابل ${positions.length} موضع`);
}
const total = rows.length;
console.log(`الآيات: ${total}`);

/* ---------- 1) فهرس الإزاحة ---------- */

const offset = new Array(surahs.length + 1);
let acc = 0;
for (const s of surahs) {
  offset[s.n] = acc;
  acc += s.verses;
}
if (acc !== total) {
  throw new Error(`مجموع آيات السور ${acc} لا يساوي ${total}`);
}

/* ---------- 2) الأجزاء: بالتساوي ---------- */

await mkdir(path.join(OUT, 'shards'), { recursive: true });
const shardSize = Math.ceil(total / SHARDS);
for (let i = 0; i < SHARDS; i++) {
  const from = i * shardSize;
  const to = Math.min(total, from + shardSize);
  if (from >= to) break;
  const name = `shards/${String(i).padStart(3, '0')}.json`;
  await writeFile(path.join(OUT, name), JSON.stringify(rows.slice(from, to)));
  console.log(`  ${name}  ← آيات ${from + 1}..${to}  (${((to - from) / 1024).toFixed(0)}KB تقريباً)`);
}

/* ---------- 3) سورة بسورة ---------- */

await mkdir(path.join(OUT, 'surah'), { recursive: true });
for (const s of surahs) {
  const from = offset[s.n];
  const to = from + s.verses;
  await writeFile(
    path.join(OUT, `surah/${s.n}.json`),
    JSON.stringify(rows.slice(from, to)),
  );
}
console.log(`  surah/1.json..${surahs.length}.json  — سورة واحدة لكل ملف`);

/* ---------- 4) فهرس بحث خفيف: [نص مُوحَّد، هيكل, gi] ---------- */
/* بلا ترجمة ولا تفسير: يوفّر نحو 3.4 ميغا من الذاكرة عند بناء MiniSearch */

const search = rows.map((r, i) => [r[4], r[5], i]);
await writeFile(path.join(OUT, 'search.json'), JSON.stringify(search));
console.log(`  search.json  — ${((search.length) / 1024).toFixed(0)}K مدخل`);

/* ---------- 5) فهرس الوسائط: خريطة الموضع -> رقم الشريحة ---------- */
/* كي يقرأ القارئ شريحة واحدة بدل الملف كله، ويعرف أين تقع الآية */

await writeFile(
  path.join(OUT, 'shard-index.json'),
  JSON.stringify({ shardSize, shards: SHARDS, total, offset }),
);
console.log(`  shard-index.json  — shardSize=${shardSize}`);

console.log('\nتم التشريح. content.ts يقرأ shards تلقائياً.');
