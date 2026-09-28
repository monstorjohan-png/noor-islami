/**
 * بوصلة القبلة
 * ------------------------------------------------------------------
 * بوصلة حية عبر حدث اتجاه الجهاز مع تصحيح زاوية الشاشة، وعند غياب
 * الجاذبة تعرض الزاوية والمسافة نصاً مع تعليمات واضحة.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSettings } from '../lib/store';
import { useS, useT } from '../lib/hooks';
import { distanceToKaaba, qiblaBearing } from '../lib/prayer';
import { Badge, Card, Row, Section } from '../components/ui';
import { QiblaIcon } from '../components/icons';

type DOEWithPerm = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<string>;
};

type OrientedEvent = DeviceOrientationEvent & {
  webkitCompassHeading?: number;
  absolute?: boolean;
};

function norm360(d: number): number {
  return ((d % 360) + 360) % 360;
}

/** الاتجاه من الجاذبة بالدرجات من الشمال، أو null إن تعذّر */
function headingFromEvent(e: OrientedEvent): number | null {
  if (typeof e.webkitCompassHeading === 'number' && Number.isFinite(e.webkitCompassHeading)) {
    return norm360(e.webkitCompassHeading);
  }
  if (typeof e.alpha !== 'number' || e.alpha === null || !Number.isFinite(e.alpha)) return null;
  let screenAngle = 0;
  try {
    screenAngle = window.screen?.orientation?.angle ?? 0;
  } catch {
    screenAngle = 0;
  }
  return norm360(360 - e.alpha + screenAngle);
}

/** الوصف الرباعي الموسّع للاتجاه */
function describeBearing(b: number, ar: boolean): string {
  const dirsAr = ['شمال', 'شمال شرق', 'شرق', 'جنوب شرق', 'جنوب', 'جنوب غرب', 'غرب', 'شمال غرب'];
  const dirsEn = ['North', 'North-East', 'East', 'South-East', 'South', 'South-West', 'West', 'North-West'];
  const i = Math.round(norm360(b) / 45) % 8;
  return ar ? dirsAr[i] : dirsEn[i];
}

