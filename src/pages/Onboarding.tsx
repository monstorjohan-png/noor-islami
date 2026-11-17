import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useL } from '../lib/hooks';
import { useSettings } from '../lib/store';
import type { GoalType, QuranGoal } from '../lib/store';

import { QuranIcon, AdhkarIcon, BookmarkIcon, HomeIcon } from '../components/icons';

/**
 * الجولة الافتتاحية — خمس شاشات لتعريف المستخدم بالتطبيق وتحديد هدفه
 * من القرآن. تُحفظ نتيجة الهدف محلياً عبر `setGoal`، ولا تُرسل أي بيانات
 * إلى أي جهة. تُفتح أيضاً في وضع التعديل من الإعدادات (?edit=1).
 */

const STEPS = 5;

type Level = 'novice' | 'rising' | 'memorizing' | 'master';

const GOAL_META: Record<GoalType, { ar: string; en: string; descAr: string; target: number }> = {
  khatma: {
    ar: 'ختم المصحف',
    en: 'Complete the Quran',
    descAr: 'ورد يومي منتظم حتى الختمة',
    target: 20,
  },
  hifzJuz: {
    ar: 'حفظ جزء عم',
    en: 'Memorize Juz Amma',
    descAr: 'من النبإ إلى الناس بخطة يومية',
    target: 10,
  },
  hifzSurahs: {
    ar: 'حفظ سور محددة',
    en: 'Memorize specific surahs',
    descAr: 'قصار المفصل ثم ما تيسّر',
    target: 5,
  },
  tajweed: {
    ar: 'ختم + تأسيس التجويد',
    en: 'Khatma + tajweed foundations',
    descAr: 'ورد قراءة مع أحكام التجويد العملية',
    target: 10,
  },
  tadabbur: {
    ar: 'فهم وتدبّر التلاوة',
    en: 'Understand & reflect',
    descAr: 'تفسير كل آية مع الورد اليومي',
    target: 15,
  },
  browse: {
    ar: 'أتصفح أولاً',
    en: 'Just browse',
    descAr: 'بلا خطط — استكشف التطبيق على راحتك',
    target: 0,
  },
};

