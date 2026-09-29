/**
 * متابعة الختم: كم حفظت، كم بقي، وما مستحقّ للمراجعة اليوم.
 * ------------------------------------------------------------------
 * أربعة أقسام: حلقة اليوم، وشبكة السور، والإحصاء، والمراجعة.
 * وفوقها رأس يشرح حالة الخطة وزرّا ضبطها.
 *
 * نصّ الآية لا يُكتب هنا: يُقرأ من `content.ts` عند كشفه، ولا يُعرض قبل
 * أن يضغط المستخدم.
 */

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAyah, getSurahs } from '../lib/content';
import { useAsync, useL, useT } from '../lib/hooks';
import {
  DAILY_MAX,
  DAILY_MIN,
  DAY_MS,
  DEFAULT_DAILY_TARGET,
  MAX_ENTRIES,
  REVIEW_MAX,
  dueForReview,
  loadHifz,
  planStatus,
  saveHifz,
  surahProgress,
  todayIndex,
} from '../lib/hifz';
import type { HifzEntry, HifzState } from '../lib/hifz';
import {
  Badge,
  Card,
  ErrorBox,
  Loading,
  Ornament,
  ProgressBar,
  Row,
  Section,
} from '../components/ui';

/** نصّ يظهر مكان القيمة غير المحسوبة — لا صفراً مكان مجهول */
const DASH = '—';
/** عبء المراجعة اليومي: ما يُعرض الآن، وما زاد يؤجَّل إلى الغد */
const DAILY_REVIEW = 20;

/** مفتاح آية واحد */
function keyOf(surah: number, ayah: number): string {
  return `${surah}:${ayah}`;
}

/** نسبة مئوية، أو نصّ المجهول إن كانت القيمة خارج المجال */
function pct(v: number): string {
  return v >= 0 && v <= 1 ? String(Math.round(v * 100)) : DASH;
}

/** نسبة بعلامة النسبة — والمجهول يظهر وحده، فلا تصير علامة على لا شيء */
function pctLabel(v: number, known = true): string {
  return known ? `${pct(v)}٪` : DASH;
}

/** يضع مدخل سورة في مكانه — السورة الواحدة لا تتكرّر ولا تتزاحم */
function upsert(entries: HifzEntry[], e: HifzEntry): HifzEntry[] {
  return [...entries.filter((x) => x.surah !== e.surah), e]
    .sort((a, b) => a.surah - b.surah)
    .slice(0, MAX_ENTRIES);
}

