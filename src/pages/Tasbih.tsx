/**
 * المسبحة
 * ------------------------------------------------------------------
 * تسع صيغ مشهورة بتشكيل صحيح، تُعرض بلا أرقام مصادر. المرجع نص ثابت:
 * «ورد في أذكار الكتاب والسنة». الإجمالي يُحفظ تلقائياً في المتجر.
 */

import { useState } from 'react';
import { useSettings } from '../lib/store';
import { useS, useT } from '../lib/hooks';
import { Card, ProgressBar, Section } from '../components/ui';
import { TasbihIcon } from '../components/icons';

interface Dhikr {
  key: string;
  ar: string;
  target: number;
  meaningAr: string;
  meaningEn: string;
}

const REF = 'ورد في أذكار الكتاب والسنة';

const DHIKR: Dhikr[] = [
  { key: 'subhan-allah', ar: 'سُبْحَانَ اللهِ', target: 33, meaningAr: 'تنزيه الله عن كل نقص', meaningEn: 'Declaring Allah free of all imperfection' },
  { key: 'alhamdu-lillah', ar: 'الْحَمْدُ لِلَّهِ', target: 33, meaningAr: 'الثناء على الله وشكره', meaningEn: 'Praising and thanking Allah' },
  { key: 'allahu-akbar', ar: 'اللهُ أَكْبَرُ', target: 34, meaningAr: 'تعظيم الله فوق كل شيء', meaningEn: 'Magnifying Allah above all' },
  { key: 'la-ilaha-illa-allah', ar: 'لَا إِلَهَ إِلَّا اللهُ', target: 100, meaningAr: 'إفراد الله بالعبادة وحده', meaningEn: 'Worshipping Allah alone' },
  { key: 'subhan-allah-wa-bihamdih', ar: 'سُبْحَانَ اللهِ وَبِحَمْدِهِ', target: 100, meaningAr: 'تنزيه الله مع حمده والثناء عليه', meaningEn: 'Glorifying Allah along with His praise' },
  { key: 'subhan-allah-al-azim', ar: 'سُبْحَانَ اللهِ الْعَظِيمِ', target: 100, meaningAr: 'تنزيه الله العظيم عن كل نقص', meaningEn: 'Glorifying Allah the Magnificent' },
  { key: 'astaghfirullah', ar: 'أَسْتَغْفِرُ اللهَ', target: 100, meaningAr: 'طلب المغفرة من الله', meaningEn: 'Seeking forgiveness from Allah' },
  { key: 'la-hawla', ar: 'لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللهِ', target: 100, meaningAr: 'الاعتماد على عون الله وحده', meaningEn: 'Relying on the help of Allah alone' },
  { key: 'tahlil-ten', ar: 'لَا إِلَهَ إِلَّا اللهُ وَحْدَهُ لَا شَرِيكَ لَهُ', target: 10, meaningAr: 'توحيد الله ونفي الشريك عنه', meaningEn: 'Declaring the oneness of Allah' },
];

