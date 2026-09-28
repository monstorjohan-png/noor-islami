/**
 * تدقيق مواضع الأسماء: هل نص الآية يحوي الاسم فعلاً؟
 * ------------------------------------------------------------------
 * يفحص كل اسم في NAMES: يقرأ آية موضعه من المصحف ويتحقق أن الهيكل
 * (بلا ألف) للآية يحوي هيكل الاسم. يطبع الفاشلة فقط مع الموضع.
 *
 *   node scripts/audit-names.mjs
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

let bad = 0;
for (const nm of NAMES) {
  if (!nm.quran) { console.log(`بلا موضع: ${nm.ar}`); bad++; continue; }
  const [s, a] = nm.quran;
  const row = quran[offset[s] + a - 1];
  if (!row) { console.log(`موضع خارج النطاق: ${nm.ar} [${s}:${a}]`); bad++; continue; }
  const hit = skel(row[0]).includes(skel(nm.ar)) || norm(row[0]).includes(norm(nm.ar));
  if (!hit) {
    bad++;
    console.log(`لا يحوي الاسم: ${nm.ar} [${s}:${a}] — ${row[0].slice(0, 70)}…`);
  }
}
console.log(bad === 0 ? 'كل المواضع سليمة' : `الفاشلة: ${bad}`);
process.exitCode = bad ? 1 : 0;
