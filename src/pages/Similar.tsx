import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useL, useAsync } from '../lib/hooks';
import { getAyah, getSurahs } from '../lib/content';
import type { AyahView } from '../lib/content';
import { SIMILAR } from '../data/similar';
import { Card, Ornament, Section } from '../components/ui';

/**
 * متشابه القرآن — مواضع التطابق اللفظي بين الآيات، مولّدة آلياً من نص
 * المصحف نفسه ولا يُضاف إليها إلا بعد تحقق آلي مماثل. المرجع العلمي عند
 * الشك: كتب المتشابهات. يعرضها المستخدم ويتذكّر بما حفظ.
 */
export default function Similar() {
  const L = useL();
  const surahs = useAsync(() => getSurahs(), []);
  const [open, setOpen] = useState<number | null>(0);
  const [ayahCache, setAyahCache] = useState<Record<string, AyahView | null>>({});
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [score, setScore] = useState({ right: 0, total: 0 });

  const nameOf = useCallback((n: number) => surahs.data?.find((s) => s.n === n), [surahs.data]);

  const fetchAyahs = useCallback(async (positions: Array<[number, number]>) => {
    setLoadingKey(positions.map((p) => p.join(':')).join('|'));
    for (const [s, a] of positions) {
      const key = `${s}:${a}`;
      if (key in ayahCache) continue;
      try {
        const view = await getAyah(s, a);
        setAyahCache((c) => ({ ...c, [key]: view }));
      } catch {
        setAyahCache((c) => ({ ...c, [key]: null }));
      }
    }
    setLoadingKey(null);
  }, [ayahCache]);

  // تحميل آيات الموضع المفتوح تلقائياً
  useEffect(() => {
    if (open !== null && SIMILAR[open]) void fetchAyahs(SIMILAR[open].positions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ── اختبار عشوائي: أيّ موضع لهذه الآية؟ ───────────────────
  const startQuiz = useCallback(() => {
    if (!surahs.data) return;
    const ci = Math.floor(Math.random() * SIMILAR.length);
    const cluster = SIMILAR[ci];
    const answerIdx = Math.floor(Math.random() * cluster.positions.length);
    const correct = cluster.positions[answerIdx];
    const distractors = new Set<number>();
    while (distractors.size < 3) {
      const n = surahs.data[Math.floor(Math.random() * surahs.data.length)].n;
      if (n !== correct[0]) distractors.add(n);
    }
    const options = [...distractors, correct[0]].sort(() => Math.random() - 0.5);
    setQuiz({ clusterIdx: ci, answerIdx, options, picked: null });
  }, [surahs.data]);

  const answerQuiz = (pick: number) => {
    if (!quiz) return;
    const cluster = SIMILAR[quiz.clusterIdx];
    const right = cluster.positions[quiz.answerIdx][0] === pick;
    setScore((s) => ({ right: s.right + (right ? 1 : 0), total: s.total + 1 }));
    setQuiz({ ...quiz, picked: pick });
  };

  if (!surahs.data) return <div className="pt-10 text-center text-sm text-slate-500">…</div>;

  return (
    <div className="animate-fade-in">
      <Section title={L({ ar: 'متشابه القرآن', en: 'Similar verses' })} />
      <p className="-mt-3 mb-4 text-[11px] leading-5 text-slate-500">
        {L({
          ar: `${SIMILAR.length} موضعاً من التطابق اللفظي — مولّدة من نص المصحف نفسه ويتحقق منها تلقائياً. اضغط موضعاً لعرض نظائره، أو اختبر نفسك.`,
          en: `${SIMILAR.length} word-identical verse groups — generated and verified from the mushaf itself.`,
        })}
      </p>

      {/* وضع الاختبار */}
      <Card className="mb-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-100">{L({ ar: 'اختبر نفسك', en: 'Quiz yourself' })}</p>
            <p className="text-[11px] text-slate-500">{L({ ar: '«أين هذه الآية؟» من بين أربع سور', en: '“Where is this verse?” — pick the surah' })}</p>
          </div>
          <button type="button" className="btn-primary !px-4 !py-2 text-xs" onClick={startQuiz}>
            {score.total > 0 ? L({ ar: 'سؤال جديد', en: 'New question' }) : L({ ar: 'ابدأ', en: 'Start' })}
          </button>
        </div>
        {score.total > 0 ? (
          <p className="mt-2 text-[11px] text-slate-500">
            {L({ ar: 'صحيحة:', en: 'Correct:' })} <span className="num text-emerald-300">{score.right}</span> / <span className="num">{score.total}</span>
          </p>
        ) : null}
        {quiz ? (
          <div className="mt-3 border-t border-white/5 pt-3">
            <p className="quran-text text-center text-lg leading-[2.1] text-slate-50">{SIMILAR[quiz.clusterIdx].preview}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {quiz.options.map((n) => {
                const s = nameOf(n)!;
                const isAnswer = SIMILAR[quiz.clusterIdx].positions[quiz.answerIdx][0] === n;
                const picked = quiz.picked === n;
                let cls = 'btn-ghost quran-text text-sm';
                if (quiz.picked !== null) {
                  if (isAnswer) cls = 'btn-ghost !border-emerald-400/50 !text-emerald-300';
                  else if (picked) cls = 'btn-ghost !border-rose-400/50 !text-rose-300';
                }
                return (
                  <button key={n} type="button" disabled={quiz.picked !== null} onClick={() => answerQuiz(n)} className={cls}>
                    {s.ar}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </Card>

      {/* قائمة المواضع */}
      <ol className="space-y-2">
        {SIMILAR.map((c, i) => (
          <li key={i}>
            <div className="card overflow-hidden">
              <button
                type="button"
                onClick={() => setOpen(open === i ? null : i)}
                aria-expanded={open === i}
                className="flex w-full items-center justify-between gap-3 p-3.5 text-start"
              >
                <span className="min-w-0 flex-1">
                  <span className="quran-text line-clamp-2 text-[15px] leading-7 text-slate-100">{c.preview}</span>
                  <span className="num mt-1 block text-[10px] text-slate-500">
                    {c.positions.map(([s, a]) => `${nameOf(s)?.ar ?? s} ${a}`).join(' · ')}
                  </span>
                </span>
                <span className="shrink-0 text-gold-400">{open === i ? '−' : '+'}</span>
              </button>
              {open === i ? (
                <div className="border-t border-white/5 p-3.5">
                  {loadingKey && c.positions.some(([s, a]) => `${s}:${a}` === loadingKey.split('|')[0]) ? (
                    <p className="text-[11px] text-slate-500">{L({ ar: 'يُحمَّل…', en: 'Loading…' })}</p>
                  ) : null}
                  <ul className="space-y-2">
                    {c.positions.map(([s, a]) => {
                      const view = ayahCache[`${s}:${a}`];
                      return (
                        <li key={`${s}:${a}`} className="rounded-lg border border-white/5 bg-white/[.03] p-2.5">
                          <Link to={`/quran/${s}/${a}`} className="block">
                            <span className="num text-[10px] text-gold-400">{nameOf(s)?.ar} {a} ‹</span>
                            <span className="quran-text mt-1 block text-sm leading-7 text-slate-100">{view?.text ?? '…'}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ol>

      <Ornament />
    </div>
  );
}

interface Quiz {
  clusterIdx: number;
  answerIdx: number;
  options: number[];
  picked: number | null;
}
