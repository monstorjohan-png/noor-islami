import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAsync, useDebounced, useL, useT } from '../lib/hooks';
import {
  getAyahRow,
  getHadith,
  getHadithIndex,
  getQuranSearchIndex,
  getSurahs,
  makeReverseMap,
  getOffsets,
} from '../lib/content';
import type { SearchRow } from '../lib/content';
import { buildQuranIndexFromSearch, searchHadithLinear, searchQuran, searchQuranLinearSearch, highlight } from '../lib/search';
import type { Surah } from '../lib/types';
import { Badge, Empty, ErrorBox, Loading, Section } from '../components/ui';

type Tab = 'quran' | 'hadith';

interface QuranHit { gi: number; s: number; a: number; text: string }
interface HadithHit { book: string; n: number; text: string; grade: string }

type TFn = (k: string) => string;
type LFn = (v?: { ar?: string; en?: string } | null) => string;

/** يُبرز مقاطع الاستعلام داخل النص */
function Marked({ text, query }: { text: string; query: string }) {
  return (
    <>
      {highlight(text, query).map((seg, i) =>
        seg.hit ? <mark key={i} className="rounded bg-gold-400/30 text-gold-100">{seg.t}</mark> : <span key={i}>{seg.t}</span>,
      )}
    </>
  );
}

