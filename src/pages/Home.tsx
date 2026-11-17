import { useMemo, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useSettings } from '../lib/store';
import { useAsync, useL, useT, useTick } from '../lib/hooks';
import { getAyah, getSurahs } from '../lib/content';
import { computeTimes, nextPrayer, PRAYERS, formatRemaining, qiblaBearing, distanceToKaaba } from '../lib/prayer';
import { toHijri, formatHijri, formatGregorian } from '../lib/hijri';
import { dueForReview, loadHifz, memorizedCount, todayIndex } from '../lib/hifz';
import { loadTasmee3 } from '../lib/tasmee3';
import { notifyNow } from '../lib/notifications';
import { Badge, Card, Ornament, ProgressBar, Section } from '../components/ui';
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
  const goal = useSettings((s) => s.goal);
  const notifications = useSettings((s) => s.notifications);
  const dailyReminders = useSettings((s) => s.dailyReminders);

  /** وردك بعد كل صلاة — جدولة مستقلة تماماً عن تنبيهات الأذان */
  const wirdTimers = useRef<number[]>([]);
  useEffect(() => {
    wirdTimers.current.forEach((id) => window.clearTimeout(id));
    wirdTimers.current = [];
    if (!notifications || !dailyReminders || !location) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const todayLocal = new Date();
    const times = computeTimes(todayLocal, location.lat, location.lon, calcMethod, madhab);
    const offsets: Array<[string, number, string]> = [
      ['fajr', 15, 'ورد الفجر'],
      ['dhuhr', 10, 'ورد الظهر'],
      ['asr', 10, 'ورد العصر'],
      ['maghrib', 10, 'ورد المغرب'],
      ['isha', 15, 'ورد العشاء'],
    ];
    for (const [key, mins, label] of offsets) {
      const at = (times as unknown as Record<string, Date>)[key];
      if (!(at instanceof Date)) continue;
      const fireAt = at.getTime() + mins * 60_000;
      const delay = fireAt - Date.now();
      if (delay < 0) continue;
      const id = window.setTimeout(() => {
        void notifyNow(`${label} — حان وردك`, 'دقائق مع القرآن الكريم الآن', `noor-wird-${key}`);
      }, Math.min(delay, 2_147_483_000));
      wirdTimers.current.push(id);
    }
    return () => {
      wirdTimers.current.forEach((id) => window.clearTimeout(id));
      wirdTimers.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifications, dailyReminders, location, calcMethod, madhab]);

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

  /**
   * متابعة الحفظ تُقرأ من تخزينها الخاص: حالة مستقلة عن الإعدادات،
   * فلا تُشتقّ من حالة التطبيق ولا تُكتب في أول رسم.
   */
  const hifz = useMemo(() => {
    const s = loadHifz();
    return {
      memorized: s.entries.reduce((a, e) => a + memorizedCount(e), 0),
      due: dueForReview(s, todayIndex(), 20, loadTasmee3()).length,
    };
  }, []);

  const quranAyahs = surahs.data?.reduce((a, s) => a + s.verses, 0) ?? 0;
  const hifzKnown = quranAyahs > 0;
  const hifzPct = hifzKnown ? (hifz.memorized / quranAyahs) * 100 : 0;

  /** تقدّم الختمة: مجموع آيات السور السابقة على آخر موضع قراءة + الآية الحالية */
  const khatmaPct = useMemo(() => {
    if (!surahs.data || surahs.data.length === 0) return 0;
    let before = 0;
    for (const su of surahs.data) {
      if (su.n < lastSurah) before += su.verses;
      else break;
    }
    return Math.min(100, ((before + lastAyah) / 6236) * 100);
  }, [surahs.data, lastSurah, lastAyah]);

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

      {/* هدفي من القرآن — يُضبط في الجولة الافتتاحية أو من الإعدادات */}
      {goal ? (
        <Link to="/settings" className="mb-5 block animate-fade-in">
          <Card className="border-gold-400/25 bg-gradient-to-br from-gold-400/10 to-transparent">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gold-400/15 text-gold-300">
                <QuranIcon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-slate-500">{L({ ar: 'هدفي من القرآن', en: 'My goal' })}</p>
                <p className="truncate text-sm font-bold text-slate-100">
                  {goal.type === 'khatma' && L({ ar: `ختم المصحف خلال ${goal.khatmaDays ?? 60} يوماً`, en: `Completing the Quran in ${goal.khatmaDays ?? 60} days` })}
                  {goal.type === 'hifzJuz' && L({ ar: 'حفظ جزء عم', en: 'Memorizing Juz Amma' })}
                  {goal.type === 'hifzSurahs' && L({ ar: 'حفظ سور محددة', en: 'Memorizing specific surahs' })}
                  {goal.type === 'tajweed' && L({ ar: 'ختم المصحف + تأسيس التجويد', en: 'Khatma + tajweed foundations' })}
                  {goal.type === 'tadabbur' && L({ ar: 'فهم وتدبر التلاوة', en: 'Understanding and reflecting' })}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {L({ ar: `بمعدل ${goal.dailyTarget} آية يومياً`, en: `${goal.dailyTarget} ayahs daily` })}
                  {goal.name ? <> · <span className="text-gold-300">{goal.name}</span></> : null}
                </p>
              </div>
              <span className="shrink-0 text-xs text-slate-600">{L({ ar: 'تعديل', en: 'Edit' })}‹</span>
            </div>
            {(goal.type === 'khatma' || goal.type === 'tajweed' || goal.type === 'tadabbur') ? (
              <div className="mt-3"><ProgressBar value={khatmaPct} /></div>
            ) : (
              <div className="mt-3"><ProgressBar value={hifzPct} /></div>
            )}
          </Card>
        </Link>
      ) : (
        <Link to="/onboarding?edit=1" className="mb-5 block">
          <Card className="flex items-center justify-between gap-3 border-dashed">
            <span className="text-xs text-slate-400">{L({ ar: 'لم تُحدد هدفك بعد — دقيقة واحدة تكفي', en: 'You have not set your goal yet — one minute is enough' })}</span>
            <span className="shrink-0 text-xs font-semibold text-gold-300">{L({ ar: 'حدد هدفي ←', en: 'Set goal →' })}</span>
          </Card>
        </Link>
      )}

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

      {/* وردك اليوم — من موضع قراءتك الحقيقي، بلا ادعاء تقدّم مخفي */}
      {surahs.data ? (() => {
        const daily = Math.max(1, Math.min(50, goal?.dailyTarget ?? 5));
        const startSurah = (() => {
          const last = surahs.data.find((x) => x.n === lastSurah);
          if (last && lastAyah >= last.verses) return { s: Math.min(114, lastSurah + 1), a: 1 };
          return { s: lastSurah, a: lastAyah + 1 };
        })();
        const wird = (() => {
          const out: Array<{ surah: number; a: number; name: string }> = [];
          let s = startSurah.s, a = startSurah.a, i = surahs.data.findIndex((x) => x.n === s);
          while (out.length < daily && i < surahs.data.length) {
            const cur = surahs.data[i];
            if (a > cur.verses) { i += 1; if (i < surahs.data.length) { s = surahs.data[i].n; a = 1; } continue; }
            out.push({ surah: s, a, name: cur.ar });
            a += 1;
          }
          return out;
        })();
        if (wird.length === 0) return null;
        const first = wird[0];
        const last = wird[wird.length - 1];
        return (
          <Section title={L({ ar: 'وردك اليوم', en: 'Today’s wird' })}>
            <Link to={`/quran/${first.surah}/${first.a}`} className="block">
              <Card className="border-gold-400/20">
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gold-400/10 text-gold-300">
                    <QuranIcon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-100">
                      {L({ ar: `من «${first.name}» آية ${first.a} إلى «${last.name}» آية ${last.a}`, en: `${first.name} ${first.a} → ${last.name} ${last.a}` })}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      <span className="num">{wird.length}</span> {L({ ar: 'آية — اضغط لمتابعة قراءتك', en: 'ayahs — tap to continue reading' })}
                    </p>
                  </div>
                  <span className="shrink-0 text-slate-600">‹</span>
                </div>
              </Card>
            </Link>
          </Section>
        );
      })() : null}

      {/* متابعة الحفظ */}
      <Section title={L({ ar: 'متابعة الحفظ', en: 'Memorization' })}>
        <Link to="/hifz" className="block">
          <Card>
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gold-400/10 text-gold-300">
                <QuranIcon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-100">
                  {hifz.memorized > 0
                    ? L({ ar: 'متابعة حفظك اليوم', en: 'Continue memorizing' })
                    : L({ ar: 'ابدأ تتبّع حفظك', en: 'Start tracking' })}
                </p>
                <p className="text-xs text-slate-500">
                  {hifz.memorized > 0 ? (
                    <>
                      <span className="num">{hifz.memorized}</span>
                      <span> {L({ ar: 'آية محفوظة', en: 'verses memorized' })}</span>
                    </>
                  ) : (
                    L({ ar: 'اضغط لتسجيل ما حفظته', en: 'Tap to record what you memorized' })
                  )}
                </p>
              </div>
              <span className="shrink-0 text-slate-600">‹</span>
            </div>

            {hifz.memorized > 0 ? (
              <>
                <div className="mt-3">
                  <ProgressBar value={hifzPct} />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge tone="gold">
                    {L({ ar: 'من الختمة', en: 'of the run' })}{' '}
                    <span className="num">{hifzKnown ? `${Math.round(hifzPct)}٪` : '—'}</span>
                  </Badge>
                  {hifz.due > 0 ? (
                    <Badge tone="green">
                      {L({ ar: 'مراجعة', en: 'Review' })}{' '}
                      <span className="num">{hifz.due}</span>
                    </Badge>
                  ) : null}
                </div>
              </>
            ) : null}
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
