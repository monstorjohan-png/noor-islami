import { useMemo, useState } from 'react';
import { useL } from '../lib/hooks';
import { FIQH_BABS } from '../data/fiqh';
import { Ornament, Section } from '../components/ui';

/**
 * فقه العبادات — يعرض أقوال الأئمة المعتمدة ومصادرها.
 * هذا القسم للتعريف والدراسة لا للفتوى — المرجع الرسمي هو
 * جهة الإفتاء في بلد المستخدم.
 */
export default function Fiqh() {
  const L = useL();
  const [query, setQuery] = useState('');
  const [openBab, setOpenBab] = useState<string | null>(FIQH_BABS[0]?.id ?? null);
  const [openMasala, setOpenMasala] = useState<string | null>(null);

  const q = query.trim();
  const filtered = useMemo(() => {
    if (!q) return FIQH_BABS;
    return FIQH_BABS.map((bab) => ({
      ...bab,
      masail: bab.masail.filter(
        (m) =>
          m.title.includes(q) ||
          m.summary.includes(q) ||
          m.views.some((v) => v.by.includes(q) || v.text.includes(q)),
      ),
    })).filter((bab) => bab.masail.length > 0);
  }, [q]);

  return (
    <div className="animate-fade-in">
      <Section title={L({ ar: 'فقه العبادات', en: 'Fiqh of Worship' })} />

      {/* تنبيه الفتوى — لا يزول */}
      <div className="mb-4 rounded-xl border border-amber-400/25 bg-amber-400/8 px-4 py-3 text-[12px] leading-6 text-amber-200">
        {L({
          ar: 'نور يعرض أقوال الأئمة المعتمدة ومصادرها للتعريف والدراسة — وليس فتوى. المرجع في ما يخصك هو جهة الإفتاء الرسمية في بلدك وأهل العلم المعتبرين فيه.',
          en: 'Noor presents the imams’ established positions and their sources for study — it is not a fatwa. Your authority is the official fatwa body in your country.',
        })}
      </div>

      <label className="mb-4 block">
        <span className="sr-only">{L({ ar: 'ابحث في الفقه', en: 'Search fiqh' })}</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={L({ ar: 'ابحث: الوضوء، الجماعة، الصيام…', en: 'Search: wudu, jamaah, fasting…' })}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 placeholder-slate-600 outline-none focus:border-gold-400/50"
        />
      </label>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">{L({ ar: 'لا نتائج — جرّب كلمة أخرى', en: 'No results — try another word' })}</p>
      ) : (
        filtered.map((bab) => (
          <section key={bab.id} className="mb-3">
            <button
              type="button"
              onClick={() => setOpenBab(openBab === bab.id ? null : bab.id)}
              aria-expanded={openBab === bab.id}
              className="card flex w-full items-center justify-between gap-3 p-4 text-start transition-colors hover:border-gold-400/30"
            >
              <span className="text-sm font-bold text-slate-100">{L(bab.title)}</span>
              <span className="num text-xs text-slate-500">
                {bab.masail.length} {L({ ar: 'مسألة', en: 'issues' })} <span className="text-gold-400">{openBab === bab.id ? '▲' : '▼'}</span>
              </span>
            </button>

            {openBab === bab.id ? (
              <div className="mt-2 space-y-2">
                {bab.masail.map((m) => (
                  <div key={m.id} className="card overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setOpenMasala(openMasala === m.id ? null : m.id)}
                      aria-expanded={openMasala === m.id}
                      className="flex w-full items-center justify-between gap-3 p-3.5 text-start"
                    >
                      <span className="text-[13px] font-semibold leading-6 text-slate-100">{m.title}</span>
                      <span className="shrink-0 text-gold-400">{openMasala === m.id ? '−' : '+'}</span>
                    </button>
                    {openMasala === m.id ? (
                      <div className="border-t border-white/5 p-3.5 pt-3">
                        <ul className="space-y-2">
                          {m.views.map((v, i) => (
                            <li key={i} className="rounded-lg border border-white/5 bg-white/[.03] p-2.5">
                              <p className="text-[11px] font-bold text-gold-200">{v.by}</p>
                              <p className="mt-1 text-[12px] leading-6 text-slate-300">{v.text}</p>
                            </li>
                          ))}
                        </ul>
                        <div className="mt-2 rounded-lg border border-emerald-400/15 bg-emerald-400/5 p-2.5">
                          <p className="text-[11px] font-bold text-emerald-300">{L({ ar: 'الخلاصة', en: 'Summary' })}</p>
                          <p className="mt-1 text-[12px] leading-6 text-slate-200">{m.summary}</p>
                        </div>
                        <p className="mt-2 text-[10px] leading-4 text-slate-600">{L({ ar: 'المصادر: ', en: 'Sources: ' })}{m.source}</p>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        ))
      )}

      <p className="mt-2 text-center text-[10px] text-slate-600">
        {L({ ar: 'المحتوى من كتب المذاهب الأربعة ومجاميع فتاوى ابن تيمية وابن باز — معروضة للمراجعة والتعلم لا للفتوى', en: 'Compiled from the four schools and the fatwas of Ibn Taymiyyah and Ibn Baz — for study, not fatwa' })}
      </p>
      <Ornament />
    </div>
  );
}
