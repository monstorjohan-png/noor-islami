/**
 * فهرس المصحف: السور والمجلدات والصفحات، مع بحث سريع في الآيات.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getQuran, getQuranMeta, getSurahs } from '../lib/content';
import { useAsync, useDebounced, useL, useT } from '../lib/hooks';
import { useSettings } from '../lib/store';
import {
  buildQuranIndexFrom,
  highlight,
  searchQuran,
  searchQuranLinear,
} from '../lib/search';
import { Badge, Empty, ErrorBox, Loading, Ornament } from '../components/ui';
import { QuranIcon, SearchIcon } from '../components/icons';
import type { Surah } from '../lib/types';

type Tab = 'surahs' | 'juzs' | 'pages';

type Hit = { s: number; a: number; text: string };

const MAX_HITS = 40;
const SNIPPET = 190;

/**
 * فهرس عكسي من رقم الآية العام إلى (سورة، آية).
 * نبنيه هنا من عدد آيات كل سورة مباشرة، لأن خريطة content.ts تفترض
 * فهرساً بعد السورة الأخيرة فيحسب طولها بواحدة فتفقد سورة الناس آياتها.
 */
function buildReverse(list: Surah[]): (gi: number) => [number, number] {
  const pairs: Array<[number, number, number]> = [];
  let acc = 0;
  for (const s of list) {
    pairs.push([s.n, acc, s.verses]);
    acc += s.verses;
  }
  return (gi) => {
    let lo = 0;
    let hi = pairs.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const p = pairs[mid];
      if (gi < p[1]) hi = mid - 1;
      else if (gi >= p[1] + p[2]) lo = mid + 1;
      else return [p[0], gi - p[1] + 1];
    }
    return [1, 1];
  };
}

/** يقتطع مقطعاً حول أول موضع مطابق حتى لا يضيع في الآيات الطويلة */
function windowAround(text: string, query: string): string {
  const segs = highlight(text, query);
  let acc = 0;
  for (const s of segs) {
    if (s.hit) {
      const start = Math.max(0, acc - 50);
      return text.slice(start, start + SNIPPET);
    }
    acc += s.t.length;
  }
  return text.slice(0, SNIPPET);
}

function Marked({ text, query }: { text: string; query: string }) {
  return (
    <>
      {highlight(text, query).map((s, i) =>
        s.hit ? (
          <mark key={i} className="rounded bg-gold-400/30 px-0.5 text-gold-100">
            {s.t}
          </mark>
        ) : (
          <span key={i}>{s.t}</span>
        ),
      )}
    </>
  );
}

/* ---------- بطاقة سورة ---------- */

function SurahCard({ s, onOpen }: { s: Surah; onOpen: () => void }) {
  const t = useT();
  const meccan = s.place === 'Mecca';
  const juz =
    s.juzFrom === s.juzTo
      ? String(s.juzFrom)
      : `${s.juzFrom}–${s.juzTo}`;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="card flex w-full items-start gap-3 p-3 text-start transition-colors hover:border-gold-400/30 active:scale-[.98]"
    >
      <span className="num grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-gold-400/30 bg-gold-400/10 text-sm font-bold text-gold-200">
        {s.n}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className="quran-text text-lg leading-tight text-slate-100">{s.ar}</span>
          <span className="truncate text-xs text-slate-500">{s.arSimple}</span>
        </span>
        <span dir="ltr" className="mt-0.5 block truncate text-start text-xs text-slate-400">
          {s.en}
        </span>
        <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <Badge tone={meccan ? 'gold' : 'green'}>{meccan ? t('makki') : t('madani')}</Badge>
          <Badge>
            <span className="num">{s.verses}</span>
            <span> {t('verses')}</span>
          </Badge>
          <Badge>
            <span>{t('juz')} </span>
            <span className="num">{juz}</span>
          </Badge>
          <Badge>
            <span>{t('page')} </span>
            <span className="num">{s.startPage}</span>
          </Badge>
        </span>
      </span>
    </button>
  );
}

