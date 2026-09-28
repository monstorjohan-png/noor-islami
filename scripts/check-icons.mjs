/**
 * فاحص الأيقونات — يفكّ ترميز PNG المكتوبة ويطبعها كفن نصي.
 * الغرض: نتأكد بصرياً من الرسم دون متصفح، وأن الملف PNG سليم.
 *
 *   node scripts/check-icons.mjs
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** يفكّ ترميز PNG بسيط (RGBA8 بلا تشابك) — ويتحقق من صحة CRC لكل قطعة */
function decodePng(buf) {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < 8; i++) if (buf[i] !== sig[i]) throw new Error('توقيع PNG غير صالح');

  let p = 8;
  let w = 0, h = 0, depth = 0, color = 0;
  const idat = [];
  const types = [];

  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString('ascii', p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    const crc = buf.readUInt32BE(p + 8 + len);
    const want = crc32(buf.subarray(p + 4, p + 8 + len));
    if (crc !== want) throw new Error(`CRC خاطئ في قطعة ${type}`);
    types.push(type);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      depth = data[8]; color = data[9];
    } else if (type === 'IDAT') idat.push(data);
    p += 12 + len;
  }
  if (depth !== 8 || color !== 6) throw new Error(`عمق/نوع غير مدعوم: ${depth}/${color}`);

  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * 4;
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    if (raw[y * (stride + 1)] !== 0) throw new Error(`نوع الترشيح غير مدعوم في السطر ${y}`);
    out.set(raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride), y * stride);
  }
  return { w, h, px: out, types };
}

const RAMP = ' .:-=+*#%@';

for (const file of ['public/icons/icon-192.png', 'public/icons/icon-512.png', 'public/icons/icon-maskable-512.png']) {
  const buf = await readFile(path.join(ROOT, file));
  const { w, h, px, types } = decodePng(buf);
  console.log(`\n\x1b[36m${file}\x1b[0m  ${w}×${h}  ${(buf.length / 1024).toFixed(1)} KB  قطع: ${types.join(',')}`);

  // فن نصي: 40 عموداً
  const COLS = 40;
  const rows = Math.round((COLS * h) / w / 2.1);
  let art = '';
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = Math.floor((c / COLS) * w);
      const y = Math.floor((r / rows) * h);
      const i = (y * w + x) * 4;
      const a = px[i + 3] / 255;
      const lum = (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) / 255;
      art += a < 0.15 ? ' ' : RAMP[Math.min(9, Math.max(0, Math.round(lum * 9)))];
    }
    art += '\n';
  }
  console.log(art);

  // إحصاء
  let opaque = 0, gold = 0, green = 0;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] > 128) opaque++;
    const [r, g, b] = [px[i], px[i + 1], px[i + 2]];
    if (r > 150 && g > 100 && b < 140 && r > b + 40) gold++;
    if (g > 100 && g > r + 30 && b > 60 && b < g) green++;
  }
  const total = w * h;
  console.log(`  معتم ${((opaque / total) * 100).toFixed(0)}%  ذهبي ${((gold / total) * 100).toFixed(1)}%  أخضر ${((green / total) * 100).toFixed(1)}%`);
}

console.log('\n\x1b[32m✓\x1b[0m كل ملفات PNG سليمة (CRC صحيح)');
