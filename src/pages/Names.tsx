/**
 * أسماء الله الحسنى المئة
 * ------------------------------------------------------------------
 * الاسم ومعناه من `src/data/adhkar.ts`، والآية التي ورد فيها الاسم
 * تُقرأ من المصحف عبر content.ts عند فتح اللوحة فقط — فالشبكة
 * نفسها بلا أي تحميل، والقارئ لا ينزّل المصحف إلا حين يطلب اسماً.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as RMouseEvent,
  type PointerEvent as RPointerEvent,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { getAyah, getSurahs } from '../lib/content';
import { useAsync, useDebounced, useL, useS, useT } from '../lib/hooks';
import { isArabicQuery, normalizeAr } from '../lib/normalize';
import { useSettings } from '../lib/store';
import type { NameOfGod } from '../lib/types';
import { Badge, Empty, ErrorBox, Ornament, Spinner } from '../components/ui';
import { CopyIcon, NamesIcon, SearchIcon } from '../components/icons';
import { NAMES } from '../data/adhkar';

interface NameRow {
  n: NameOfGod;
  /** الاسم مُوحَّداً للبحث العربي */
  arNorm: string;
  /** المعنى العربي مُوحَّداً للبحث */
  meaningArNorm: string;
  /** التسمية اللاتينية والمعنى الإنكليزيان للبحث اللاتيني */
  latin: string;
}

/** الترتيب تصاعدياً بالرقم، ويُبنى مرة واحدة عند تحميل الوحدة */
const ROWS: NameRow[] = [...NAMES]
  .sort((a, b) => a.n - b.n)
  .map((n) => ({
    n,
    arNorm: normalizeAr(n.ar),
    meaningArNorm: normalizeAr(n.meaning.ar),
    latin: `${n.trans} ${n.meaning.en}`.toLowerCase(),
  }));

/* ---------- خطّافات محلية ---------- */

/** رسالة قصيرة تظهر أسفل الشاشة */
function useToast() {
  const [msg, setMsg] = useState('');
  const timer = useRef<number | null>(null);
  const show = useCallback((m: string) => {
    setMsg(m);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMsg(''), 2200);
  }, []);
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );
  return { msg, show };
}

/** ضغط مطوّل: يفيد على الهاتف باللمس، وعلى الحاسوب بالضغط المستمر */
function useLongPress(onLong: () => void, ms = 500) {
  const timer = useRef<number | null>(null);
  const fired = useRef(false);
  const origin = useRef<{ x: number; y: number } | null>(null);

  const stop = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  useEffect(() => stop, [stop]);

  return {
    fired,
    handlers: {
      onPointerDown: (e: RPointerEvent<HTMLElement>) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        fired.current = false;
        origin.current = { x: e.clientX, y: e.clientY };
        stop();
        timer.current = window.setTimeout(() => {
          fired.current = true;
          onLong();
        }, ms);
      },
      onPointerMove: (e: RPointerEvent<HTMLElement>) => {
        const o = origin.current;
        if (!o) return;
        if (Math.abs(e.clientX - o.x) > 10 || Math.abs(e.clientY - o.y) > 10) stop();
      },
      onPointerUp: stop,
      onPointerLeave: stop,
      onPointerCancel: stop,
      onContextMenu: (e: RMouseEvent<HTMLElement>) => e.preventDefault(),
    },
  };
}

/* ---------- اللوحة المنبثقة ---------- */

