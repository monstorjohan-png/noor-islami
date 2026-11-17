import { useMemo, useState } from 'react';
import { useL } from '../lib/hooks';
import { SCHOLARS, SCHOLAR_CAT_LABELS } from '../data/scholars';
import type { ScholarCat } from '../data/scholars';
import { Ornament, Section } from '../components/ui';

/**
 * تراجم العلماء والصالحين — الأعلام المشهورة والمغمورات.
 * التواريخ تقريبية (ميلادي) — والمصادر: سير أعلام النبلاء ·
 * البداية والنهاية · وفيات الأعيان · تاريخ الطبري.
 */
export default function Scholars() {
  const L = useL();
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState<ScholarCat | 'all'>('all');

  const q = query.trim();
  const filtered = useMemo(
    () =>
      SCHOLARS.filter((s) => {
        if (cat !== 'all' && s.cat !== cat) return false;
        if (!q) return true;
        return (
          s.name.includes(q) ||
          s.field.includes(q) ||
          s.bio.includes(q) ||
          s.lesson.includes(q)
        );
      }),
    [q, cat],
  );

  const cats = Object.keys(SCHOLAR_CAT_LABELS) as ScholarCat[];

  return (
    <div className="animate-fade-in">
      <Section title={L({ ar: 'تراجم العلماء والصالحين', en: 'Biographies' })} />
      <p className="-mt-3 mb-4 text-[11px] leading-5 text-slate-500">
        {L({
          ar: `${SCHOLARS.length} علماً من الصحابة إلى اليوم — أعلام مشهورة وأعلام مغمورة في كتب التراث. المصادر: سير أعلام النبلاء · البداية والنهاية · وفيات الأعيان`,
          en: `${SCHOLARS.length} figures from the Companions to today — sources: Siyar Aʿlam al-Nubala’ · al-Bidaya wa’l-Nihaya · Wafayat al-Aʿyan`,
        })}
      </p>

      <label className="mb-3 block">
        <span className="sr-only">{L({ ar: 'ابحث باسم عالم أو تخصص', en: 'Search a scholar' })}</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={L({ ar: 'ابحث: الشافعي، الحديث، التفسير…', en: 'Search: a name, field…' })}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 placeholder-slate-600 outline-none focus:border-gold-400/50"
        />
      </label>

      {/* التصفية بالطبقة */}
      <div className="mb-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => setCat('all')} className={`chip ${cat === 'all' ? 'chip-active' : ''}`}>
          {L({ ar: 'الكل', en: 'All' })} <span className="num">({SCHOLARS.length})</span>
        </button>
        {cats.map((c) => (
          <button key={c} type="button" onClick={() => setCat(cat === c ? 'all' : c)} className={`chip ${cat === c ? 'chip-active' : ''}`}>
            {L(SCHOLAR_CAT_LABELS[c])}
          </button>
        ))}
      </div>

      {/* البطاقات */}
      <div className="space-y-3">
        {filtered.map((s) => (
          <article key={s.id} className="card p-4">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
              <h3 className="text-[15px] font-bold leading-6 text-slate-50">{s.name}</h3>
              <span className="num text-[11px] text-gold-300">{s.span}</span>
            </div>
            <p className="mt-0.5 text-[11px] text-slate-500">{s.field}</p>
            <p className="mt-2 text-[12px] leading-6 text-slate-300">{s.bio}</p>
            <p className="mt-2 border-t border-white/5 pt-2 text-[11px] leading-5 text-gold-200/80">
              <span className="font-bold text-gold-300">{L({ ar: 'ماذا نتعلم: ', en: 'Lesson: ' })}</span>
              {s.lesson}
            </p>
            <p className="mt-1.5 text-[10px] text-slate-600">
              {L({ ar: 'الطبقة: ', en: 'Layer: ' })}{L(SCHOLAR_CAT_LABELS[s.cat])}
            </p>
          </article>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">{L({ ar: 'لا نتائج — جرّب كلمة أخرى', en: 'No results — try another word' })}</p>
      ) : null}

      <Ornament />
    </div>
  );
}
