/**
 * التقويم الهجري والميلادي
 * ------------------------------------------------------------------
 * شريط اليوم، شبكة شهر كامل بمبدّل هجري/ميلادي، أقرب خمس مناسبات
 * قادمة، وعدّاد رمضان — كله محسوب محلياً عبر src/lib/hijri.ts.
 */

import { useMemo, useState } from 'react';
import { useSettings } from '../lib/store';
import { useS, useT } from '../lib/hooks';
import {
  HIJRI_EVENTS,
  formatGregorian,
  formatHijri,
  hijriEvent,
  hijriMonthLength,
  toHijri,
} from '../lib/hijri';
import type { HijriDate } from '../lib/hijri';
import { Badge, Card, Section } from '../components/ui';
import { CalendarIcon } from '../components/icons';

type Mode = 'hijri' | 'gregorian';

const WEEK_AR = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
const WEEK_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/** أول يوم ميلادي يوافق غرة الشهر الهجري المعروض (بحث للخلف حتى 32 يوماً) */
function hijriMonthStart(view: Date, h: HijriDate): Date {
  for (let back = 0; back < 32; back += 1) {
    const d = addDays(view, -back);
    const hh = toHijri(d);
    if (hh.year === h.year && hh.month === h.month && hh.day === 1) return d;
  }
  return addDays(view, -(h.day - 1));
}