function NameSheet({ row, onClose, notify }: { row: NameRow; onClose: () => void; notify: (m: string) => void }) {
  const t = useT();
  const S = useS();
  const L = useL();
  const nav = useNavigate();
  const [tafsir, setTafsir] = useState(false);
  const mushafSize = useSettings((s) => s.reading.fontSize);
  const { data: surahs } = useAsync(() => getSurahs(), [row.n.n]);

  const ref = row.n.quran;
  const { data: ayah, error, loading, reload } = useAsync(
    () => (ref ? getAyah(ref[0], ref[1]) : Promise.resolve(null)),
    [row.n.n],
  );

  const surah = ref ? surahs?.find((s) => s.n === ref[0]) : undefined;
  const fontSize = Math.min(34, Math.max(20, mushafSize));
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  async function copyName() {
    try {
      if (!navigator.clipboard?.writeText) {
        notify(S('الحافظة غير متاحة في هذا المتصفح', 'Clipboard unavailable in this browser'));
        return;
      }
      await navigator.clipboard.writeText(row.n.ar);
      notify(S('تم نسخ الاسم', 'Name copied'));
    } catch {
      notify(S('تعذّر نسخ الاسم', 'Could not copy the name'));
    }
  }

  function openSurah() {
    if (!ref) return;
    onClose();
    nav(`/quran/${ref[0]}/${ref[1]}`);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-ink-900/80 backdrop-blur-sm"
        onClick={onClose}
        aria-label={t('close')}
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={row.n.ar}
        className="animate-slide-up relative max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-white/10 bg-ink-800 p-5 outline-none sm:rounded-3xl"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="quran-text text-3xl leading-[1.9] text-gold-200">{row.n.ar}</h2>
            <p className="mt-0.5 text-xs text-slate-400" dir="auto">
              {row.n.trans}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              className="btn-subtle !px-1.5 !py-1.5"
              onClick={copyName}
              aria-label={t('copy')}
              title={t('copy')}
            >
              <CopyIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="btn-subtle !px-2 !py-1.5 text-xs"
              onClick={onClose}
              aria-label={t('close')}
            >
              ✕
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-white/5 bg-ink-900/50 p-3">
          <p className="label-ar mb-1">{t('meaning')}</p>
          <p className="text-sm leading-7 text-slate-200">{L(row.n.meaning)}</p>
        </div>

        <Ornament label={t('appearsIn')} />

        {ref ? (
          loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-xs text-slate-400">
              <Spinner className="h-4 w-4 text-gold-400" />
              {t('loading')}
            </div>
          ) : error ? (
            <ErrorBox error={error} onRetry={reload} />
          ) : !ayah ? (
            <Empty label={S('تعذّر تحديد موضع هذا الاسم', 'Location of this name not found')} icon="🔍" />
          ) : (
            <>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge tone="gold">
                  {t('surah')} {surah ? L(surah) : ''} <span className="num">{ref[0]}</span>
                </Badge>
                <Badge>
                  {t('verse')} <span className="num">{ref[1]}</span>
                </Badge>
              </div>
              <p
                className="quran-text rounded-xl border border-white/5 bg-ink-900/50 p-3 text-slate-100"
                style={{ fontSize }}
              >
                {ayah.text}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className="btn-ghost !py-2 text-xs" onClick={openSurah}>
                  {S('فتح السورة', 'Open surah')}
                </button>
                <button
                  type="button"
                  className={`chip ${tafsir ? 'chip-active' : ''}`}
                  onClick={() => setTafsir((v) => !v)}
                  aria-expanded={tafsir}
                >
                  {t('tafsir')}
                </button>
              </div>

              {tafsir ? (
                <div className="mt-3 rounded-xl border border-white/5 bg-ink-900/50 p-3">
                  <p className="mb-1 text-[11px] font-medium text-gold-300/80">{t('tafsirSource')}</p>
                  <p className="text-sm leading-7 text-slate-300">
                    {ayah.tafsir || S('لا يوجد نص تفسير لهذه الآية', 'No tafsir text for this verse')}
                  </p>
                </div>
              ) : null}
            </>
          )
        ) : (
          <Empty label={S('لا موضع قرآني مسجّل لهذا الاسم', 'No Quranic location recorded')} icon="📖" />
        )}
      </div>
    </div>
  );
}

/* ---------- الصفحة ---------- */