export default function Qibla() {
  const t = useT();
  const S = useS();
  const location = useSettings((s) => s.location);
  const langIsAr = useSettings((s) => s.lang) === 'ar';

  const [heading, setHeading] = useState<number | null>(null);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [permMsg, setPermMsg] = useState('');
  const [errMsg, setErrMsg] = useState('');

  /* مستمعو الجاذبة — يُنظَّفون عند الخروج */
  useEffect(() => {
    let alive = true;
    const onOrient = (ev: Event) => {
      if (!alive) return;
      try {
        const h = headingFromEvent(ev as OrientedEvent);
        if (h !== null) {
          setHeading(h);
          setSupported(true);
        }
      } catch (err) {
        setErrMsg(err instanceof Error ? err.message : S('تعذّر قراءة اتجاه الجهاز', 'Could not read device direction'));
      }
    };
    try {
      if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) {
        setSupported(false);
        return () => {
          alive = false;
        };
      }
      window.addEventListener('deviceorientationabsolute', onOrient as EventListener, true);
      window.addEventListener('deviceorientation', onOrient as EventListener, true);
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : S('تعذّر تفعيل مستشعر الاتجاه', 'Could not enable the direction sensor'));
      setSupported(false);
    }
    return () => {
      alive = false;
      try {
        window.removeEventListener('deviceorientationabsolute', onOrient as EventListener, true);
        window.removeEventListener('deviceorientation', onOrient as EventListener, true);
      } catch (err) {
        console.warn('تعذّر إزالة مستمع الاتجاه', err);
      }
    };
  }, [S]);

  /* زر التفعيل — طلب إذن آي أو إس داخل معالج النقر مباشرة */
  const enableCompass = () => {
    setPermMsg('');
    setErrMsg('');
    try {
      const DOE = DeviceOrientationEvent as unknown as DOEWithPerm;
      if (typeof DOE.requestPermission === 'function') {
        DOE.requestPermission()
          .then((res) => {
            if (res === 'granted') {
              setPermMsg(S('تم تفعيل البوصلة. حرّك هاتفك ببطء لمعايرتها', 'Compass enabled. Move your phone slowly to calibrate it'));
            } else {
              setPermMsg(S('رُفض إذن الوصول إلى الجاذبة. فعّله من إعدادات المتصفح', 'Compass permission was denied. Enable it in the browser settings'));
            }
          })
          .catch((err: unknown) => {
            setErrMsg(err instanceof Error ? err.message : S('تعذّر طلب إذن الجاذبة', 'Could not request compass permission'));
          });
      } else {
        setPermMsg(S('البوصلة تعمل تلقائياً على هذا الجهاز. حرّك هاتفك ببطء', 'The compass works automatically on this device. Move your phone slowly'));
      }
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : S('تعذّر تفعيل البوصلة', 'Could not enable the compass'));
    }
  };

  if (!location) {
    return (
      <div className="animate-fade-in">
        <header className="mb-4 flex items-center gap-2">
          <QiblaIcon className="h-6 w-6 text-gold-400" />
          <h1 className="text-lg font-bold text-slate-100">{t('qibla')}</h1>
        </header>
        <Card className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-sm text-slate-300">{t('setLocation')}</p>
          <Link to="/prayer" className="btn-primary active:scale-[.97]">
            {S('تحديد الموقع من صفحة الصلاة', 'Set location from the Prayer page')}
          </Link>
        </Card>
      </div>
    );
  }

  const bearing = qiblaBearing(location.lat, location.lon);
  const km = distanceToKaaba(location.lat, location.lon);
  const hasCompass = supported !== false && heading !== null;
  const relative = hasCompass ? norm360(bearing - (heading ?? 0)) : bearing;
  const aligned = hasCompass && (relative < 6 || relative > 354);
  const noSensor = supported === false || (supported === null && heading === null);

  return (
    <div className="animate-fade-in">
      <header className="mb-4 flex items-center gap-2">
        <QiblaIcon className="h-6 w-6 text-gold-400" />
        <h1 className="text-lg font-bold text-slate-100">{t('qibla')}</h1>
        {aligned ? <Badge tone="green">{S('أنت متجه إلى القبلة', 'You are facing the Qibla')}</Badge> : null}
      </header>

      {/* ---------- البوصلة ---------- */}
      <Section>
        <Card className="flex flex-col items-center gap-4 py-6">
          <CompassDial
            heading={heading}
            bearing={bearing}
            aligned={aligned}
            emptyLabel={S('بانتظار إشارة الجاذبة', 'Waiting for the compass signal')}
          />

          <div className="text-center">
            <p className="label-ar">{t('qiblaDirection')}</p>
            <p className="num mt-1 text-3xl font-bold text-gold-200 tabular-nums">
              {Math.round(bearing)}°
            </p>
            <p className="mt-1 text-sm text-slate-300">{describeBearing(bearing, langIsAr)}</p>
            {hasCompass ? (
              <p className="num mt-1 text-xs text-slate-500 tabular-nums">
                {S('اتجاه هاتفك', 'Your heading')}: {Math.round(heading ?? 0)}° ·{' '}
                {S('الباقي للقبلة', 'left to Qibla')}: {Math.round(relative)}°
              </p>
            ) : null}
          </div>

          <button type="button" className="btn-primary active:scale-[.97]" onClick={enableCompass}>
            {S('تفعيل البوصلة', 'Enable the compass')}
          </button>
          {permMsg ? <p className="text-xs text-emerald-300">{permMsg}</p> : null}
          {errMsg ? <p className="text-xs text-rose-300">{errMsg}</p> : null}

          {noSensor ? (
            <div className="w-full rounded-xl border border-white/10 bg-ink-900/60 p-4 text-start">
              <p className="mb-1 text-sm font-semibold text-gold-200">
                {S('لا توجد جاذبة في هذا الجهاز', 'No compass sensor on this device')}
              </p>
              <p className="text-xs leading-6 text-slate-300">
                {S(
                  'اتجه بزاوية القبلة الموضحة أعلاه من الشمال باستخدام أي بوصلة خارجية. قف في مكان مفتوح بعيداً عن المعادن والمغناطيس، وأمسك الهاتف أفقياً، ثم استدر ببطء حتى تطابق الزاوية.',
                  'Face the Qibla angle shown above, measured from the north, using any external compass. Stand in an open place away from metal and magnets, hold the phone flat, then turn slowly until you match the angle.',
                )}
              </p>
            </div>
          ) : null}
        </Card>
      </Section>

      {/* ---------- بطاقة الموقع ---------- */}
      <Section title={S('موقعك', 'Your location')}>
        <Card>
          <Row label={S('التسمية', 'Label')}>
            <span className="text-sm text-slate-100">{location.label}</span>
          </Row>
          <Row label={S('الإحداثيات', 'Coordinates')}>
            <span className="num text-sm text-slate-200 tabular-nums">
              {location.lat.toFixed(3)}، {location.lon.toFixed(3)}
            </span>
          </Row>
          <Row label={t('qiblaDistance')}>
            <span className="num text-sm text-gold-200 tabular-nums">
              {km.toLocaleString('en-US')} {S('كم', 'km')}
            </span>
          </Row>
          <Row label={t('qiblaDirection')}>
            <span className="text-sm text-slate-100">
              <span className="num tabular-nums">{Math.round(bearing)}°</span> · {describeBearing(bearing, langIsAr)}
            </span>
          </Row>
          <div className="mt-3">
            <Link to="/prayer" className="btn-ghost inline-block active:scale-[.97]">
              {S('تغيير الموقع', 'Change location')}
            </Link>
          </div>
        </Card>
      </Section>
    </div>
  );
}

