import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSettings } from '../lib/store';
import { useL, useT, useTick } from '../lib/hooks';
import {
  CALC_METHODS,
  CITIES,
  MADHABS,
  PRAYERS,
  computeTimes,
  currentPrayer,
  distanceToKaaba,
  formatRemaining,
  locate,
  nearestCity,
  nextPrayer,
  qiblaBearing,
} from '../lib/prayer';
import type { CalcMethodKey, DayTimes, PrayerName } from '../lib/prayer';
import type { Lang } from '../lib/types';
import { enableBackgroundSync, notifyNow, syncOnOpen } from '../lib/notifications';
import { Badge, Card, Row, Section, Toggle } from '../components/ui';
import { PrayerIcon } from '../components/icons';

/* الشروق ليس صلاة، فلا أذان له */
const ATHAN_PRAYERS: PrayerName[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

const LAST_ATHAN = 'noor:last-athan';
const VIEW_DATE = 'noor:prayer-view-date';

/** نافذة التسامح بعد دخول الوقت — بالمللي ثانية */
const ALERT_WINDOW = 90_000;

/* ---------- أدوات محلية ---------- */

/** دالة الترجمة التي تعيدها useT */
type TFn = (k: string) => string;

const pad2 = (n: number) => String(n).padStart(2, '0');

const midnightOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

function clock(d: Date, lang: Lang): string {
  const h = d.getHours();
  const m = d.getMinutes();
  if (lang === 'ar') return `${pad2(h)}:${pad2(m)}`;
  const meridiem = h < 12 ? 'AM' : 'PM';
  return `${h % 12 === 0 ? 12 : h % 12}:${pad2(m)} ${meridiem}`;
}

function sessionGet(key: string): string | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.sessionStorage.getItem(key);
  } catch (err) {
    console.warn('تعذّر القراءة من ذاكرة الجلسة', err);
    return null;
  }
}

function sessionSet(key: string, value: string): boolean {
  try {
    if (typeof window === 'undefined') return false;
    window.sessionStorage.setItem(key, value);
    return true;
  } catch (err) {
    console.warn('تعذّر الكتابة في ذاكرة الجلسة', err);
    return false;
  }
}

/** رسائل رفض إذن الموقع — كل واحدة لها مقابل في القاموس المشترك */
function geoErrorMessage(e: unknown, t: TFn): string {
  const code = typeof e === 'object' && e !== null ? (e as { code?: number }).code : undefined;
  if (code === 1) return t('geoDenied');
  if (code === 2) return t('geoUnavailable');
  if (code === 3) return t('geoTimeout');
  return e instanceof Error ? e.message : t('geoFailed');
}

/**
 * تنبيه صوتي مبسَّط يُولَّد بـ Web Audio بلا أي ملف خارجي.
 * ثلاث نغمات قصيرة فقط — ليس أذاناً حقيقياً، بل نداء تنبيه.
 */
function playAlertTone(volume: number): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as Window & { webkitAudioContext?: typeof AudioContext };
  const Ctor = window.AudioContext ?? w.webkitAudioContext;
  if (!Ctor) return false;
  try {
    const ctx = new Ctor();
    if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
    const master = ctx.createGain();
    master.gain.value = Math.max(0, Math.min(1, volume)) * 0.3;
    master.connect(ctx.destination);
    for (const delay of [0, 0.9, 1.8]) {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 660;
      env.gain.setValueAtTime(0.0001, ctx.currentTime + delay);
      env.gain.exponentialRampToValueAtTime(1, ctx.currentTime + delay + 0.04);
      env.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + 0.55);
      osc.connect(env);
      env.connect(master);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.6);
    }
    window.setTimeout(() => {
      ctx.close().catch((err: unknown) => console.warn('تعذّر إغلاق سياق الصوت', err));
    }, 3200);
    return true;
  } catch (err) {
    console.warn('تعذّر توليد نغمة التنبيه', err);
    return false;
  }
}

