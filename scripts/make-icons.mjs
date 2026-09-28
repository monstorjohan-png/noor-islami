/**
 * مولّد أيقونات التطبيق
 * ------------------------------------------------------------------
 * ينتج أيقونات PNG بصيغتين (192 و 512) ونسخة maskable، إضافةً إلى
 * favicon.svg. تُرسم هندسياً بلا أي مكتبة رسوم: نُشغّل Canvas ونكتب
 * البكسلات مباشرة — يبقى الناتج حتمياً وبلا تبعيات.
 *
 *   node scripts/make-icons.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public', 'icons');

/* ---------- كتابة PNG يدوياً ---------- */

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** rgba: Uint8Array بطول w*h*4 */
function encodePng(rgba, w, h) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // بلا ضغط لكل سطر
    Buffer.from(rgba.buffer, y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;   // عمق البت
  ihdr[9] = 6;   // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ---------- رسم الأيقونة ---------- */

const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
const INK = hex('#0b1220');
const GOLD_D = hex('#c9992f');
const GOLD_L = hex('#f3dfa8');
const GREEN = hex('#17a37f');

const mix = (a, b, t) => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
];

/**
 * يرسم الأيقونة.
 * maskable = true يعني أن المحتوى داخل المنطقة الآمنة (80% الوسط)
 * لأن النظام قد يقصّ الأطراف.
 */
function draw(size, maskable) {
  const px = new Uint8Array(size * size * 4);
  const c = (size - 1) / 2;
  const R = size * 0.5;
  const D2R = Math.PI / 180;

  // في نسخة maskable يقصّ النظام الأطراف، فنُبقي الرسم داخل المنطقة الآمنة
  const content = maskable ? R * 0.70 : R * 0.86;

  /* هندسة حرف النون:
   *  • نقطة مستديرة فوق الوسط
   *  • كأس من قوس دائري واحد بفتحة علوية — يمثّل سعة النون
   */
  const stroke = Math.max(2, size * 0.072);
  const bowlR = content * 0.46;              // نصف قطر القوس
  const bowlCy = c + content * 0.30;          // مركز القأسفل القوس
  const dotR = content * 0.115;
  const dotCy = bowlCy - bowlR - content * 0.30;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const d = Math.hypot(x - c, y - c);

      // الخلفية: تدرّج قطري، ثم هالة ذهبية وسطية ناعمة
      let col = mix(INK, hex('#16233d'), (x + y) / (size * 2));
      const glow = Math.max(0, 1 - d / (R * 0.95)) ** 2.4;
      if (glow > 0.002) col = mix(col, GOLD_D, glow * 0.32);

      // إطار ذهبي رفيع على حافة القرص
      if (!maskable && d > R * 0.955) col = mix(col, GOLD_D, Math.min(1, (d - R * 0.955) / (R * 0.03)) * 0.9);

      const a = maskable ? 255 : d > R ? 0 : 255;

      /* النقطة */
      if (Math.hypot(x - c, y - dotCy) <= dotR) col = mix(col, GOLD_L, 1);

      /* القوس:
       * الزاوية بالدرجات في [0,360). الكأس يشمل من 225° عبر الأسفل
       * إلى 315° — أي 270° من القوس، وتُترك فتحة علوية بزاوية 90°.
       */
      const dx = x - c;
      const dy = y - bowlCy;
      const dist = Math.hypot(dx, dy);
      if (dist > 1e-6 && Math.abs(dist - bowlR) <= stroke / 2) {
        const ang = (Math.atan2(dy, dx) / D2R + 360) % 360;
        if (ang <= 225 || ang >= 315) col = mix(col, GOLD_L, 1);
      }

      px[i] = col[0];
      px[i + 1] = col[1];
      px[i + 2] = col[2];
      px[i + 3] = a;
    }
  }

  // قوس أخضر رفيع قرب الحافة يرمز للقبلة
  if (!maskable) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        if (px[i + 3] === 0) continue;
        const d = Math.hypot(x - c, y - c);
        if (Math.abs(d - R * 0.86) < size * 0.011) {
          px[i] = GREEN[0]; px[i + 1] = GREEN[1]; px[i + 2] = GREEN[2];
        }
      }
    }
  }

  return px;
}

/* ---------- favicon.svg ---------- */

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <radialGradient id="g" cx="50%" cy="45%" r="60%">
      <stop offset="0%" stop-color="#243352"/>
      <stop offset="100%" stop-color="#0b1220"/>
    </radialGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f3dfa8"/>
      <stop offset="100%" stop-color="#c9992f"/>
    </linearGradient>
  </defs>
  <circle cx="32" cy="32" r="31" fill="url(#g)"/>
  <circle cx="32" cy="32" r="30.2" fill="none" stroke="#c9992f" stroke-width="1.6"/>
  <circle cx="32" cy="50" r="22.5" fill="none" stroke="#17a37f" stroke-width="1.2" opacity=".8"/>
  <circle cx="32" cy="17" r="4.2" fill="url(#gold)"/>
  <path d="M14 24 L14 32 A18 12 0 0 0 50 32 L50 24"
        fill="none" stroke="url(#gold)" stroke-width="5.2" stroke-linecap="round"/>
</svg>
`;

/* ---------- التنفيذ ---------- */

await mkdir(OUT, { recursive: true });

for (const size of [192, 512]) {
  const png = encodePng(draw(size, false), size, size);
  await writeFile(path.join(OUT, `icon-${size}.png`), png);
  console.log(`  ✓ icons/icon-${size}.png  (${(png.length / 1024).toFixed(1)} KB)`);
}

const maskable = encodePng(draw(512, true), 512, 512);
await writeFile(path.join(OUT, 'icon-maskable-512.png'), maskable);
console.log(`  ✓ icons/icon-maskable-512.png  (${(maskable.length / 1024).toFixed(1)} KB)`);

await writeFile(path.join(ROOT, 'public', 'favicon.svg'), SVG, 'utf8');
console.log('  ✓ favicon.svg');