export default function Tasbih() {
  const t = useT();
  const S = useS();
  const counts = useSettings((s) => s.tasbihCounts);
  const total = useSettings((s) => s.tasbihTotal);
  const langIsAr = useSettings((s) => s.lang) === 'ar';
  const bump = useSettings((s) => s.bumpTasbih);
  const reset = useSettings((s) => s.resetTasbih);

  const [index, setIndex] = useState(0);
  const [msg, setMsg] = useState('');
  const [speaking, setSpeaking] = useState(false);

  const current = DHIKR[index] ?? DHIKR[0];
  const count = counts[current.key] ?? 0;
  const pct = Math.min(100, (count / current.target) * 100);

  const tap = () => {
    setMsg('');
    try {
      if (typeof window !== 'undefined' && 'navigator' in window) {
        navigator.vibrate?.(15);
      }
    } catch {
      /* الاهتزاز تحسين اختياري — تجاهل الفشل بصمت مع رسالة محايدة */
      setMsg(S('الاهتزاز غير متاح على هذا الجهاز', 'Vibration is unavailable on this device'));
    }
    const res = bump(current.key, current.target);
    if (res.done) {
      setIndex((i) => (i + 1) % DHIKR.length);
      setMsg(S('تقبّل الله. انتقلنا إلى الذكر التالي', 'Accepted, God willing. Moved to the next dhikr'));
    }
  };

  const resetAll = () => {
    reset();
    setIndex(0);
    setMsg(S('صُفّر العداد', 'Counter reset'));
  };

  const speakOnce = () => {
    setMsg('');
    try {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        setMsg(S('النطق الصوتي غير مدعوم في هذا المتصفح', 'Speech is not supported in this browser'));
        return;
      }
      const synth = window.speechSynthesis;
      synth.cancel();
      const u = new SpeechSynthesisUtterance(current.ar);
      u.lang = 'ar-SA';
      u.rate = 0.85;
      u.onend = () => setSpeaking(false);
      u.onerror = () => {
        setSpeaking(false);
        setMsg(S('تعذّر النطق الصوتي', 'Could not speak the text'));
      };
      setSpeaking(true);
      synth.speak(u);
    } catch (err) {
      setSpeaking(false);
      setMsg(err instanceof Error ? err.message : S('تعذّر النطق الصوتي', 'Could not speak the text'));
    }
  };

  return (
    <div className="animate-fade-in">
      <header className="mb-4 flex items-center gap-2">
        <TasbihIcon className="h-6 w-6 text-gold-400" />
        <h1 className="text-lg font-bold text-slate-100">{t('tasbih')}</h1>
      </header>

      {/* ---------- شريط اختيار الذكر ---------- */}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-2" role="tablist" aria-label={t('tasbih')}>
        {DHIKR.map((d, i) => {
          const c = counts[d.key] ?? 0;
          const active = i === index;
          return (
            <button
              key={d.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setIndex(i);
                setMsg('');
              }}
              className={`shrink-0 rounded-xl border px-3 py-2 text-start transition-transform active:scale-[.97] ${
                active ? 'border-gold-400/60 bg-gold-400/10' : 'border-white/10 bg-white/5'
              }`}
            >
              <span className="quran-text block text-base leading-8 text-slate-100">{d.ar}</span>
              <span className="num mt-0.5 block text-[11px] text-slate-400 tabular-nums">
                {c}/{d.target}
              </span>
            </button>
          );
        })}
      </div>

      {/* ---------- العداد الرئيسي ---------- */}
      <Section>
        <Card className="flex flex-col items-center gap-4 py-8 text-center">
          <p className="quran-text text-4xl leading-[2] text-gold-100">{current.ar}</p>
          <p className="max-w-md text-xs leading-6 text-slate-400">{langIsAr ? current.meaningAr : current.meaningEn}</p>
          <p className="text-[11px] text-slate-500">{REF}</p>

          <button
            type="button"
            onClick={tap}
            aria-label={S('اضغط للتسبيح', 'Tap to count')}
            className="flex h-44 w-44 flex-col items-center justify-center rounded-full border-4 border-gold-400/50 bg-gradient-to-br from-gold-400/20 to-emerald-500/10 shadow-lg shadow-gold-400/10 transition-transform active:scale-95"
          >
            <span className="num text-5xl font-bold text-slate-50 tabular-nums">{count}</span>
            <span className="num mt-1 text-xs text-slate-400 tabular-nums">
              / {current.target}
            </span>
          </button>

          <div className="w-full max-w-xs">
            <ProgressBar value={pct} tone="gold" />
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            <button type="button" className="btn-ghost active:scale-[.97]" onClick={resetAll}>
              {t('reset')}
            </button>
            <button
              type="button"
              className="btn-ghost active:scale-[.97]"
              onClick={speakOnce}
              disabled={speaking}
            >
              {speaking ? S('جارٍ النطق…', 'Speaking…') : S('استماع للذكر', 'Listen')}
            </button>
          </div>
          {msg ? <p className="text-xs text-slate-400">{msg}</p> : null}
        </Card>
      </Section>

      {/* ---------- إحصاء اليوم ---------- */}
      <Section title={t('totalToday')}>
        <Card>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-slate-300">{S('عدد الجولات المكتملة اليوم', 'Completed rounds today')}</span>
            <span className="num text-2xl font-bold text-emerald-300 tabular-nums">{total}</span>
          </div>
          <p className="mt-2 text-[11px] leading-5 text-slate-500">
            {S('يُحفظ الإجمالي تلقائياً في جهازك، ويُصفَّر مع العداد بزر التصفير', 'The total is saved automatically on your device, and resets with the counter')}
          </p>
        </Card>
      </Section>
    </div>
  );
}
