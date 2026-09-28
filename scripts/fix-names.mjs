/**
 * Correct quran references in NAMES: for each name, find a verse that contains the name string.
 * If none, leave quran undefined (the UI will show no verse).
 * ------------------------------------------------------------------
 * Reads src/data/adhkar.ts, updates the quran field, writes back.
 */
import { readFile, writeFile } from 'node:fs/promises';
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

async function main() {
  const srcPath = path.join(ROOT, 'src/data/adhkar.ts');
  const src = await readFile(srcPath, 'utf8');
  const { code } = await transform(src, { loader: 'ts', format: 'esm', target: 'node20' });
  const module = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
  const { NAMES } = module;

  const quran = JSON.parse(await readFile(path.join(OUT, 'quran/uthmani.json'), 'utf8'));
  const surahs = JSON.parse(await readFile(path.join(OUT, 'quran/surahs.json'), 'utf8'));
  const offset = [];
  let acc = 0;
  for (const s of surahs) { offset[s.n] = acc; acc += s.verses; }

  let changed = 0;
  for (const nm of NAMES) {
    if (!nm.quran) continue; // already none, skip
    const [s, a] = nm.quran;
    const row = quran[offset[s] + a - 1];
    if (!row) { // out of range
      console.log(`Out of range: ${nm.ar} [${s}:${a}]`);
      nm.quran = undefined;
      changed++;
      continue;
    }
    const hit = skel(row[0]).includes(skel(nm.ar)) || norm(row[0]).includes(norm(nm.ar));
    if (!hit) {
      // search for a verse containing the name
      let found = false;
      for (let si = 1; si <= surahs.length && !found; si++) {
        const surah = surahs.find(x => x.n === si);
        if (!surah) continue;
        const start = offset[si];
        const end = start + surah.verses;
        for (let i = start; i < end; i++) {
          const r = quran[i];
          if (skel(r[0]).includes(skel(nm.ar)) || norm(r[0]).includes(norm(nm.ar))) {
            nm.quran = [si, i - offset[si] + 1];
            found = true;
            changed++;
            break;
          }
        }
      }
      if (!found) {
        console.log(`No verse contains: ${nm.ar} (current [${s}:${a}])`);
        nm.quran = undefined; // remove reference
        changed++;
      }
    }
  }

  if (changed === 0) {
    console.log('No changes needed.');
    return;
  }

  // reconstruct the file: we only need to replace the NAMES array definition
  // Simpler: replace the whole file with a new one that has the updated NAMES
  // but we must keep other exports (ADHKAR). We'll do a string replace for the NAMES array.
  const namesVar = 'export const NAMES: NameOfGod[] = [';
  const idx = src.indexOf(namesVar);
  if (idx === -1) throw new Error('Could not find NAMES array');
  // Find the end of the array (matching brackets)
  let bracket = 1;
  let i = idx + namesVar.length;
  while (i < src.length && bracket > 0) {
    const ch = src[i];
    if (ch === '[') bracket++;
    else if (ch === ']') bracket--;
    i++;
  }
  if (bracket !== 0) throw new Error('Unbalanced brackets in NAMES array');
  const end = i;
  // Build new NAMES source
  const namesSrc = 'export const NAMES: NameOfGod[] = ' + JSON.stringify(NAMES, null, 2).replace(/^  /gm, '  ') + ';';
  const newSrc = src.slice(0, idx) + namesSrc + src.slice(end);
  await writeFile(srcPath, newSrc, 'utf8');
  console.log(`Updated ${changed} name references in ${srcPath}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});