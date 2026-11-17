/**
 * بطاقة الإنجاز — صورة 1:1 بروح «نور» تُشارك عبر Web Share API.
 * كل الرسم محلي على Canvas: بلا خادم ولا تتبع.
 */

export interface AchievementCard {
  /** عنوان الإنجاز — مثال: «آيات أتقنتها» */
  title: string;
  /** الرقم الكبير — يُعرض بصيغة لاتينية */
  value: string;
  /** سطر التوضيح أسفل الرقم */
  sub: string;
  /** سطر التوقيع — افتراضياً «نور — NOOR» + تاريخ اليوم */
  footer?: string;
}

export async function renderAchievementCard(card: AchievementCard): Promise<Blob> {
  const S = 1080;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas غير مدعوم');

  // الخلفية الزمردية المتدرجة
  const grad = ctx.createLinearGradient(0, 0, 0, S);
  grad.addColorStop(0, '#143F2E');
  grad.addColorStop(0.55, '#0D2C21');
  grad.addColorStop(1, '#061C14');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, S, S);

  // وهج دائري ذهبي خلف الشعار
  const glow = ctx.createRadialGradient(S / 2, 330, 20, S / 2, 330, 340);
  glow.addColorStop(0, 'rgba(212,175,55,0.30)');
  glow.addColorStop(1, 'rgba(212,175,55,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, S, S);

  // الحلقة الذهبية الأخلاقية (إطار المصحف)
  ctx.strokeStyle = '#E9CD8F';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(S / 2, 330, 168, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(208,178,112,0.75)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(S / 2, 330, 152, 0, Math.PI * 2);
  ctx.stroke();

  // «ن» بخط الأميري — الشعار نفسه
  try {
    await document.fonts.load('700 190px "Amiri Quran"');
  } catch {
    // الاحتياط: يُرسم بالخط الافتراضي
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // الظل
  ctx.fillStyle = 'rgba(70,48,14,0.9)';
  ctx.font = '700 210px "Amiri Quran", serif';
  ctx.fillText('ن', S / 2 + 4, 338 + 5);
  // الجسم بدرجات الذهب
  ctx.fillStyle = '#F8E9B4';
  ctx.font = '700 210px "Amiri Quran", serif';
  ctx.fillText('ن', S / 2, 338 + 2);
  ctx.fillStyle = '#E9CD8F';
  ctx.fillText('ن', S / 2, 338);

  // القوس أعلاها
  ctx.strokeStyle = '#E9CD8F';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(S / 2 - 108, 268);
  ctx.quadraticCurveTo(S / 2, 208, S / 2 + 108, 268);
  ctx.stroke();

  // العنوان
  ctx.fillStyle = '#F5EFDC';
  ctx.font = '600 52px "Amiri Quran", serif';
  ctx.fillText(card.title, S / 2, 616);

  // الرقم الأكبر
  ctx.fillStyle = '#E9CD8F';
  ctx.font = '700 168px Inter, system-ui, sans-serif';
  ctx.fillText(card.value, S / 2, 792);

  // التوضيح
  ctx.fillStyle = '#C9C3AC';
  ctx.font = '400 36px "Amiri Quran", serif';
  ctx.fillText(card.sub, S / 2, 916);

  // التوقيع والتاريخ
  ctx.fillStyle = '#8CA381';
  ctx.font = '400 28px "Amiri Quran", serif';
  const today = new Date().toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' });
  ctx.fillText(card.footer ?? `نور — NOOR  ·  ${today}`, S / 2, 1002);

  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('تعذر رسم البطاقة'))), 'image/png', 0.95),
  );
}

/** مشاركة البطاقة أو حفظها كصورة — حسب قدرات الجهاز */
export async function shareAchievement(card: AchievementCard): Promise<'shared' | 'downloaded' | 'failed'> {
  try {
    const blob = await renderAchievementCard(card);
    const file = new File([blob], 'noor-achievement.png', { type: 'image/png' });
    const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
    if (nav.canShare?.({ files: [file] })) {
      await nav.share({ files: [file], title: card.title });
      return 'shared';
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'noor-achievement.png';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return 'downloaded';
  } catch {
    return 'failed';
  }
}