/* ---------- الصفحة ---------- */

export default function Prayer() {
  const t = useT();
  const L = useL();

  const lang = useSettings((s) => s.lang);
  const location = useSettings((s) => s.location);
  const madhab = useSettings((s) => s.madhab);
  const calcMethod = useSettings((s) => s.calcMethod);
  const athanEnabled = useSettings((s) => s.athanEnabled);
  const athanVolume = useSettings((s) => s.athanVolume);
  const notifications = useSettings((s) => s.notifications);
  const set = useSettings((s) => s.set);

  // إعادة تصيير كل ثانية — محرّك العدّ التنازلي
  useTick(1000);

  const [viewDate, setViewDate] = useState<Date>(() => midnightOf(new Date()));
  const [gpsBusy, setGpsBusy] = useState(false);
  const [geoMsg, setGeoMsg] = useState('');
  const [athanMsg, setAthanMsg] = useState('');

  const now = new Date();
  const dayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;

  // اليوم ثابت طوال اليوم despite إعادة التصيير كل ثانية
  const today = useMemo(() => midnightOf(new Date()), [dayKey]);

  /* استعادة آخر يوم شوهد، وحفظ الجديد */
  useEffect(() => {
    const saved = sessionGet(VIEW_DATE);
    if (!saved) return;
    const parsed = new Date(saved);
    if (Number.isNaN(parsed.getTime())) {
      sessionSet(VIEW_DATE, '');
      return;
    }
    setViewDate(midnightOf(parsed));
  }, []);

  useEffect(() => {
    sessionSet(VIEW_DATE, viewDate.toISOString());
  }, [viewDate]);

  const timesFor = (d: Date): DayTimes | null =>
    location ? computeTimes(d, location.lat, location.lon, calcMethod, madhab) : null;

  const todayTimes = useMemo(() => timesFor(today), [location, today, calcMethod, madhab]);
  const viewTimes = useMemo(() => timesFor(viewDate), [location, viewDate, calcMethod, madhab]);

  // opts ضرورية: بدونها يُحسب فجر الغد من موقع (0,0) وهو خطأ
  const next = todayTimes
    ? nextPrayer(todayTimes, now, {
        lat: location?.lat,
        lon: location?.lon,
        method: calcMethod,
        madhab,
      })
    : null;

  const viewingToday = dayKey === `${viewDate.getFullYear()}-${viewDate.getMonth()}-${viewDate.getDate()}`;
  const activeKey = viewingToday && viewTimes ? currentPrayer(viewTimes, now) : null;

  /* ---- تنبيه دخول وقت الصلاة ---- */
  useEffect(() => {
    if (!athanEnabled || !location || !todayTimes) return;

    const check = () => {
      const at = new Date();
      for (const key of ATHAN_PRAYERS) {
        const entered = at.getTime() - todayTimes[key].getTime();
        if (entered < 0 || entered > ALERT_WINDOW) continue;
        const stamp = `${key}@${midnightOf(at).getTime()}`;
        if (sessionGet(LAST_ATHAN) === stamp) break;
        sessionSet(LAST_ATHAN, stamp);

        const meta = PRAYERS.find((p) => p.key === key);
        const prayerName = meta ? L({ ar: meta.ar, en: meta.en }) : '';
        const body = clock(todayTimes[key], lang);

        if (!playAlertTone(athanVolume)) {
          setAthanMsg(t('athanAudioFailed'));
        } else {
          setAthanMsg(t('athanToneNote'));
        }

        if (notifications) {
          void notifyNow(`${t('athan')}: ${prayerName}`, body, `noor-athan-${key}`).then((outcome) => {
            if (outcome === 'unsupported') setAthanMsg(t('athanUnsupported'));
            else if (outcome === 'denied') setAthanMsg(t('athanDenied'));
            else if (outcome === 'need-permission') setAthanMsg(t('athanNeedGesture'));
          });
        }
        break;
      }
    };

    check();
    const id = window.setInterval(check, 15_000);
    return () => window.clearInterval(id);
  }, [athanEnabled, location, todayTimes, today, athanVolume, notifications, lang, L, t]);

  /* ---- جدولة التنبيه في الخلفية: يعمل حتى أُغلق التطبيق ---- */
  useEffect(() => {
    if (!notifications || !athanEnabled || !location || !todayTimes) return;
    const slots = ATHAN_PRAYERS.map((key) => {
      const meta = PRAYERS.find((p) => p.key === key);
      const at = todayTimes[key];
      return {
        key,
        label: meta ? L({ ar: meta.ar, en: meta.en }) : key,
        // فرق عن منتصف ليل اليوم المحلي بالمللي ثانية
        ms: at.getTime() - midnightOf(today).getTime(),
      };
    });
    // يعيد جدولة ما فات، ويجدد جدولة الغد
    syncOnOpen(slots);
    void enableBackgroundSync();
  }, [notifications, athanEnabled, location, todayTimes, today, L]);

  /* ---- الموقع ---- */
  const useGps = () => {
    setGpsBusy(true);
    setGeoMsg('');
    locate()
      .then((pos) => {
        const { latitude, longitude } = pos.coords;
        const nearest = nearestCity(latitude, longitude);
        set('location', { lat: latitude, lon: longitude, label: `${nearest.ar} — ${nearest.country}` });
        setGeoMsg(t('geoOk'));
      })
      .catch((e: unknown) => {
        setGeoMsg(geoErrorMessage(e, t));
      })
      .finally(() => {
        setGpsBusy(false);
      });
  };

  const citiesByCountry = useMemo(() => {
    const groups = new Map<string, typeof CITIES>();
    for (const c of CITIES) {
      const list = groups.get(c.country) ?? [];
      list.push(c);
      groups.set(c.country, list);
    }
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0], 'ar'));
  }, []);

  const shiftDay = (delta: number) => {
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + delta));
  };

  const remaining = next ? formatRemaining(next.remaining) : null;
  const qibla = location ? qiblaBearing(location.lat, location.lon) : null;
  const kaabaKm = location ? distanceToKaaba(location.lat, location.lon) : null;

  return (
    <div className="animate-fade-in">
      {/* ---------- الصلاة القادمة ---------- */}
      <Section title={t('prayer')}>
        {!location ? (
          <Card className="flex flex-col items-center gap-4 py-8 text-center">
            <PrayerIcon className="h-10 w-10 text-gold-300" />
            <p className="text-sm text-slate-300">{t('setLocation')}</p>
            <div className="flex flex-wrap justify-center gap-2">
              <button type="button" className="btn-primary" onClick={useGps} disabled={gpsBusy}>
                {gpsBusy ? t('loading') : t('useGPS')}
              </button>
              <CitySelect
                cities={citiesByCountry}
                onPick={(city) => set('location', { lat: city.lat, lon: city.lon, label: `${city.ar} — ${city.country}` })}
                label={t('pickCity')}
                value=""
              />
            </div>
            {geoMsg ? <p className="text-xs text-rose-300">{geoMsg}</p> : null}
          </Card>
        ) : !next || !remaining ? (
          <Card className="text-center text-sm text-slate-400">
            {t('noTimesHere')}
          </Card>
        ) : (
          <div className="card overflow-hidden p-0">
            <div className="bg-gradient-to-br from-gold-400/15 to-emerald-500/10 p-5">
              <p className="label-ar">{t('nextPrayer')}</p>
              <div className="mt-2 flex items-center gap-3">
                <PrayerIcon className="h-9 w-9 shrink-0 text-gold-300" />
                <div className="min-w-0">
                  <p className="text-2xl font-bold text-gold-100">
                    {L({ ar: PRAYERS.find((p) => p.key === next.key)?.ar, en: PRAYERS.find((p) => p.key === next.key)?.en })}
                  </p>
                  <p className="num text-sm text-slate-300">{clock(next.date, lang)}</p>
                </div>
              </div>
              <div className="mt-4 text-center">
                <p className="label-ar">{t('remaining')}</p>
                <p className="num text-4xl font-bold tracking-wider text-slate-50 tabular-nums">
                  {remaining.h}:{remaining.m}:{remaining.s}
                </p>
              </div>
            </div>
            {location ? (
              <p className="border-t border-white/5 px-5 py-2.5 text-center text-xs text-slate-400">{location.label}</p>
            ) : null}
          </div>
        )}
      </Section>

      {/* ---------- جدول اليوم ---------- */}
      <Section
        title={viewingToday ? t('today') : formatDayTitle(viewDate, lang)}
        action={
          <div className="flex items-center gap-1">
            <button type="button" className="btn-subtle !px-3" onClick={() => shiftDay(-1)} aria-label={t('prev')}>
              ‹
            </button>
            {!viewingToday ? (
              <button type="button" className="btn-subtle !px-3 text-xs" onClick={() => setViewDate(today)}>
                {t('today')}
              </button>
            ) : null}
            <button type="button" className="btn-subtle !px-3" onClick={() => shiftDay(1)} aria-label={t('next')}>
              ›
            </button>
          </div>
        }
      >
        {!location ? (
          <Card className="text-sm text-slate-400">{t('setLocation')}</Card>
        ) : !viewTimes ? (
          <Card className="text-sm text-slate-400">—</Card>
        ) : (
          <ul className="card divide-y divide-white/5 p-0">
            {PRAYERS.map((p) => {
              const at = viewTimes[p.key];
              const isActive = activeKey === p.key;
              const isUpcoming = viewingToday && next?.key === p.key;
              return (
                <li
                  key={p.key}
                  className={`flex items-center justify-between gap-3 px-4 py-3 transition-colors ${
                    isActive ? 'bg-emerald-500/10' : isUpcoming ? 'bg-gold-400/10' : ''
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span aria-hidden className="text-base">
                      {p.icon}
                    </span>
                    <span className={`text-sm ${isActive ? 'font-semibold text-emerald-200' : 'text-slate-200'}`}>
                      {L({ ar: p.ar, en: p.en })}
                    </span>
                    {isActive ? <Badge tone="green">{t('now')}</Badge> : null}
                    {isUpcoming ? <Badge tone="gold">{t('nextPrayer')}</Badge> : null}
                  </span>
                  <span className="num shrink-0 text-base font-semibold text-slate-100 tabular-nums">
                    {clock(at, lang)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {/* ---------- الموقع ---------- */}
      {location ? (
        <Section title={t('pickCity')}>
          <Card>
            <Row label={t('pickCity')}>
              <span className="text-sm text-slate-100">{location.label}</span>
            </Row>
            <Row label={t('qiblaDistance')}>
              <span className="num text-sm text-gold-200">{kaabaKm?.toLocaleString('en-US')} {t('km')}</span>
            </Row>
            <Row label={t('qiblaDirection')}>
              <Link to="/qibla" className="text-sm text-gold-200 underline decoration-dotted">
                <span className="num">{Math.round(qibla ?? 0)}°</span> → {L(QIBLA_TXT)}
              </Link>
            </Row>
            <Row label={t('useGPS')}>
              <span className="num text-xs text-slate-400">
                {location.lat.toFixed(3)}, {location.lon.toFixed(3)}
              </span>
            </Row>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="btn-ghost" onClick={useGps} disabled={gpsBusy}>
                {gpsBusy ? t('loading') : t('useGPS')}
              </button>
              <CitySelect
                cities={citiesByCountry}
                onPick={(city) => set('location', { lat: city.lat, lon: city.lon, label: `${city.ar} — ${city.country}` })}
                label={t('pickCity')}
                value={`${location.lat},${location.lon}`}
              />
            </div>
            {geoMsg ? <p className="mt-2 text-xs text-slate-400">{geoMsg}</p> : null}
          </Card>
        </Section>
      ) : null}

      {/* ---------- الإعدادات السريعة ---------- */}
      <Section title={t('method')}>
        <Card>
          <label className="mb-1.5 block text-sm text-slate-300" htmlFor="calc-method">
            {t('method')}
          </label>
          <select
            id="calc-method"
            value={calcMethod}
            onChange={(e) => set('calcMethod', e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-ink-700 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-gold-400/50"
          >
            {(Object.keys(CALC_METHODS) as CalcMethodKey[]).map((k) => (
              <option key={k} value={k}>
                {L(CALC_METHODS[k])}
              </option>
            ))}
          </select>

          <label className="mb-1.5 mt-4 block text-sm text-slate-300" htmlFor="madhab">
            {t('madhab')}
          </label>
          <select
            id="madhab"
            value={madhab}
            onChange={(e) => set('madhab', e.target.value as typeof madhab)}
            className="w-full rounded-xl border border-white/10 bg-ink-700 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-gold-400/50"
          >
            {(Object.keys(MADHABS) as Array<keyof typeof MADHABS>).map((k) => (
              <option key={k} value={k}>
                {L(MADHABS[k])}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-slate-500">{t('calcNote')}</p>
        </Card>
      </Section>

      {/* ---------- الأذان ---------- */}
      <Section title={t('athan')}>
        <Card>
          <Toggle
            on={athanEnabled}
            onChange={(v) => set('athanEnabled', v)}
            label={athanEnabled ? t('athanOn') : t('athanOff')}
            hint={t('athanToneHint')}
          />
          <div className="mt-2">
            <label className="mb-1.5 flex items-center justify-between text-sm text-slate-300" htmlFor="athan-volume">
              <span>{t('volume')}</span>
              <span className="num text-xs text-slate-400">{Math.round(athanVolume * 100)}%</span>
            </label>
            <input
              id="athan-volume"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={athanVolume}
              onChange={(e) => set('athanVolume', Number(e.target.value))}
              className="w-full accent-gold-400"
            />
          </div>
          {athanMsg ? <p className="mt-3 text-xs text-amber-200/90">{athanMsg}</p> : null}
        </Card>
      </Section>

      {/* ---------- تنبيه علمي ---------- */}
      <div className="mb-7 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4">
        <p className="mb-1 text-sm font-semibold text-rose-200">{t('scholarlyNote')}</p>
        <p className="text-xs leading-relaxed text-rose-100/90">{t('disclaimer')}</p>
      </div>
    </div>
  );
}

/* ---------- عناصر فرعية ---------- */

const QIBLA_TXT = { ar: 'بوصلة القبلة', en: 'Qibla compass' };

function CitySelect({
  cities, onPick, label, value,
}: {
  cities: Array<[string, typeof CITIES]>;
  onPick: (c: (typeof CITIES)[number]) => void;
  label: string;
  value: string;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => {
        const picked = CITIES.find((c) => `${c.lat},${c.lon}` === e.target.value);
        if (picked) onPick(picked);
      }}
      className="btn-ghost max-w-[13rem] cursor-pointer truncate"
    >
      <option value="">{label}</option>
      {cities.map(([country, list]) => (
        <optgroup key={country} label={country}>
          {list.map((c) => (
            <option key={`${c.lat},${c.lon}`} value={`${c.lat},${c.lon}`}>
              {c.ar}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

function formatDayTitle(d: Date, lang: Lang): string {
  try {
    return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG-u-ca-gregory-nu-latn' : 'en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(d);
  } catch (err) {
    console.warn('تعذّر تنسيق التاريخ', err);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }
}
