import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useL, useAsync } from '../lib/hooks';
import { getSurahs, getSurahAyahs } from '../lib/content';
import type { Surah } from '../lib/types';
import type { AyahView } from '../lib/content';
import {
  buildCloze,
  endSession,
  loadTasmee3,
  recordGrade,
  saveTasmee3,
  shuffle,
  tokenizeAyah,
} from '../lib/tasmee3';
import type { Ease, Tasmee3Mode, Tasmee3State } from '../lib/tasmee3';
import {
  ensureListenModel,
  listenState,
  transcribeArabic,
  blobToFloat32,
  scoreTranscript,
  gradeFromPct,
} from '../lib/listen';
import type { ListenScore } from '../lib/listen';
import { tokenizeArabic } from '../lib/ar-text';
import { checkWrittenWords } from '../lib/tasmee3';
import { Card, Ornament, Section, ProgressBar } from '../components/ui';
import { QuranIcon } from '../components/icons';

/**
 * التسميع — جلسة استذكار تفاعلية داخل التطبيق.
 * الأوضاع: كشف الآية بعد المحاولة · الكلمة الناقصة (اختيار من 4) ·
 * ترتيب الآيات · التسميع بالتسجيل مع تقييم ذاتي.
 * كل الأنواع تُخزن في `noor-tasmee3` ولا تمس بيانات متابعة الحفظ.
 */

type Phase = 'surah' | 'mode' | 'session' | 'done';

interface SessionStats {
  padded: number; // آيات جُرِّبت
  good: number;   // أتقنت (2)
  ok: number;     // جيد (1)
  weak: number;   // لم يتقن (0)
}

const MODE_LABELS: Record<Tasmee3Mode, { ar: string; en: string; hintAr: string }> = {
  reveal: {
    ar: 'اكشف بعد المحاولة',
    en: 'Recall, then reveal',
    hintAr: 'الآية مخفيّة — ردّد بصوتك ثم اكشف وقيّمها',
  },
  cloze: {
    ar: 'الكلمة الناقصة',
    en: 'Missing word',
    hintAr: 'اختر الكلمة المناسبة للموضع من أربعة خيارات',
  },
  order: {
    ar: 'رتّب الآيات',
    en: 'Order the ayahs',
    hintAr: 'اضغط الآيات بترتيب حفظها — خمس في كل جولة',
  },
  record: {
    ar: 'التسميع بالتسجيل',
    en: 'Record yourself',
    hintAr: 'اقرأ الآية مسجلاً صوتك ثم استمع وقيّمها ذاتياً',
  },
  write: {
    ar: 'اكتب وتلا',
    en: 'Write while reciting',
    hintAr: 'الآية مخفيّة — اكتبها وأنت تتلوها من الذاكرة، وكل كلمة تُفحص فوراً',
  },
};