/* ---------- الصفحة ---------- */

export default function Quran() {
  const t = useT();
  const L = useL();
  const nav = useNavigate();
  const lastSurah = useSettings((s) => s.reading.lastSurah);
  const lastAyah = useSettings((s) => s.reading.lastAyah);

  const { data, error, loading, reload } = useAsync(
    () => Promise.all([getSurahs(), getQuranMeta()]),
    [],
  );
  const surahs = useMemo(() => data?.[0] ?? [], [data]);
  const meta = data?.[1] ?? null;
  const pageCount = meta?.pageCount ?? 604;
  const rev = useMemo(() => buildReverse(surahs), [surahs]);

  const [tab, setTab] = useState<Tab>('surahs');
  const [q, setQ] = useState('');
  const dq = useDebounced(q, 320);
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const indexed = useRef(false);

  /* بحث نصي في المصحف — يُبنى الفهرس مرة واحدة ثم يعود للبحث الخطي إن لم يجد */
  useEffect(() => {
    const term = dq.trim();
    if (term.length < 2) {
      setHits(null);
      setSearching(false);
      return;
    }
    let alive = true;
    setSearching(true);

    (async () => {
      try {
        const rows = await getQuran();
        if (!alive) return;

        let idx: number[];
        if (!indexed.current) {
          buildQuranIndexFrom(rows);
          indexed.current = true;
        }
        idx = searchQuran(term, MAX_HITS);
        if (idx.length === 0) idx = searchQuranLinear(rows, term, MAX_HITS);
        if (!alive) return;

        const safe = idx.filter((i) => i >= 0 && i < rows.length);
        setHits(
          safe.map((i) => {
            const [s, a] = rev(i);
            return { s, a, text: rows[i][0] };
          }),
        );
      } catch {
        if (alive) setHits([]);
      } finally {
        if (alive) setSearching(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [dq, rev]);

  const byNumber = useMemo(() => {
    const m = new Map<number, Surah>();
    for (const s of surahs) m.set(s.n, s);
    return m;
  }, [surahs]);

  /* نطاق كل جزء: من أول سورة فيه إلى آخر سورة فيه */
  const juzRange = useMemo(() => {
    const m = new Map<number, { from: Surah | null; to: Surah | null }>();
    for (let j = 1; j <= 30; j++) m.set(j, { from: null, to: null });
    for (const s of surahs) {
      for (let j = s.juzFrom; j <= s.juzTo && j <= 30; j++) {
        const e = m.get(j);
        if (!e) continue;
        if (!e.from) e.from = s;
        e.to = s;
      }
    }
    return m;
  }, [surahs]);

  /* السور التي تبدأ في كل صفحة */
  const pageStart = useMemo(() => {
    const m = new Map<number, Surah>();
    for (const s of surahs) if (!m.has(s.startPage)) m.set(s.startPage, s);
    return m;
  }, [surahs]);

  const term = dq.trim();
  const last = byNumber.get(lastSurah) ?? surahs[0] ?? null;

  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (loading && !data) return <Loading label={t('loading')} />;

  return (
    <div className="animate-fade-in">
      {/* متابعة القراءة */}
      <div className="card mb-5 flex items-center gap-3 p-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gold-400/15 text-gold-300">
          <QuranIcon className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="label-ar">{t('continueReading')}</p>
          <p className="quran-text truncate text-base text-slate-100">
            {last ? last.ar : t('quran')}
          </p>
        </div>
        <button
          type="button"
          className="btn-primary shrink-0"
          onClick={() => nav(`/quran/${lastSurah}/${lastAyah || 1}`)}
        >
          {t('next')}
        </button>
      </div>

      {/* بحث سريع */}
      <div className="relative mb-5">
        <SearchIcon className="pointer-events-none absolute inset-y-0 start-3 my-auto h-5 w-5 text-slate-500" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('searchPlaceholder')}
          aria-label={t('search')}
          className="w-full rounded-2xl border border-white/10 bg-white/5 py-3 pe-3 ps-11 text-sm text-slate-200 outline-none transition-colors placeholder:text-slate-500 focus:border-gold-400/50 focus:bg-white/10"
        />
      </div>

      {term.length >= 2 ? (
        <section className="mb-6">
          <header className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-100">{t('results')}</h2>
            {!searching && hits ? (
              <span className="num text-xs text-slate-500">{hits.length}</span>
            ) : null}
          </header>

          {searching ? <Loading label={t('loading')} /> : null}

          {!searching && hits && hits.length === 0 ? (
            <Empty label={t('noResults')} />
          ) : null}

          {!searching && hits && hits.length > 0 ? (
            <div className="flex flex-col gap-2">
              {hits.map((h) => {
                const s = byNumber.get(h.s);
                return (
                  <button
                    key={`${h.s}:${h.a}`}
                    type="button"
                    onClick={() => nav(`/quran/${h.s}/${h.a}`)}
                    className="card p-3 text-start transition-colors hover:border-gold-400/30 active:scale-[.98]"
                  >
                    <span className="mb-1 flex items-center gap-2">
                      <span className="num text-xs font-semibold text-gold-300">{h.s}</span>
                      <span className="quran-text text-sm text-slate-200">{s ? s.ar : ''}</span>
                      <span className="num text-xs text-slate-500">
                        {h.s}:{h.a}
                      </span>
                    </span>
                    <span className="quran-text block text-base leading-loose text-slate-100">
                      <Marked text={windowAround(h.text, term)} query={term} />
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </section>
      ) : (
        <>
          {/* التبويبات */}
          <div className="mb-5 flex flex-wrap gap-2">
            {(
              [
                ['surahs', t('surahs')],
                ['juzs', t('juzList')],
                ['pages', t('page')],
              ] as Array<[Tab, string]>
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`chip transition-colors active:scale-[.97] ${
                  tab === key ? 'chip-active' : ''
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'surahs' ? (
            <div className="flex flex-col gap-2">
              {surahs.map((s) => (
                <SurahCard key={s.n} s={s} onOpen={() => nav(`/quran/${s.n}`)} />
              ))}
            </div>
          ) : null}

          {tab === 'juzs' ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {Array.from({ length: 30 }, (_, i) => i + 1).map((n) => {
                const r = juzRange.get(n);
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => nav(`/quran/1?juz=${n}`)}
                    className="card flex flex-col items-center gap-1 p-3 transition-colors hover:border-gold-400/30 active:scale-[.97]"
                  >
                    <span className="num grid h-9 w-9 place-items-center rounded-full border border-gold-400/30 bg-gold-400/10 text-sm font-bold text-gold-200">
                      {n}
                    </span>
                    <span className="text-xs font-medium text-slate-200">{t('juz')}</span>
                    {r?.from && r.to ? (
                      <span className="line-clamp-2 text-center text-[11px] leading-tight text-slate-500">
                        {r.from.arSimple}
                        {r.from.n !== r.to.n ? ` – ${r.to.arSimple}` : ''}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : null}

          {tab === 'pages' ? (
            <div>
              <p className="label-ar mb-3">
                {t('page')} <span className="num">1</span> – <span className="num">{pageCount}</span>
              </p>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => {
                  const s = pageStart.get(n);
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => nav(`/quran/1?page=${n}`)}
                      title={s ? s.arSimple : undefined}
                      className={`num rounded-xl border py-2 text-sm transition-colors active:scale-[.97] ${
                        s
                          ? 'border-gold-400/30 bg-gold-400/10 text-gold-200'
                          : 'border-white/10 bg-white/5 text-slate-300'
                      }`}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </>
      )}

      <Ornament label={L(meta?.editions.text?.label)} />
    </div>
  );
}
