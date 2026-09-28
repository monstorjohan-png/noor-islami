/**
 * مشاركة الآية صورةً.
 * ------------------------------------------------------------------
 * صورةً، فكثير منهم ينشرها كذلك. نرسمها على لوحة canvas بخط المصحف المضمَّن.
 * صورة. نرسمها على لوحة canvas بخط المصحف المضمَّن ونصدّرها PNG.
 *
 * القواعد:
 *  - النص يأتي من `AyahView` (أي من المصحف) — لا يُكتب من الذاكرة هنا.
 *  - كل فشل يُبلَّغ عنه عبر الاستثناء ليعرضه المتصل رسالة صريحة.
 *  - اللوحة بحجم ثابت 1080×1080 ليبقى المخرج موحّداً على كل الأجهزة.
 */

/** لون الخلفية والحدّ — يتبعان هوية التطبيق */
const BG = '#0b1120';
const GOLD = '#d4af37';
const TEXT = '#e2e8f0';
const SUB = '#94a3b8';

export interface ImageCard {
  /** نص الآية — من AyahView */
  text: string;
  /** اسم السورة */
  surah: string;
  /** رقم السورة */
  surahNo: number;
  /** رقم الآية */
  ayahNo: number;
  /** اسم القارئ أو التفسير اختياري */
  footer?: string;
}

const SIZE = 1080;
const PAD = 96;

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** يقسّم النص إلى أسطر لا يتجاوز عرضها `maxW` */
function wrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxW: number,
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** ينتظر تحميل خط معيّن — بدونه تُرسم الآية بخط الجهاز */
async function ensureFont(px: number): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  try {
    await document.fonts.load(`${px}px "Amiri Quran"`);
  } catch (err) {
    console.warn('تعذّر تحميل خط المصحف للصورة — سيُستخدم خط الجهاز', err);
  }
}

/**
 * يرسم بطاقة الآية ويعيدها كصورة PNG.
 * يرمي استثناءً عند الفشل حتى لا نُبلّغ المستخدم بنجاح كاذب.
 */
export async function renderAyahCard(card: ImageCard): Promise<Blob> {
  if (typeof document === 'undefined') throw new Error('المتصفح غير متاح');

  const fontPx = 54;
  await ensureFont(fontPx);

  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('تعذّر إنشاء لوحة الرسم');

  /* الخلفية */
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // زخرفة خفيفة: إطار ذهبي رفيع
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 3;
  roundRect(ctx, 28, 28, SIZE - 56, SIZE - 56, 24);
  ctx.stroke();
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 1;
  roundRect(ctx, 44, 44, SIZE - 88, SIZE - 88, 16);
  ctx.stroke();
  ctx.globalAlpha = 1;

  /* زاوية مزخرفة أعلى الوسط */
  ctx.fillStyle = GOLD;
  ctx.font = '30px "Amiri", serif';
  ctx.textAlign = 'center';
  ctx.fillText('۞', SIZE / 2, PAD + 26);

  /* نص الآية */
  const innerW = SIZE - PAD * 2;
  ctx.direction = 'rtl';
  ctx.textAlign = 'center';
  ctx.fillStyle = TEXT;
  // نجرّب 54 ثم 48 ثم 42 حتى fits السطر داخل الإطار
  const candidates = [54, 48, 42, 36];
  let lines: string[] = [];
  let lineH = 0;
  for (const px of candidates) {
    ctx.font = `${px}px "Amiri Quran", "Traditional Arabic", serif`;
    lines = wrap(ctx, card.text, innerW);
    lineH = px * 1.75;
    if (lines.length * lineH < SIZE - PAD * 2.6) break;
  }
  const blockH = lines.length * lineH;
  const startY = PAD + 96 + Math.max(0, (SIZE - PAD * 2.6 - blockH) / 2);
  lines.forEach((ln, i) => {
    ctx.fillText(ln, SIZE / 2, startY + i * lineH);
  });

  /* اسم السورة ورقم الآية */
  ctx.direction = 'rtl';
  ctx.fillStyle = GOLD;
  ctx.font = '34px "Amiri", serif';
  ctx.fillText(
    `${card.surah} — ${card.surahNo} : ${card.ayahNo}`,
    SIZE / 2,
    SIZE - PAD - (card.footer ? 74 : 26),
  );

  /* التذييل */
  if (card.footer) {
    ctx.fillStyle = SUB;
    ctx.font = '26px "Amiri", serif';
    ctx.fillText(card.footer, SIZE / 2, SIZE - PAD - 22);
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('تعذّر تصدير الصورة'));
    }, 'image/png');
  });
}

/** اسم ملف مقروء يحتوي اسم السورة ورقم الآية */
export function cardFileName(card: ImageCard): string {
  const surah = card.surah.replace(/[^\p{L}\p{N}]+/gu, '-');
  return `noor-${surah}-${card.surahNo}-${card.ayahNo}.png`;
}

/**
 * ينزّل الصورة إلى جهاز المستخدم.
 * يستخدم anchor لأن واجهة الملفات غير متاحة في كل المتصفحات.
 */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // نحرّر العنوان بعد إطار حتى لا يُلغى التنزيل في فايرفوكس
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** هل المتصفح يستطيع مشاركة الملفات؟ أغلبها لا */
export function canShareFiles(): boolean {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean;
    share?: (data: ShareData) => Promise<void>;
  };
  if (typeof nav.share !== 'function' || typeof nav.canShare !== 'function') return false;
  try {
    const probe = new File([new Uint8Array(1)], 'p.png', { type: 'image/png' });
    return nav.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

/** يشارك الصورة إن أمكن، وإلا ينزّلها */
export async function shareAyahImage(
  blob: Blob,
  fileName: string,
  title: string,
): Promise<'shared' | 'downloaded'> {
  const file = new File([blob], fileName, { type: 'image/png' });
  if (canShareFiles()) {
    try {
      await navigator.share({ files: [file], title });
      return 'shared';
    } catch (err) {
      // المستخدم ألغى المشاركة — لا نُنزّل نيابةً عنه
      if (err instanceof DOMException && err.name === 'AbortError') return 'shared';
      console.warn('تعذّرت المشاركة — ننزّل الصورة بدلاً منها', err);
    }
  }
  saveBlob(blob, fileName);
  return 'downloaded';
}