export default function Search() {
  const t = useT();
  const L = useL();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const [tab, setTab] = useState<Tab>('quran');
  const [book, setBook] = useState('');
  const debounced = useDebounced(q, 280);

  // فهرس البحث يُحمَّل مرة واحدة عند أول بحث فقط — لا مسبقاً
  const [rows, setRows] = useState<SearchRow[] | null>(null);
  const [rowsError, setRowsError] = useState<Error | null>(null);
  useEffect(() => {
    if (rows || rowsError || !debounced.trim()) return;
    let alive = true;
    getQuranSearchIndex()
      .then((r) => {
        if (!alive) return;
        setRows(r);
        buildQuranIndexFromSearch(r);
      })
      .catch((e) => { if (alive) setRowsError(e instanceof Error ? e : new Error(String(e))); });
    return () => { alive = false; };
  }, [debounced, rows, rowsError]);

  const surahs = useAsync<Surah[]>(() => getSurahs(), []);
  const books = useAsync(() => getHadithIndex(), []);
  const offsets = useAsync<number[]>(() => getOffsets(), []);

  /** مواضع النتائج: تُحسب من الفهرس الخفيف، ثم يُجلب نص الآية من شريحتها */
  const qHits = useAsync<QuranHit[]>(async () => {
    const query = debounced.trim();
    if (!query || !rows || !surahs.data || !offsets.data) return [];
    // الفهرس المقلوب أولاً، ثم بحث خطّي على حقل الهيكل يلتقط ما فاته
    let ids = searchQuran(query, 150);
    if (ids.length < 5) {
      const extra = searchQuranLinearSearch(rows, query, 150);
      ids = Array.from(new Set([...ids, ...extra]));
    }
    const rev = makeReverseMap(offsets.data, rows.length);
    const top = ids.slice(0, 150);
    return Promise.all(
      top.map(async (gi) => {
        const [s, a] = rev(gi);
        const row = await getAyahRow(gi);
        return { gi, s, a, text: row?.[0] ?? '' };
      }),
    );
  }, [debounced, rows, surahs.data, offsets.data]);

  const hHits = useAsync<HadithHit[]>(async () => {
    const query = debounced.trim();
    if (!query || !book) return [];
    const hs = await getHadith(book);
    return searchHadithLinear(hs, query, 100).map((i) => ({
      book, n: hs[i].n, text: hs[i].t, grade: hs[i].g,
    }));
  }, [book, debounced]);

  const surahName = (n: number) => surahs.data?.find((s) => s.n === n)?.ar ?? '';

  return (
    <div className="animate-fade-in">
      <Section
        title={t('search')}
        action={
          <div className="flex gap-1.5">
            <TabBtn active={tab === 'quran'} onClick={() => setTab('quran')}>{t('quran')}</TabBtn>
            <TabBtn active={tab === 'hadith'} onClick={() => setTab('hadith')}>{t('hadith')}</TabBtn>
          </div>
        }
      >
        <input
          type="search"
          autoFocus
          value={q}
          onChange={(e) => setParams({ q: e.target.value }, { replace: true })}
          placeholder={t('searchPlaceholder')}
          aria-label={t('search')}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-base text-slate-100 outline-none placeholder:text-slate-500 focus:border-gold-400/50"
        />
      </Section>

      {!debounced.trim() ? (
        <Empty label={t('searchPlaceholder')} icon="🔎" />
      ) : tab === 'quran' ? (
        rowsError ? (
          <ErrorBox error={rowsError} onRetry={() => setRowsError(null)} />
        ) : !rows || surahs.loading ? (
          <Loading />
        ) : qHits.error ? (
          <ErrorBox error={qHits.error} onRetry={qHits.reload} />
        ) : !qHits.data?.length ? (
          <Empty label={t('noResults')} />
        ) : (
          <Section title={`${qHits.data.length} ${t('results')}`}>
            <ul className="space-y-2.5">
              {qHits.data.map((h) => (
                <li key={h.gi}>
                  <Link to={`/quran/${h.s}/${h.a}`} className="card block p-4 transition-colors hover:border-gold-400/30">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Badge tone="gold">{surahName(h.s)}</Badge>
                      <Badge>{t('verse')} <span className="num">{h.a}</span></Badge>
                    </div>
                    <p className="quran-text text-ink-50 text-lg leading-[2.1]">
                      <Marked text={h.text} query={debounced} />
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        )
      ) : (
        <HadithTab
          books={books.data ?? []}
          book={book}
          setBook={setBook}
          hits={hHits.data ?? []}
          loading={hHits.loading}
          error={hHits.error}
          reload={hHits.reload}
          query={debounced}
          t={t}
          L={L}
        />
      )}
    </div>
  );
}

function HadithTab({
  books, book, setBook, hits, loading, error, reload, query, t, L,
}: {
  books: Array<{ key: string; label: { ar: string; en: string }; count: number }>;
  book: string; setBook: (v: string) => void;
  hits: HadithHit[]; loading: boolean; error: Error | null; reload: () => void;
  query: string; t: TFn; L: LFn;
}) {
  if (!books.length) return <Loading />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;

  return (
    <>
      <Section title={t('books')}>
        <div className="flex flex-wrap gap-1.5">
          {books.map((b) => (
            <button
              key={b.key}
              type="button"
              onClick={() => setBook(book === b.key ? '' : b.key)}
              className={book === b.key ? 'chip chip-active' : 'chip'}
            >
              {L(b.label)}
              <span className="num opacity-60">{b.count.toLocaleString('en-US')}</span>
            </button>
          ))}
        </div>
      </Section>

      {!book ? (
        <Empty label={t('books')} icon="📚" />
      ) : loading ? (
        <Loading />
      ) : !hits.length ? (
        <Empty label={t('noResults')} />
      ) : (
        <Section title={`${hits.length} ${t('results')}`}>
          <ul className="space-y-2.5">
            {hits.map((h) => (
              <li key={`${h.book}-${h.n}`}>
                <Link to={`/hadith/${h.book}?n=${h.n}`} className="card block p-4 transition-colors hover:border-emerald-500/30">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge tone="green">{t('hadithNo')} <span className="num">{h.n}</span></Badge>
                    <GradeBadge g={h.grade} t={t} />
                  </div>
                  <p className="text-ink-100 text-[15px] leading-[2]">
                    <Marked text={h.text} query={query} />
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" onClick={() => onClick()} className={active ? 'chip chip-active' : 'chip'}>{children}</button>;
}

export function GradeBadge({ g, t }: { g: string; t: TFn }) {
  const key = g === 'sahih' ? 'sahih' : g === 'hasan' ? 'hasan' : g === 'daif' ? 'daif' : 'unspecified';
  const tone = g === 'sahih' ? 'green' : g === 'daif' ? 'red' : g === 'hasan' ? 'gold' : 'default';
  return <Badge tone={tone}>{t(key)}</Badge>;
}
