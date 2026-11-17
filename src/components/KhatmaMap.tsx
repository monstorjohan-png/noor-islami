import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAsync, useL } from '../lib/hooks';
import { getOffsets, getPositions, getSurahs } from '../lib/content';
import type { HifzEntry } from '../lib/hifz';

/**
 * خريطة الختمة — الـ ٦٠٤ صفحات مصفوفة بصرياً.
 * تُملأ الصفحة «بخضرة» حين تكتمل، و«نصف ذهبية» حين تُقرأ جزئياً،
 * بحسب الآيات المحفوظة (تسلسل من واحد + المتفرقة).
 * لا تُدعى «خريطة ما قرأته» — هي خريطة ما **حفظته** داخل صفحات المصحف،
 * لأن نور لا يتتبع موضع بصرك، فقط ما سجّلتَه.
 */
export default function KhatmaMap({ entries }: { entries: HifzEntry[] }) {
  const L = useL();
  const data = useAsync(async () => {
    const [positions, offsets, surahs] = await Promise.all([getPositions(), getOffsets(), getSurahs()]);
    // آية محفوظة؟ — مصفوفة منطقية بطول 6236
    const memorized: boolean[] = new Array(6236).fill(false);
    for (const e of entries) {
      if (!e) continue;
      const start = offsets[e.surah]; // الفهرس العالمي للآية صفر من سورة e.surah
      for (let a = 1; a <= e.maxAyah; a++) {
        const gi = start + a - 1;
        if (gi >= 0 && gi < 6236) memorized[gi] = true;
      }
      for (const a of e.extra ?? []) {
        const gi = start + a - 1;
        if (Number.isInteger(gi) && gi >= 0 && gi < 6236) memorized[gi] = true;
      }
    }
    // صفحة: مجموعها وعدد المحفوظ فيها، وأول موضع فيها للانتقال إليه
    const total = new Array(604).fill(0);
    const done = new Array(604).fill(0);
    const firstPos = new Array<[number, number] | null>(604).fill(null);
    let surahCursor = 0;
    let acc = 0;
    for (let gi = 0; gi < 6236; gi++) {
      const p = positions[gi];
      const page = p[1];
      total[page] += 1;
      if (memorized[gi]) done[page] += 1;
      while (surahCursor < surahs.length - 1 && gi >= acc + surahs[surahCursor].verses) {
        acc += surahs[surahCursor].verses;
        surahCursor += 1;
      }
      if (!firstPos[page]) firstPos[page] = [surahs[surahCursor].n, gi - acc + 1];
    }
    return { total, done, firstPos };
  }, [entries]);

  const summary = useMemo(() => {
    if (!data.data) return { full: 0, partial: 0 };
    let full = 0, partial = 0;
    for (let i = 1; i <= 604; i++) {
      if (data.data.done[i] >= data.data.total[i] && data.data.total[i] > 0) full += 1;
      else if (data.data.done[i] > 0) partial += 1;
    }
    return { full, partial };
  }, [data.data]);

  if (data.error) {
    return (
      <p className="rounded-xl border border-white/5 bg-white/[.03] p-3 text-center text-[11px] text-slate-500">
        {L({ ar: 'تعذر بناء خريطة الختمة — تأكد أن ملفات المصحف مُنزَّلة من صفحة التنزيل', en: 'Map unavailable — check the mushaf files in Download' })}
      </p>
    );
  }
  if (!data.data) return <div className="py-4 text-center text-xs text-slate-500">…</div>;

  return (
    <div>
      <p className="mb-2 text-[11px] text-slate-500">
        {L({
          ar: '٦٠٤ صفحات — خضراء ما أتممته حفظاً، وذهبية ما بدأته. اضغط صفحة للانتقال إليها.',
          en: '604 pages — green fully memorized, gold started. Tap a page to jump to it.',
        })}
      </p>
      <div className="grid grid-cols-[repeat(20,1fr)] gap-[3px]" role="grid" aria-label={L({ ar: 'خريطة الختمة', en: 'Khatma map' })}>
        {Array.from({ length: 604 }, (_, i) => i + 1).map((page) => {
          const t = data.data!.total[page];
          const d = data.data!.done[page];
          const full = t > 0 && d >= t;
          const partial = d > 0 && !full;
          const cls = full
            ? 'bg-emerald-500/80 border-emerald-400/50'
            : partial
              ? 'bg-gold-400/55 border-gold-400/40'
              : 'bg-white/[.04] border-white/5';
          const target = data.data!.firstPos[page];
          const cell = (
            <span
              className={`block h-3.5 rounded-[3px] border transition-transform hover:scale-110 ${cls}`}
              title={`${L({ ar: 'صفحة', en: 'Page' })} ${page} — ${d}/${t}`}
            />
          );
          return target ? (
            <Link key={page} to={`/quran/${target[0]}/${target[1]}`} aria-label={`${L({ ar: 'صفحة', en: 'Page' })} ${page}`}>
              {cell}
            </Link>
          ) : (
            <span key={page}>{cell}</span>
          );
        })}
      </div>
      <p className="mt-2 text-center text-[11px] text-slate-500">
        <span className="num text-emerald-300">{summary.full}</span> {L({ ar: 'صفحة مُتمّة', en: 'pages complete' })}
        {' · '}
        <span className="num text-gold-300">{summary.partial}</span> {L({ ar: 'جزئية', en: 'partial' })}
        {' · '}
        <span className="num">{604 - summary.full - summary.partial}</span> {L({ ar: 'لم تبدأ', en: 'untouched' })}
      </p>
    </div>
  );
}
