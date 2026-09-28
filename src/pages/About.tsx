import { Link } from 'react-router-dom';
import { useAsync, useL, useT } from '../lib/hooks';
import { getQuranMeta, getHadithIndex } from '../lib/content';
import { loadData } from '../lib/db';
import { Badge, Card, Loading, Ornament, Section } from '../components/ui';
import type { HadithBookMeta, QuranMeta } from '../lib/types';

interface Report {
  verifiedAt: string;
  adhkarChecked: number;
  adhkarResolved: number;
  adhkarProblems: Array<{ id: string; why: string; source?: string }>;
  namesTotal: number;
  namesWithQuran: number;
  policy: string;
}

interface GapBook { label: string; count: number; numbers: number[] }
interface Gaps {
  policy: string;
  source: string;
  books: Record<string, GapBook>;
}

export default function About() {
  const t = useT();
  const L = useL();
  const meta = useAsync<QuranMeta>(() => getQuranMeta(), []);
  const books = useAsync<HadithBookMeta[]>(() => getHadithIndex(), []);
  const report = useAsync<Report>(() => loadData('content-report.json'), []);
  const gaps = useAsync<Gaps>(() => loadData('gaps.json'), []);

  const clean = report.data ? report.data.adhkarProblems.length === 0 : false;

  return (
    <div className="animate-fade-in">
      <Section title={t('about')}>
        <Card>
          <div className="flex items-center gap-3">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-gold-300 to-gold-500 text-3xl font-bold text-ink-900">
              ن
            </span>
            <div>
              <h1 className="text-xl font-bold text-slate-100">{t('appName')}</h1>
              <p className="text-sm text-slate-400">{t('tagline')}</p>
            </div>
          </div>
          <Ornament />
          <p className="text-sm leading-relaxed text-slate-300">{t('contentPolicy')}</p>
        </Card>
      </Section>

      {/* القرآن */}
      <Section title={t('quran')}>
        {meta.loading ? <Loading /> : meta.data ? (
          <Card>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat n={meta.data.ayahCount.toLocaleString('en-US')} l={L({ ar: 'آية', en: 'verses' })} />
              <Stat n={String(meta.data.surahCount)} l={L({ ar: 'سورة', en: 'surahs' })} />
              <Stat n={String(meta.data.juzCount)} l={L({ ar: 'جزء', en: 'juzs' })} />
              <Stat n={String(meta.data.sajdaCount)} l={L({ ar: 'سجدة', en: 'sajdas' })} />
            </dl>
            <Ornament />
            <ul className="space-y-2.5">
              {Object.values(meta.data.editions).map((e) => (
                <li key={e.key} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-slate-200">{L(e.label)}</p>
                    <p className="truncate text-xs text-slate-500">{e.origin}</p>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-slate-500">
              {L({ ar: 'الترخيص:', en: 'License:' })} <span className="num">{meta.data.license}</span>
            </p>
          </Card>
        ) : null}
      </Section>

      {/* الحديث */}
      <Section title={t('hadith')}>
        {books.loading ? <Loading /> : books.data ? (
          <Card>
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="text-sm text-slate-300">
                {L({ ar: 'الإجمالي', en: 'Total' })}
              </span>
              <span className="num text-lg font-bold text-gold-300">
                {books.data.reduce((a, b) => a + b.count, 0).toLocaleString('en-US')}
              </span>
            </div>
            <ul className="space-y-2">
              {books.data.map((b) => (
                <li key={b.key} className="flex items-center justify-between gap-3 border-b border-white/5 pb-2 last:border-0">
                  <div className="min-w-0">
                    <Link to={`/hadith/${b.key}`} className="text-sm text-slate-200 hover:text-gold-300">
                      {L(b.label)}
                    </Link>
                    <p className="truncate text-xs text-slate-500">{L(b.author)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {b.grade === 'sahih' ? <Badge tone="green">{t('sahih')}</Badge> : <Badge>{L({ ar: 'مختلط', en: 'Mixed' })}</Badge>}
                    <span className="num text-xs text-slate-400">{b.count.toLocaleString('en-US')}</span>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </Section>

      {/* سياسة المصدر والنواقص */}
      <Section title={t('contentSources')}>
        <Card className="space-y-3">
          <p className="text-sm leading-relaxed text-slate-300">{t('contentPolicy')}</p>

          {report.data ? (
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-slate-200">
                  {L({ ar: 'فحص المحتوى', en: 'Content audit' })}
                </span>
                <Badge tone={clean ? 'green' : 'red'}>
                  {clean
                    ? L({ ar: 'لا أخطاء', en: 'No errors' })
                    : L({ ar: `${report.data.adhkarProblems.length} مشكلة`, en: `${report.data.adhkarProblems.length} problems` })}
                </Badge>
              </div>
              <p className="text-xs leading-relaxed text-slate-400">
                {L({ ar: 'فُحص كل ذكر وكل اسم: تأكد أن المرجع موجود في المصدر، وأن نص المصدر يحوي النص المطلوب، وأن الرقم المعروض يطابق المرجع الفعلي.' })}
              </p>
              <p className="num mt-1 text-[11px] text-slate-600">
                {report.data.adhkarResolved}/{report.data.adhkarChecked} {L({ ar: 'ذكراً', en: 'adhkar' })}
                {' · '}
                {report.data.namesWithQuran}/{report.data.namesTotal} {L({ ar: 'اسماً', en: 'names' })}
              </p>
            </div>
          ) : null}

          {gaps.data ? (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
              <p className="mb-2 text-xs leading-relaxed text-amber-200/90">{t('gapsNote')}</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(gaps.data.books).map(([key, b]) => (
                  <span key={key} className="chip">
                    {b.label} <span className="num opacity-70">{b.count}</span>
                  </span>
                ))}
                <span className="chip chip-active">
                  {L({ ar: 'الإجمالي', en: 'Total' })}{' '}
                  <span className="num">
                    {Object.values(gaps.data.books).reduce((a, b) => a + b.count, 0)}
                  </span>
                </span>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-amber-200/60">{gaps.data.policy}</p>
            </div>
          ) : null}
        </Card>
      </Section>

      <p className="pb-8 text-center text-xs leading-relaxed text-slate-500">{t('disclaimer')}</p>
    </div>
  );
}

function Stat({ n, l }: { n: string; l: string }) {
  return (
    <div className="rounded-xl bg-white/5 p-3 text-center">
      <p className="num text-lg font-bold text-gold-300">{n}</p>
      <p className="mt-0.5 text-[11px] text-slate-400">{l}</p>
    </div>
  );
}
