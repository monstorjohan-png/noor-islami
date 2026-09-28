/**
 * عارض حديث — يطبع نص حديث برقمه من النسخة المُحقَّقة.
 *   node scripts/show.mjs abudawud 465
 *   node scripts/show.mjs muslim 1652
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [book, num] = process.argv.slice(2);
if (!book || !num) { console.error('الاستعمال: node scripts/show.mjs <book> <n>'); process.exit(1); }

const rows = JSON.parse(await readFile(path.join(ROOT, 'public', 'data', 'hadith', `${book}.json`), 'utf8'));
const row = rows.find((r) => r.n === Number(num));
if (!row) { console.error(`غير موجود: ${book} #${num}`); process.exit(1); }
console.log(`\n[${book} #${row.n}]\n${row.t}\n`);
if (row.g) console.log('الدرجة:', JSON.stringify(row.g, null, 2));