export default function Names() {
  const t = useT();
  const S = useS();
  const L = useL();
  const { msg, show } = useToast();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<NameRow | null>(null);
  const debounced = useDebounced(query, 200);
  const close = useCallback(() => setOpen(null), []);

  const filtered = useMemo(() => {
    const q = debounced.trim();
    if (!q) return ROWS;
    if (isArabicQuery(q)) {
      const nq = normalizeAr(q);
      return ROWS.filter((r) => r.arNorm.includes(nq) || r.meaningArNorm.includes(nq));
    }
    const nq = q.toLowerCase();
    return ROWS.filter((r) => r.latin.includes(nq));
  }, [debounced]);

  async function copyRow(row: NameRow) {
    try {
      if (!navigator.clipboard?.writeText) {
        show(S('الحافظة غير متاحة في هذا المتصفح', 'Clipboard unavailable in this browser'));
        return;
      }
      await navigator.clipboard.writeText(row.n.ar);
      show(S('تم نسخ الاسم', 'Name copied'));
    } catch {
      show(S('تعذّر نسخ الاسم', 'Could not copy the name'));
    }
  }

  return (
    <div>
      <header className="mb-4 flex items-center gap-2">
        <NamesIcon className="h-6 w-6 text-gold-400" />
        <h1 className="text-lg font-bold text-slate-100">{t('names')}</h1>
      </header>

      <div className="relative mb-2">
        <SearchIcon className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-slate-500" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={S('ابحث باسم أو معنى…', 'Search by name or meaning…')}
          aria-label={t('search')}
          className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pe-3 ps-9 text-sm text-slate-200 outline-none transition-colors placeholder:text-slate-500 focus:border-gold-400/50 focus:bg-white/10"
        />
      </div>

      <p className="mb-4 text-xs text-slate-500">
        {debounced.trim() ? (
          <>
            <span className="num">{filtered.length}</span> {S('اسماً معروضاً', 'names shown')}
          </>
        ) : (
          <>
            <span className="num">{ROWS.length}</span> {S('اسماً', 'names')}
          </>
        )}
        <span className="text-slate-600"> · </span>
        {S('اضغط مطوّلاً على أي اسم لنسخه', 'Press and hold a name to copy it')}
      </p>

      {filtered.length === 0 ? (
        <Empty label={t('noResults')} />
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {filtered.map((row) => (
            <NameCard key={row.n.n} row={row} L={L} onOpen={setOpen} onCopy={copyRow} />
          ))}
        </div>
      )}

      {open ? <NameSheet row={open} onClose={close} notify={show} /> : null}

      {msg ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-40 flex justify-center px-4">
          <p role="status" className="rounded-full bg-ink-700/95 px-4 py-2 text-xs text-gold-100 shadow-lg">
            {msg}
          </p>
        </div>
      ) : null}
    </div>
  );
}

/* ---------- بطاقة اسم ---------- */

function NameCard({
  row,
  L,
  onOpen,
  onCopy,
}: {
  row: NameRow;
  L: (v?: { ar?: string; en?: string } | null) => string;
  onOpen: (row: NameRow) => void;
  onCopy: (row: NameRow) => void;
}) {
  const press = useLongPress(() => onCopy(row));

  return (
    <button
      type="button"
      onClick={() => {
        if (press.fired.current) {
          press.fired.current = false;
          return;
        }
        onOpen(row);
      }}
      onPointerDown={press.handlers.onPointerDown}
      onPointerMove={press.handlers.onPointerMove}
      onPointerUp={press.handlers.onPointerUp}
      onPointerLeave={press.handlers.onPointerLeave}
      onPointerCancel={press.handlers.onPointerCancel}
      onContextMenu={press.handlers.onContextMenu}
      className="card flex flex-col items-center gap-1 p-3 text-center transition-transform active:scale-[.97]"
      aria-label={`${row.n.ar} — ${L(row.n.meaning)}`}
      title={row.n.trans}
    >
      <span className="num text-[10px] text-gold-500/70">{row.n.n}</span>
      <span className="quran-text w-full text-xl leading-[1.9] text-gold-100">{row.n.ar}</span>
      <span className="w-full truncate text-[10px] text-slate-500" dir="auto">
        {row.n.trans}
      </span>
      <span className="line-clamp-2 w-full text-[11px] leading-5 text-slate-400">{L(row.n.meaning)}</span>
    </button>
  );
}
