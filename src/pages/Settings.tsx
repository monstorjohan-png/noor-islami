import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSettings } from '../lib/store';
import { useL, useT } from '../lib/hooks';
import { storageInfo } from '../lib/db';
import { CALC_METHODS, MADHABS, CITIES, nearestCity, locate } from '../lib/prayer';
import {
  clearDailyReminder,
  enableBackgroundSync,
  notificationSupport,
  requestPermission,
  scheduleDailyReminder,
} from '../lib/notifications';

/** وقت التذكير اليومي الافتراضي */
const REMINDER_HOUR = 5;
const REMINDER_MINUTE = 30;
import { Card, Row, Section, Toggle } from '../components/ui';
import type { Madhab } from '../lib/store';

const FONT_STEPS = [20, 24, 28, 32, 38, 44, 52];
type GpsState = 'idle' | 'busy' | 'ok' | 'denied';

export default function Settings() {
  const t = useT();
  const L = useL();
  const s = useSettings();
  const [space, setSpace] = useState({ used: 0, quota: 0 });
  const [gps, setGpsState] = useState<GpsState>('idle');
  const [perm, setPerm] = useState<NotificationPermission | 'unsupported'>(notificationSupport());

  useEffect(() => { void storageInfo().then(setSpace); }, []);

  const askNotify = async () => {
    const p = await requestPermission();
    setPerm(p);
    s.set('notifications', p === 'granted');
    // مزامنة الخلفية تجعل التنبيه يصل حتى أُغلق التطبيق
    if (p === 'granted') await enableBackgroundSync();
  };

  const clearCache = async () => {
    if (!window.confirm(t('clearDataConfirm'))) return;
    await new Promise<void>((res) => {
      const req = indexedDB.deleteDatabase('noor-db');
      req.onsuccess = req.onerror = req.onblocked = () => res();
    });
    if ('caches' in window) {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
    }
    localStorage.removeItem('noor-settings');
    window.location.reload();
  };

  const useGps = async () => {
    setGpsState('busy');
    try {
      const pos = await locate();
      // الإحداثيات الحقيقية للجهاز — لا إحداثيات أقرب مدينة (فرق دقائق في المواقيت)
      const c = nearestCity(pos.coords.latitude, pos.coords.longitude);
      s.set('location', { lat: pos.coords.latitude, lon: pos.coords.longitude, label: `${c.ar}، ${c.country}` });
      setGpsState('ok');
    } catch {
      setGpsState('denied');
    }
  };

  return (
    <div className="animate-fade-in">
      <Section title={t('settings')} />

      {/* المظهر واللغة */}
      <Card className="mb-4">
        <Row label={t('language')}>
          <select
            value={s.lang}
            onChange={(e) => s.set('lang', e.target.value as 'ar' | 'en')}
            className="rounded-lg border border-white/10 bg-ink-700 px-3 py-1.5 text-sm text-slate-100 outline-none"
          >
            <option value="ar">العربية</option>
            <option value="en">English</option>
          </select>
        </Row>
        <Row label={t('theme')}>
          <select
            value={s.theme}
            onChange={(e) => s.set('theme', e.target.value as 'dark' | 'light')}
            className="rounded-lg border border-white/10 bg-ink-700 px-3 py-1.5 text-sm text-slate-100 outline-none"
          >
            <option value="dark">{t('dark')}</option>
            <option value="light">{t('light')}</option>
          </select>
        </Row>
        <Row label={t('fontSize')}>
          <select
            value={s.reading.fontSize}
            onChange={(e) => s.set('reading', { ...s.reading, fontSize: Number(e.target.value) })}
            className="rounded-lg border border-white/10 bg-ink-700 px-3 py-1.5 text-sm text-slate-100 outline-none"
          >
            {FONT_STEPS.map((n) => (
              // <span> داخل <option> غير صالح في HTML
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </Row>
      </Card>

      {/* الصلاة */}
      <Section title={t('prayer')} />
      <Card className="mb-4">
        <Row label={t('method')}>
          <select
            value={s.calcMethod}
            onChange={(e) => s.set('calcMethod', e.target.value)}
            className="max-w-[60%] rounded-lg border border-white/10 bg-ink-700 px-3 py-1.5 text-sm text-slate-100 outline-none"
          >
            {Object.entries(CALC_METHODS).map(([k, v]) => (
              <option key={k} value={k}>{L(v)}</option>
            ))}
          </select>
        </Row>
        <Row label={t('madhab')}>
          <select
            value={s.madhab}
            onChange={(e) => s.set('madhab', e.target.value as Madhab)}
            className="rounded-lg border border-white/10 bg-ink-700 px-3 py-1.5 text-sm text-slate-100 outline-none"
          >
            {Object.entries(MADHABS).map(([k, v]) => (
              <option key={k} value={k}>{L({ ar: v.ar, en: v.short })}</option>
            ))}
          </select>
        </Row>
        <Row label={t('qibla')}>
          <span className="text-sm text-slate-300">
            {s.location ? s.location.label : L({ ar: 'غير محدَّد', en: 'Not set' })}
          </span>
        </Row>
        <div className="border-t border-white/5 py-3">
          <div className="mb-2 flex gap-2">
            <button
              type="button"
              onClick={useGps}
              disabled={gps === 'busy'}
              className="btn-ghost flex-1"
            >
              {gps === 'busy' ? L({ ar: 'جارٍ التحديد…', en: 'Locating…' }) : t('useGPS')}
            </button>
          </div>
          {gps === 'denied' ? (
            <p className="mb-2 text-xs text-amber-300">
              {L({ ar: 'تعذّر تحديد الموقع. اختر مدينتك من القائمة أدناه.', en: 'Could not locate you. Pick your city below.' })}
            </p>
          ) : null}
          <label className="label-ar block pb-1">{t('pickCity')}</label>
          <select
            value={s.location?.label ?? ''}
            onChange={(e) => {
              const c = CITIES.find((x) => `${x.ar}، ${x.country}` === e.target.value);
              if (c) { s.set('location', { lat: c.lat, lon: c.lon, label: `${c.ar}، ${c.country}` }); setGpsState('idle'); }
            }}
            className="w-full rounded-lg border border-white/10 bg-ink-700 px-3 py-2 text-sm text-slate-100 outline-none"
          >
            <option value="">{L({ ar: 'اختر مدينة…', en: 'Pick a city…' })}</option>
            {CITIES.map((c) => (
              <option key={c.ar} value={`${c.ar}، ${c.country}`}>{c.ar} — {c.country}</option>
            ))}
          </select>
        </div>
      </Card>

      {/* التنبيهات */}
      <Section title={L({ ar: 'التنبيهات', en: 'Notifications' })} />
      <Card className="mb-4">
        <Toggle
          on={s.athanEnabled}
          onChange={(v) => s.set('athanEnabled', v)}
          label={t('athan')}
          hint={s.athanEnabled ? t('athanOn') : t('athanOff')}
        />
        <div className="border-t border-white/5 py-3">
          <label className="label-ar block pb-1">{t('volume')}</label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={s.athanVolume}
            onChange={(e) => s.set('athanVolume', Number(e.target.value))}
            className="w-full accent-gold-400"
          />
        </div>
        {perm === 'unsupported' ? (
          <p className="pb-2 text-xs text-slate-500">
            {L({ ar: 'هذا المتصفح لا يدعم التنبيهات.', en: 'This browser does not support notifications.' })}
          </p>
        ) : perm !== 'granted' ? (
          <button type="button" onClick={askNotify} className="btn-ghost w-full">
            {L({ ar: 'السماح بالتنبيهات', en: 'Allow notifications' })}
          </button>
        ) : (
          <p className="pb-2 text-xs text-emerald-300">
            {L({ ar: 'التنبيهات مفعّلة', en: 'Notifications allowed' })}
          </p>
        )}
        <div className="border-t border-white/5">
          <Toggle
            on={s.dailyReminders}
            onChange={(v) => {
              s.set('dailyReminders', v);
              if (v) scheduleDailyReminder(REMINDER_HOUR, REMINDER_MINUTE);
              else void clearDailyReminder();
            }}
            label={t('dailyReminders')}
            hint={L({
              ar: `تذكير يومي عند ${REMINDER_HOUR}:${String(REMINDER_MINUTE).padStart(2, '0')} بأذكار اليوم وآية اليوم`,
              en: `A daily reminder at ${REMINDER_HOUR}:${String(REMINDER_MINUTE).padStart(2, '0')} with today's adhkar and verse`,
            })}
          />
        </div>
      </Card>

      {/* البيانات */}
      <Section title={t('dataAndPrivacy')} />
      <Card className="mb-4">
        <Row label={t('storage')}>
          <span className="num text-sm text-slate-300">
            {(space.used / 1_048_576).toFixed(1)} MB
            {space.quota ? ` / ${(space.quota / 1_048_576).toFixed(0)} MB` : ''}
          </span>
        </Row>
        <div className="flex flex-wrap gap-2 py-3">
          <Link to="/download" className="btn-ghost flex-1">{t('download')}</Link>
          <button type="button" onClick={clearCache} className="btn-ghost flex-1 !text-rose-300">
            {t('clearData')}
          </button>
        </div>
        <p className="pb-1 text-xs leading-relaxed text-slate-500">
          {t('contentPolicy')}
        </p>
      </Card>

      <div className="py-6 text-center">
        <Link to="/about" className="text-sm text-gold-400 underline">{t('about')}</Link>
        <p className="mt-3 text-[11px] leading-relaxed text-slate-600">{t('disclaimer')}</p>
      </div>
    </div>
  );
}
