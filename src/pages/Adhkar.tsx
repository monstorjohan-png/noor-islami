/**
 * الأذكار
 * ------------------------------------------------------------------
 * قاعدة العرض: النص المقروء هو النص الأصلي من المصدر — مصحف أو حديث —
 * يُقرأ عبر مكتبة المحتوى، أمّا حقل الوصف المختصر فيظهر عنواناً للبطاقة فقط.
 * التحميل كسول: لا يُطلب المصحف ولا كتاب حديث إلا حين تقترب البطاقة
 * من الشاشة، فبقيّة التصفح لا تُحمّل عشرات الميغابايتات دفعة واحدة.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { getAyah, getHadith, type AyahView } from '../lib/content';
import { useAsync, useL, useT } from '../lib/hooks';
import { useSettings } from '../lib/store';
import type { AdhkarGroup, AdhkarItem, Hadith } from '../lib/types';
import { Badge, Card, ErrorBox, ProgressBar, Section, Spinner } from '../components/ui';
import { AdhkarIcon, BookmarkIcon, CopyIcon, ShareIcon } from '../components/icons';
import { ADHKAR } from '../data/adhkar';

/* ---------- ثوابت ---------- */

/** يُفترض هذا العدد إن غاب `count` من البيانات */
const DEFAULT_COUNT = 33;

/** نوافذ التوقيت بالساعة المحلية: الفجر إلى الشروق، والعصر إلى المغرب */
const MORNING_FROM = 4;
const MORNING_TO = 7;
const EVENING_FROM = 15;
const EVENING_TO = 19;

/** حدّا حجم خط الآية حتى يبقى النص مقروءاً داخل بطاقة ضيّقة */
const FONT_MIN = 20;
const FONT_MAX = 34;

type LoadedText = { kind: 'quran'; ayah: AyahView } | { kind: 'hadith'; hadith: Hadith };

/* ---------- أدوات محلّية ---------- */

