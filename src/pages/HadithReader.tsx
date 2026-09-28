/**
 * قارئ كتاب الحديث: الإسناد والمتن، والفلترة بالدرجة، والبحث داخل الكتاب.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { getHadith, getHadithIndex } from '../lib/content';
import type { Hadith, HadithBookMeta, GradeBase } from '../lib/types';
import { useAsync, useDebounced, useL, useT } from '../lib/hooks';
import { useSettings } from '../lib/store';
import { searchHadithLinear } from '../lib/search';
import { Badge, Empty, ErrorBox, Loading, Ornament } from '../components/ui';
import { BookmarkIcon, CopyIcon, HadithIcon, SearchIcon } from '../components/icons';

const PAGE_SIZE = 50;
const SEARCH_LIMIT = 100;

type View = 'full' | 'matn' | 'isnad';
type GradeFilter = 'all' | GradeBase;

const MESSAGES = {
  searchPlaceholder: { ar: 'ابحث داخل هذا الكتاب…', en: 'Search inside this collection…' },
  searchResults: { ar: 'نتائج البحث داخل الكتاب', en: 'Search results' },
  clearSearch: { ar: 'إلغاء البحث', en: 'Clear search' },
  showFull: { ar: 'النص كاملاً', en: 'Full text' },
  showMatn: { ar: 'المتن فقط', en: 'Matn only' },
  showIsnad: { ar: 'الإسناد فقط', en: 'Isnad only' },
  copied: { ar: 'تم نسخ الحديث', en: 'Hadith copied' },
  copyFail: { ar: 'تعذّر النسخ على هذا المتصفح', en: 'Copy is unavailable in this browser' },
  loadMore: { ar: 'تحميل المزيد', en: 'Load more' },
  remaining: { ar: 'متبقٍ', en: 'remaining' },
  shown: { ar: 'معروض', en: 'shown' },
  unsplit: { ar: 'لا علامات متن في هذا النص، فكامل الحديث كما هو', en: 'No matn marker in this text — showing it whole' },
  unknownBook: { ar: 'اسم الكتاب غير معروف', en: 'Unknown collection' },
  textMode: { ar: 'طريقة العرض', en: 'Text view' },
} as const;

type MsgKey = keyof typeof MESSAGES;

/* ---------- فصل الإسناد عن المتن ---------- */

/** يبني تعبيراً يتحمّل التشكيل: كل حرف يليه تشكيل اختياري */
function tolerant(phrase: string): RegExp {
  const parts = Array.from(phrase).map(
    (ch) => ch + '[\\u0610-\\u061A\\u064B-\\u0652\\u0670\\u06D6-\\u06ED]*',
  );
  return new RegExp(parts.join(''));
}

/** علامات تدل على بداية المتن في النص المُشكَّل */
const MATN_MARKERS: RegExp[] = [
  tolerant('قال رسول الله'),
  tolerant('قال رسولهم'),
  tolerant('قال النبي'),
  /«/,
  /“/,
  /؟/,
];

/**
 * يقتطع المتن من أول علامة ظاهرة. إن لم توجد علامة، أو كانت في غير موضعها
 * المعتاد، يُعيد النص كاملاً حتى لا يُفسَد شيء.
 */
function splitHadith(text: string): { isnad: string; matn: string } {
  const whole = { isnad: '', matn: text };
  if (!text) return whole;

  let best = -1;
  for (const re of MATN_MARKERS) {
    const m = re.exec(text);
    if (m && (best < 0 || m.index < best)) best = m.index;
  }
  if (best < 15 || best > text.length * 0.85) return whole;

  return { isnad: text.slice(0, best).trim(), matn: text.slice(best).trim() };
}

/* ---------- درجة الحديث ---------- */

function gradeLabel(g: GradeBase, t: (k: string) => string): string {
  if (g === 'sahih') return t('sahih');
  if (g === 'hasan') return t('hasan');
  if (g === 'daif') return t('daif');
  return t('unspecified');
}

function gradeTone(g: GradeBase): 'green' | 'gold' | 'red' | 'default' {
  if (g === 'sahih') return 'green';
  if (g === 'hasan') return 'gold';
  if (g === 'daif') return 'red';
  return 'default';
}

/* ---------- بطاقة الحديث ---------- */