/* ---------- قرص البوصلة ---------- */

function CompassDial({
  heading,
  bearing,
  aligned,
  emptyLabel,
}: {
  heading: number | null;
  bearing: number;
  aligned: boolean;
  emptyLabel: string;
}) {
  const live = heading !== null;
  /* الإبرة تدور عكس اتجاه الهاتف لتبقى مشيرة إلى الشمال،
     وعلامة القبلة تدور بالفرق بين الزاويتين */
  const needleDeg = live ? norm360(-(heading ?? 0)) : 0;
  const qiblaDeg = live ? norm360(bearing - (heading ?? 0)) : bearing;
  const ring = aligned ? 'stroke-emerald-400' : 'stroke-gold-400/60';

  const ticks = Array.from({ length: 12 }, (_, i) => i * 30);

  return (
    <div role="img" aria-label={emptyLabel} className="relative">
      <svg width="240" height="240" viewBox="0 0 240 240" className="block">
        <circle cx="120" cy="120" r="112" fill="none" strokeWidth="2" className={ring} stroke="currentColor" opacity="0.9" />
        <circle cx="120" cy="120" r="96" fill="none" strokeWidth="1" stroke="currentColor" className="stroke-white/10" />

        {ticks.map((deg) => {
          const rad = ((deg - 90) * Math.PI) / 180;
          const major = deg % 90 === 0;
          const r1 = major ? 96 : 102;
          const x1 = 120 + r1 * Math.cos(rad);
          const y1 = 120 + r1 * Math.sin(rad);
          const x2 = 120 + 110 * Math.cos(rad);
          const y2 = 120 + 110 * Math.sin(rad);
          return (
            <line
              key={deg}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              strokeWidth={major ? 2.5 : 1.2}
              stroke="currentColor"
              className={major ? 'stroke-slate-300' : 'stroke-slate-600'}
            />
          );
        })}

        {/* حروف الاتجاهات ثابتة على القرص */}
        <text x="120" y="30" textAnchor="middle" fontSize="15" fontWeight="bold" fill="currentColor" className="fill-rose-300">ش</text>
        <text x="214" y="126" textAnchor="middle" fontSize="15" fontWeight="bold" fill="currentColor" className="fill-slate-300">ق</text>
        <text x="120" y="222" textAnchor="middle" fontSize="15" fontWeight="bold" fill="currentColor" className="fill-slate-300">ج</text>
        <text x="26" y="126" textAnchor="middle" fontSize="15" fontWeight="bold" fill="currentColor" className="fill-slate-300">غ</text>

        {/* إبرة الشمال */}
        <g transform={`rotate(${needleDeg} 120 120)`}>
          <polygon points="120,44 128,120 120,112 112,120" fill="#f87171" opacity="0.95" />
          <polygon points="120,196 128,120 120,128 112,120" fill="#e2e8f0" opacity="0.85" />
        </g>

        {/* علامة القبلة */}
        <g transform={`rotate(${qiblaDeg} 120 120)`}>
          <line x1="120" y1="120" x2="120" y2="52" strokeWidth="3" stroke="currentColor" className="stroke-gold-400" strokeDasharray="7 4" />
          <rect x="112" y="34" width="16" height="16" rx="3" transform="rotate(45 120 42)" fill="currentColor" className="fill-gold-400" />
        </g>

        <circle cx="120" cy="120" r="10" fill="currentColor" className="fill-ink-700 stroke-gold-400/70" strokeWidth="2" />
        <circle cx="120" cy="120" r="3.5" fill="currentColor" className="fill-gold-300" />
      </svg>
      {!live ? (
        <p className="pointer-events-none absolute inset-x-0 bottom-1 text-center text-[11px] text-slate-500">{emptyLabel}</p>
      ) : null}
    </div>
  );
}