export default function Onboarding() {
  const L = useL();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const editing = params.get('edit') === '1';

  const storedGoal = useSettings((s) => s.goal);
  const setGoal = useSettings((s) => s.setGoal);
  const completeOnboarding = useSettings((s) => s.completeOnboarding);

  const [step, setStep] = useState(0);
  const [type, setType] = useState<GoalType>(storedGoal?.type ?? 'khatma');
  const [khatmaDays, setKhatmaDays] = useState<30 | 60 | 90>(storedGoal?.khatmaDays ?? 60);
  const [name, setName] = useState(storedGoal?.name ?? '');
  const [dailyTarget, setDailyTarget] = useState<number>(storedGoal?.dailyTarget ?? 10);
  const [level, setLevel] = useState<Level | null>(null);


  // المرحلة الافتتاحية تُفتح من الخاتمة: الحلقات القديمة لا تدعم ?edit قبل وجودها
  useEffect(() => {
    if (storedGoal) {
      setType(storedGoal.type);
      setKhatmaDays(storedGoal.khatmaDays ?? 60);
      setName(storedGoal.name);
      setDailyTarget(storedGoal.dailyTarget);
    }
    // يُقرأ مرة واحدة عند التركيب فقط — التعديلات اللفظية تخص المستخدم
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // اقتراح الهدف اليومي من نوع الهدف — ما لم يحدد المستخدم بنفسه
  const suggested = GOAL_META[type].target;
  useEffect(() => {
    setDailyTarget((cur) => (cur === storedGoal?.dailyTarget ? cur : suggested));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const pickType = (nt: GoalType) => {
    setType(nt);
    setDailyTarget(GOAL_META[nt].target || 5);
  };

  const dailyFromKhatma = useMemo(() => {
    // 6236 آية على مدى الأيام — تقريب محافظ يُعرض كإشارة لا كحساب رسمي
    if (type !== 'khatma') return null;
    return Math.max(1, Math.round(6236 / khatmaDays));
  }, [type, khatmaDays]);

  const finish = (skipGoal = false) => {
    const at = Date.now();
    if (!skipGoal && type !== 'browse') {
      const g: QuranGoal = {
        type,
        khatmaDays: type === 'khatma' || type === 'tajweed' ? khatmaDays : null,
        dailyTarget: Math.max(1, Math.min(50, dailyTarget)),
        name: name.trim().slice(0, 40),
        createdAt: storedGoal?.createdAt ?? at,
      };
      setGoal(g);
    } else if (!skipGoal && type === 'browse') {
      setGoal(null);
    }
    completeOnboarding();
    nav(editing ? '/settings' : '/', { replace: true });
  };

  const levelLabel = (lv: Level) =>
    L({
      ar: { novice: 'مبتدئ', rising: 'ناشئ', memorizing: 'حافظ نشط', master: 'متقن' }[lv],
      en: { novice: 'Beginner', rising: 'Developing', memorizing: 'Active memorizer', master: 'Master' }[lv],
    });

  return (
    <div className="pattern-bg flex min-h-dvh flex-col bg-ink-900 text-slate-100">
      {/* شريط التقدم */}
      <header className="mx-auto flex w-full max-w-md items-center justify-between px-6 pt-[max(1.25rem,var(--safe-t))]">
        <span className="num text-xs text-slate-500" dir="ltr">{step + 1} / {STEPS}</span>
        <div className="flex gap-1.5" aria-hidden>
          {Array.from({ length: STEPS }, (_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step ? 'w-6 bg-gold-400' : i < step ? 'w-3 bg-gold-400/50' : 'w-3 bg-white/10'
              }`}
            />
          ))}
        </div>
        {editing ? (
          <button type="button" className="text-xs text-slate-500 hover:text-slate-300" onClick={() => nav(-1)}>
            {L({ ar: 'إلغاء', en: 'Cancel' })}
          </button>
        ) : (
          <span className="w-10" aria-hidden />
        )}
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 pb-[max(2rem,var(--safe-b))] pt-4">
        {/* ── الشاشة 1: ترحيب ─────────────────────────────── */}
        {step === 0 && (
          <section className="flex flex-1 flex-col items-center justify-center text-center animate-fade-in">
            <div className="grid h-24 w-24 place-items-center rounded-3xl bg-gradient-to-br from-[#173F2E] to-[#081F16] text-5xl font-bold text-gold-300 ring-1 ring-gold-400/50 shadow-2xl shadow-emerald-950/60">
              ن
            </div>
            <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-slate-50">
              {L({ ar: 'أهلاً بك في نور', en: 'Welcome to Noor' })}
            </h1>
            <p className="mt-2 max-w-[26ch] text-sm leading-6 text-slate-400">
              {L({
                ar: 'رفيقك في حفظ القرآن الكريم — مصحف كامل، تسميع، مراجعة ذكية — كل شيء بلا نت.',
                en: 'Your companion for memorizing the Quran — full mushaf, recitation practice and smart review, fully offline.',
              })}
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              <span className="chip chip-active">{L({ ar: 'اقرأ بلا نت', en: 'Offline mushaf' })}</span>
              <span className="chip">{L({ ar: 'تسميع وتقييم', en: 'Recite & rate' })}</span>
              <span className="chip">{L({ ar: 'مراجعة ذكية', en: 'Smart review' })}</span>
            </div>
            <button type="button" className="btn-primary mt-10 w-full text-base !py-3.5" onClick={() => setStep(1)}>
              {L({ ar: 'ابدأ الرحلة', en: 'Start the journey' })}
            </button>
            <p className="mt-4 text-[11px] text-slate-600">
              {L({ ar: 'لا حساب، لا إعلانات، لا جمع بيانات — التطبيق كله على جهازك.', en: 'No account, no ads, no tracking — everything stays on your device.' })}
            </p>
          </section>
        )}

        {/* ── الشاشة 2: ما يميز نور ───────────────────────── */}
        {step === 1 && (
          <section className="flex flex-1 flex-col justify-center animate-fade-in">
            <h2 className="text-xl font-bold text-slate-50">{L({ ar: 'لماذا نور؟', en: 'Why Noor?' })}</h2>
            <p className="mt-1 text-sm text-slate-400">{L({ ar: 'أربع أشياء تصنع الفارق', en: 'Four things that make the difference' })}</p>
            <ul className="mt-5 space-y-3">
              {[
                {
                  Icon: QuranIcon,
                  ar: 'المصحف كاملاً برسم عثماني مع التفسير والترجمة — بلا نت بعد التحميل',
                  en: 'Full Uthmani mushaf with tafsir and translation — offline after download',
                },
                {
                  Icon: AdhkarIcon,
                  ar: 'أذكار الصباح والمساء والصلاة، ومواقيت الصلاة والقبلة والتقويم الهجري',
                  en: 'Daily adhkar, prayer times, qibla and Hijri calendar',
                },
                {
                  Icon: BookmarkIcon,
                  ar: 'خطة حفظ ومراجعة ذكية تتابع ما حفظته من أجلك',
                  en: 'A memorization plan with smart review that tracks your progress',
                },
                {
                  Icon: HomeIcon,
                  ar: 'خصوصيتك مقدّسة: لا حساب إجباري ولا جمع بيانات — كل شيء على جهازك',
                  en: 'Your privacy is sacred: no forced account, no data collection',
                },
              ].map(({ Icon, ar, en }, i) => (
                <li key={i} className="card flex items-start gap-3 p-4">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gold-400/12 text-gold-300">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="text-[13px] leading-6 text-slate-200">{L({ ar, en })}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6 flex gap-3">
              <button type="button" className="btn-ghost flex-1" onClick={() => setStep(0)}>
                {L({ ar: 'رجوع', en: 'Back' })}
              </button>
              <button type="button" className="btn-primary flex-[2] !py-3" onClick={() => setStep(2)}>
                {L({ ar: 'التالي', en: 'Next' })}
              </button>
            </div>
          </section>
        )}

        {/* ── الشاشة 3: تحديد الهدف ───────────────────────── */}
        {step === 2 && (
          <section className="flex flex-1 flex-col justify-center animate-fade-in">
            <h2 className="text-xl font-bold text-slate-50">{L({ ar: 'ما هدفك من القرآن؟', en: 'What is your goal?' })}</h2>
            <p className="mt-1 text-sm text-slate-400">{L({ ar: 'سنبني خطتك على أساسه — ويمكن تغييره لاحقاً', en: 'We will build your plan around it — changeable anytime' })}</p>
            <ul className="mt-4 space-y-2 overflow-y-auto" role="radiogroup" aria-label={L({ ar: 'اختر هدفك', en: 'Choose your goal' })}>
              {(Object.keys(GOAL_META) as GoalType[]).map((k) => {
                const meta = GOAL_META[k];
                const active = type === k;
                return (
                  <li key={k}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => pickType(k)}
                      className={`card flex w-full items-center gap-3 p-3 text-start transition-all ${
                        active ? 'border-gold-400/50 ring-2 ring-gold-400/30 bg-gold-400/5' : 'hover:border-white/10'
                      }`}
                    >
                      <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${active ? 'border-gold-400 bg-gold-400' : 'border-slate-600'}`}>
                        {active ? <span className="h-1.5 w-1.5 rounded-full bg-ink-900" /> : null}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-slate-100">{L(meta)}</span>
                        <span className="mt-0.5 block text-[11px] text-slate-500">{meta.descAr}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {/* مدة الختمة */}
            {(type === 'khatma' || type === 'tajweed') ? (
              <div className="mt-3">
                <p className="label-ar mb-2">{L({ ar: 'خلال كم يوماً؟', en: 'In how many days?' })}</p>
                <div className="flex gap-2">
                  {([30, 60, 90] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setKhatmaDays(d)}
                      className={`chip flex-1 justify-center !py-2 ${khatmaDays === d ? 'chip-active' : ''}`}
                    >
                      <span className="num">{d}</span> {L({ ar: 'يوم', en: 'days' })}
                    </button>
                  ))}
                </div>
                {dailyFromKhatma ? (
                  <p className="mt-2 text-center text-[11px] text-slate-500">
                    {L({ ar: 'يعادل تقريباً', en: 'Roughly' })} <span className="num text-gold-300">{dailyFromKhatma}</span> {L({ ar: 'آية يومياً', en: 'ayahs per day' })}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="mt-5 flex gap-3">
              <button type="button" className="btn-ghost flex-1" onClick={() => setStep(1)}>
                {L({ ar: 'رجوع', en: 'Back' })}
              </button>
              <button type="button" className="btn-primary flex-[2] !py-3" onClick={() => setStep(3)}>
                {L({ ar: 'التالي', en: 'Next' })}
              </button>
            </div>
          </section>
        )}

        {/* ── الشاشة 4: المستوى — اختياري ─────────────────── */}
        {step === 3 && (
          <section className="flex flex-1 flex-col justify-center animate-fade-in">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold text-slate-50">{L({ ar: 'دعنا نعرف مستواك', en: 'Let us know your level' })}</h2>
              <button type="button" className="btn-subtle !px-3 !py-1.5 text-xs" onClick={() => setStep(4)}>
                {L({ ar: 'تجاوز ←', en: 'Skip →' })}
              </button>
            </div>
            <p className="mt-1 text-sm text-slate-400">{L({ ar: 'ثلاث إجابات سريعة — لا تسجيل ولا تحليل', en: 'Three quick answers — no recording, no analysis' })}</p>

            <p className="label-ar mb-2 mt-5">{L({ ar: 'كم تحفظ من القرآن الآن؟', en: 'How much do you know by heart?' })}</p>
            <div className="flex flex-wrap gap-2">
              {([
                ['h1', 'لا أحفظ شيئاً'],
                ['h2', 'الفاتحة + قصار السور'],
                ['h3', 'جزء عم كاملاً'],
                ['h4', 'أكثر من جزء'],
              ] as const).map(([k, ar]) => {
                const lv: Level = k === 'h1' ? 'novice' : k === 'h2' ? 'rising' : k === 'h3' ? 'memorizing' : 'master';
                const active = level === lv;
                return (
                  <button key={k} type="button" className={`chip ${active ? 'chip-active' : ''}`} onClick={() => setLevel(lv)}>
                    {ar}
                  </button>
                );
              })}
            </div>

            <p className="label-ar mb-2 mt-5">{L({ ar: 'كيف تقرأ أمام غيرك؟', en: 'How comfortable is your recitation?' })}</p>
            <div className="flex flex-wrap gap-2">
              {[
                ['novice', 'أتلعثم أحياناً'],
                ['rising', 'أقرأ ببطء لكن بثبات'],
                ['memorizing', 'أقرأ بطلاقة'],
              ].map(([lv, ar]) => (
                <button key={lv} type="button" className={`chip ${level === lv ? 'chip-active' : ''}`} onClick={() => setLevel(lv as Level)}>
                  {ar}
                </button>
              ))}
            </div>

            {level ? (
              <p className="mt-5 rounded-xl border border-gold-400/25 bg-gold-400/5 px-4 py-3 text-center text-sm text-gold-200">
                {L({ ar: 'مستواك:', en: 'Your level:' })} <strong>{levelLabel(level)}</strong> — {L({ ar: 'اللهم بارك', en: 'may Allah bless you' })}
              </p>
            ) : null}

            <div className="mt-6 flex gap-3">
              <button type="button" className="btn-ghost flex-1" onClick={() => setStep(2)}>
                {L({ ar: 'رجوع', en: 'Back' })}
              </button>
              <button type="button" className="btn-primary flex-[2] !py-3" onClick={() => setStep(4)}>
                {L({ ar: 'التالي', en: 'Next' })}
              </button>
            </div>
          </section>
        )}

        {/* ── الشاشة 5: الخطة ورسالة الترحيب ───────────────── */}
        {step === 4 && (
          <section className="flex flex-1 flex-col justify-center animate-fade-in">
            <h2 className="text-xl font-bold text-slate-50">{L({ ar: 'لمسات أخيرة', en: 'Final touches' })}</h2>
            <p className="mt-1 text-sm text-slate-400">{L({ ar: 'لن يخرج أي اسم من هذا الجهاز', en: 'Your name never leaves this device' })}</p>

            <label htmlFor="onb-name" className="label-ar mb-1.5 mt-5 block">{L({ ar: 'كيف نناديك؟ (اختياري)', en: 'What should we call you? (optional)' })}</label>
            <input
              id="onb-name"
              type="text"
              value={name}
              maxLength={40}
              onChange={(e) => setName(e.target.value)}
              placeholder={L({ ar: 'صديق نور', en: 'Noor’s friend' })}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 placeholder-slate-600 outline-none transition focus:border-gold-400/50 focus:ring-2 focus:ring-gold-400/20"
              autoComplete="name"
            />

            <p className="label-ar mb-1.5 mt-4">{L({ ar: 'هدفك اليومي (آيات)', en: 'Daily target (ayahs)' })}</p>
            <div className="flex flex-wrap gap-2">
              {[3, 5, 10, 15, 20].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setDailyTarget(n)}
                  className={`chip !px-4 !py-2 text-sm ${dailyTarget === n ? 'chip-active' : ''}`}
                >
                  <span className="num">{n}</span>
                </button>
              ))}
            </div>

            <div className="card mt-6 border-gold-400/25 bg-gradient-to-br from-gold-400/10 to-transparent p-5 text-center">
              <p className="text-lg font-bold text-gold-200">
                {L({ ar: `أهلاً بك يا ${name.trim() || 'صديق نور'}`, en: `Welcome, ${name.trim() || 'Noor’s friend'}` })}
              </p>
              <p className="mt-2 text-[13px] leading-6 text-slate-300">
                {type === 'browse'
                  ? L({ ar: 'خطتك: التصفح على مهل — لا خطط ولا ضغوط، القرآن ينتظرك متى رجعت إليه.', en: 'Your plan: browse freely — no schedules, no pressure.' })
                  : L({
                      ar: `خطتك جاهزة: ${GOAL_META[type].ar}، بمعدل ${dailyTarget} آية يومياً${khatmaDays && (type === 'khatma' || type === 'tajweed') ? ` خلال ${khatmaDays} يوماً` : ''}.`,
                      en: `Your plan is ready: ${GOAL_META[type].en}, ${dailyTarget} ayahs daily.`,
                    })}
              </p>
              <p className="mt-2 text-[11px] text-slate-500">{L({ ar: 'تقبّل الله طاعتك — وإلى القرآن دائماً', en: 'May Allah accept your worship' })}</p>
            </div>

            <div className="mt-5 flex gap-3">
              <button type="button" className="btn-ghost flex-1" onClick={() => setStep(3)}>
                {L({ ar: 'رجوع', en: 'Back' })}
              </button>
              <button type="button" className="btn-primary flex-[2] !py-3" onClick={() => finish(false)}>
                {L({ ar: 'ابدأ الآن', en: 'Start now' })}
              </button>
            </div>
            <button type="button" className="btn-subtle mt-2 w-full text-xs" onClick={() => finish(true)}>
              {L({ ar: 'تخطي بدون هدف — سأختار لاحقاً', en: 'Skip without a goal — choose later' })}
            </button>
          </section>
        )}
      </main>
    </div>
  );
}