function HadithCard({
  h,
  view,
  marked,
  onToggleMark,
  onCopy,
}: {
  h: Hadith;
  view: View;
  marked: boolean;
  onToggleMark: () => void;
  onCopy: () => void;
}) {
  const t = useT();
  const m = (k: MsgKey) => (t.lang === 'ar' ? MESSAGES[k].ar : MESSAGES[k].en);
  const parts = useMemo(() => splitHadith(h.t), [h.t]);
  const splittable = parts.isnad.length > 0;
  const body =
    !splittable || view === 'full'
      ? h.t
      : view === 'matn'
        ? parts.matn
        : parts.isnad;

  return (
    <article className="card p-4">
      <header className="mb-2 flex flex-wrap items-center gap-2">
        <span className="num rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-bold text-emerald-200">
          {t('hadithNo')} {h.n}
        </span>
        {h.b ? <span className="num text-[11px] text-slate-500">{h.b}</span> : null}
        <Badge tone={gradeTone(h.g)}>{gradeLabel(h.g, t)}</Badge>
        {h.gr.slice(0, 3).map((x, i) => (
          <Badge key={i}>
            {x.g} · {x.by}
          </Badge>
        ))}
      </header>

      <p className="quran-text text-lg leading-loose text-slate-100">{body}</p>

      {view !== 'full' && !splittable ? (
        <p className="mt-2 text-[11px] text-slate-500">{m('unsplit')}</p>
      ) : null}

      <footer className="mt-3 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          className={`btn-subtle !px-2 !py-1 text-[11px] ${marked ? 'text-gold-300' : ''}`}
          onClick={onToggleMark}
        >
          <BookmarkIcon className="h-3.5 w-3.5" filled={marked} />
          <span>{marked ? t('bookmarked') : t('bookmark')}</span>
        </button>
        <button type="button" className="btn-subtle !px-2 !py-1 text-[11px]" onClick={onCopy}>
          <CopyIcon className="h-3.5 w-3.5" />
          <span>{t('copy')}</span>
        </button>
      </footer>
    </article>
  );
}

/* ---------- الصفحة ---------- */