export default function Calendar() {
  const t = useT();
  const S = useS();
  const langIsAr = useSettings((s) => s.lang) === 'ar';
  const weekNames = langIsAr ? WEEK_AR : WEEK_EN;

  const today = useMemo(() => new Date(), []);
  const todayHijri = useMemo(() => toHijri(today), [today]);
  const todayEvent = hijriEvent(todayHijri);

  const [mode, setMode] = useState<Mode>('hijri');
  const [view, setView] = useState<Date>(() => new Date());

  /* ---------- أقرب 5 مناسبات (حتى 400 يوم) ---------- */
  const upcoming = useMemo(() => {
    const out: Array<{ date: Date; h: HijriDate; ar: string; en: string; after: number }> = [];
    for (let off = 1; off <= 400 && out.length < 5; off += 1) {
      const d = addDays(today, off);
      const h = toHijri(d);
      const ev = HIJRI_EVENTS.find((e) => e.month === h.month && e.day === h.day);
      if (ev) out.push({ date: d, h, ar: ev.ar, en: ev.en, after: off });
    }
    return out;
  }, [today]);

  /* ---------- عدّاد رمضان ---------- */
  const ramadan = useMemo(() => {
    if (todayHijri.month === 9) {
      const len = hijriMonthLength(todayHijri.year, 9);
      return { inRamadan: true, left: len - todayHijri.day + 1, until: 0 };
    }
    for (let off = 1; off <= 400; off += 1) {
      const h = toHijri(addDays(today, off));
      if (h.month === 9 && h.day === 1) return { inRamadan: false, left: 0, until: off };
    }
    return { inRamadan: false, left: 0, until: -1 };
  }, [today, todayHijri]);

  const shift = (delta: number) => {
    setView((v) => {
      if (mode === 'gregorian') return new Date(v.getFullYear(), v.getMonth() + delta, 1);
      /* هجري: انتقل شهراً عبر التاريخ الميلادي التقريبي (30 يوماً) ثم ثبّت */
      return addDays(new Date(v.getFullYear(), v.getMonth(), v.getDate() + delta * 30), 0);
    });
  };

  const goToday = () => setView(new Date());

  return (
    <div className="animate-fade-in">
      <header className="mb-4 flex items-center gap-2">
        <CalendarIcon className="h-6 w-6 text-gold-400" />
        <h1 className="text-lg font-bold text-slate-100">{t('calendar')}</h1>
      </header>

      {/* ---------- شريط اليوم ---------- */}
      <Section>
        <div className="card overflow-hidden p-0">
          <div className="bg-gradient-to-br from-gold-400/15 to-emerald-500/10 p-5 text-center">
            <p className="text-2xl font-bold text-gold-100">{formatHijri(todayHijri)}</p>
            <p className="mt-1 text-sm text-slate-300">{formatGregorian(today)}</p>
          </div>
          <div className="border-t border-white/5 px-5 py-3 text-center">
            {todayEvent ? (
              <Badge tone="gold">
                {S('مناسبة اليوم', "Today's occasion")}: {langIsAr ? todayEvent.ar : todayEvent.en}
              </Badge>
            ) : (
              <span className="text-xs text-slate-500">{S('لا مناسبة اليوم', 'No occasion today')}</span>
            )}
          </div>
        </div>
      </Section>

      {/* ---------- عدّاد رمضان ---------- */}
      <Section>
        <Card className="text-center">
          {ramadan.inRamadan ? (
            <>
              <p className="label-ar">{S('رمضان', 'Ramadan')}</p>
              <p className="mt-1 text-sm text-slate-200">
                {S('بقي من الشهر', 'Left in the month')}{' '}
                <span className="num font-bold text-emerald-300 tabular-nums">{ramadan.left}</span>{' '}
                {S('يوم', 'days')}
              </p>
            </>
          ) : ramadan.until >= 0 ? (
            <>
              <p className="label-ar">{S('العد التنازلي لرمضان', 'Countdown to Ramadan')}</p>
              <p className="mt-1 text-sm text-slate-200">
                <span className="num font-bold text-gold-200 tabular-nums">{ramadan.until}</span>{' '}
                {S('يوم تقريباً', 'days approximately')}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                {S('تقدير تقريبي حسب تقويم أم القرى، والرؤية الشرعية هي المعتمدة', 'Rough estimate based on the Umm al-Qura calendar; the sighted crescent is authoritative')}
              </p>
            </>
          ) : (
            <p className="text-xs text-slate-500">{S('تعذّر حساب العد التنازلي', 'Could not compute the countdown')}</p>
          )}
        </Card>
      </Section>

      {/* ---------- المبدّل والتنقل ---------- */}
      <Section
        title={S('شهر كامل', 'Full month')}
        action={
          <div className="flex items-center gap-1">
            <div className="me-2 flex rounded-lg border border-white/10 bg-white/5 p-0.5 text-xs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'hijri'}
                onClick={() => setMode('hijri')}
                className={`rounded-md px-2.5 py-1 ${mode === 'hijri' ? 'bg-gold-400/20 text-gold-200' : 'text-slate-400'}`}
              >
                {t('hijri')}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'gregorian'}
                onClick={() => setMode('gregorian')}
                className={`rounded-md px-2.5 py-1 ${mode === 'gregorian' ? 'bg-gold-400/20 text-gold-200' : 'text-slate-400'}`}
              >
                {t('gregorian')}
              </button>
            </div>
            <button type="button" className="btn-subtle !px-3" onClick={() => shift(-1)} aria-label={t('prev')}>‹</button>
            <button type="button" className="btn-subtle !px-3 text-xs" onClick={goToday}>{t('today')}</button>
            <button type="button" className="btn-subtle !px-3" onClick={() => shift(1)} aria-label={t('next')}>›</button>
          </div>
        }
      >
        {mode === 'gregorian' ? (
          <GregorianGrid view={view} today={today} weekNames={weekNames} langIsAr={langIsAr} />
        ) : (
          <HijriGrid view={view} today={today} weekNames={weekNames} langIsAr={langIsAr} />
        )}
      </Section>

      {/* ---------- أقرب المناسبات ---------- */}
      <Section title={t('events')}>
        {upcoming.length === 0 ? (
          <Card className="text-sm text-slate-400">{S('لا مناسبات في الأيام القادمة', 'No upcoming occasions')}</Card>
        ) : (
          <ul className="card divide-y divide-white/5 p-0">
            {upcoming.map((u) => (
              <li key={`${u.h.year}-${u.h.month}-${u.h.day}`} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="min-w-0">
                  <span className="block truncate text-sm text-slate-100">{langIsAr ? u.ar : u.en}</span>
                  <span className="mt-0.5 block text-[11px] text-slate-500">
                    {formatHijri(u.h)} ·{' '}
                    {new Intl.DateTimeFormat(langIsAr ? 'ar-EG-u-ca-gregory-nu-latn' : 'en-GB', {
                      day: 'numeric',
                      month: 'short',
                    }).format(u.date)}
                  </span>
                </span>
                <Badge tone="gold">
                  <span className="num tabular-nums">{u.after}</span> {S('يوم', 'd')}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

/* ---------- شبكة ميلادية: كل خلية تعرض مقابلها الهجري ---------- */

function GregorianGrid({
  view,
  today,
  weekNames,
  langIsAr,
}: {
  view: Date;
  today: Date;
  weekNames: string[];
  langIsAr: boolean;
}) {
  const year = view.getFullYear();
  const month = view.getMonth();
  const first = new Date(year, month, 1);
  const offset = first.getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells: Array<Date | null> = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: days }, (_, i) => new Date(year, month, i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const title = new Intl.DateTimeFormat(langIsAr ? 'ar-EG-u-ca-gregory-nu-latn' : 'en-GB', {
    month: 'long',
    year: 'numeric',
  }).format(first);

  return (
    <div className="card p-3">
      <p className="mb-2 text-center text-sm font-semibold text-slate-200">{title}</p>
      <div className="grid grid-cols-7 gap-1 text-center">
        {weekNames.map((w) => (
          <span key={w} className="py-1 text-[11px] text-slate-500">{w}</span>
        ))}
        {cells.map((d, i) => {
          if (!d) return <span key={`e-${i}`} />;
          const h = toHijri(d);
          const ev = hijriEvent(h);
          const isToday = sameDay(d, today);
          return (
            <div
              key={d.toISOString()}
              className={`relative flex min-h-[3rem] flex-col items-center justify-center rounded-lg border py-1 ${
                isToday ? 'border-gold-400/60 bg-gold-400/10' : 'border-white/5 bg-white/[.02]'
              }`}
            >
              <span className={`num text-sm font-semibold tabular-nums ${isToday ? 'text-gold-200' : 'text-slate-100'}`}>
                {d.getDate()}
              </span>
              <span className="num text-[10px] text-slate-500 tabular-nums">{h.day} {langIsAr ? h.monthNameAr : h.monthNameEn}</span>
              {ev ? <span className="absolute top-1 end-1 h-1.5 w-1.5 rounded-full bg-gold-400" title={langIsAr ? ev.ar : ev.en} /> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- شبكة هجرية ---------- */

function HijriGrid({
  view,
  today,
  weekNames,
  langIsAr,
}: {
  view: Date;
  today: Date;
  weekNames: string[];
  langIsAr: boolean;
}) {
  const h = toHijri(view);
  const len = hijriMonthLength(h.year, h.month);
  const start = hijriMonthStart(view, h);
  const offset = start.getDay();
  const cells: Array<{ day: number; greg: Date } | null> = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: len }, (_, i) => ({ day: i + 1, greg: addDays(start, i) })),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const title = langIsAr ? `${h.monthNameAr} ${h.year}هـ` : `${h.monthNameEn} ${h.year}H`;

  return (
    <div className="card p-3">
      <p className="mb-2 text-center text-sm font-semibold text-slate-200">{title}</p>
      <div className="grid grid-cols-7 gap-1 text-center">
        {weekNames.map((w) => (
          <span key={w} className="py-1 text-[11px] text-slate-500">{w}</span>
        ))}
        {cells.map((c, i) => {
          if (!c) return <span key={`e-${i}`} />;
          const ev = HIJRI_EVENTS.find((e) => e.month === h.month && e.day === c.day);
          const isToday = sameDay(c.greg, today);
          return (
            <div
              key={c.day}
              className={`relative flex min-h-[3rem] flex-col items-center justify-center rounded-lg border py-1 ${
                isToday ? 'border-gold-400/60 bg-gold-400/10' : 'border-white/5 bg-white/[.02]'
              }`}
              title={ev ? (langIsAr ? ev.ar : ev.en) : undefined}
            >
              <span className={`num text-sm font-semibold tabular-nums ${isToday ? 'text-gold-200' : 'text-slate-100'}`}>
                {c.day}
              </span>
              <span className="num text-[10px] text-slate-500 tabular-nums">{c.greg.getDate()}</span>
              {ev ? <span className="absolute top-1 end-1 h-1.5 w-1.5 rounded-full bg-gold-400" /> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
