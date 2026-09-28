import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useSettings } from '../lib/store';
import { useAsync, useL, useT, useTick } from '../lib/hooks';
import { getAyah, getSurahs } from '../lib/content';
import { computeTimes, nextPrayer, PRAYERS, formatRemaining, qiblaBearing, distanceToKaaba } from '../lib/prayer';
import { toHijri, formatHijri, formatGregorian } from '../lib/hijri';
import { Badge, Card, Ornament, Section } from '../components/ui';
import { AdhkarIcon, HadithIcon, NamesIcon, QuranIcon, TasbihIcon, CalendarIcon, PrayerIcon } from '../components/icons';

/** آية اليوم: موضع ثابت يتغيّر بتغيّر اليوم — يُقرَّر من المصدر لا من الذاكرة */
function verseOfDayIndex(): number {
  const d = new Date();
  // عدد الأيام منذ حقبة UTC بالتوقيت المحلي — لا UTC مباشرة،
  // وإلا تغيّرت الآية عند منتصف الليل UTC لا عند منتصف ليل المستخدم
  const days = Math.floor(
    Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000,
  );
  // 6236 آية — توزيع منتظم على السنة
  return (days * 7919) % 6236;
}

export default function Home() {
  const t = useT();
  const L = useL();
  useTick(30_000);

  const lang = useSettings((s) => s.lang);
  const location = useSettings((s) => s.location);
  const calcMethod = useSettings((s) => s.calcMethod);
  const madhab = useSettings((s) => s.madhab);
  const lastSurah = useSettings((s) => s.reading.lastSurah);
  const lastAyah = useSettings((s) => s.reading.lastAyah);
  const adhkarProgress = useSettings((s) => s.adhkarProgress);

  const surahs = useAsync(() => getSurahs(), []);

  /** آية اليوم — موضعها يُشتق من رقم اليوم ويُقرأ من المصحف */
  const verse = useAsync(async () => {
    const gi = verseOfDayIndex();
    const list = await getSurahs();
    let acc = 0;
    for (const su of list) {
      if (gi < acc + su.verses) {
        const ay = await getAyah(su.n, gi - acc + 1);
        return ay ? { surah: su, ayah: ay } : null;
      }
      acc += su.verses;
    }
    return null;
  }, []);

  // مواقيت اليوم
  const today = useMemo(() => {
    if (!location) return null;
    return computeTimes(new Date(), location.lat, location.lon, calcMethod, madhab);
  }, [location, calcMethod, madhab]);

  const next = useMemo(() => {
    if (!today || !location) return null;
    return nextPrayer(today, new Date(), {
      lat: location.lat, lon: location.lon, method: calcMethod, madhab,
    });
  }, [today, location, calcMethod, madhab]);

  const hijri = toHijri(new Date());

  const adhkarDone = Object.entries(adhkarProgress)
    .filter(([k, v]) => k !== '__day' && typeof v === 'number')
    .length;

  return (
    <div className="animate-fade-in">
      {/* الترويسة والسلام */}
      <header className="mb-5 pt-2">
        <h1 className="text-2xl font-bold text-slate-100">{t('appName')}</h1>
        <p className="mt-1 text-sm text-slate-400">{t('tagline')}</p>
        <p className="mt-2 text-xs text-slate-500">
          {formatGregorian(new Date())} · {formatHijri(hijri)}
        </p>
      </header>

      {/* الصلاة القادمة */}
      <Section title={t('nextPrayer')}>
        {next ? (
          <Link to="/prayer" className="block">
            <Card className="border-gold-400/25 bg-gradient-to-br from-gold-400/10 to-transparent">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm text-slate-400">{t('nextPrayer')}</p>
                  <p className="mt-0.5 text-2xl font-bold text-gold-200">
                    {L({ ar: PRAYERS.find((p) => p.key === next.key)?.ar ?? '', en: PRAYERS.find((p) => p.key === next.key)?.en ?? '' })}
                  </p>
                </div>
                <div className="shrink-0 text-end">
                  <p className="num text-3xl font-bold tabular-nums text-slate-100">
                    {next.date.toLocaleTimeString(lang === 'ar' ? 'ar-EG' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <p className="num mt-0.5 text-xs text-slate-400">
                    {(() => { const r = formatRemaining(next.date.getTime() - Date.now()); return `${r.h}:${r.m}`; })()}
                  </p>
                </div>
              </div>
            </Card>
          </Link>
        ) : (
          <Link to="/prayer">
            <Card className="text-center">
              <p className="text-sm text-slate-300">{t('setLocation')}</p>
              <p className="btn-primary mt-3 inline-flex">{t('useGPS')}</p>
            </Card>
          </Link>
        )}
      </Section>

      {/* القبلة إن توفّر الموقع */}
      {location ? (
        <Link to="/qibla" className="mb-7 block">
          <Card className="flex items-center justify-between gap-3">
            <span className="text-sm text-slate-300">{t('qiblaDirection')}</span>
            <span className="flex items-center gap-3">
              <span className="num text-lg font-bold text-gold-300">
                {qiblaBearing(location.lat, location.lon).toFixed(0)}°
              </span>
              <span className="num text-xs text-slate-500">
                {distanceToKaaba(location.lat, location.lon).toLocaleString('en-US')} km
              </span>
            </span>
          </Card>
        </Link>
      ) : null}

      {/* متابعة القراءة */}
      <Section title={t('continueReading')}>
        <Link to={`/quran/${lastSurah}/${lastAyah}`} className="block">
          <Card>
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gold-400/10 text-gold-300">
                <QuranIcon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-100">
                  {surahs.data?.find((s) => s.n === lastSurah)?.ar ?? `${t('surah')} ${lastSurah}`}
                </p>
                <p className="text-xs text-slate-500">
                  {t('verse')} <span className="num">{lastAyah}</span>
                </p>
              </div>
              <span className="shrink-0 text-slate-600">‹</span>
            </div>
          </Card>
        </Link>
      </Section>

      {/* الوصول السريع */}
      <Section title={t('more')}>
        <div className="grid grid-cols-3 gap-2.5">
          <Tile to="/adhkar" label={t('adhkar')} Icon={AdhkarIcon} badge={adhkarDone ? String(adhkarDone) : undefined} />
          <Tile to="/hadith" label={t('hadith')} Icon={HadithIcon} />
          <Tile to="/tasbih" label={t('tasbih')} Icon={TasbihIcon} />
          <Tile to="/names" label={t('names')} Icon={NamesIcon} />
          <Tile to="/prayer" label={t('prayer')} Icon={PrayerIcon} />
          <Tile to="/calendar" label={t('calendar')} Icon={CalendarIcon} />
        </div>
      </Section>

      {/* آية اليوم */}
      {verse.data ? (
        <Section title={L({ ar: 'آية اليوم', en: 'Verse of the day' })}>
          <Link to={`/quran/${verse.data.ayah.s}/${verse.data.ayah.a}`} className="block">
            <Card className="border-emerald-500/20">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge tone="green">{verse.data.surah.ar}</Badge>
                <Badge>{t('verse')} <span className="num">{verse.data.ayah.a}</span></Badge>
              </div>
              <p className="quran-text text-ink-50 text-xl leading-[2.15]">{verse.data.ayah.text}</p>
            </Card>
          </Link>
        </Section>
      ) : null}

      <Ornament />
      <p className="pb-4 text-center text-[11px] leading-relaxed text-slate-600">{t('disclaimer')}</p>
    </div>
  );
}

function Tile({
  to, label, Icon, badge,
}: { to: string; label: string; Icon: (p: { className?: string }) => JSX.Element; badge?: string }) {
  return (
    <Link to={to} className="card flex flex-col items-center gap-2 p-3.5 transition-colors hover:border-gold-400/30">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-gold-400/10 text-gold-300">
        <Icon className="h-5 w-5" />
      </span>
      <span className="text-[11px] text-slate-300">{label}</span>
      {badge ? <span className="num text-[10px] text-slate-500">{badge}</span> : null}
    </Link>
  );
}
