/**
 * فهرس كتب الحديث التسعة، مع بحث سريع يوديك إلى داخل الكتاب.
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getHadithIndex } from '../lib/content';
import { useAsync, useL, useT } from '../lib/hooks';
import type { HadithBookMeta } from '../lib/types';
import { Badge, ErrorBox, Loading, Ornament } from '../components/ui';
import { HadithIcon, SearchIcon } from '../components/icons';

const MESSAGES = {
  quickSearch: {
    ar: 'البحث السريع داخل الكتب',
    en: 'Quick search inside the collections',
  },
  quickHint: {
    ar: 'البحث يجري داخل كل كتاب بعد فتحه، فتُحمَّل طبعة واحدة في المرة الواحدة.',
    en: 'Search runs inside each collection once you open it, loading one edition at a time.',
  },
  openSearch: { ar: 'فتح للبحث', en: 'Open & search' },
  openBook: { ar: 'فتح الكتاب', en: 'Open' },
  gapOf: {
    ar: 'حديثاً ناقصاً في الطبعة المفتوحة — أُسقط وسُجّل رقمه بدل ملئه',
    en: 'missing in the open edition — dropped and logged rather than filled in',
  },
  placeholder: { ar: 'اكتب كلمة ثم افتح الكتاب', en: 'Type a word, then open a collection' },
  death: { ar: 'الوفاة', en: 'Died' },
  totals: { ar: 'أصلها', en: 'Source total' },
  collections: { ar: 'تسعة كتب', en: 'Nine collections' },
  searchingFor: { ar: 'للبحث عن', en: 'searching for' },
} as const;

type MsgKey = keyof typeof MESSAGES;

const fmt = (n: number) => n.toLocaleString('en-US');

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function BookCard({
  b,
  term,
  onOpen,
}: {
  b: HadithBookMeta;
  term: string;
  onOpen: () => void;
}) {
  const t = useT();
  const L = useL();
  const m = (k: MsgKey) => (t.lang === 'ar' ? MESSAGES[k].ar : MESSAGES[k].en);

  return (
    <article className="card p-4">
      <header className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-500/15 text-emerald-300">
          <HadithIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-slate-100">{L(b.label)}</h3>
          <p className="truncate text-xs text-slate-500">{L(b.author)}</p>
        </div>
        <Badge tone={b.grade === 'sahih' ? 'green' : 'gold'}>
          {b.grade === 'sahih' ? t('sahih') : t('allGrades')}
        </Badge>
      </header>

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs sm:grid-cols-4">
        <div className="min-w-0">
          <dt className="label-ar">{t('hadithNo')}</dt>
          <dd className="num text-slate-200">{fmt(b.count)}</dd>
        </div>
        <div className="min-w-0">
          <dt className="label-ar">{m('death')}</dt>
          <dd className="truncate text-slate-300">{L(b.death)}</dd>
        </div>
        <div className="min-w-0">
          <dt className="label-ar">{m('totals')}</dt>
          <dd className="num text-slate-300">{fmt(b.sourceCount)}</dd>
        </div>
        <div className="min-w-0">
          <dt className="label-ar">{t('size')}</dt>
          <dd className="num text-slate-300">{fmtBytes(b.bytes)}</dd>
        </div>
      </dl>

      {b.note ? (
        <p className="mt-3 rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-xs leading-relaxed text-slate-400">
          {L(b.note)}
        </p>
      ) : null}

      {b.gaps > 0 ? (
        <p className="mt-2 text-[11px] leading-relaxed text-amber-300/90">
          <span className="num">{fmt(b.gaps)}</span> {m('gapOf')}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" className={term ? 'btn-primary' : 'btn-ghost'} onClick={onOpen}>
          {term ? m('openSearch') : m('openBook')}
        </button>
        {term ? (
          <span className="text-[11px] text-slate-500">
            {m('searchingFor')} <span className="text-gold-300">«{term}»</span>
          </span>
        ) : null}
      </div>
    </article>
  );
}

export default function Hadith() {
  const t = useT();
  const L = useL();
  const nav = useNavigate();
  const m = (k: MsgKey) => (t.lang === 'ar' ? MESSAGES[k].ar : MESSAGES[k].en);

  const { data, error, loading, reload } = useAsync(() => getHadithIndex(), []);
  const books = useMemo(() => data ?? [], [data]);

  const [q, setQ] = useState('');
  const term = q.trim();

  const total = useMemo(() => books.reduce((s, b) => s + b.count, 0), [books]);
  const totalGaps = useMemo(() => books.reduce((s, b) => s + b.gaps, 0), [books]);

  const open = (key: string) =>
    nav(term ? `/hadith/${key}?q=${encodeURIComponent(term)}` : `/hadith/${key}`);

  if (error) return <ErrorBox error={error} onRetry={reload} />;

  return (
    <div className="animate-fade-in">
      <div className="card mb-4 flex items-center gap-3 p-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-500/15 text-emerald-300">
          <HadithIcon className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-semibold text-slate-100">{t('books')}</h1>
          <p className="text-xs text-slate-500">
            <span className="num">{books.length}</span> · <span className="num">{fmt(total)}</span>{' '}
            {t('hadithNo')}
          </p>
        </div>
      </div>

      <div className="card mb-4 p-4">
        <label className="label-ar mb-2 block">{m('quickSearch')}</label>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute inset-y-0 start-3 my-auto h-5 w-5 text-slate-500" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={m('placeholder')}
            aria-label={m('quickSearch')}
            className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pe-3 ps-11 text-sm text-slate-200 outline-none transition-colors placeholder:text-slate-500 focus:border-gold-400/50 focus:bg-white/10"
          />
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-slate-500">{m('quickHint')}</p>
      </div>

      {loading ? <Loading label={t('loading')} /> : null}

      {!loading ? (
        <div className="flex flex-col gap-3">
          {books.map((b) => (
            <BookCard key={b.key} b={b} term={term} onOpen={() => open(b.key)} />
          ))}
        </div>
      ) : null}

      {totalGaps > 0 ? (
        <p className="mt-4 text-[11px] leading-relaxed text-slate-500">{t('gapsNote')}</p>
      ) : null}

      <Ornament label={L({ ar: MESSAGES.collections.ar, en: MESSAGES.collections.en })} />
    </div>
  );
}