export default function HadithReader() {
  const t = useT();
  const L = useL();
  const nav = useNavigate();
  const params = useParams();
  const [sp] = useSearchParams();

  const m = (k: MsgKey) => (t.lang === 'ar' ? MESSAGES[k].ar : MESSAGES[k].en);

  const raw = params.book ?? '';
  const book = /^[a-z0-9_-]{1,32}$/i.test(raw) ? raw : '';
  const { data, error, loading, reload } = useAsync(async () => {
    if (!book) return { rows: [] as Hadith[], meta: null as HadithBookMeta | null };
    const [rows, index] = await Promise.all([getHadith(book), getHadithIndex()]);
    return { rows, meta: index.find((x) => x.key === book) ?? null };
  }, [book]);

  const rows = useMemo(() => data?.rows ?? [], [data]);
  const meta = data?.meta ?? null;

  const [q, setQ] = useState(sp.get('q') ?? '');
  const urlQ = sp.get('q') ?? '';
  const dq = useDebounced(q, 300);
  const term = dq.trim();

  /* البحث السريع في صفحة الفهرس يمرّر الكلمة هنا — نلتقطها عند تغيّر الرابط */
  useEffect(() => {
    setQ(urlQ);
  }, [urlQ, book]);

  const [grade, setGrade] = useState<GradeFilter>('all');
  const [view, setView] = useState<View>('full');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [toast, setToast] = useState<string | null>(null);

  const bookmarks = useSettings((s) => s.bookmarks);
  const toggleBookmark = useSettings((s) => s.toggleBookmark);
  const markedSet = useMemo(
    () => new Set(bookmarks.filter((b) => b.kind === 'hadith').map((b) => b.ref)),
    [bookmarks],
  );

  useEffect(() => {
    setLimit(PAGE_SIZE);
  }, [book, term, grade]);

  /* ---------- البحث داخل الكتاب ---------- */

  const found = useMemo(() => {
    if (term.length < 2) return null;
    return searchHadithLinear(rows, term, SEARCH_LIMIT);
  }, [rows, term]);

  /* ---------- الفلترة ---------- */

  const list = useMemo(() => {
    const base = found ? found.map((i) => rows[i]).filter(Boolean) : rows;
    const filtered = grade === 'all' ? base : base.filter((h) => h.g === grade);
    return filtered.slice(0, limit);
  }, [rows, found, grade, limit]);

  const afterFilter = useMemo(() => {
    const base = found ? found.map((i) => rows[i]).filter(Boolean) : rows;
    return grade === 'all' ? base.length : base.filter((h) => h.g === grade).length;
  }, [rows, found, grade]);

  const counts = useMemo(() => {
    const c: Record<GradeBase, number> = { sahih: 0, hasan: 0, daif: 0, unspecified: 0 };
    const base = found ? found.map((i) => rows[i]).filter(Boolean) : rows;
    for (const h of base) c[h.g] += 1;
    return c;
  }, [rows, found]);

  /* ---------- النسخ ---------- */

  const toastTimer = useRef<number | null>(null);
  const flash = (text: string) => {
    setToast(text);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2400);
  };

  useEffect(
    () => () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    },
    [],
  );

  const copy = async (text: string) => {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
      flash(m('copied'));
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.top = '-1000px';
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try {
        ok = document.execCommand('copy');
      } catch {
        ok = false;
      }
      document.body.removeChild(ta);
      flash(ok ? m('copied') : m('copyFail'));
    }
  };

  /* ---------- العرض ---------- */

  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (loading && !data) return <Loading label={t('loading')} />;

  if (data && !data.meta && rows.length === 0) {
    return (
      <div className="card p-8 text-center">
        <p className="text-sm text-slate-300">{m('unknownBook')}</p>
        <button type="button" className="btn-ghost mt-4" onClick={() => nav('/hadith')}>
          {t('back')}
        </button>
      </div>
    );
  }

  const gradeFilters: Array<[GradeFilter, string]> = [
    ['all', t('allGrades')],
    ['sahih', t('sahih')],
    ['hasan', t('hasan')],
    ['daif', t('daif')],
    ['unspecified', t('unspecified')],
  ];

  return (
    <div className="animate-fade-in">
      {/* رأس الكتاب */}
      <div className="card mb-4 p-4">
        <button
          type="button"
          className="btn-subtle mb-2 !px-2 !py-1 text-xs"
          onClick={() => nav('/hadith')}
        >
          {t('books')}
        </button>

        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-500/15 text-emerald-300">
            <HadithIcon className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold text-slate-100">{L(meta?.label)}</h1>
            <p className="mt-0.5 text-xs text-slate-400">{L(meta?.author)}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {meta?.death ? <Badge>{L(meta.death)}</Badge> : null}
              {meta ? (
                <Badge tone={meta.grade === 'sahih' ? 'green' : 'gold'}>
                  {meta.grade === 'sahih' ? t('sahih') : t('allGrades')}
                </Badge>
              ) : null}
              <Badge>
                <span className="num">{rows.length.toLocaleString('en-US')}</span>
                <span> {t('hadithNo')}</span>
              </Badge>
            </div>
          </div>
        </div>

        {meta?.note ? (
          <p className="mt-3 rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-xs leading-relaxed text-slate-400">
            {L(meta.note)}
          </p>
        ) : null}

        {meta && meta.gaps > 0 ? (
          <p className="mt-2 text-[11px] leading-relaxed text-amber-300/90">
            <span className="num">{meta.gaps.toLocaleString('en-US')}</span>{' '}
            {t('gapsNote')}
          </p>
        ) : null}
      </div>

      {/* البحث داخل الكتاب */}
      <div className="card mb-4 p-4">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute inset-y-0 start-3 my-auto h-5 w-5 text-slate-500" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={m('searchPlaceholder')}
            aria-label={t('search')}
            className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pe-3 ps-11 text-sm text-slate-200 outline-none transition-colors placeholder:text-slate-500 focus:border-gold-400/50 focus:bg-white/10"
          />
        </div>

        {term.length >= 2 ? (
          <p className="mt-2 text-[11px] text-slate-500">
            {m('searchResults')}: <span className="num">{(found?.length ?? 0)}</span>
          </p>
        ) : null}
      </div>

      {/* فلتر الدرجة */}
      <div className="mb-3 flex flex-wrap gap-2">
        {gradeFilters.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setGrade(key)}
            className={`chip active:scale-[.97] ${grade === key ? 'chip-active' : ''}`}
          >
            {label}
            {key !== 'all' ? <span className="num opacity-70">{counts[key]}</span> : null}
          </button>
        ))}
      </div>

      {/* طريقة العرض */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="label-ar">{m('textMode')}</span>
        {(
          [
            ['full', m('showFull')],
            ['matn', m('showMatn')],
            ['isnad', m('showIsnad')],
          ] as Array<[View, string]>
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setView(key)}
            className={`chip active:scale-[.97] ${view === key ? 'chip-active' : ''}`}
          >
            {label}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <Empty label={t('noResults')} />
      ) : (
        <div className="flex flex-col gap-3">
          {list.map((h) => (
            <HadithCard
              key={`${book}-${h.n}`}
              h={h}
              view={view}
              marked={markedSet.has(`${book}:${h.n}`)}
              onToggleMark={() =>
                toggleBookmark({
                  id: `hadith-${book}-${h.n}`,
                  kind: 'hadith',
                  ref: `${book}:${h.n}`,
                  label: `${L(meta?.label)} — ${h.n}`,
                })
              }
              onCopy={() => copy(h.t)}
            />
          ))}
        </div>
      )}

      {list.length < afterFilter ? (
        <div className="mt-5 flex justify-center">
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setLimit((n) => n + PAGE_SIZE)}
          >
            {m('loadMore')} · {m('remaining')}{' '}
            <span className="num">{afterFilter - list.length}</span>
          </button>
        </div>
      ) : null}

      <p className="mt-5 text-center text-[11px] text-slate-600">
        {m('shown')} <span className="num">{list.length}</span> /{' '}
        <span className="num">{afterFilter}</span>
      </p>

      {toast ? (
        <p className="no-print fixed inset-x-0 bottom-24 z-40 mx-auto w-fit rounded-xl border border-emerald-500/40 bg-ink-800 px-4 py-2 text-xs text-emerald-200 shadow-lg">
          {toast}
        </p>
      ) : null}

      <Ornament label={L(meta?.author)} />
    </div>
  );
}
