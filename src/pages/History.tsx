import { useMemo, useState } from 'react';
import { useL } from '../lib/hooks';
import { HISTORY } from '../data/history';
import { Ornament, Section } from '../components/ui';

/**
 * تاريخ الإسلام — خط زمني من البعثة إلى اليوم.
 * المصادر: البداية والنهاية · تاريخ الطبري · سير أعلام النبلاء ·
 * تاريخ الإسلام للذهبي — والتواريخ الهجرية تقريبية.
 */

const ERAS: Array<{ from: number; to: number; ar: string; en: string }> = [
  { from: 500, to: 622, ar: 'الجاهلية ومطلع البعثة', en: 'Before the Hijra' },
  { from: 622, to: 661, ar: 'عصر النبوة والخلافة الراشدة', en: 'Prophetic era & Rightly-guided Caliphs' },
  { from: 661, to: 750, ar: 'الدولة الأموية', en: 'Umayyad Caliphate' },
  { from: 750, to: 1055, ar: 'الدولة العباسية', en: 'Abbasid Caliphate' },
  { from: 1055, to: 1258, ar: 'السلاجقة والصليبيون والأيوبيون', en: 'Seljuks, Crusaders, Ayyubids' },
  { from: 1258, to: 1924, ar: 'المماليك والعثمانيون', en: 'Mamluks and Ottomans' },
  { from: 1924, to: 3000, ar: 'العالم الإسلامي الحديث', en: 'The modern era' },
];

export default function History() {
  const L = useL();
  const [era, setEra] = useState<number | null>(null);

  const filtered = useMemo(
    () => HISTORY.filter((e) => (era === null ? true : e.year >= ERAS[era].from && e.year < ERAS[era].to)),
    [era],
  );

  return (
    <div className="animate-fade-in">
      <Section title={L({ ar: 'تاريخ الإسلام', en: 'Islamic history' })} />
      <p className="-mt-3 mb-4 text-[11px] leading-5 text-slate-500">
        {L({
          ar: 'من البعثة إلى اليوم — المصادر: البداية والنهاية · تاريخ الطبري · سير أعلام النبلاء',
          en: 'From the first revelation to today — sources: al-Bidaya wa’l-Nihaya · Tarikh al-Tabari · Siyar Aʿlam al-Nubala’',
        })}
      </p>

      {/* تصفية حسب الحقبة */}
      <div className="mb-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => setEra(null)} className={`chip ${era === null ? 'chip-active' : ''}`}>
          {L({ ar: 'الكل', en: 'All' })} <span className="num">({HISTORY.length})</span>
        </button>
        {ERAS.map((e, i) => (
          <button key={i} type="button" onClick={() => setEra(era === i ? null : i)} className={`chip ${era === i ? 'chip-active' : ''}`}>
            {L(e)}
          </button>
        ))}
      </div>

      {/* الخط الزمني */}
      <ol className="relative border-r border-white/10 pe-6">
        {filtered.map((e) => (
          <li key={e.year + e.title} className="relative mb-5">
            <span aria-hidden className="absolute -end-[1.55rem] top-1.5 h-3 w-3 rounded-full border border-gold-400/60 bg-ink-900 ring-4 ring-ink-900" />
            <div className="card p-3.5">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                <span className="num text-lg font-bold text-gold-300">{e.year}</span>
                <span className="num text-[10px] text-slate-500">{e.hijri}</span>
                <span className="ms-auto text-[10px] text-slate-600">{e.place}</span>
              </div>
              <h3 className="mt-1 text-sm font-bold leading-6 text-slate-100">{e.title}</h3>
              <p className="mt-1 text-[12px] leading-6 text-slate-300">{e.fact}</p>
              <p className="mt-2 border-t border-white/5 pt-2 text-[11px] leading-5 text-gold-200/80">
                <span className="font-bold text-gold-300">{L({ ar: 'الدرس: ', en: 'Lesson: ' })}</span>
                {e.learn}
              </p>
            </div>
          </li>
        ))}
      </ol>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">{L({ ar: 'لا أحداث في هذه الحقبة', en: 'No events in this era' })}</p>
      ) : null}

      <Ornament />
    </div>
  );
}
