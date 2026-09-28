/**
 * باحث المراجع — يجد الرقم الصحيح داخل النسخة المُحقَّقة.
 * ---------------------------------------------------------------
 * بدل الاعتماد على الذاكرة في ترقيم الأحاديث والآيات، نبحث عن النص
 * في المصدر المُنزَّل ونقرأ رقمه منه. هكذا لا يمر رقم خاطئ للتطبيق.
 *
 *   node scripts/find-ref.mjs "سبحان الذي سخر لنا هذا"
 *   node scripts/find-ref.mjs "رضيت بالله ربا" --limit 5
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public', 'data');

const DIAC = /[\u0610-\u061A\u064B-\u065F\u06D6-\u06ED\u0640\u08F0-\u08F3]/g;
const norm = (s = '') =>
  s.replace(/\u0670/g, '\u0627').replace(DIAC, '')
    .replace(/[\u0622\u0623\u0625\u0671]/g, '\u0627')
    .replace(/\u0629/g, '\u0647').replace(/\u0649/g, '\u064A')
    .replace(/\u0624/g, '\u0648').replace(/\u0626/g, '\u064A')
    .replace(/\u0621/g, '\u0627')
    .replace(/[\u061F\u060C\u061B]/g, ' ').replace(/\s+/g, ' ').trim();
/** هيكل بلا ألف — يضمن تطابق «إله» مع «إلٰه» */
const skel = (s = '') => norm(s).replace(/[\u0627\u0649]/g, '');

const args = process.argv.slice(2);
const query = args.filter((a) => !a.startsWith('--'))[0];
const limit = Number((args.find((a) => a.startsWith('--limit=')) || '').split('=')[1] || 8);
if (!query) {
  console.error('الاستعمال: node scripts/find-ref.mjs "نص" [--limit=8] [--quran]');
  process.exit(1);
}

const qn = norm(query);
const qs = skel(query);

const readJson = (f) => readFile(path.join(OUT, f), 'utf8').then(JSON.parse);

const onlyQuran = args.includes('--quran');

/* ---------- القرآن ---------- */
if (!onlyQuran) {
  const quran = await readJson('quran/uthmani.json');
  const surahs = await readJson('quran/surahs.json');
  const offset = []; let acc = 0;
  for (const s of surahs) { offset[s.n] = acc; acc += s.verses; }
  const hits = [];
  for (let i = 0; i < quran.length; i++) {
    const n = norm(quran[i][0]);
    if (n.includes(qn) || skel(quran[i][0]).includes(qs)) {
      let s = 1; for (let k = 1; k < surahs.length + 1; k++) if (i >= offset[k]) s = k;
      hits.push({ ref: `القرآن ${s}:${i - offset[s] + 1}`, text: quran[i][0].slice(0, 90) });
    }
  }
  if (hits.length) {
    console.log('\n\x1b[36mالقرآن\x1b[0m');
    for (const h of hits.slice(0, limit)) console.log(`  [${h.ref}]  ${h.text}`);
  }
}

/* ---------- الحديث ---------- */
if (!args.includes('--quran-only')) {
  const idx = await readJson('hadith/index.json');
  console.log('\n\x1b[36mالحديث\x1b[0m');
  let found = 0;
  outer:
  for (const b of idx) {
    const rows = await readJson(`hadith/${b.key}.json`);
    for (const r of rows) {
      const n = norm(r.t);
      if (n.includes(qn) || skel(r.t).includes(qs)) {
        console.log(`  [${b.key} #${r.n}]  ${r.t.replace(/\s+/g, ' ').slice(0, 110)}…`);
        if (++found >= limit) break outer;
      }
    }
  }
  if (!found) console.log('  (لا نتائج)');
}
