/**
 * مدقّق المحتوى المُحال إلى مصادر
 * ---------------------------------------------------------------
 * لكل ذكر في التطبيق: يتحقق أن (أ) المرجع موجود فعلاً في المصدر،
 * (ب) النص المُستبدَل يحتوي الكلمات المفتاحية المطلوبة.
 * لو أخطأنا في رقم حديث أو آية، يفشل الفحص هنا — لا في يد المستخدم.
 *
 *   node scripts/verify-content.mjs
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { transform } from 'esbuild';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'public', 'data');

const log = (...a) => console.log(...a);
const ok = (m) => log(`  \x1b[32m✓\x1b[0m ${m}`);
const bad = (m) => log(`  \x1b[31m✗\x1b[0m ${m}`);
const warn = (m) => log(`  \x1b[33m!\x1b[0m ${m}`);

const DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u06D6-\u06ED\u0640\u08F0-\u08F3]/g;
const norm = (s = '') =>
  s.replace(/\u0670/g, '\u0627').replace(DIACRITICS, '').replace(/[\u0622\u0623\u0625\u0671]/g, '\u0627')
    .replace(/\u0629/g, '\u0647').replace(/\u0649/g, '\u064A').replace(/\u0624/g, '\u0648')
    .replace(/\u0626/g, '\u064A').replace(/\u0621/g, '\u0627')
    .replace(/[\u061F\u060C\u061B]/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * هيكل بلا ألف. لازم في الفحص: الرسم العثماني يكتب «لَآ إِلَٰهَ» فتصير
 * بعد التوحيد «لا الاه» — ألف زائدة لا وجود لها في إملاء المستخدم «لا اله».
 * المقارنة على الهيكل وحده هي التي تُظهر تطابق النصين، تماماً كما في البحث.
 */
const skel = (s = '') => norm(s).replace(/[\u0627\u0649]/g, '');

/** احتواء: مطابقة عادية أو مطابقة على الهيكل (الألف زائدة في العثماني) */
const contains = (textNorm, textSkel, key) =>
  textNorm.includes(norm(key)) || textSkel.includes(skel(key));

const toWestern = (s) => s.replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660));
/** أول رقم في نص المرجع — يكشف انفصال التسمية عن المؤشر الفعلي */
const firstNumber = (s) => {
  const m = toWestern(String(s || '')).match(/\d+/);
  return m ? Number(m[0]) : null;
};

/* ---------- تحميل وحدات TS عبر esbuild ---------- */

async function importTs(file) {
  const src = await readFile(path.join(ROOT, file), 'utf8');
  const { code } = await transform(src, { loader: 'ts', format: 'esm', target: 'node20' });
  const url = 'data:text/javascript;base64,' + Buffer.from(code).toString('base64');
  return import(url);
}

/* ---------- تحميل بيانات المصدر ---------- */

const readJson = async (f) => JSON.parse(await readFile(path.join(OUT, f), 'utf8'));