/** تاريخ اليوم بصيغة سنة-شهر-يوم، يُحفظ في مفتاح تخزين مستقل */
function todayKey(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const DAY_KEY = 'noor-adhkar-day';

/**
 * يوم التقدّم المخزّن، أو null إن لم يُحفظ بعد.
 * القيمة تُتحقّق من شكلها: أي نص محرَّب في التخزين المحلي يُهمَل
 * ويُعيد التصفير من جديد، ولا يمرّ إلى منطق العرض.
 */
function storedDay(): string | null {
  try {
    const v = localStorage.getItem(DAY_KEY);
    return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
  } catch {
    return null;
  }
}

/** يحفظ يوم التقدّم في مفتاح مستقل — لا يلوّث سجلّ الأعداد الرقمي */
function saveDay(day: string): void {
  try {
    localStorage.setItem(DAY_KEY, day);
  } catch {
    /* التخزين غير متاح — يستمر التصفير كل جلسة */
  }
}

function hourOfDay(): number {
  const d = new Date();
  return d.getHours() + d.getMinutes() / 60;
}

function targetOf(item: AdhkarItem): number {
  return item.count && item.count > 0 ? item.count : DEFAULT_COUNT;
}

function readCount(progress: Record<string, unknown>, id: string): number | null {
  const v = progress[id];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** المتبقّي من تكرار الذكر، محسوماً بين ما هو محفوظ وما هو في البيانات */
function remainingOf(progress: Record<string, unknown>, item: AdhkarItem): number {
  const target = targetOf(item);
  const v = readCount(progress, item.id);
  if (v === null) return target;
  return Math.min(target, Math.max(0, Math.round(v)));
}

/** اقتراح مجموعة واحدة فقط حسب الوقت، أو لا اقتراح */
function suggestGroupId(hours: number): string | null {
  if (hours >= MORNING_FROM && hours < MORNING_TO) return 'morning';
  if (hours >= EVENING_FROM && hours < EVENING_TO) return 'evening';
  return null;
}

async function loadItemText(item: AdhkarItem): Promise<LoadedText> {
  const q = item.quran;
  if (q) {
    const ayah = await getAyah(q[0], q[1]);
    if (!ayah) throw new Error(`تعذّر جلب الآية — ${item.ref}`);
    return { kind: 'quran', ayah };
  }
  const hd = item.hadith;
  if (hd) {
    const rows = await getHadith(hd[0]);
    const found = rows.find((r) => r.n === hd[1]);
    if (!found) throw new Error(`تعذّر جلب الحديث — ${item.ref}`);
    return { kind: 'hadith', hadith: found };
  }
  throw new Error('لا يوجد مصدر نصي لهذا الذكر');
}

/* ---------- خطّافات صغيرة ---------- */

/** نصوص الصفحة نفسها بلغتيها، تفادياً لملف ترجمة مشترك مع الوكلاء */
function useS() {
  const t = useT();
  return useCallback((ar: string, en: string) => (t.lang === 'ar' ? ar : en), [t]);
}

/** ساعة اليوم، تتحدّث كل دقيقة لإحياء الاقتراح عند تغيّر الوقت */
function useNowHours(): number {
  const [h, setH] = useState(hourOfDay);
  useEffect(() => {
    const id = window.setInterval(() => setH(hourOfDay()), 60000);
    return () => window.clearInterval(id);
  }, []);
  return h;
}

/** هل ظهرت البطاقة قرب الشاشة — لتأجيل تحميل نصّها */
function useNear(): [RefObject<HTMLDivElement>, boolean] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setNear(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: '320px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, near];
}

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

/* ---------- بطاقة الذكر ---------- */

function ItemCard({ item, notify }: { item: AdhkarItem; notify: (m: string) => void }) {
  const t = useT();
  const S = useS();

  const [wrapRef, near] = useNear();
  const { data, error, reload } = useAsync<LoadedText | null>(
    () => (near ? loadItemText(item) : Promise.resolve(null)),
    [item.id, near],
  );
  const [tafsir, setTafsir] = useState(false);

  const progress = useSettings((s) => s.adhkarProgress) ?? {};
  const setProgress = useSettings((s) => s.setAdhkarProgress);
  const isBookmarked = useSettings((s) => s.isBookmarked);
  const toggleBookmark = useSettings((s) => s.toggleBookmark);
  const mushafSize = useSettings((s) => s.reading.fontSize);

  const target = targetOf(item);
  const left = remainingOf(progress, item);
  const isDone = left === 0;
  const bookmarkRef = `adhkar:${item.id}`;
  const saved = isBookmarked('ayah', bookmarkRef);
  const fontSize = Math.min(FONT_MAX, Math.max(FONT_MIN, mushafSize));

  const copyText = useMemo(() => {
    const base =
      data?.kind === 'quran' ? data.ayah.text : data?.kind === 'hadith' ? data.hadith.t : item.ar;
    return `${base}\n\n(${item.ref})`;
  }, [data, item.ar, item.ref]);

  function tap() {
    if (left <= 0) return;
    setProgress(item.id, left - 1);
    try {
      navigator.vibrate?.(15);
    } catch {
      notify(S('الاهتزاز غير متاح على هذا الجهاز', 'Vibration is not available here'));
    }
  }

  async function onCopy() {
    try {
      if (!navigator.clipboard?.writeText) {
        notify(S('الحافظة غير متاحة في هذا المتصفح', 'Clipboard unavailable in this browser'));
        return;
      }
      await navigator.clipboard.writeText(copyText);
      notify(S('تم نسخ الذكر', 'Dhikr copied'));
    } catch {
      notify(S('تعذّر نسخ الذكر', 'Could not copy the dhikr'));
    }
  }

  async function onShare() {
    try {
      if (!navigator.share) {
        await onCopy();
        return;
      }
      await navigator.share({ title: item.ar, text: copyText });
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') notify(S('أُلغيت المشاركة', 'Share cancelled'));
      else notify(S('تعذّرت المشاركة', 'Sharing failed'));
    }
  }

  function body() {
    if (!near) {
      return (
        <div className="py-3 text-center text-xs text-slate-600">
          {S('يظهر النص عند التمرير إليه', 'Text loads as you reach it')}
        </div>
      );
    }
    if (error) return <ErrorBox error={error} onRetry={reload} />;
    // لا نصّ بعد: إما أن التحميل جارٍ أو لم يبدأ بعد هذه الصورة
    if (!data) {
      return (
        <div className="flex items-center justify-center gap-2 py-6 text-xs text-slate-400">
          <Spinner className="h-4 w-4 text-gold-400" />
          {t('loading')}
        </div>
      );
    }
    return (
      <>
        {data.kind === 'quran' ? (
          <p className="quran-text text-slate-100" style={{ fontSize }}>
            {data.ayah.text}
          </p>
        ) : (
          <p className="text-sm leading-8 text-slate-200">{data.hadith.t}</p>
        )}

        {data.kind === 'quran' ? (
          <div className="mt-3">
            <button
              type="button"
              className={`chip ${tafsir ? 'chip-active' : ''}`}
              onClick={() => setTafsir((v) => !v)}
              aria-expanded={tafsir}
            >
              {t('tafsir')}
            </button>
            {tafsir ? (
              <div className="mt-2 rounded-xl border border-white/5 bg-ink-900/60 p-3">
                <p className="mb-1 text-[11px] font-medium text-gold-300/80">{t('tafsirSource')}</p>
                <p className="text-sm leading-7 text-slate-300">
                  {data.ayah.tafsir || S('لا يوجد نص تفسير لهذه الآية', 'No tafsir text for this verse')}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
      </>
    );
  }

  return (
    <div
      ref={wrapRef}
      className={`card p-4 transition-colors ${isDone ? 'border-gold-400/40 bg-gold-400/[0.07]' : ''}`}
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium leading-6 text-slate-200">{item.ar}</p>
          {item.meaning ? (
            <p className="mt-1 text-xs leading-6 text-slate-400">
              {t('meaning')}: {item.meaning}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            className="btn-subtle !px-1.5 !py-1.5"
            onClick={onCopy}
            disabled={!data}
            aria-label={t('copy')}
            title={t('copy')}
          >
            <CopyIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="btn-subtle !px-1.5 !py-1.5"
            onClick={onShare}
            disabled={!data}
            aria-label={t('share')}
            title={t('share')}
          >
            <ShareIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            className={`btn-subtle !px-1.5 !py-1.5 ${saved ? 'text-gold-300' : ''}`}
            onClick={() => toggleBookmark({ id: bookmarkRef, kind: 'ayah', ref: bookmarkRef, label: item.ar })}
            aria-label={saved ? t('bookmarked') : t('bookmark')}
            title={saved ? t('bookmarked') : t('bookmark')}
          >
            <BookmarkIcon className="h-4 w-4" filled={saved} />
          </button>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge tone="gold">{item.ref}</Badge>
        <Badge>
          {t('repeat')}
          <span className="num">{target}</span>
        </Badge>
        {isDone ? <Badge tone="green">{t('done')}</Badge> : null}
      </div>

      {body()}

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/5 pt-3">
        <div className="text-xs text-slate-500">
          {isDone ? t('done') : `${t('remaining')}: `}
          {!isDone ? <span className="num">{left}</span> : null}
        </div>
        {isDone ? (
          <button
            type="button"
            className="btn-ghost !py-2 text-xs"
            onClick={() => setProgress(item.id, target)}
          >
            {S('إعادة', 'Restart')}
          </button>
        ) : (
          <button
            type="button"
            className="grid h-14 w-14 shrink-0 place-items-center rounded-full border-2 border-gold-400/60 bg-gold-400/10 text-gold-200 transition-transform active:scale-95"
            onClick={tap}
            aria-label={S('اضغط للعدّ', 'Tap to count')}
          >
            <span className="num text-xl font-bold">{left}</span>
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------- صفحة الأذكار ---------- */

export default function Adhkar() {
  const t = useT();
  const S = useS();
  const L = useL();
  const { msg, show } = useToast();

  const [tab, setTab] = useState('all');
  const nowHours = useNowHours();

  const progress = (useSettings((s) => s.adhkarProgress) ?? {}) as Record<string, unknown>;
  const setProgress = useSettings((s) => s.setAdhkarProgress);
  const setState = useSettings((s) => s.set);
  const today = todayKey();

  // يوم جديد = تقدّم جديد (اليوم في مفتاح مستقل، والأعداد رقمية خالصة)
  useEffect(() => {
    if (storedDay() === today) return;
    setState('adhkarProgress', {});
    saveDay(today);
  }, [today, setState]);

  const stats = useMemo(() => {
    let total = 0;
    let done = 0;
    let itemsTotal = 0;
    let itemsDone = 0;
    for (const g of ADHKAR) {
      for (const it of g.items) {
        const target = targetOf(it);
        const left = remainingOf(progress, it);
        total += target;
        done += target - left;
        itemsTotal += 1;
        if (left === 0) itemsDone += 1;
      }
    }
    return { total, done, itemsTotal, itemsDone, pct: total > 0 ? (done / total) * 100 : 0 };
  }, [progress]);

  const suggestion = useMemo(() => {
    const id = suggestGroupId(nowHours);
    if (!id) return null;
    return ADHKAR.find((g) => g.id === id) ?? null;
  }, [nowHours]);

  const groups = useMemo(
    () => (tab === 'all' ? ADHKAR : ADHKAR.filter((g) => g.id === tab)),
    [tab],
  );

  function resetGroup(g: AdhkarGroup) {
    for (const it of g.items) setProgress(it.id, targetOf(it));
    show(S('صُفِّرت المجموعة', 'Group reset'));
  }

  return (
    <div>
      <header className="mb-4 flex items-center gap-2">
        <AdhkarIcon className="h-6 w-6 text-gold-400" />
        <h1 className="text-lg font-bold text-slate-100">{t('adhkar')}</h1>
      </header>

      {/* الموضع تحت مقدّم التطبيق الثابت في أعلى الشاشة */}
      <div className="card sticky top-[3.85rem] z-20 mb-4 p-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-xs text-slate-300">
            {t('totalToday')}: <span className="num">{stats.done}</span>
            <span className="text-slate-500"> / </span>
            <span className="num">{stats.total}</span>
          </p>
          <button
            type="button"
            className="btn-subtle !px-2 !py-1 text-xs"
            onClick={() => {
              setState('adhkarProgress', {});
              saveDay(today);
              show(S('صُفِّر تقدّم اليوم', "Today's progress reset"));
            }}
          >
            {S('تصفير اليوم', 'Reset today')}
          </button>
        </div>
        <ProgressBar value={stats.pct} tone={stats.pct >= 100 ? 'emerald' : 'gold'} />
        <p className="mt-1.5 text-[11px] text-slate-500">
          {S('أُنجز', 'Done')}: <span className="num">{stats.itemsDone}</span>
          <span className="text-slate-600"> / </span>
          <span className="num">{stats.itemsTotal}</span>
        </p>
      </div>

      {suggestion && tab !== suggestion.id ? (
        <Card className="mb-4 border-gold-400/30 bg-gold-400/[0.07]">
          <p className="label-ar text-gold-300/80">{S('الوقت المناسب الآن', 'Suitable right now')}</p>
          <h2 className="mt-0.5 text-base font-semibold text-gold-100">{L(suggestion.title)}</h2>
          {suggestion.when ? <p className="mt-1 text-xs text-slate-300">{L(suggestion.when)}</p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary !py-2 text-xs"
              onClick={() => setTab(suggestion.id)}
            >
              {S('ابدأ الآن', 'Start now')}
            </button>
            <button type="button" className="btn-ghost !py-2 text-xs" onClick={() => setTab('all')}>
              {S('عرض الكل', 'Show all')}
            </button>
          </div>
        </Card>
      ) : null}

      <div className="-mx-4 mb-4 overflow-x-auto px-4">
        <div className="flex w-max gap-2 pb-1" role="group" aria-label={t('adhkar')}>
          <button
            type="button"
            aria-pressed={tab === 'all'}
            className={`chip whitespace-nowrap ${tab === 'all' ? 'chip-active' : ''}`}
            onClick={() => setTab('all')}
          >
            {S('الكل', 'All')}
          </button>
          {ADHKAR.map((g) => (
            <button
              key={g.id}
              type="button"
              aria-pressed={tab === g.id}
              className={`chip whitespace-nowrap ${tab === g.id ? 'chip-active' : ''}`}
              onClick={() => setTab(g.id)}
            >
              {L(g.title)}
            </button>
          ))}
        </div>
      </div>

      {groups.map((g) => (
        <Section
          key={g.id}
          title={L(g.title)}
          action={
            <button type="button" className="btn-subtle !px-2 !py-1 text-xs" onClick={() => resetGroup(g)}>
              {t('reset')}
            </button>
          }
        >
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge>{`${t('source')}: ${g.source}`}</Badge>
            {g.when ? <span className="text-xs text-slate-400">{L(g.when)}</span> : null}
          </div>
          <div className="space-y-3">
            {g.items.map((it) => (
              <ItemCard key={it.id} item={it} notify={show} />
            ))}
          </div>
        </Section>
      ))}

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
