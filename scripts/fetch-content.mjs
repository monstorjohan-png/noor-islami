/**
 * نور NOOR — خط أنابيب المحتوى
 * ---------------------------------------------------------------
 * ينزّل البيانات من مصادر مُوثّقة (Public Domain / CC-BY) ويتحقق منها
 * قبل أن تدخل التطبيق. لا نص يدخل التطبيق إلا من هنا.
 *
 * مبدأ صارم: لا تُكتب ولا تُستكمل ولا يُعاد ترقيم أي نص ناقص.
 *          ما ينقص من المصدر يُسجَّل في gaps.json ويُبلَّغ عنه.
 *
 *   node scripts/fetch-content.mjs [--force] [--only=book1,book2]
 */
import { mkdir, writeFile, readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { QURAN, HADITH, QURAN_CDN, HADITH_CDN } from './lib/sources.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'public', 'data');
const CACHE = path.join(ROOT, '.cache');

const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const ONLY = (args.find((a) => a.startsWith('--only=')) || '').replace('--only=', '').split(',').filter(Boolean);

const log = (...a) => console.log(...a);
const ok = (m) => log(`  \x1b[32m✓\x1b[0m ${m}`);
const warn = (m) => log(`  \x1b[33m!\x1b[0m ${m}`);
const bad = (m) => log(`  \x1b[31m✗\x1b[0m ${m}`);

const report = { startedAt: new Date().toISOString(), items: {}, gaps: {}, errors: [] };

/* ---------- أدوات ---------- */

const DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u06D6-\u06ED\u0640\u08F0-\u08F3]/g;
const CONTROLS = /[\u200B-\u200F\u202A-\u202E\uFEFF]/g;
const PUNCT_AR = /[\u061F\u060C\u061B\u061E\u066A-\u066D]/g;
/** الألف الخنجرية ٰ -> ألف عادية، وإلا اختفى الفرق بين «صرٰط» و«صراط» */
const DAGGER_ALEF = /\u0670/g;

