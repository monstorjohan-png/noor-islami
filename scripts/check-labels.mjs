/**
 * فاحص نصوص البناء
 * ------------------------------------------------------------------
 * الغرض: كشف التلف الذي لا تكشفه البوابات الأخرى.
 *
 * المشكلتان العمليتان:
 *   ١ • محرف البديل U+FFFD داخل حزمة مبنية = تلف فعلي في المخرجات.
 *   ٢ • تسمية عربية أساسية اختفت أو تغيّرت بعد التصغير.
 *
 * لماذا مكتوب بالهروب \uXXXX لا بالعربية الحرفية؟
 *   لأن الطرفية على ويندوز تعرض العربية مقلوبة، فالنص المكتوب في
 *   السكربت لا يضمن وصوله سليماً. الهروب يضمن المطابقة حتمياً.
 *
 *   node scripts/check-labels.mjs
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');

const REPLACEMENT = '\uFFFD';

/** تسميات عربية لا يجوز أن تختفي من البناء */
const REQUIRED = [
  { key: 'share', ar: '\u0645\u0634\u0627\u0631\u0643\u0629' }, // مشاركة
  { key: 'textShare', ar: '\u0646\u0635' }, // نص
  { key: 'tafsir', ar: '\u0627\u0644\u062a\u0641\u0633\u064a\u0631' }, // التفسير
  { key: 'copy', ar: '\u0646\u0633\u062e' }, // نسخ
  { key: 'bookmark', ar: '\u062d\u0641\u0638' }, // حفظ
  { key: 'listen', ar: '\u0627\u0633\u062a\u0645\u0627\u0639' }, // استماع
  { key: 'adhkar', ar: '\u0623\u0630\u0643\u0627\u0631' }, // أذكار
  { key: 'prayer', ar: '\u0627\u0644\u0635\u0644\u0627\u0629' }, // الصلاة
];

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (/\.(js|html|css|webmanifest)$/.test(e.name)) out.push(p);
  }
  return out;
}

let files;
try {
  files = await walk(DIST);
} catch {
  console.error('\u274c dist/ غير موجود — شغّل npm run build أولاً');
  process.exit(1);
}

const problems = [];
let scanned = 0;
let chars = 0;

for (const f of files) {
  const text = await readFile(f, 'utf8');
  scanned += 1;
  chars += text.length;
  const bad = text.indexOf(REPLACEMENT);
  if (bad >= 0) {
    problems.push(
      `${path.relative(ROOT, f)}: محرف تلف U+FFFD عند الموضع ${bad}`,
    );
  }
}

const blob = (await Promise.all(files.map((f) => readFile(f, 'utf8')))).join('\n');
const missing = REQUIRED.filter((r) => !blob.includes(r.ar));

if (missing.length) {
  problems.push(
    `تسميات عربية ناقصة في البناء: ${missing.map((m) => m.key).join(', ')}`,
  );
}

if (problems.length) {
  for (const p of problems) console.error(`\u2717 ${p}`);
  console.error(`\n\u2717 ${problems.length} حالة تلف في البناء`);
  process.exit(1);
}

console.log(
  `\u2713 البناء سليم: ${scanned} ملفاً (${chars} محرفاً)، ` +
    `لا تلف، و${REQUIRED.length} تسمية عربية كاملة`,
);
