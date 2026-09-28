/**
 * مقترح مواضع الأسماء: لكل اسم، الآيات التي تحوي صيغته حرفياً.
 * ------------------------------------------------------------------
 * يطبع تقريراً يُراجَع بشرياً قبل أي تعديل على adhkar.ts.
 * لا يعدّل شيئاً — قراءة فقط.
 *
 *   node scripts/suggest-names.mjs > .opencode/context/names-audit.txt
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { transform } from 'esbuild';

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
const skel = (s = '') => norm(s).replace(/[\u0627\u0649]/g, '');

const src = await readFile(path.join(ROOT, 'src/data/adhkar.ts'), 'utf8');
const { code } = await transform(src, { loader: 'ts', format: 'esm', target: 'node20' });
const { NAMES } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));

const quran = JSON.parse(await readFile(path.join(OUT, 'quran/uthmani.json'), 'utf8'));
const surahs = JSON.parse(await readFile(path.join(OUT, 'quran/surahs.json'), 'utf8'));
const offset = [];
let acc = 0;
for (const s of surahs) { offset[s.n] = acc; acc += s.verses; }
const sname = (n) => surahs.find((x) => x.n === n)?.ar ?? n;

for (const nm of NAMES) {
  const key = skel(nm.ar);
  const hits = [];
  for (let i = 0; i < quran.length && hits.length < 4; i++) {
    if (skel(quran[i][0]).includes(key)) {
      let s = 1;
      for (let k = 1; k <= 114; k++) if (i >= offset[k]) s = k;
      hits.push(`${s}:${i - offset[s] + 1} (${sname(s)})`);
    }
  }
  const cur = nm.quran ? nm.quran.join(':') : '—';
  const curOk = hits.some((h) => h.startsWith(cur + ' ') || h === cur);
  console.log(`${nm.n}. ${nm.ar} | الحالي: ${cur} ${curOk ? 'OK' : '!!'} | حرفي في: ${hits.length ? hits.join('، ') : 'لا يوجد'}`);
}