function normalizeAr(s) {
  if (!s) return '';
  return s
    .replace(DAGGER_ALEF, '\u0627')
    .replace(DIACRITICS, '')
    .replace(CONTROLS, '')
    .replace(PUNCT_AR, ' ')
    .replace(/[\u0622\u0623\u0625\u0671\u0672\u0673]/g, '\u0627')
    .replace(/\u0629/g, '\u0647')
    .replace(/\u0649/g, '\u064A')
    .replace(/\u0624/g, '\u0648')
    .replace(/\u0626/g, '\u064A')
    .replace(/\u0621/g, '\u0627')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * هيكل المقارنة: يحذف الألف تماماً.
 * يحوّل «لا إله إلا هو» (إملاء المستخدم) و«لَآ إِلَٰهَ إِلَّا هُوَ» (الرسم العثماني)
 * إلى صيغة واحدة، وإلا فشلت كل عملية بحث عن الآيات. يُستخدم للقرآن فقط —
 * نصوص الأحاديث بالإملاء المعتاد ولا تحتاجه.
 */
function skeleton(s) {
  return normalizeAr(s).replace(/[\u0627\u0649]/g, '');
}

async function fetchJson(url, cacheKey) {
  const cacheFile = path.join(CACHE, `${cacheKey}.json`);
  if (!FORCE && existsSync(cacheFile)) {
    const st = await stat(cacheFile);
    log(`  \x1b[90m↺\x1b[0m ${cacheKey} (${(st.size / 1024).toFixed(0)}KB)`);
    return JSON.parse(await readFile(cacheFile, 'utf8'));
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  const txt = await res.text();
  await mkdir(CACHE, { recursive: true });
  await writeFile(cacheFile, txt);
  return JSON.parse(txt);
}

async function writeOut(name, obj) {
  const json = JSON.stringify(obj);
  const file = path.join(OUT, name);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, json);
  const bytes = Buffer.byteLength(json);
  report.items[name] = { bytes, sha256: createHash('sha256').update(json).digest('hex').slice(0, 16) };
  return { file, bytes };
}

/** نص عربي صالح: ليس فارغاً، لا يقل عن 8 محارف، وأغلبه عربي */
function looksArabic(text) {
  if (!text || typeof text !== 'string' || text.length < 8) return false;
  const arabic = (text.match(/[\u0600-\u06FF]/g) || []).length;
  return arabic / text.length > 0.5;
}

/* ---------- القرآن ---------- */

async function buildQuran() {
  log('\n\x1b[1m📖 القرآن الكريم\x1b[0m');

  const info = await fetchJson(QURAN.info, 'quran-info');
  const main = await fetchJson(`${QURAN_CDN}/editions/${QURAN.editions.uthmani.file}`, 'quran-uthmani');
  const ump = main[Object.keys(main)[0]];
  if (!Array.isArray(ump) || ump.length !== 6236) throw new Error(`عدد الآيات ${ump?.length} بدل 6236`);
  ok(`المصحف العثماني: ${ump.length} آية`);

  const tafsir = await fetchJson(`${QURAN_CDN}/editions/${QURAN.editions.tafsirJalalayn.file}`, 'quran-tafsir-jalalayn');
  const tafsirArr = tafsir[Object.keys(tafsir)[0]];
  if (!Array.isArray(tafsirArr) || tafsirArr.length !== 6236) throw new Error(`تفسير الجلالين: ${tafsirArr?.length} بدل 6236`);
  ok(`تفسير الجلالين: ${tafsirArr.length} مدخل`);

  const enHaleem = await fetchJson(`${QURAN_CDN}/editions/${QURAN.editions.enAbdelHaleem.file}`, 'quran-en-haleem');
  const enHye = await fetchJson(`${QURAN_CDN}/editions/${QURAN.editions.enAbdulHye.file}`, 'quran-en-hye');
  const en1 = enHaleem[Object.keys(enHaleem)[0]];
  const en2 = enHye[Object.keys(enHye)[0]];
  ok(`الترجمة الإنجليزية: ${en1?.length} / ${en2?.length} آية`);

  // بيانات كل آية: الجزء، الصفحة، خط المصحف، الركوع، السجدة
  const metaByKey = new Map();
  for (const ch of info.chapters) {
    for (const v of ch.verses || []) {
      metaByKey.set(`${ch.chapter}:${v.verse}`, {
        juz: v.juz, page: v.page, line: v.line, ruku: v.ruku, maqra: v.maqra, sajda: !!v.sajda,
      });
    }
  }
  ok(`بيانات الآيات: ${metaByKey.size} مدخل (جزء/صفحة/خط/سجدة)`);

  // نص المصحف: [نص، تفسير، ترجمتان، مُوحَّد، هيكل مقارنة]
  const pos = new Array(6236);
  const text = new Array(6236);
  let i = 0;
  for (const v of ump) {
    const m = metaByKey.get(`${v.chapter}:${v.verse}`);
    if (!m) throw new Error(`لا بيانات موضع للآية ${v.chapter}:${v.verse}`);
    pos[i] = [m.juz, m.page, m.line, m.ruku, m.sajda ? 1 : 0];
    const f = normalizeAr(v.text);
    text[i] = [v.text, tafsirArr[i]?.text || '', en1?.[i]?.text || '', en2?.[i]?.text || '', f, skeleton(v.text)];
    i++;
  }
  if (i !== 6236) throw new Error(`دمج ${i} بدل 6236`);

  await writeOut('quran/uthmani.json', text);
  await writeOut('quran/positions.json', pos);
  ok('مصفوفة النص والمواضع جاهزة');

  const surahs = (info.chapters || []).map((c) => {
    const vs = c.verses || [];
    const juzSet = [...new Set(vs.map((v) => v.juz))].sort((a, b) => a - b);
    return {
      n: c.chapter,
      ar: c.arabicname,
      arSimple: normalizeAr(c.arabicname).replace(/^سوره/, '').trim(),
      en: c.englishname,
      type: String(c.revelation).toLowerCase().includes('mecca') ? 'مكية' : 'مدنية',
      verses: c.verses.length,
      place: c.revelation,
      juzFrom: juzSet[0],
      juzTo: juzSet[juzSet.length - 1],
      startPage: vs[0]?.page,
    };
  });
  await writeOut('quran/surahs.json', surahs);
  ok(`السور: ${surahs.length}`);

  const juzRefs = (info.juzs?.references || []).map((j) => ({ n: j.juz, s: j.chapter, a: j.verse }));
  await writeOut('quran/juzs.json', juzRefs);
  ok(`الأجزاء: ${juzRefs.length}`);

  await writeOut('quran/meta.json', {
    ayahCount: 6236,
    surahCount: surahs.length,
    juzCount: juzRefs.length,
    sajdaCount: info.sajdas?.count ?? null,
    sajdaObligatory: (info.sajdas?.references || []).filter((s) => s.obligatory).length,
    rukuCount: info.rukus?.count ?? null,
    pageCount: info.pages?.count ?? null,
    editions: {
      text: QURAN.editions.uthmani,
      tafsir: QURAN.editions.tafsirJalalayn,
      en1: QURAN.editions.enAbdelHaleem,
      en2: QURAN.editions.enAbdulHye,
    },
    license: QURAN.license,
    licenseUrl: QURAN.licenseUrl,
  });
  ok('بيانات الفهرس');
}

/* ---------- الحديث ---------- */

async function buildHadith() {
  log('\n\x1b[1m📚 الحديث الشريف\x1b[0m');

  const index = [];
  for (const book of HADITH.books) {
    if (ONLY.length && !ONLY.includes(book.key)) continue;

    const raw = await fetchJson(`${HADITH_CDN}/editions/${book.ara}.json`, `hadith-ara-${book.key}`);
    const list = raw.hadiths;
    if (!Array.isArray(list) || !list.length) throw new Error(`${book.key}: بيانات فارغة`);

    const rows = [];
    const gaps = [];
    const seen = new Set();

    for (const h of list) {
      const num = h.hadithnumber;
      if (!looksArabic(h.text)) {
        // فجوة في المصدر — تُسجَّل ولا تُملأ ولا يُعاد ترقيمها
        gaps.push(num);
        continue;
      }
      if (seen.has(num)) continue; // تكرار في المصدر
      seen.add(num);

      const grades = (h.grades || []).map((g) => {
        const gr = g.grade || '';
        return {
          g: gr,
          by: g.name,
          base: /sahih\s*hasan|hasan\s*sahih/i.test(gr) ? 'hasan'
            : /^sahih/i.test(gr) ? 'sahih'
            : /^hasan/i.test(gr) ? 'hasan'
            : /da'?if|weak|munkar|reject/i.test(gr) ? 'daif'
            : 'unspecified',
        };
      });
      const strongest = grades.some((g) => g.base === 'sahih') ? 'sahih'
        : grades.some((g) => g.base === 'hasan') ? 'hasan'
        : grades.length ? 'daif' : 'unspecified';

      rows.push({
        n: num,
        b: h.reference?.book ?? null,
        t: h.text,
        f: normalizeAr(h.text),
        g: strongest,
        gr: grades,
      });
    }

    if (gaps.length) {
      report.gaps[book.key] = { label: book.label.ar, count: gaps.length, numbers: gaps };
      warn(`${book.label.ar}: ${gaps.length} حديث ناقص في المصدر المفتوح — أُسقطت وسُجّلت في gaps.json`);
    }

    const r = await writeOut(`hadith/${book.key}.json`, rows);
    index.push({
      key: book.key,
      label: book.label,
      author: book.author,
      death: book.death,
      grade: book.grade,
      note: book.note,
      count: rows.length,
      sourceCount: list.length,
      gaps: gaps.length,
      bytes: r.bytes,
    });
    const c = gaps.length ? warn : ok;
    c(`${book.label.ar}: ${rows.length} حديث — ${(r.bytes / 1048576).toFixed(2)}MB`);
  }

  await writeOut('hadith/index.json', index);
  const total = index.reduce((s, i) => s + i.count, 0);
  const gapTotal = Object.values(report.gaps).reduce((s, g) => s + g.count, 0);
  ok(`الإجمالي: ${total.toLocaleString('ar-EG')} حديث في ${index.length} كتب`);
  if (gapTotal) warn(`فجوات موثّقة: ${gapTotal} حديث — لن تظهر في التطبيق`);
}

/* ---------- التحقق ---------- */

async function verify() {
  log('\n\x1b[1m🔍 التحقق النهائي\x1b[0m');
  let problems = 0;
  const t = (name, pass, got) => {
    if (pass) ok(name);
    else { bad(`${name}${got !== undefined ? ` — القيمة: ${JSON.stringify(got)?.slice(0, 70)}` : ''}`); problems++; }
  };

  const txt = JSON.parse(await readFile(path.join(OUT, 'quran/uthmani.json'), 'utf8'));
  const pos = JSON.parse(await readFile(path.join(OUT, 'quran/positions.json'), 'utf8'));
  const surahs = JSON.parse(await readFile(path.join(OUT, 'quran/surahs.json'), 'utf8'));

  t('عدد الآيات = 6236', txt.length === 6236, txt.length);
  t('عدد مواضع الآيات = 6236', pos.length === 6236, pos.length);
  t('عدد السور = 114', surahs.length === 114, surahs.length);

  // فهرس الإزاحة: من (سورة، آية) إلى موضع الآية في المصفوفة
  const offset = [];
  let acc = 0;
  for (const s of surahs) { offset[s.n] = acc; acc += s.verses; }
  t('مجموع آيات السور = 6236', acc === 6236, acc);
  const at = (s, a) => txt[offset[s] + a - 1];
  const norm = (s) => normalizeAr(s);
  const skel = (s) => skeleton(s);

  t('الفاتحة: 7 آيات', Array.from({ length: 7 }, (_, i) => at(1, i + 1)[0].length > 0).every(Boolean), true);
  t('الفاتحة 1:1 = بسم الله (الرسم العثماني: الرحمٰن)', norm(at(1, 1)[0]).includes('بسم الله'), norm(at(1, 1)[0]).slice(0, 45));
  // الألف الخنجرية في العثماني تُحوَّل لألف عادية — لذا «صراط» لا «صرط»
  t('الفاتحة 1:7 = صراط الذين أنعمت عليهم', norm(at(1, 7)[0]).includes('صراط الذين انعمت عليهم غير المغضوب'), norm(at(1, 7)[0]).slice(0, 50));
  t('البقرة 2:1 = الم', norm(at(2, 1)[0]) === 'الم', norm(at(2, 1)[0]));
  // آية الكرسي: «إله» في العثماني «إلٰه» — نختبر صيغتي الكتابة
  t('آية الكرسي 2:255 (رسم عثماني)', norm(at(2, 255)[0]).startsWith('الله لا الاه الا هو الحي القيوم'), norm(at(2, 255)[0]).slice(0, 45));
  t('آية الكرسي 2:255 (بهيكل المقارنة)', skel(at(2, 255)[0]).startsWith(skel('الله لا إله إلا هو الحي القيوم')), skel(at(2, 255)[0]).slice(0, 30));
  t('خواتيم البقرة 2:286', norm(at(2, 286)[0]).includes('لا يكلف الله نفسا الا وسعها'), norm(at(2, 286)[0]).slice(-55));
  t('الإخلاص 112:1 = قل هو الله أحد', norm(at(112, 1)[0]).includes('قل هو الله احد'), norm(at(112, 1)[0]));
  t('آخر آية 114:6 = من الجنة والناس', norm(at(114, 6)[0]).includes('من الجنه والناس'), norm(at(114, 6)[0]));
  t('آية النور 24:35', norm(at(24, 35)[0]).includes('الله نور السماوات والارض'), norm(at(24, 35)[0]).slice(0, 45));
  // الألف الخنجرية تُطابق كتابتها الاعتيادية
  t('الألف الخنجرية تُطابق كتابتها الاعتيادية', norm(at(1, 7)[0]).includes('صراط') && norm(at(24, 35)[0]).includes('السماوات'), true);
  // هيكل المقارنة: يجب أن يجد «لا إله إلا هو» كتابَه User العادي
  t('هيكل المقارنة يطابق الإملاء العادي', skel(at(2, 255)[0]).includes(skel('الله لا اله الا هو')), true);
  t('كل آية لها حقل بحث مُوحَّد وهيكل', txt.every((r) => r[4] && r[4].length > 0 && r[5] && r[5].length > 0), true);
  t('تفسير الجلالين مكتمل', txt.filter((r) => r[1] && r[1].length > 3).length > 6100, txt.filter((r) => r[1]?.length > 3).length);
  t('ترجمة إنجليزية مرفقة', txt.filter((r) => r[2] && r[2].length > 3).length > 6100, txt.filter((r) => r[2]?.length > 3).length);
  t('لا نص فارغ', txt.every((r) => r[0] && r[0].length > 0), true);
  t('أجزاء صحيحة (30)', JSON.parse(await readFile(path.join(OUT, 'quran/juzs.json'), 'utf8')).length === 30,
    JSON.parse(await readFile(path.join(OUT, 'quran/juzs.json'), 'utf8')).length);
  t('كل آية لها موضع صحيح', pos.every((p) => p[0] >= 1 && p[0] <= 30 && p[1] >= 1 && p[1] <= 604), true);
  t('مواضع الآيات 1:1 صحيحة (جزء 1 صفحة 1)', pos[0][0] === 1 && pos[0][1] === 1, pos[0]);
  t('السجدات 15', JSON.parse(await readFile(path.join(OUT, 'quran/meta.json'), 'utf8')).sajdaCount === 15,
    JSON.parse(await readFile(path.join(OUT, 'quran/meta.json'), 'utf8')).sajdaCount);

  const hidx = JSON.parse(await readFile(path.join(OUT, 'hadith/index.json'), 'utf8'));
  for (const b of hidx) {
    const rows = JSON.parse(await readFile(path.join(OUT, `hadith/${b.key}.json`), 'utf8'));
    const good = rows.filter((r) => looksArabic(r.t) && typeof r.n === 'number' && r.f.length > 5);
    const numsUnique = new Set(rows.map((r) => r.n)).size === rows.length;
    const pass = good.length === rows.length && numsUnique && rows.length === b.count;
    t(`${b.label.ar}: ${b.count} حديث — ${numsUnique ? 'ترقيم سليم' : 'تكرار في الترقيم'}`,
      pass, pass ? undefined : { good: good.length, rows: rows.length, unique: numsUnique });
  }
  return problems;
}

/* ---------- التشغيل ---------- */

(async () => {
  log('\x1b[1m\x1b[32mنور NOOR — بناء المحتوى\x1b[0m');
  log(`\x1b[90m${new Date().toLocaleString('ar-EG')}\x1b[0m`);
  await mkdir(OUT, { recursive: true });
  await mkdir(CACHE, { recursive: true });

  for (const s of [buildQuran, buildHadith, verify]) {
    try { await s(); } catch (e) {
      bad(`${s.name}: ${e.message}`);
      report.errors.push({ stage: s.name, error: e.message });
      process.exitCode = 1;
    }
  }

  await writeOut('gaps.json', {
    policy: 'أي نص ناقص في المصدر المفتوح يُسجَّل هنا ولا يُملأ ولا يُعاد ترقيمه.',
    source: HADITH.licenseUrl,
    books: report.gaps,
  });

  report.finishedAt = new Date().toISOString();
  await writeOut('manifest.json', {
    ...report,
    app: 'نور NOOR',
    contentPolicy: 'المحتوى من مصادر موثّقة فقط (Public Domain / CC-BY). كل نص يُراجَع على مصدره.',
  });

  const totalBytes = Object.values(report.items).reduce((s, i) => s + i.bytes, 0);
  log(`\n\x1b[1m\x1b[32m✅ اكتمل\x1b[0m — ${(totalBytes / 1048576).toFixed(2)}MB في ${path.relative(ROOT, OUT)}`);
  if (report.errors.length) { bad(`${report.errors.length} خطأ`); process.exitCode = 1; }
  else ok('لا أخطاء');
})();