export default function Tasmee3() {
  const L = useL();
  const nav = useNavigate();

  const [phase, setPhase] = useState<Phase>('surah');
  const [surah, setSurah] = useState<Surah | null>(null);
  const [ayahs, setAyahs] = useState<AyahView[]>([]);
  const [mode, setMode] = useState<Tasmee3Mode>('reveal');
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(1);
  const [idx, setIdx] = useState(0);
  const [state, setState] = useState<Tasmee3State>(() => loadTasmee3());
  const [stats, setStats] = useState<SessionStats>({ padded: 0, good: 0, ok: 0, weak: 0 });

  const surahs = useAsync(() => getSurahs(), []);

  // تحميل آيات السورة عند اختيارها
  const loadError = useMemo(() => null as Error | null, []);
  useEffect(() => {
    if (!surah) return;
    let live = true;
    getSurahAyahs(surah.n).then((rows) => {
      if (!live) return;
      setAyahs(rows);
      setFrom(1);
      setTo(rows.length);
      setIdx(0);
    }).catch(() => {
      if (live) setAyahs([]);
    });
    return () => { live = false; };
  }, [surah]);

  const persist = useCallback((next: Tasmee3State) => {
    setState(next);
    saveTasmee3(next);
  }, []);

  const grade = useCallback((surahN: number, ayahN: number, ease: Ease) => {
    setStats((s) => ({
      padded: s.padded + 1,
      good: s.good + (ease === 2 ? 1 : 0),
      ok: s.ok + (ease === 1 ? 1 : 0),
      weak: s.weak + (ease === 0 ? 1 : 0),
    }));
    setState((prev) => {
      const next = recordGrade(prev, surahN, ayahN, ease);
      saveTasmee3(next);
      return next;
    });
  }, []);

  const sessionAyahs = useMemo(
    () => ayahs.filter((a) => a.a >= from && a.a <= to),
    [ayahs, from, to],
  );
  const current = sessionAyahs[idx] ?? null;

  const next = useCallback(() => {
    setIdx((i) => {
      if (i + 1 >= sessionAyahs.length) {
        setPhase('done');
        return i;
      }
      return i + 1;
    });
  }, [sessionAyahs.length]);

  const finish = useCallback(() => {
    if (!surah) return;
    persist(endSession(state, mode, surah.n));
    nav('/hifz');
  }, [persist, state, mode, surah, nav]);

  // ── مرحلة اختيار السورة ───────────────────────────────────
  if (phase === 'surah') {
    return (
      <div className="animate-fade-in">
        <Section title={L({ ar: 'التسميع والاستذكار', en: 'Recitation practice' })} />
        <p className="-mt-3 mb-4 text-xs leading-5 text-slate-500">
          {L({ ar: 'اختر سورة، اختر طريقة، ثم سمّع وردّد — التقييم ذاتي ولا تُرسل أي بيانات.', en: 'Pick a surah, pick a method, recite — self-graded, nothing leaves your device.' })}
        </p>
        <div className="grid grid-cols-3 gap-2">
          {surahs.data?.map((s) => (
            <button
              key={s.n}
              type="button"
              onClick={() => { setSurah(s); setPhase('mode'); }}
              className="card flex flex-col items-center gap-1 p-2.5 transition-colors hover:border-gold-400/40"
            >
              <span className="num text-[10px] text-slate-500">{s.n}</span>
              <span className="quran-text text-sm leading-5 text-slate-100">{s.ar}</span>
              <span className="num text-[10px] text-slate-600">{s.verses} {L({ ar: 'آية', en: 'ayahs' })}</span>
            </button>
          ))}
        </div>
        {loadError ? <p className="mt-3 text-center text-xs text-rose-300">{String(loadError)}</p> : null}
        <p className="mt-5 text-center text-[11px] text-slate-600">
          {L({ ar: 'آخر وضع:', en: 'Last mode:' })} {state.lastMode ? MODE_LABELS[state.lastMode].ar : '—'} ·{' '}
          {L({ ar: `الجلسات: ${state.sessions}`, en: `Sessions: ${state.sessions}` })}
        </p>
      </div>
    );
  }

  // ── مرحلة اختيار الوضع والنطاق ────────────────────────────
  if (phase === 'mode' && surah) {
    return (
      <div className="animate-fade-in">
        <button type="button" className="btn-subtle mb-3 !px-3 !py-1.5 text-xs" onClick={() => setPhase('surah')}>
          ← {L({ ar: 'تغيير السورة', en: 'Change surah' })}
        </button>
        <Card>
          <div className="text-center">
            <p className="text-[11px] text-slate-500">{L({ ar: 'سورة', en: 'Surah' })} <span className="num">{surah.n}</span></p>
            <h1 className="quran-text mt-1 text-2xl text-slate-50">{surah.ar}</h1>
            <p className="num mt-1 text-xs text-slate-500">{surah.verses} {L({ ar: 'آية', en: 'ayahs' })}</p>
          </div>
        </Card>

        <p className="label-ar mb-2 mt-5">{L({ ar: 'الطريقة', en: 'Method' })}</p>
        <ul className="space-y-2">
          {(Object.keys(MODE_LABELS) as Tasmee3Mode[]).map((m) => (
            <li key={m}>
              <button
                type="button"
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
                className={`card flex w-full items-center gap-3 p-3 text-start transition-all ${
                  mode === m ? 'border-gold-400/50 bg-gold-400/5 ring-2 ring-gold-400/25' : ''
                }`}
              >
                <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${mode === m ? 'border-gold-400 bg-gold-400' : 'border-slate-600'}`}>
                  {mode === m ? <span className="h-1.5 w-1.5 rounded-full bg-ink-900" /> : null}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-100">{L(MODE_LABELS[m])}</span>
                  <span className="mt-0.5 block text-[11px] leading-4 text-slate-500">{MODE_LABELS[m].hintAr}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex items-center gap-3">
          <label className="flex flex-1 items-center gap-2 text-xs text-slate-400">
            {L({ ar: 'من', en: 'From' })}
            <input type="number" min={1} max={surah.verses} value={from}
              onChange={(e) => setFrom(clampNum(Number(e.target.value), 1, surah.verses))}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-center text-sm text-slate-100 outline-none" />
          </label>
          <label className="flex flex-1 items-center gap-2 text-xs text-slate-400">
            {L({ ar: 'إلى', en: 'To' })}
            <input type="number" min={1} max={surah.verses} value={to}
              onChange={(e) => setTo(clampNum(Number(e.target.value), 1, surah.verses))}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-center text-sm text-slate-100 outline-none" />
          </label>
        </div>

        <button
          type="button"
          className="btn-primary mt-5 w-full !py-3.5"
          onClick={() => {
            const f = Math.min(from, to);
            const t = Math.max(from, to);
            setFrom(f); setTo(t); setIdx(0); setStats({ padded: 0, good: 0, ok: 0, weak: 0 });
            setPhase('session');
          }}
        >
          {L({ ar: 'ابدأ التسميع', en: 'Start' })}
        </button>
      </div>
    );
  }

  // ── مرحلة الجلسة ───────────────────────────────────────────
  if (phase === 'session' && surah && current) {
    return (
      <div className="animate-fade-in">
        <div className="mb-3 flex items-center justify-between gap-3">
          <button type="button" className="btn-subtle !px-3 !py-1.5 text-xs" onClick={() => setPhase('mode')}>
            ← {L({ ar: 'إيقاف', en: 'Stop' })}
          </button>
          <p className="text-xs text-slate-500">
            <span className="quran-text text-slate-300">{surah.ar}</span> · <span className="num">{idx + 1}/{sessionAyahs.length}</span>
          </p>
        </div>

        {mode === 'reveal' ? (
          <RevealCard key={`${current.s}:${current.a}`} ayah={current} onGrade={(e) => { grade(surah.n, current.a, e); next(); }} />
        ) : null}
        {mode === 'cloze' ? (
          <ClozeCard key={`${current.s}:${current.a}`} ayah={current} pool={ayahs.flatMap((a) => tokenizeAyah(a.text))} onDone={(ok) => { grade(surah.n, current.a, ok ? 2 : 0); next(); }} />
        ) : null}
        {mode === 'order' ? (
          <OrderRound key={`${from}-${to}-${idx}`} ayahs={sessionAyahs.slice(idx, idx + 5)} baseIdx={idx} onWindowDone={(grades) => {
            for (const g of grades) grade(surah.n, g.ayah, g.ease);
            setIdx((i) => (i + 5 >= sessionAyahs.length ? (setPhase('done'), i) : i + 5));
          }} />
        ) : null}
        {mode === 'record' ? (
          <RecordCard key={`${current.s}:${current.a}`} ayah={current} onGrade={(e) => { grade(surah.n, current.a, e); next(); }} />
        ) : null}
        {mode === 'write' ? (
          <WriteCard key={`${current.s}:${current.a}`} ayah={current} onGrade={(e) => { grade(surah.n, current.a, e); next(); }} />
        ) : null}
      </div>
    );
  }

  // ── ملخص الجلسة ─────────────────────────────────────────────
  if (phase === 'done') {
    const total = stats.padded || 1;
    return (
      <div className="animate-fade-in">
        <Section title={L({ ar: 'اكتملت الجلسة', en: 'Session complete' })} />
        <Card className="text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-gold-400/15 text-gold-300">
            <QuranIcon className="h-8 w-8" />
          </div>
          <p className="mt-4 text-lg font-bold text-slate-100">{L({ ar: 'ما شاء الله — أكملت التسميع', en: 'MashaAllah — you finished' })}</p>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <StatBox n={stats.good} label={L({ ar: 'أتقنت', en: 'Mastered' })} tone="text-emerald-300" />
            <StatBox n={stats.ok} label={L({ ar: 'جيد', en: 'Good' })} tone="text-gold-300" />
            <StatBox n={stats.weak} label={L({ ar: 'تحتاج مراجعة', en: 'Needs review' })} tone="text-rose-300" />
          </div>
          <p className="mt-3 text-[11px] text-slate-500">
            <span className="num">{Math.round((stats.good / total) * 100)}٪</span> {L({ ar: 'إتقان هذه الجلسة', en: 'mastery this session' })}
          </p>
        </Card>
        <div className="mt-4 flex gap-3">
          <button type="button" className="btn-ghost flex-1" onClick={() => { setPhase('surah'); setIdx(0); }}>
            {L({ ar: 'سورة أخرى', en: 'Another surah' })}
          </button>
          <button type="button" className="btn-primary flex-1" onClick={finish}>
            {L({ ar: 'إنهاء', en: 'Done' })}
          </button>
        </div>
        <Ornament />
      </div>
    );
  }

  // تحميل السورة
  if (!surah) {
    return <div className="pt-10 text-center text-sm text-slate-500">…</div>;
  }
  if (ayahs.length === 0) {
    return <div className="pt-10 text-center text-sm text-slate-500">{L({ ar: 'تعذر تحميل السورة — تحقق من الاتصال ثم حاول', en: 'Could not load the surah — check connection and retry' })}</div>;
  }
  return null;
}

function clampNum(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

function StatBox({ n, label, tone }: { n: number; label: string; tone: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[.03] p-3">
      <p className={`num text-2xl font-bold ${tone}`}>{n}</p>
      <p className="mt-1 text-[11px] text-slate-500">{label}</p>
    </div>
  );
}

/* ── وضع: اكشف بعد المحاولة ─────────────────────────── */
function RevealCard({ ayah, onGrade }: { ayah: AyahView; onGrade: (e: Ease) => void }) {
  const L = useL();
  const [shown, setShown] = useState(false);
  return (
    <Card>
      <p className="text-center text-[11px] text-slate-500">
        {L({ ar: 'الآية', en: 'Ayah' })} <span className="num">{ayah.a}</span>
      </p>
      <div className="relative mt-4 min-h-[7.5rem]">
        <p className={`quran-text text-center text-2xl leading-[2.3] text-slate-50 transition-all duration-300 ${shown ? '' : 'select-none blur-[10px]'}`} aria-hidden={!shown}>
          {ayah.text}
        </p>
      </div>
      {!shown ? (
        <button type="button" className="btn-primary mt-4 w-full" onClick={() => setShown(true)}>
          {L({ ar: 'اكشف الآية', en: 'Reveal' })}
        </button>
      ) : (
        <div className="mt-4">
          <p className="label-ar mb-2 text-center">{L({ ar: 'كيف كان تسميعك؟', en: 'How was your recitation?' })}</p>
          <div className="grid grid-cols-3 gap-2">
            <button type="button" className="btn-primary !bg-emerald-400 !text-emerald-950 hover:!bg-emerald-300" onClick={() => onGrade(2)}>
              {L({ ar: 'أتقنت', en: 'Mastered' })}
            </button>
            <button type="button" className="btn-ghost" onClick={() => onGrade(1)}>
              {L({ ar: 'جيد', en: 'Good' })}
            </button>
            <button type="button" className="btn-ghost !text-rose-300" onClick={() => onGrade(0)}>
              {L({ ar: 'لم أتقن', en: 'Not yet' })}
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

/* ── وضع: الكلمة الناقصة ─────────────────────────────── */
function ClozeCard({ ayah, pool, onDone }: { ayah: AyahView; pool: string[]; onDone: (ok: boolean) => void }) {
  const L = useL();
  const cloze = useMemo(() => buildCloze(ayah.text, pool), [ayah.text, pool]);
  const [picked, setPicked] = useState<string | null>(null);

  if (!cloze) {
    return (
      <Card className="text-center">
        <p className="text-sm text-slate-400">{L({ ar: 'لا تصلح هذه الآية لهذا الوضع — تجاوزها', en: 'This ayah does not fit this mode' })}</p>
        <button type="button" className="btn-primary mt-4 w-full" onClick={() => onDone(true)}>
          {L({ ar: 'التالي', en: 'Next' })}
        </button>
      </Card>
    );
  }

  const answered = picked !== null;
  return (
    <Card>
      <p className="text-center text-[11px] text-slate-500">
        {L({ ar: 'الآية', en: 'Ayah' })} <span className="num">{ayah.a}</span> — {L({ ar: 'اختر الكلمة الناقصة', en: 'pick the missing word' })}
      </p>
      <p className="quran-text mt-4 text-center text-2xl leading-[2.3] text-slate-50">{cloze.masked}</p>
      <div className="mt-5 grid grid-cols-2 gap-2">
        {cloze.options.map((opt) => {
          const isAnswer = opt === cloze.answer;
          const isPicked = opt === picked;
          let cls = 'btn-ghost';
          if (answered) {
            if (isAnswer) cls = 'btn-ghost !border-emerald-400/50 !text-emerald-300';
            else if (isPicked) cls = 'btn-ghost !border-rose-400/50 !text-rose-300';
            else cls = 'btn-ghost opacity-60';
          }
          return (
            <button key={opt} type="button" disabled={answered} onClick={() => setPicked(opt)} className={`${cls} !py-3 quran-text text-base`}>
              {opt}
            </button>
          );
        })}
      </div>
      {answered ? (
        <button type="button" className="btn-primary mt-4 w-full" onClick={() => onDone(picked === cloze.answer)}>
          {L({ ar: 'التالي', en: 'Next' })}
        </button>
      ) : null}
    </Card>
  );
}

/* ── وضع: ترتيب الآيات ────────────────────────────────── */
function OrderRound({
  ayahs,
  baseIdx,
  onWindowDone,
}: {
  ayahs: AyahView[];
  baseIdx: number;
  onWindowDone: (grades: Array<{ ayah: number; ease: Ease }>) => void;
}) {
  const L = useL();
  const shuffled = useMemo(() => shuffle(ayahs), [ayahs]);
  const [picked, setPicked] = useState<AyahView[]>([]);
  const [wrongBefore, setWrongBefore] = useState(0);
  const [missMap, setMissMap] = useState<Record<number, number>>({});

  const expectedNext = useMemo(() => {
    const remaining = ayahs.filter((a) => !picked.includes(a)).slice().sort((x, y) => x.a - y.a);
    return remaining[0] ?? null;
  }, [ayahs, picked]);

  if (ayahs.length === 0) return null;

  const tapAyah = (a: AyahView) => {
    if (picked.includes(a)) return;
    if (expectedNext && a.a === expectedNext.a) {
      setPicked((p) => [...p, a]);
    } else {
      setWrongBefore((w) => w + 1);
      setMissMap((m) => ({ ...m, [a.a]: (m[a.a] ?? 0) + 1 }));
    }
  };

  const complete = picked.length === ayahs.length;

  const done = () => {
    const grades = ayahs.map((a) => ({
      ayah: a.a,
      ease: (missMap[a.a] ?? 0) === 0 ? (2 as Ease) : (missMap[a.a] === 1 ? (1 as Ease) : (0 as Ease)),
    }));
    onWindowDone(grades);
  };

  return (
    <Card>
      <p className="text-center text-[11px] text-slate-500">
        {L({ ar: `الجولة ${Math.floor(baseIdx / 5) + 1} — اضغط الآيات بترتيب حفظها`, en: `Round ${Math.floor(baseIdx / 5) + 1} — tap the ayahs in memorized order` })}
      </p>
      <div className="mt-3 min-h-[2.75rem] rounded-xl border border-white/5 bg-white/[.03] p-2">
        {picked.length === 0 ? (
          <p className="pt-1 text-center text-[11px] text-slate-600">{L({ ar: 'ترتيب إجابتك يظهر هنا', en: 'Your order appears here' })}</p>
        ) : (
          <ol className="flex flex-wrap gap-1.5">
            {picked.map((a, i) => (
              <li key={a.a} className="chip chip-active !py-1"><span className="num">{i + 1}.</span> {a.a}</li>
            ))}
          </ol>
        )}
      </div>
      <div className="mt-3 space-y-2">
        {shuffled.map((a) => {
          const used = picked.includes(a);
          return (
            <button
              key={a.a}
              type="button"
              disabled={used}
              onClick={() => tapAyah(a)}
              className={`card block w-full p-2.5 text-start transition-all ${used ? 'opacity-30' : 'hover:border-gold-400/40'}`}
            >
              <span className="num text-[10px] text-slate-600">{a.a}</span>
              <span className="quran-text mt-0.5 block text-sm leading-7 text-slate-100">{a.text}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-[11px] text-slate-500">
          {L({ ar: 'أخطاء:', en: 'Mistakes:' })} <span className="num text-rose-300">{wrongBefore}</span>
        </p>
        <button type="button" className="btn-primary !py-2" disabled={!complete} onClick={done}>
          {L({ ar: 'التالي', en: 'Next' })}
        </button>
      </div>
    </Card>
  );
}

/* ── وضع: التسميع بالتسجيل + التقييم الذكي (بلا نت) ─────── */
type SmartPhase = 'idle' | 'downloading' | 'analyzing' | 'done';

function RecordCard({ ayah, onGrade }: { ayah: AyahView; onGrade: (e: Ease) => void }) {
  const L = useL();
  const [recording, setRecording] = useState(false);
  const [audioURL, setAudioURL] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [smart, setSmart] = useState<SmartPhase>('idle');
  const [dlPct, setDlPct] = useState(0);
  const [result, setResult] = useState<ListenScore | null>(null);
  const [smartNote, setSmartNote] = useState<string | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const aliveRef = useRef(true);
  useEffect(() => () => { aliveRef.current = false; }, []);

  const start = async () => {
    setError(null);
    setResult(null);
    setSmartNote(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      rec.onstop = () => {
        const b = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
        setBlob(b);
        setAudioURL((old) => {
          if (old) URL.revokeObjectURL(old);
          return URL.createObjectURL(b);
        });
        stream.getTracks().forEach((t) => t.stop());
      };
      mediaRef.current = rec;
      rec.start();
      setRecording(true);
    } catch {
      setError(L({ ar: 'تعذر تشغيل الميكروفون — تحقق من الإذن', en: 'Microphone unavailable — check permission' }));
    }
  };

  const stop = () => {
    try {
      if (mediaRef.current && mediaRef.current.state !== 'inactive') mediaRef.current.stop();
    } catch { /* تجاهل */ }
    setRecording(false);
  };

  useEffect(() => () => { if (audioURL) URL.revokeObjectURL(audioURL); /* eslint-disable-next-line */ }, []);

  const runSmart = () => {
    if (!blob) return;
    setSmartNote(null);
    const fuse = listenState();
    if (fuse.status === 'ready') {
      void analyze();
      return;
    }
    setSmart('downloading');
    setDlPct(fuse.status === 'loading' ? fuse.progress : 0);
    ensureListenModel((p) => {
      if (aliveRef.current) setDlPct(p);
    })
      .then(() => analyze())
      .catch(() => {
        if (!aliveRef.current) return;
        setSmart('idle');
        setSmartNote(L({
          ar: 'تعذر تنزيل حزمة التسميع الذكي — التقييم الذاتي ما زال متاحاً',
          en: 'Could not download the smart pack — self-rating still works',
        }));
      });
  };

  const analyze = async () => {
    setSmart('analyzing');
    try {
      const f32 = await blobToFloat32(blob!);
      const transcript = await transcribeArabic(f32);
      const score = scoreTranscript(ayah.text, transcript);
      if (!aliveRef.current) return;
      setResult(score);
      setSmart('done');
    } catch {
      if (!aliveRef.current) return;
      setSmart('idle');
      setSmartNote(L({
        ar: 'تعذر التحليل على هذا الجهاز — التقييم الذاتي ما زال متاحاً',
        en: 'Analysis failed on this device — self-rating still works',
      }));
    }
  };

  const smartUi = (() => {
    if (smart === 'downloading') {
      return (
        <div className="mt-3 w-full">
          <p className="text-center text-[11px] text-slate-400">
            {L({ ar: 'تنزيل حزمة التسميع الذكي (~250MB مرة واحدة)…', en: 'Downloading smart pack (~250MB, once)…' })}{' '}
            <span className="num text-gold-300">{dlPct}٪</span>
          </p>
          <div className="mt-1.5"><ProgressBar value={dlPct} /></div>
        </div>
      );
    }
    if (smart === 'analyzing') {
      return (
        <p className="mt-3 text-center text-[11px] text-slate-400">
          {L({ ar: 'يستمع الذكاء الاصطناعي إليك… (قد يستغرق ١٠–٣٠ ثانية على الهاتف)', en: 'AI is listening… (10–30s on a phone)' })}
        </p>
      );
    }
    if (smart === 'done' && result) {
      const grade = gradeFromPct(result.pct);
      return (
        <div className="mt-3 w-full rounded-xl border border-white/5 bg-white/[.03] p-3">
          <p className="text-center text-[11px] text-slate-500">{L({ ar: 'هكذا سمعتك', en: 'What the AI heard' })}</p>
          <p className="quran-text mt-1 text-center text-base leading-7 text-slate-100">{result.transcript || '—'}</p>
          <div className="mt-2 flex items-center justify-center gap-4">
            <span className="num text-3xl font-bold text-gold-300">{result.pct}٪</span>
            <span className="text-[11px] leading-4 text-slate-500">
              {L({ ar: `${result.matched} من ${result.total} كلمة صحيحة بالترتيب`, en: `${result.matched}/${result.total} words in order` })}
            </span>
          </div>
          {result.missingWords.length > 0 ? (
            <div className="mt-2 flex flex-wrap justify-center gap-1.5">
              {result.missingWords.map((w, i) => (
                <span key={i} className="chip !border-rose-400/30 !text-rose-300">{w}</span>
              ))}
            </div>
          ) : null}
          <button type="button" className="btn-primary mt-3 w-full !py-2.5" onClick={() => onGrade(grade)}>
            {L({
              ar: `تأكيد التقييم: ${grade === 2 ? 'أتقنت' : grade === 1 ? 'جيد' : 'لم أتقن'}`,
              en: `Confirm: ${grade === 2 ? 'Mastered' : grade === 1 ? 'Good' : 'Not yet'}`,
            })}
          </button>
        </div>
      );
    }
    return audioURL ? (
      <button type="button" className="btn-ghost mt-3 w-full !py-2.5 text-xs" onClick={runSmart}>
        {L({ ar: 'قيّمني آلياً — Whisper Small، يعمل بلا نت بعد التنزيل', en: 'Grade me — Whisper Small, offline after download' })}
      </button>
    ) : null;
  })();

  return (
    <Card>
      <p className="text-center text-[11px] text-slate-500">
        {L({ ar: 'الآية', en: 'Ayah' })} <span className="num">{ayah.a}</span> — {L({ ar: 'اقرأها بصوتك', en: 'read it aloud' })}
      </p>
      <p className="quran-text mt-4 text-center text-2xl leading-[2.3] text-slate-50">{ayah.text}</p>

      <div className="mt-4 flex flex-col items-center gap-3">
        {!recording ? (
          <button type="button" className="btn-primary !py-3 !px-8" onClick={start}>
            {L({ ar: 'ابدأ التسجيل', en: 'Start recording' })}
          </button>
        ) : (
          <button type="button" className="btn !border-rose-400/40 bg-rose-500/15 !py-3 !px-8 text-rose-200" onClick={stop}>
            <span className="relative flex h-3 w-3"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-60" /><span className="inline-flex h-3 w-3 rounded-full bg-rose-400" /></span>
            {L({ ar: 'إيقاف التسجيل', en: 'Stop' })}
          </button>
        )}
        {audioURL ? <audio controls src={audioURL} className="w-full" /> : null}
        {error ? <p className="text-xs text-rose-300">{error}</p> : null}
        {smartNote ? <p className="text-xs text-rose-300">{smartNote}</p> : null}
        {smartUi}
      </div>

      <p className="label-ar mb-2 mt-4 text-center">{L({ ar: 'أو قيّم ذاتياً', en: 'Or rate yourself' })}</p>
      <div className="grid grid-cols-3 gap-2">
        <button type="button" className="btn-primary !bg-emerald-400 !text-emerald-950 hover:!bg-emerald-300" onClick={() => onGrade(2)}>{L({ ar: 'أتقنت', en: 'Mastered' })}</button>
        <button type="button" className="btn-ghost" onClick={() => onGrade(1)}>{L({ ar: 'جيد', en: 'Good' })}</button>
        <button type="button" className="btn-ghost !text-rose-300" onClick={() => onGrade(0)}>{L({ ar: 'لم أتقن', en: 'Not yet' })}</button>
      </div>
    </Card>
  );
}

/* ── وضع: اكتب وتلا — الآية مخفيّة والنص يُكتب مع التلاوة ── */
function WriteCard({ ayah, onGrade }: { ayah: AyahView; onGrade: (e: Ease) => void }) {
  const L = useL();
  const [written, setWritten] = useState('');
  const [hinted, setHinted] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const check = useMemo(() => checkWrittenWords(ayah.text, written), [ayah.text, written]);
  const typed = tokenizeArabic(written);
  const expectedCount = useMemo(() => tokenizeArabic(ayah.text).length, [ayah.text]);

  const autoGrade: Ease = gradeFromPct(check.pct);
  const confirmEase: Ease = hinted ? (Math.min(autoGrade, 1) as Ease) : autoGrade;

  return (
    <Card>
      <p className="text-center text-[11px] text-slate-500">
        {L({ ar: 'الآية', en: 'Ayah' })} <span className="num">{ayah.a}</span> — {L({ ar: 'الآية مخفيّة — اكتبها وأنت تتلوها من الذاكرة', en: 'The verse is hidden — write it from memory as you recite' })}
      </p>

      {/* كلماتك المكتوبة — خضراء إن طابقَت، حمراء إن خالفت */}
      <div className="mt-4 flex min-h-[4.5rem] flex-wrap items-start content-start justify-center gap-1.5 rounded-2xl border border-white/5 bg-white/[.03] p-3" aria-live="polite">
        {check.cells.map((cell, i) => {
          const word = typed[i];
          if (cell === 'pending') {
            return (
              <span key={i} className="chip !border-dashed !border-white/10 !text-slate-600" aria-hidden>
                <span className="num">{i + 1}</span>
              </span>
            );
          }
          const cls = cell === 'right'
            ? 'chip chip-active !border-emerald-400/40 !text-emerald-300'
            : 'chip !border-rose-400/40 !text-rose-300';
          return (
            <span key={i} className={cls}>
              <span className="num text-[10px] opacity-60">{i + 1}</span> {word}
            </span>
          );
        })}
        {check.cells.length === 0 ? (
          <span className="text-[12px] text-slate-600">{L({ ar: 'اكتب بمسافات بين الكلمات — كل كلمة تُفحص فورياً', en: 'Type with spaces between words — each word is checked live' })}</span>
        ) : null}
      </div>

      <textarea
        value={written}
        onChange={(e) => { setWritten(e.target.value); setSubmitted(false); }}
        autoFocus
        dir="rtl"
        rows={2}
        placeholder={L({ ar: 'اكتب الآية هنا…', en: 'Write the verse here…' })}
        className="mt-3 w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-lg leading-8 text-slate-100 outline-none placeholder-slate-700 focus:border-gold-400/50"
        aria-label={L({ ar: 'نص الآية من ذاكرتك', en: 'Verse text from memory' })}
      />

      <div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-slate-500">
        <span><span className="num text-gold-300">{check.answered}</span>/<span className="num">{expectedCount}</span> {L({ ar: 'كلمة', en: 'words' })}</span>
        <span><span className="num text-gold-300">{check.pct}٪</span> {L({ ar: 'مطابقة', en: 'match' })}</span>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        {!hinted && !submitted ? (
          <button type="button" className="btn-ghost !px-3 !py-1.5 text-[11px]" onClick={() => setHinted(true)}>
            {L({ ar: 'أظهر الآية (يُنقص التقييم)', en: 'Show the verse (caps rating)' })}
          </button>
        ) : null}
        {check.complete || submitted ? (
          <button type="button" className="btn-primary !px-6" onClick={() => setSubmitted((v) => !v)}>
            {submitted ? L({ ar: 'إخفاء الآية', en: 'Hide verse' }) : L({ ar: 'إنهاء ومراجعة', en: 'Finish and review' })}
          </button>
        ) : null}
      </div>

      {/* بعد المراجعة — تُكشف الآية وتُعرض النتيجة */}
      {submitted ? (
        <div className="mt-3 rounded-2xl border border-white/5 bg-white/[.03] p-3">
          <p className="text-center text-[11px] text-slate-500">{L({ ar: 'الآية كاملة', en: 'The verse in full' })}</p>
          <p className="quran-text mt-1 text-center text-xl leading-[2.1] text-slate-50">{ayah.text}</p>
          <p className="mt-2 text-center text-[11px] text-slate-400">
            {L({ ar: `المطابقة: ${check.pct}٪`, en: `Match: ${check.pct}%` })}{hinted ? L({ ar: ' · (كُشفت الآية — التقييم مقيد بجيد)', en: ' · (verse shown — capped at Good)' }) : ''}
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <button type="button" className={`btn-primary !bg-emerald-400 !text-emerald-950 hover:!bg-emerald-300 ${confirmEase === 2 ? 'ring-2 ring-emerald-300' : ''}`} onClick={() => onGrade(2)}>
              {L({ ar: 'أتقنت', en: 'Mastered' })}
            </button>
            <button type="button" className={`btn-ghost ${confirmEase === 1 ? 'ring-2 ring-gold-400/60' : ''}`} onClick={() => onGrade(1)}>
              {L({ ar: 'جيد', en: 'Good' })}
            </button>
            <button type="button" className={`btn-ghost !text-rose-300 ${confirmEase === 0 ? 'ring-2 ring-rose-400/60' : ''}`} onClick={() => onGrade(0)}>
              {L({ ar: 'لم أتقن', en: 'Not yet' })}
            </button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