export default function Hifz() {
  const t = useT();
  const L = useL();

  /**
   * أول رسم قراءة فقط: لا يُكتب في التخزين قبل أن يغيّر المستخدم شيئاً.
   * اليوم يُثبَّت للجلسة كلها، فترقيم الأيام لا يقفز منتصف النهار،
   * وقائمة المراجعة تُلتقط مرة واحدة فلا تختفي الآيات أثناء مراجعتها.
   */
  const [boot] = useState(() => {
    const s = loadHifz();
    const d = todayIndex();
    const all = dueForReview(s, d, REVIEW_MAX);
    return { s, d, all, due: all.slice(0, DAILY_REVIEW) };
  });
  const [state, setState] = useState<HifzState>(boot.s);
  const [picked, setPicked] = useState<number | null>(null);
  const [cleared, setCleared] = useState<ReadonlySet<string>>(() => new Set());
  const [revealed, setRevealed] = useState(false);

  const day = boot.d;
  const { data: surahs, error, loading, reload } = useAsync(() => getSurahs(), []);

  /* ---------- الأرقام المشتقّة ---------- */

  const bySurah = useMemo(() => {
    const m = new Map<number, HifzEntry>();
    for (const e of state.entries) m.set(e.surah, e);
    return m;
  }, [state.entries]);

  const plan = useMemo(() => planStatus(state, day), [state, day]);
  const memorized = plan.memorized;

  const totalAyahs = useMemo(
    () => (surahs ? surahs.reduce((a, s) => a + s.verses, 0) : 0),
    [surahs],
  );
  // عدد الآيات مجهول قبل تحميل فهرس السور، فلا تُحسب نسبة من خانة فارغة
  const known = totalAyahs > 0;
  const overall = known ? Math.min(1, memorized / totalAyahs) : 0;

  const daysElapsed = plan.daysElapsed;
  const remaining = plan.remaining;

  const daysSinceTouch = useMemo(() => {
    const list = state.entries.map((e) => e.updatedAt).filter((n) => n > 0);
    if (!list.length) return null;
    return Math.max(0, Math.floor((Date.now() - Math.max(...list)) / DAY_MS));
  }, [state.entries]);

  const runDoneToday =
    state.lastCompletedAt !== null && Math.floor(state.lastCompletedAt / DAY_MS) === day;

  /* ---------- سورة العمل ---------- */

  const firstOpen = useMemo(() => {
    if (!surahs) return null;
    for (const s of surahs) {
      if (surahProgress(bySurah.get(s.n), s.verses) < 1) return s;
    }
    return null;
  }, [surahs, bySurah]);

  const active = useMemo(() => {
    if (!surahs) return null;
    const chosen = picked ? surahs.find((s) => s.n === picked) : undefined;
    if (chosen && surahProgress(bySurah.get(chosen.n), chosen.verses) < 1) return chosen;
    return firstOpen;
  }, [surahs, picked, bySurah, firstOpen]);

  const activeEntry = active ? bySurah.get(active.n) : undefined;
  const activeProgress = active ? surahProgress(activeEntry, active.verses) : 0;

  /* ---------- قائمة المراجعة ---------- */

  const list = useMemo(
    () => boot.due.filter((i) => !cleared.has(keyOf(i.surah, i.ayah))),
    [boot.due, cleared],
  );
  const item = list[0] ?? null;
  const ayah = useAsync(
    () => (item ? getAyah(item.surah, item.ayah) : Promise.resolve(null)),
    [item?.surah, item?.ayah],
  );

  /* ---------- الأفعال ---------- */

  const apply = (next: HifzState) => {
    setState(next);
    saveHifz(next);
  };

  const changeTarget = (n: number) => {
    if (n < DAILY_MIN || n > DAILY_MAX) return;
    apply({ ...state, dailyTarget: n });
  };

  const finishOne = () => {
    if (!active) return;
    const prev = bySurah.get(active.n);
    const next: HifzEntry = {
      surah: active.n,
      maxAyah: Math.min(active.verses, (prev?.maxAyah ?? 0) + 1),
      updatedAt: Date.now(),
    };
    if (prev?.extra?.length) next.extra = prev.extra;
    apply({ ...state, entries: upsert(state.entries, next) });
  };

  /** يسجّل أن السورة استُعرضت اليوم — فيؤجَّل دورها التالي */
  const touch = (surah: number) => {
    const prev = bySurah.get(surah);
    if (!prev) return;
    apply({ ...state, entries: upsert(state.entries, { ...prev, updatedAt: Date.now() }) });
  };

  const resetPlan = () => {
    const ok = window.confirm(
      L({
        ar: 'يُعاد يوم بدء الخطة إلى اليوم والهدف اليومي إلى ٢٠. محفوظاتك لن تُمس.',
        en: 'The plan start day returns to today and the daily target to 20. Your memorization stays.',
      }),
    );
    if (!ok) return;
    apply({ ...state, startDay: day, dailyTarget: DEFAULT_DAILY_TARGET });
  };

  const startRun = () => {
    if (!known || overall < 1 || runDoneToday) return;
    const ok = window.confirm(
      L({
        ar: 'تُسجَّل ختمة مكتملة جديدة. محفوظاتك تبقى كما هي.',
        en: 'A new completed run is recorded. Your memorization stays as it is.',
      }),
    );
    if (!ok) return;
    apply({ ...state, completedRuns: state.completedRuns + 1, lastCompletedAt: Date.now() });
  };

  const next = () => {
    if (!item) return;
    setCleared((prev) => new Set(prev).add(keyOf(item.surah, item.ayah)));
    setRevealed(false);
  };

  const mastered = () => {
    if (!item) return;
    // الفاتورة مستحقّة بعد الفاصل، لا اليوم: آخر نشاط على السورة الآن
    touch(item.surah);
    next();
  };

  /* ---------- العرض ---------- */

  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (loading && !surahs) return <Loading label={t('loading')} />;

  return (
    <div className="animate-fade-in">
      {/* رأس الحالة */}
      <header className="card mb-6 p-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-slate-100">
              {L({ ar: 'متابعة الحفظ', en: 'Memorization' })}
            </h1>
            <p className="mt-0.5 text-xs text-slate-500">
              {L({ ar: 'الخطة', en: 'Plan' })}
            </p>
          </div>
          <div className="shrink-0 text-end">
            <p className="num text-2xl font-bold tabular-nums text-gold-200">
              {pctLabel(overall, known)}
            </p>
            <p className="text-[11px] text-slate-500">
              {L({ ar: 'من الختمة', en: 'of the run' })}
            </p>
          </div>
        </div>

        <ProgressBar value={known ? overall * 100 : 0} />

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Stat
            value={String(daysElapsed + 1)}
            label={L({ ar: 'يوم في الخطة', en: 'day in plan' })}
          />
          <Stat
            value={String(state.dailyTarget)}
            label={L({ ar: 'آية في اليوم', en: 'verses a day' })}
          />
          <Stat
            value={String(remaining)}
            label={L({ ar: 'متبقٍّ اليوم', en: 'left today' })}
            tone="gold"
          />
        </div>
      </header>

      {/* الخطة: تعديل الهدف، وإعادة الضبط، وبدء ختمة */}
      <Section title={L({ ar: 'الخطة', en: 'Plan' })}>
        <Card>
          <div className="flex items-center justify-between gap-3">
            <span className="min-w-0 text-sm text-slate-300">
              {L({ ar: 'هدف اليوم', en: 'Daily target' })}
            </span>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => changeTarget(state.dailyTarget - 1)}
                disabled={state.dailyTarget <= DAILY_MIN}
                aria-label={L({ ar: 'إنقاص', en: 'Decrease' })}
                className="btn-ghost !h-11 !w-11 !p-0 text-lg"
              >
                −
              </button>
              <span className="num w-8 text-center text-base font-bold text-slate-100">
                {state.dailyTarget}
              </span>
              <button
                type="button"
                onClick={() => changeTarget(state.dailyTarget + 1)}
                disabled={state.dailyTarget >= DAILY_MAX}
                aria-label={L({ ar: 'زيادة', en: 'Increase' })}
                className="btn-ghost !h-11 !w-11 !p-0 text-lg"
              >
                +
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-col gap-2">
            <button type="button" onClick={resetPlan} className="btn-ghost min-h-11 w-full">
              {L({ ar: 'إعادة ضبط الخطة', en: 'Reset the plan' })}
            </button>
            <button
              type="button"
              onClick={startRun}
              disabled={!known || overall < 1 || runDoneToday}
              className="btn-primary min-h-11 w-full"
            >
              {L({ ar: 'بدء ختمة جديدة', en: 'Record a finished run' })}
            </button>
            {!known ? (
              <p className="text-center text-[11px] text-slate-500">
                {L({ ar: 'لا يُسجَّل قبل حساب نسبة السور', en: 'Not available until surahs are loaded' })}
              </p>
            ) : overall < 1 ? (
              <p className="text-center text-[11px] text-slate-500">
                {L({
                  ar: 'لا يُسجَّل قبل إتمام الختمة كلها',
                  en: 'Not available until the whole run is complete',
                })}
              </p>
            ) : runDoneToday ? (
              <p className="text-center text-[11px] text-slate-500">
                {L({ ar: 'سُجّلت ختمة اليوم', en: 'Today\'s run is already recorded' })}
              </p>
            ) : null}
          </div>
        </Card>
      </Section>

      {/* حلقة اليوم */}
      <Section title={L({ ar: 'حلقة اليوم', en: "Today's loop" })}>
        {active ? (
          <Card>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="quran-text truncate text-xl text-slate-100">{active.ar}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {t('verse')} <span className="num">{(activeEntry?.maxAyah ?? 0) + 1}</span>
                  {' / '}
                  <span className="num">{active.verses}</span>
                </p>
              </div>
              <Badge tone={activeProgress > 0 ? 'gold' : 'default'}>
                <span className="num">{pctLabel(activeProgress)}</span>
              </Badge>
            </div>

            <div className="mt-3">
              <ProgressBar value={activeProgress * 100} />
            </div>

            <button
              type="button"
              onClick={finishOne}
              className="btn-primary mt-4 min-h-11 w-full"
            >
              {L({ ar: 'انتهيت من آية', en: 'One verse done' })}
            </button>

            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="text-[11px] text-slate-500">
                {L({ ar: 'متبقٍّ اليوم', en: 'Left today' })}{' '}
                <span className="num font-semibold text-gold-200">{remaining}</span>
              </p>
              <Link to={`/quran/${active.n}`} className="btn-subtle min-h-11 !px-3 text-xs">
                {L({ ar: 'افتح في المصحف', en: 'Open in mushaf' })}
              </Link>
            </div>
          </Card>
        ) : surahs ? (
          <Card className="border-emerald-500/25 text-center">
            <p className="text-sm text-slate-200">
              {L({ ar: 'تمّت ختمة كاملة —بارك الله في حفظك', en: 'A full run is complete' })}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {L({ ar: 'عدد الختمات', en: 'Completed runs' })}{' '}
              <span className="num font-semibold text-emerald-200">{state.completedRuns}</span>
            </p>
          </Card>
        ) : null}
      </Section>

      {/* شبكة السور */}
      <Section
        title={L({ ar: 'السور', en: 'Surahs' })}
        action={
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <Badge>{L({ ar: 'لم يبدأ', en: 'Not started' })}</Badge>
            <Badge tone="gold">{L({ ar: 'جارٍ', en: 'In progress' })}</Badge>
            <Badge tone="green">{L({ ar: 'تمّت', en: 'Done' })}</Badge>
          </div>
        }
      >
        <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
          {(surahs ?? []).map((s) => {
            const p = surahProgress(bySurah.get(s.n), s.verses);
            const done = p >= 1;
            const tone = done
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
              : p > 0
                ? 'border-gold-400/40 bg-gold-400/10 text-gold-200'
                : 'border-white/10 bg-white/5 text-slate-400';
            return (
              <button
                key={s.n}
                type="button"
                onClick={() => setPicked(s.n)}
                title={s.arSimple}
                aria-label={`${s.arSimple} — ${pctLabel(p)}`}
                aria-pressed={active?.n === s.n}
                className={`flex min-h-11 flex-col items-center justify-center gap-1 rounded-xl border px-1 py-1.5 transition-colors active:scale-95 ${tone} ${
                  active?.n === s.n ? 'ring-1 ring-gold-300/70' : ''
                }`}
              >
                <span className="num text-[11px] font-semibold leading-none">{s.n}</span>
                <span className="h-1 w-full overflow-hidden rounded-full bg-black/30">
                  <span
                    className="block h-full rounded-full bg-current"
                    style={{ width: `${Math.round(p * 100)}%` }}
                  />
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-[11px] text-slate-500">
          {L({
            ar: 'اضغط سورة لتجعلها سورة العمل اليوم',
            en: 'Tap a surah to make it the one you work on today',
          })}
        </p>
      </Section>

      {/* الإحصاء */}
      <Section title={L({ ar: 'الإحصاء', en: 'Statistics' })}>
        <Card>
          <Row label={L({ ar: 'النسبة الكلية', en: 'Overall' })}>
            <span className="num font-semibold text-gold-200">{pctLabel(overall, known)}</span>
          </Row>
          <Row label={L({ ar: 'نسبة السورة الحالية', en: 'Current surah' })}>
            <span className="num font-semibold text-slate-100">
              {pctLabel(activeProgress, active !== null)}
            </span>
          </Row>
          <Row label={L({ ar: 'الآيات المحفوظة', en: 'Verses memorized' })}>
            <span className="num font-semibold text-slate-100">
              {known ? memorized : DASH}
            </span>
          </Row>
          <Row
            label={L({
              ar: 'أيام منذ آخر حفظ',
              en: 'Days since last memorization',
            })}
          >
            <span className="num font-semibold text-slate-100">
              {daysSinceTouch === null ? DASH : daysSinceTouch}
            </span>
          </Row>
          <Row label={L({ ar: 'الختمات المكتملة', en: 'Completed runs' })}>
            <span className="num font-semibold text-emerald-200">{state.completedRuns}</span>
          </Row>
        </Card>
      </Section>

      {/* المراجعة */}
      <Section
        title={L({ ar: 'المراجعة', en: 'Review' })}
        action={
          <span className="num text-xs text-slate-500">
            {list.length} / {boot.all.length}
          </span>
        }
      >
        {item ? (
          <Card>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge tone="gold">
                {L({ ar: 'سورة', en: 'Surah' })}{' '}
                <span className="num">{item.surah}</span>
              </Badge>
              <Badge>
                {t('verse')} <span className="num">{item.ayah}</span>
              </Badge>
            </div>

            {revealed ? (
              <div>
                {ayah.loading ? (
                  <Loading />
                ) : ayah.error ? (
                  <div className="flex flex-col items-center gap-2 py-6 text-center">
                    <p className="text-sm text-slate-400">
                      {L({
                        ar: 'تعذّر جلب نصّ الآية — نزّل المحتوى من صفحة التنزيل',
                        en: 'The verse text is unavailable — download content first',
                      })}
                    </p>
                    <button
                      type="button"
                      onClick={ayah.reload}
                      className="btn-ghost min-h-11 !px-4 text-xs"
                    >
                      {t('retry')}
                    </button>
                  </div>
                ) : ayah.data ? (
                  <p className="quran-text break-words text-ink-50 text-xl leading-[2.15]">
                    {ayah.data.text}
                  </p>
                ) : (
                  <p className="py-6 text-center text-sm text-slate-500">
                    {L({ ar: 'لا نصّ لهذه الآية', en: 'No text for this verse' })}
                  </p>
                )}

                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={mastered}
                    className="btn-primary min-h-11 flex-1"
                  >
                    {L({ ar: 'أتتقنتها', en: 'Mastered' })}
                  </button>
                  <button
                    type="button"
                    onClick={next}
                    className="btn-ghost min-h-11 flex-1"
                  >
                    {L({ ar: 'أعِدها', en: 'Repeat' })}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setRevealed(true)}
                className="flex min-h-24 w-full items-center justify-center rounded-xl border border-dashed border-white/15 bg-white/5 text-sm text-slate-300 transition-colors active:scale-[.99]"
              >
                {L({ ar: 'اضغط للكشف', en: 'Tap to reveal' })}
              </button>
            )}
          </Card>
        ) : (
          <Card className="text-center">
            <p className="text-sm text-slate-300">
              {boot.all.length === 0
                ? L({ ar: 'لا مراجعة مستحقة اليوم', en: 'Nothing due for review today' })
                : L({ ar: 'انتهت مراجعة اليوم', en: 'Today\'s review is done' })}
            </p>
            {boot.all.length > 0 ? (
              <p className="mt-1 text-xs text-slate-500">
                {L({ ar: 'راجع الباقي غداً', en: 'The rest carries over to tomorrow' })}
              </p>
            ) : null}
          </Card>
        )}
      </Section>

      <Ornament />
    </div>
  );
}

/** خانة رقمية صغيرة في الرأس */
function Stat({
  value, label, tone = 'default',
}: { value: string; label: string; tone?: 'default' | 'gold' }) {
  return (
    <div className="min-w-0 rounded-xl bg-white/5 px-2 py-2.5">
      <p
        className={`num text-lg font-bold tabular-nums ${
          tone === 'gold' ? 'text-gold-200' : 'text-slate-100'
        }`}
      >
        {value}
      </p>
      <p className="mt-0.5 truncate text-[10px] text-slate-500">{label}</p>
    </div>
  );
}
