/**
 * فاحص التلف النصي
 * ------------------------------------------------------------------
 * يكشف المحارف التي لا مكان لها داخل النصوص العربية. المسألة التي
 * تتكرر أثناء التحرير هي خلط حروف من لغات أخرى داخل الجملة العربية
 * فينتج نص مثل «يمسّه.sleep» أو «تُنسب、所有».
 *
 * القواعد:
 *   ١ • نص يحوي عربية ولاتينية معاً = تلف شبه مؤكد
 *   ٢ • محارف صينية أو يابانية أو كورية داخل سطر عربي = تلف مؤكد
 *   ٣ • ترقيم غريب داخل سطر عربي = تلف مؤكد
 *
 *   node scripts/check-encoding.mjs
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');

const ARABIC = /[\u0600-\u06FF]/;
const LATIN = /[A-Za-z]/;
const CJK = /[\u3000-\u303F\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF\uFF00-\uFFEF]/;
/** الترقيم الغريب، مع استثناء « » (مقصودة) و° (درجات القبلة/الإحداثيات) */
const ODD_PUNCT = /[\u00A2-\u00A9\u00AC\u00AE\u00AF\u00B2-\u00B5\u00B9\u00BC-\u00BF]/;

/** كلمات إنجليزية شائعة وسط النص العربي = أثر تلف نصي */
const LATIN_WORDS = /[A-Za-z]{3,}/g;
/** مسموحات: أسماء تقنية لا تُترجم وتُستعمل داخل الجمل العربية عمداً */
const ALLOWED = new Set([
  'Vite', 'PWA', 'IndexedDB', 'Workbox', 'Tailwind', 'React', 'TypeScript',
  'JavaScript', 'Service', 'Worker', 'API', 'URL', 'JSON', 'CSS', 'HTML',
  'TS', 'JS', 'OfflineReady', 'goldsmith',
  // أسماء المتصفحات وأدوات النظام: أسماء تقنية تُذكر داخل الجمل العربية
  // عمداً في التوثيق. تلفُه لا يشبه «يمسّه.sleep».
  'Chrome', 'Edge', 'Opera', 'Safari', 'Firefox', 'CORS',
  'MediaSession', 'WakeLock', 'AbortController',
]);

/**
 * التلف يظهر دائماً بلا فاصل: «صحيحةGoldsmith» أو «يمسّه.sleep».
 * فاصل المسافة يعني كلمتين مقصودتين، وهذا ليس تلفاً.
 */
const JOINED = /(?<=[\u0600-\u06FF])[A-Za-z]{2,}|[A-Za-z]{2,}(?=[\u0600-\u06FF])/g;

/** يقتطع نصوص الجافاسكربت من السطر، مع تجاهل أجزاء التعويض ‎${…}‎ */
function stringsOf(line) {
  const out = [];
  const re = /'([^'\\]*(?:\\.[^'\\]*)*)'|"([^"\\]*(?:\\.[^"\\]*)*)"|`([^`\\]*(?:\\.[^`\\]*)*)`/g;
  let m;
  while ((m = re.exec(line))) {
    const raw = m[1] ?? m[2] ?? m[3] ?? '';
    out.push(raw.replace(/\$\{[^}]*\}/g, ' '));
  }
  return out;
}

async function* walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (/\.(ts|tsx)$/.test(e.name)) yield p;
  }
}

const files = [];
for await (const f of walk(SRC)) files.push(f);

const red = (s) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
let issues = 0;

for (const f of files) {
  const rel = path.relative(ROOT, f);
  const lines = (await readFile(f, 'utf8')).split(/\r?\n/);

  lines.forEach((line, i) => {
    if (!ARABIC.test(line)) return;

    for (const s of stringsOf(line)) {
      if (ARABIC.test(s) && LATIN.test(s)) {
        issues++;
        console.log(`${red('✗')} ${rel}:${i + 1}  ${yellow('عربية+لاتينية')}: ${s.slice(0, 100)}`);
      }
    }

    // التلف داخل التعليقات أو السلاسل: حروف لاتينية ملتصقة بعربية
    const joined = line.match(JOINED);
    if (joined) {
      const bad = joined.filter((w) => !ALLOWED.has(w));
      if (bad.length) {
        issues++;
        console.log(`${red('✗')} ${rel}:${i + 1}  ${yellow('حروف ملتصقة')}: ${bad.join(' ')}  ← ${line.trim().slice(0, 80)}`);
      }
    }

    const cjk = line.match(CJK);
    if (cjk) {
      issues++;
      console.log(`${red('✗')} ${rel}:${i + 1}  ${yellow('محرف مقحم')}: ${[...cjk].join(' ')}  ${line.trim().slice(0, 90)}`);
    }

    const odd = line.match(ODD_PUNCT);
    if (odd) {
      issues++;
      console.log(`${red('✗')} ${rel}:${i + 1}  ${yellow('ترقيم غريب')}: ${[...odd].join(' ')}`);
    }
  });
}

console.log('');
if (issues === 0) console.log(`\x1b[32m✓\x1b[0m لا تلف نصي في ${files.length} ملف`);
else {
  console.log(red(`✗ ${issues} حالة تحتاج مراجعة`));
  process.exitCode = 1;
}