async function main() {
  log('\n\x1b[1m🧾 تدقيق المحتوى المُحال إلى مصادر\x1b[0m');

  if (!existsSync(path.join(OUT, 'quran/uthmani.json'))) {
    bad('لا توجد بيانات — شغّل: npm run data');
    process.exit(1);
  }

  const { ADHKAR, NAMES } = await importTs('src/data/adhkar.ts');
  const quran = await readJson('quran/uthmani.json');
  const surahs = await readJson('quran/surahs.json');

  const offset = [];
  let acc = 0;
  for (const s of surahs) { offset[s.n] = acc; acc += s.verses; }
  const ayah = (s, a) => quran[offset[s] + a - 1]?.[0] ?? '';

  // فهارس الحديث
  const hadithCache = new Map();
  async function hadithOf(book) {
    if (!hadithCache.has(book)) {
      const idx = JSON.parse(await readFile(path.join(OUT, 'hadith/index.json'), 'utf8'));
      if (!idx.some((b) => b.key === book)) return null;
      hadithCache.set(book, await readJson(`hadith/${book}.json`));
    }
    return hadithCache.get(book);
  }

  const problems = [];
  const resolved = [];
  let checked = 0;

  log('\n\x1b[1mالأذكار\x1b[0m');
  for (const group of ADHKAR) {
    for (const item of group.items) {
      checked++;
      let text = null;
      let source = null;

      if (item.quran) {
        const [s, a] = item.quran;
        text = ayah(s, a);
        source = `القرآن ${s}:${a}`;
        if (!text) { problems.push({ id: item.id, why: `سورة/آية غير موجودة: ${s}:${a}` }); continue; }
        if (a > (surahs.find((x) => x.n === s)?.verses ?? 0)) {
          problems.push({ id: item.id, why: `الآية ${a} خارج نطاق السورة ${s}` });
          continue;
        }
      } else if (item.hadith) {
        const [book, num] = item.hadith;
        const rows = await hadithOf(book);
        if (!rows) { problems.push({ id: item.id, why: `كتاب غير موجود: ${book}` }); continue; }
        const row = rows.find((r) => r.n === num);
        if (!row) {
          problems.push({ id: item.id, why: `حديث ${num} غير موجود في ${book} (المتاح: ${rows.length})` });
          continue;
        }
        text = row.t;
        source = `${book} #${num}`;
      } else {
        problems.push({ id: item.id, why: 'لا مرجع (لا quran ولا hadith)' });
        continue;
      }

      // التسمية المعروضة يجب أن تطابق المؤشر الفعلي — يمنع رقماً كاذباً في الواجهة.
      // ملاحظة: تسمية الآية تكتب اسم السورة ثم رقم الآية («البقرة 255»)، بينما
      // الذكر المصوّر بسورة كاملة يكتب رقم السورة («الإخلاص 112»). نقبل الاثنين.
      const label = firstNumber(item.ref);
      if (label !== null) {
        const valid = item.hadith
          ? [item.hadith[1]]
          : [item.quran[0], item.quran[1]];
        if (!valid.includes(label)) {
          problems.push({ id: item.id, why: `التسمية «${item.ref}» لا تطابق المرجع الفعلي [${valid.join(' / ')}]`, source });
          continue;
        }
      }

      // فحص الكلمات المفتاحية — يكشف خطأ الرقم
      const n = norm(text);
      const k = skel(text);
      const missing = (item.must || []).filter((kw) => !contains(n, k, kw));
      if (missing.length) {
        problems.push({ id: item.id, why: `الكلمات المطلوبة غير موجودة في النص: ${missing.join('، ')}`, source });
        continue;
      }
      resolved.push({ group: group.id, id: item.id, source, chars: text.length });
    }
  }
  if (problems.length === 0) ok(`كل الأذكار (${checked}) تحققت من مراجعها`);
  for (const p of problems) bad(`${p.id}: ${p.why}${p.source ? ` [${p.source}]` : ''}`);

  /* ---------- أسماء الله ---------- */
  log('\n\x1b[1mأسماء الله الحسنى\x1b[0m');
  let nameProblems = 0;
  let withQuran = 0;
  for (const nm of NAMES) {
    if (!nm.quran) { warn(`${nm.ar}: بلا موضع قرآني`); continue; }
    const [s, a] = nm.quran;
    const t = ayah(s, a);
    if (!t) { bad(`${nm.ar}: موضع غير موجود ${s}:${a}`); nameProblems++; continue; }
    if (a > (surahs.find((x) => x.n === s)?.verses ?? 0)) {
      bad(`${nm.ar}: الآية ${a} خارج نطاق السورة ${s}`); nameProblems++; continue;
    }
    withQuran++;
  }
  if (nameProblems === 0) ok(`كل الأسماء (${NAMES.length}) لها موضع قرآني صحيح (${withQuran})`);

  /* ---------- تقرير ---------- */
  await mkdir(OUT, { recursive: true });
  const report = {
    verifiedAt: new Date().toISOString(),
    adhkarChecked: checked,
    adhkarResolved: resolved.length,
    adhkarProblems: problems,
    namesTotal: NAMES.length,
    namesWithQuran: withQuran,
    policy: 'كل ذكر/اسم لا يظهر في التطبيق إلا بعد نجاح هذا الفحص.',
  };
  await writeFile(path.join(OUT, 'content-report.json'), JSON.stringify(report, null, 2), 'utf8');

  const total = problems.length + nameProblems;
  log('');
  if (total === 0) {
    ok(`\x1b[1mلا أخطاء\x1b[0m — ${checked} ذكراً و${NAMES.length} اسماً مُتحقَّق منها`);
  } else {
    bad(`\x1b[1m${total} مشكلة\x1b[0m — التفاصيل في public/data/content-report.json`);
    process.exitCode = 1;
  }
}

main().catch((e) => { bad(e.stack || e.message); process.exit(1); });
