import { useMemo, useState } from 'react';
import { useL } from '../lib/hooks';
import { TAJWEED_SECTIONS } from '../data/tajweed';
import { Ornament, Section } from '../components/ui';

/**
 * التجويد العملي — أحكام مع أمثلة من القرآن الكريم واختبار قصير لكل حكم.
 * لا يُغني عن التلقي من مجوّد معتمد — التلاوة مندوبة سماعاً أولاً.
 */
export default function Tajweed() {
  const L = useL();
  const [openId, setOpenId] = useState<string | null>(TAJWEED_SECTIONS[0]?.id ?? null);
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [score, setScore] = useState({ right: 0, total: 0 });

  const totalQuiz = useMemo(
    () => TAJWEED_SECTIONS.reduce((n, s) => n + s.quiz.length, 0),
    [],
  );

  const pick = (sectionId: string, qi: number, opt: number, correct: number) => {
    const key = `${sectionId}:${qi}`;
    if (key in picked) return;
    setPicked((p) => ({ ...p, [key]: opt }));
    setScore((s) => ({ right: s.right + (opt === correct ? 1 : 0), total: s.total + 1 }));
  };

  return (
    <div className="animate-fade-in">
      <Section title={L({ ar: 'أحكام التجويد', en: 'Tajweed rules' })} />

      <div className="mb-4 rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-4 py-3 text-[12px] leading-6 text-emerald-100">
        {L({
          ar: 'التجويد يُتلقى سماعاً من مجوّد معتمد — هذا القسم للتعريف والمراجعة بعد التلقي، لا بديلاً عنه.',
          en: 'Tajweed is received by hearing from a certified reciter — this is for reference, not a substitute.',
        })}
      </div>

      <p className="mb-3 text-center text-[11px] text-slate-500">
        {L({ ar: 'إجاباتك:', en: 'Your answers:' })} <span className="num text-emerald-300">{score.right}</span> / <span className="num">{score.total}</span> {L({ ar: `(المجموع ${totalQuiz})`, en: `(of ${totalQuiz})` })}
      </p>

      {TAJWEED_SECTIONS.map((sec) => (
        <section key={sec.id} className="mb-2.5">
          <button
            type="button"
            onClick={() => setOpenId(openId === sec.id ? null : sec.id)}
            aria-expanded={openId === sec.id}
            className="card flex w-full items-center justify-between gap-3 p-4 text-start"
          >
            <span className="text-sm font-bold text-slate-100">{L(sec.title)}</span>
            <span className="shrink-0 text-gold-400">{openId === sec.id ? '−' : '+'}</span>
          </button>

          {openId === sec.id ? (
            <div className="card mt-1.5 space-y-3 p-4">
              <p className="text-[12px] leading-7 text-slate-300">{sec.rule}</p>
              {sec.formula ? (
                <p className="rounded-lg border border-gold-400/20 bg-gold-400/5 px-3 py-2 text-center text-[11px] text-gold-200">{sec.formula}</p>
              ) : null}
              <ul className="space-y-1.5">
                {sec.examples.map((ex, i) => (
                  <li key={i} className="rounded-lg border border-white/5 bg-white/[.03] p-2.5">
                    <span className="quran-text text-[16px] leading-8 text-slate-50">{ex.quran}</span>
                    <span className="mt-0.5 block text-[10px] leading-4 text-slate-500">{ex.note}</span>
                  </li>
                ))}
              </ul>
              {sec.quiz.map((q, qi) => {
                const key = `${sec.id}:${qi}`;
                const chosen = picked[key];
                return (
                  <div key={qi} className="border-t border-white/5 pt-2.5">
                    <p className="text-[12px] font-semibold text-slate-200">{q.q}</p>
                    <div className="mt-2 grid grid-cols-2 gap-1.5">
                      {q.options.map((o, oi) => {
                        const isRight = oi === q.correct;
                        const isPicked = chosen === oi;
                        let cls = 'btn-ghost !py-2 text-[11px]';
                        if (chosen !== undefined) {
                          if (isRight) cls = 'btn-ghost !py-2 !border-emerald-400/50 !text-emerald-300 text-[11px]';
                          else if (isPicked) cls = 'btn-ghost !py-2 !border-rose-400/50 !text-rose-300 text-[11px]';
                        }
                        return (
                          <button key={oi} type="button" disabled={chosen !== undefined} onClick={() => pick(sec.id, qi, oi, q.correct)} className={cls}>
                            {o}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </section>
      ))}

      <Ornament />
    </div>
  );
}
