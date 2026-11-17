import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useL, useAsync } from '../lib/hooks';
import { getSurahs } from '../lib/content';
import { shareAchievement } from '../lib/achievement-card';
import { useState } from 'react';
import { loadHifz, memorizedCount, dueForReview, todayIndex } from '../lib/hifz';
import { loadTasmee3, weakestAyahsAll } from '../lib/tasmee3';
import { evaluateBadges, unlockedCount } from '../lib/badges';
import { Ornament, Section } from '../components/ui';
import { QuranIcon } from '../components/icons';

/**
 * لوحة رحلتك — حصيلة التلاوة والحفظ الحقيقية من تخزينك المحلي:
 * لا أرقام مستوردة ولا تقديرات؛ كل رقم هنا قابل للتتبع من `noor-hifz`
 * و`noor-tasmee3`.
 */
export default function Report() {
  const L = useL();
  const surahs = useAsync(() => getSurahs(), []);

  const stats = useMemo(() => {
    const h = loadHifz();
    const t = loadTasmee3();
    let memorized = 0;
    for (const e of h.entries) {
      memorized += memorizedCount(e);
    }
    return { h, t, memorized };
  }, []);

  const fullSurahs = useMemo(() => {
    if (!surahs.data) return 0;
    let n = 0;
    for (const e of stats.h.entries) {
      const su = surahs.data.find((x) => x.n === e.surah);
      if (su && memorizedCount(e) >= su.verses) n += 1;
    }
    return n;
  }, [stats.h.entries, surahs.data]);

  const mastered = useMemo(
    () => Object.values(stats.t.perAyah).filter((v) => v.ease === 2).length,
    [stats.t.perAyah],
  );
  const due = useMemo(() => dueForReview(stats.h, todayIndex(), 20, stats.t).length, [stats.h, stats.t]);
  const weak = useMemo(() => weakestAyahsAll(stats.t, 5), [stats.t]);
  const [sharing, setSharing] = useState<'idle' | 'busy' | 'shared' | 'downloaded' | 'failed'>('idle');

  /** أفضل إنجاز متاح للمشاركة — الأكبر رقماً أولاً */
  const shareTitle =
    stats.memorized >= 1000 ? L({ ar: 'ألف آية محفوظة', en: 'A thousand verses memorized' })
    : stats.memorized >= 100 ? L({ ar: 'مئة آية محفوظة', en: 'A hundred verses memorized' })
    : stats.memorized >= 10 ? L({ ar: 'عشر آيات محفوظة', en: 'Ten verses memorized' })
    : stats.memorized >= 1 ? L({ ar: 'أول آية محفوظة', en: 'First verse memorized' })
    : L({ ar: 'رحلتي مع القرآن بدأت', en: 'My Quran journey has begun' });

  const onShare = async () => {
    setSharing('busy');
    const r = await shareAchievement({
      title: shareTitle,
      value: String(stats.memorized),
      sub: L({ ar: 'آية محفوظة — والبقية قادمة بإذن الله', en: 'verses memorized — and more to come, Allah willing' }),
    });
    setSharing(r === 'shared' || r === 'downloaded' ? r : 'failed');
    window.setTimeout(() => setSharing('idle'), 4000);
  };

  const badgeStats = {
    memorized: stats.memorized,
    mastered,
    sessions: stats.t.sessions,
    streak: stats.t.streak,
    completedRuns: stats.h.completedRuns,
    fullSurahs,
  };
  const badges = evaluateBadges(badgeStats);
  const unlocked = unlockedCount(badgeStats);

  return (
    <div className="animate-fade-in">
      <Section title={L({ ar: 'لوحة رحلتك', en: 'Your journey' })} />

      {/* الحصيلة */}
      <div className="grid grid-cols-3 gap-2">
        <StatBlock value={stats.memorized} label={L({ ar: 'آية محفوظة', en: 'verses memorized' })} />
        <StatBlock value={mastered} label={L({ ar: 'آية أتقنتها', en: 'mastered' })} />
        <StatBlock value={stats.t.sessions} label={L({ ar: 'جلسة تسميع', en: 'sessions' })} />
        <StatBlock value={stats.t.streak} label={L({ ar: 'أيام متتالية', en: 'day streak' })} />
        <StatBlock value={due} label={L({ ar: 'تراجع اليوم', en: 'due today' })} tone="warn" />
        <StatBlock value={stats.h.completedRuns} label={L({ ar: 'ختمات', en: 'khatmas' })} />
      </div>

      {/* تحتاج تركيزك */}
      {weak.length > 0 ? (
        <Section title={L({ ar: 'تحتاج تركيزك', en: 'Needs your focus' })}>
          <div className="flex flex-wrap gap-2">
            {weak.map((w) => (
              <Link key={`${w.surah}:${w.ayah}`} to={`/tasmee3`} className="chip">
                <span className="quran-text">
                  {surahs.data?.find((s) => s.n === w.surah)?.ar ?? `سورة ${w.surah}`} : آية <span className="num">{w.ayah}</span>
                </span>
              </Link>
            ))}
          </div>
        </Section>
      ) : null}

      {/* الشارات */}
      <Section title={L({ ar: `الشارات — ${unlocked} من ${badges.length}`, en: `Badges — ${unlocked}/${badges.length}` })}>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {badges.map((b) => (
            <div
              key={b.id}
              className={`flex flex-col items-center gap-1.5 rounded-2xl border p-2.5 text-center transition-all ${
                b.isUnlocked ? 'border-gold-400/40 bg-gold-400/8' : 'border-white/5 bg-white/[.02] opacity-45'
              }`}
              title={b.desc.ar}
            >
              <span className={`grid h-10 w-10 place-items-center rounded-full ${b.isUnlocked ? 'bg-gold-400/15 text-gold-300' : 'bg-white/5 text-slate-600'}`}>
                <QuranIcon className="h-5 w-5" />
              </span>
              <span className="text-[10px] font-semibold leading-4 text-slate-200">{L(b.title)}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-center text-[10px] text-slate-600">
          {L({ ar: 'كل رقم هنا من تخزينك المحلي وحده — لا خوادم ولا تقديرات', en: 'Every number comes from your own device storage — no servers, no estimates' })}
        </p>
      </Section>

      <Ornament />

      {/* بطاقة الإنجاز — تُشارك أو تُحفظ كصورة */}
      <button type="button" className="btn-primary w-full !py-3.5" onClick={() => void onShare()} disabled={sharing === 'busy'}>
        {sharing === 'busy'
          ? L({ ar: 'تُرسم بطاقتك…', en: 'Painting your card…' })
          : sharing === 'shared'
            ? L({ ar: 'تمّت المشاركة', en: 'Shared' })
            : sharing === 'downloaded'
              ? L({ ar: 'حُفظت كصورة', en: 'Saved as image' })
              : sharing === 'failed'
                ? L({ ar: 'تعذرت المشاركة — حاول مجدداً', en: 'Share failed — try again' })
                : L({ ar: 'شارك إنجازي', en: 'Share my milestone' })}
      </button>
    </div>
  );
}

function StatBlock({ value, label, tone }: { value: number; label: string; tone?: 'warn' }) {
  return (
    <div className="card p-3 text-center">
      <p className={`num text-2xl font-bold ${tone === 'warn' ? 'text-amber-300' : 'text-gold-200'}`}>{value}</p>
      <p className="mt-1 text-[10px] leading-4 text-slate-500">{label}</p>
    </div>
  );
}
