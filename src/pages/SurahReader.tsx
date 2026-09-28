/**
 * قارئ السورة: نص المصحف آية آية، مع التفسير والترجمة والتلاوة.
 * ويقبل كذلك عرض جزء أو صفحة عبر معاملَي الاستعلام juz و page.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  getByJuz,
  getByPage,
  getQuranMeta,
  getSurahAyahs,
  getSurahs,
} from '../lib/content';
import type { AyahView } from '../lib/content';
import {
  RECITERS,
  ayahAudioUrl,
  downloadSurahAudio,
  hasSurahAudio,
  isAudioCached,
  surahAudioUrl,
} from '../lib/audio';
import type { ReciterId } from '../lib/audio';
import { cardFileName, renderAyahCard, shareAyahImage } from '../lib/card';
import { shareAyah, shareSurah } from '../lib/share';
import { getBtnLabel } from '../lib/ui-labels';
import { useAsync, useL, useT } from '../lib/hooks';
import { useSettings } from '../lib/store';
import type { ReadingState } from '../lib/store';
import type { Surah } from '../lib/types';
import { Badge, ErrorBox, Loading, Ornament } from '../components/ui';
import {
  BookmarkIcon,
  CopyIcon,
  PauseIcon,
  PlayIcon,
  QuranIcon,
  ShareIcon,
} from '../components/icons';

/* ---------- روابط التلاوة ---------- */
/* من lib/audio: القارئ اختياري والتنزيل المحلي ونسبة البايتات كلها هناك */

type Range = 'surah' | 'juz' | 'page';
type Translation = ReadingState['translation'];

const keyOf = (ay: AyahView) => `${ay.s}:${ay.a}`;
const clampFont = (n: number) => Math.min(56, Math.max(18, n));

/**
 * فهرس عكسي من رقم الآية العام إلى (سورة، آية).
 * نبنيه هنا لأن خريطة content.ts تفترض فهرساً بعد السورة الأخيرة،
 * فتحسب طول سورة الناس بواحدة وتضيع آياتها الخمس الأخيرة.
 * و(AyahView) الواردة من getByJuz و getByPage تُصحَّح به.
 */
function buildReverse(list: Surah[]): (gi: number) => [number, number] {
  const pairs: Array<[number, number, number]> = [];
  let acc = 0;
  for (const s of list) {
    pairs.push([s.n, acc, s.verses]);
    acc += s.verses;
  }
  return (gi) => {
    let lo = 0;
    let hi = pairs.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const p = pairs[mid];
      if (gi < p[1]) hi = mid - 1;
      else if (gi >= p[1] + p[2]) lo = mid + 1;
      else return [p[0], gi - p[1] + 1];
    }
    return [1, 1];
  };
}

/* ---------- نصوص توضيحية محلية ---------- */

const MESSAGES = {
  copied: { ar: 'تم نسخ الآية', en: 'Ayah copied' },
  copyFail: { ar: 'تعذّر النسخ على هذا المتصفح', en: 'Copy is unavailable in this browser' },
  copiedName: { ar: 'تم نسخ اسم السورة', en: 'Surah name copied' },
  shareDone: { ar: 'تم نسخ النص', en: 'Text copied' },
  shareFail: { ar: 'تعذّرت المشاركة — انسخ النص يدوياً', en: 'Sharing failed — copy the text manually' },
  audioFail: {
    ar: 'تعذّر تشغيل التلاوة — تحقّق من الاتصال بالإنترنت',
    en: 'Recitation could not start — check your connection',
  },
  noSurah: { ar: 'رقم السورة غير صحيح', en: 'Invalid surah number' },
  noTranslation: { ar: 'بلا ترجمة', en: 'No translation' },
  tafsirLabel: { ar: 'تفسير الجلالين', en: 'Tafsir al-Jalalayn' },
  imageSaved: { ar: 'حُفظت صورة الآية على جهازك', en: 'Ayah image saved to your device' },
  imageFail: { ar: 'تعذّر رسم صورة الآية — نشارك النص بدلاً منها', en: 'Could not render the ayah image — sharing the text instead' },
} as const;

type MsgKey = keyof typeof MESSAGES;

export default function SurahReader() {
  const t = useT();
  const L = useL();
  const nav = useNavigate();
  const params = useParams();
  const [sp] = useSearchParams();

  const lang = t.lang;
  const msg = useCallback(
    (k: MsgKey) => (lang === 'ar' ? MESSAGES[k].ar : MESSAGES[k].en),
    [lang],
  );

  const surahNo = Number(params.surah);
  const ayahNo = Number(params.ayah ?? '0') || 0;
  const juzNo = Number(sp.get('juz') ?? '') || 0;
  const pageNo = Number(sp.get('page') ?? '') || 0;

  /**
   * النطاق يُحسم من قيمة صالحة أو لا قيمة.
   * الرقم خارج المدى كان يتجاهَل صامتاً فيظهر للمستخدم السورة نفسها
   * وهو يظن أنه يقرأ جزءاً آخر. و«1e309» تعطي ما لا نهاية فتنقذ حرفياً.
   */
  const juzOk = Number.isInteger(juzNo) && juzNo >= 1 && juzNo <= 30;
  const pageOk = Number.isInteger(pageNo) && pageNo >= 1 && pageNo <= 604;
  const range: Range = juzOk ? 'juz' : pageOk ? 'page' : 'surah';
  const valid = Number.isInteger(surahNo) && surahNo >= 1 && surahNo <= 114;

  const { data, error, loading, reload } = useAsync(async () => {
    const [surahs, meta] = await Promise.all([getSurahs(), getQuranMeta()]);
    let ayahs: AyahView[] = [];
    if (range === 'juz') {
      ayahs = await getByJuz(juzNo);
    } else if (range === 'page') {
      ayahs = await getByPage(pageNo);
    } else if (valid) {
      ayahs = await getSurahAyahs(surahNo);
    }
    return { surahs, meta, ayahs, surah: surahs.find((x) => x.n === surahNo) ?? null };
  }, [surahNo, range, juzNo, pageNo, valid]);

  const raw = useMemo(() => data?.ayahs ?? [], [data]);
  const surahs = useMemo(() => data?.surahs ?? [], [data]);
  const rev = useMemo(() => buildReverse(surahs), [surahs]);

  /** تصحيح رقم السورة والآية من الفهرس العام — لازم لوضعَي الجزء والصفحة */
  const ayahs = useMemo<AyahView[]>(
    () =>
      surahs.length
        ? raw.map((ay) => {
            const [s, a] = rev(ay.globalIndex);
            return s === ay.s && a === ay.a ? ay : { ...ay, s, a };
          })
        : raw,
    [raw, rev, surahs.length],
  );

  const surah = data?.surah ?? null;
  const meta = data?.meta ?? null;

  /* ---------- الإعدادات ---------- */

  const reading = useSettings((s) => s.reading);
  const patch = useSettings((s) => s.set);
  const bookmarks = useSettings((s) => s.bookmarks);
  const toggleBookmark = useSettings((s) => s.toggleBookmark);

  const setReading = (p: Partial<ReadingState>) =>
    patch('reading', { ...useSettings.getState().reading, ...p });

  const [openTafsir, setOpenTafsir] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const reciter = useSettings((s) => s.reciter);
  const [audioSaved, setAudioSaved] = useState(false);
  const [audioBusy, setAudioBusy] = useState(false);
  const [audioPct, setAudioPct] = useState(0);

  const reciterName = useMemo(() => {
    const r = RECITERS.find((x) => x.id === reciter);
    return { ar: r?.ar ?? '', en: r?.en ?? '' };
  }, [reciter]);

  

  /**
   * رابط ملف السورة كاملة، أو `null` إن لم يكن لهذا القارئ ملف سورة على الشبكة.
   * ثلاثة قرّاء فقط لهم هذا الملف، فالباقي يتلو آية آية.
   */
  const surahUrl = useMemo(
    () => (range === 'surah' && surah ? surahAudioUrl(reciter, surah.n) : null),
    [range, surah, reciter],
  );

  /** هل تلاوة هذه السورة مخزَّنة محلياً؟ */
  useEffect(() => {
    if (!surahUrl) { setAudioSaved(false); return; }
    let alive = true;
    void isAudioCached(surahUrl).then((hit) => {
      if (alive) setAudioSaved(hit);
    });
    return () => { alive = false; };
  }, [surahUrl]);

  const markedKeys = useMemo(
    () =>
      new Set(
        bookmarks.filter((b) => b.kind === 'ayah').map((b) => b.ref),
      ),
    [bookmarks],
  );

  const surahName = useCallback(
    (n: number) => surahs.find((x) => x.n === n)?.arSimple ?? '',
    [surahs],
  );

  /* ---------- موضع القراءة ---------- */

  useEffect(() => {
    if (range !== 'surah' || !valid || !surah) return;
    const cur = useSettings.getState().reading;
    const asked = ayahNo > 0 && ayahNo <= surah.verses ? ayahNo : 0;
    const a = asked || (cur.lastSurah === surahNo ? cur.lastAyah : 1);
    if (cur.lastSurah === surahNo && cur.lastAyah === a) return;
    patch('reading', { ...cur, lastSurah: surahNo, lastAyah: a });
  }, [range, valid, surahNo, ayahNo, surah, patch]);

  /* ---------- النسخ والمشاركة ---------- */

  const toastTimer = useRef<number | null>(null);
  const flash = useCallback((text: string) => {
    setToast(text);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2400);
  }, []);

  useEffect(
    () => () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    },
    [],
  );

  const legacyCopy = (text: string) => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
    } catch {
      /* المتصفح رفض الأمر — نكتفي برسالة الفشل التي يعرضها المتصل */
    }
    document.body.removeChild(ta);
  };

  const copy = useCallback(
    async (text: string, okMsg: string) => {
      try {
        if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
        else legacyCopy(text);
        flash(okMsg);
      } catch {
        legacyCopy(text);
        flash(msg('copyFail'));
      }
    },
    [flash, msg],
  );

  const share = useCallback(
    async (title: string, text: string) => {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        try {
          await navigator.share({ title, text });
          return;
        } catch {
          flash(msg('shareFail'));
          return;
        }
      }
      await copy(text, msg('shareDone'));
    },
    [copy, flash, msg],
  );

  /**
   * مشاركة الآية صورةً — تُرسم بخط المصحف المضمَّن وتُصدَّر PNG.
   * عند فشل الرسم نرجع لمشاركة النص حتى لا يضيع المستخدم شيئاً.
   */
  const shareImage = useCallback(
    async (ay: AyahView) => {
      try {
        const blob = await renderAyahCard({
          text: ay.text,
          surah: surahName(ay.s),
          surahNo: ay.s,
          ayahNo: ay.a,
          footer: `${t('appName')} — ${L(reciterName)}`,
        });
        const how = await shareAyahImage(
          blob,
          cardFileName({ text: ay.text, surah: surahName(ay.s), surahNo: ay.s, ayahNo: ay.a }),
          `${surahName(ay.s)} ${ay.a}`,
        );
        flash(how === 'shared' ? msg('shareDone') : msg('imageSaved'));
      } catch (err) {
        console.warn('تعذّر رسم بطاقة الآية', err);
        flash(msg('imageFail'));
        await share(`${surahName(ay.s)} — ${t('verse')} ${ay.a}`, ay.text);
      }
    },
    [flash, msg, surahName, t, reciterName, share],
  );

  /* ---------- التلاوة ---------- */

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playList = useRef<AyahView[]>([]);
  const nodes = useRef(new Map<string, HTMLElement>());

  const [playing, setPlaying] = useState<string | null>(null);
  const [current, setCurrent] = useState<string | null>(null);

  const stop = useCallback(() => {
    const a = audioRef.current;
    if (a) a.pause();
    playList.current = [];
    setPlaying(null);
    setCurrent(null);
  }, []);

  const start = useCallback(
    (url: string, list: AyahView[], id: string) => {
      const a = audioRef.current;
      if (!a) return;
      setAudioError(null);
      if (a.src !== url) a.src = url;
      playList.current = list;
      setPlaying(id);
      setCurrent(list[0] ? keyOf(list[0]) : null);
      a.play()
        .then(() => undefined)
        .catch(() => {
          setPlaying(null);
          setCurrent(null);
          setAudioError(msg('audioFail'));
        });
    },
    [msg],
  );

  const toggleWhole = () => {
    if (playing === 'all') {
      stop();
      return;
    }
    if (!ayahs.length) return;
    // ملف السورة متاح لثلاثة قرّاء؛ لغيرهم نبدأ من أول آية
    if (surahUrl) start(surahUrl, ayahs, 'all');
    else start(ayahAudioUrl(reciter, ayahs[0].globalIndex), [ayahs[0]], keyOf(ayahs[0]));
  };

  const toggleAyah = (ay: AyahView) => {
    if (playing === keyOf(ay)) {
      stop();
      return;
    }
    start(ayahAudioUrl(reciter, ay.globalIndex), [ay], keyOf(ay));
  };

  /** تنزيل تلاوة السورة كاملة لتعمل بلا إنترنت */
  const saveAudio = async () => {
    if (range !== 'surah' || !surah) return;
    setAudioBusy(true);
    setAudioPct(0);
    const state = await downloadSurahAudio(reciter, surah.n, (loaded, total) => {
      setAudioPct(total ? Math.round((loaded / total) * 100) : 0);
    });
    setAudioBusy(false);
    setAudioPct(0);
    setAudioSaved(state === 'done');
    if (state === 'error') setAudioError(msg('audioFail'));
  };

  /**
   * الآية الجارية: تقسيم زمني متساوٍ — المدة ÷ عدد الآيات.
   * ينطبق على تلاوة السورة كلها وعلى تلاوة الآية المفردة بالطريقة نفسها.
   */
  const onTime = () => {
    const a = audioRef.current;
    const list = playList.current;
    if (!a || list.length === 0) return;
    const d = a.duration;
    if (!d || !Number.isFinite(d)) return;
    const i = Math.min(list.length - 1, Math.max(0, Math.floor((a.currentTime / d) * list.length)));
    const ay = list[i];
    if (!ay) return;
    setCurrent((prev) => (prev === keyOf(ay) ? prev : keyOf(ay)));
  };

  useEffect(() => {
    stop();
  }, [surahNo, range, juzNo, pageNo, stop]);

  /* ---------- التمرير إلى الآية المطلوبة ---------- */

  useEffect(() => {
    if (!ayahNo || range !== 'surah') return;
    const el = nodes.current.get(`${surahNo}:${ayahNo}`);
    if (el) window.setTimeout(() => el.scrollIntoView({ block: 'center' }), 80);
  }, [ayahNo, surahNo, range, ayahs.length]);

  /* ---------- العرض ---------- */

  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (loading && !data) return <Loading label={t('loading')} />;
  if (!valid && range === 'surah') {
    return (
      <div className="card p-8 text-center">
        <p className="text-sm text-slate-300">{msg('noSurah')}</p>
        <button type="button" className="btn-ghost mt-4" onClick={() => nav('/quran')}>
          {t('back')}
        </button>
      </div>
    );
  }

  const translation = reading.translation;

  const heading =
    range === 'juz'
      ? `${t('juz')} ${juzNo}`
      : range === 'page'
        ? `${t('page')} ${pageNo}`
        : surah
          ? surah.ar
          : t('quran');

  return (
    <div className="animate-fade-in">
      {/* رأس القراءة */}
      <div className="card mb-4 p-4">
        {range !== 'surah' ? (
          <button
            type="button"
            className="btn-subtle mb-2 !px-2 !py-1 text-xs"
            onClick={() => nav('/quran')}
          >
            {t('surahs')}
          </button>
        ) : null}

        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gold-400/15 text-gold-300">
            <QuranIcon className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="quran-text text-xl leading-snug text-slate-100">{heading}</h1>
            {surah && range === 'surah' ? (
              <p dir="ltr" className="mt-0.5 text-start text-xs text-slate-400">
                {surah.en}
              </p>
            ) : null}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {surah && range === 'surah' ? (
                <>
                  <Badge tone={surah.place === 'Mecca' ? 'gold' : 'green'}>
                    {surah.place === 'Mecca' ? t('makki') : t('madani')}
                  </Badge>
                  <Badge>
                    <span className="num">{surah.verses}</span>
                    <span> {t('verses')}</span>
                  </Badge>
                  <Badge>
                    <span>{t('juz')} </span>
                    <span className="num">
                      {surah.juzFrom === surah.juzTo
                        ? surah.juzFrom
                        : `${surah.juzFrom}–${surah.juzTo}`}
                    </span>
                  </Badge>
                  <Badge>
                    <span>{t('page')} </span>
                    <span className="num">{surah.startPage}</span>
                  </Badge>
                </>
              ) : (
                <Badge>
                  <span className="num">{ayahs.length}</span>
                  <span> {t('verse')}</span>
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn-primary"
            onClick={toggleWhole}
            disabled={ayahs.length === 0}
          >
            {playing === 'all' ? (
              <PauseIcon className="h-4 w-4" />
            ) : (
              <PlayIcon className="h-4 w-4" />
            )}
            <span>{playing === 'all' ? t('stopRecitation') : t('playRecitation')}</span>
          </button>

          <div className="flex items-center gap-1 rounded-xl border border-white/5 bg-white/5 px-1">
            <button
              type="button"
              className="btn-subtle !px-2 !py-1"
              onClick={() => setReading({ fontSize: clampFont(reading.fontSize - 2) })}
              aria-label={t('fontSize')}
            >
              <span aria-hidden>−</span>
            </button>
            <span className="num w-7 text-center text-xs text-slate-400">
              {reading.fontSize}
            </span>
            <button
              type="button"
              className="btn-subtle !px-2 !py-1"
              onClick={() => setReading({ fontSize: clampFont(reading.fontSize + 2) })}
              aria-label={t('fontSize')}
            >
              <span aria-hidden>+</span>
            </button>
          </div>

          {surah && range === 'surah' ? (
            <>
              <button
                type="button"
                className="btn-ghost !px-3"
                onClick={() => copy(surah.ar, msg('copiedName'))}
                aria-label={t('copy')}
              >
                <CopyIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="btn-ghost !px-3"
                onClick={() => share(surah.ar, surah.ar)}
                aria-label={t('share')}
              >
                <ShareIcon className="h-4 w-4" />
              </button>
            </>
          ) : null}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-slate-400">
            <span>{t('translation')}</span>
            <select
              value={translation}
              onChange={(e) => setReading({ translation: e.target.value as Translation })}
              aria-label={t('translation')}
              className="max-w-[12rem] rounded-lg border border-white/10 bg-ink-800 px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-gold-400/50"
            >
              <option value="none">{msg('noTranslation')}</option>
              <option value="abdelhaleem">{L(meta?.editions.en1?.label) || '—'}</option>
              <option value="abdulhye">{L(meta?.editions.en2?.label) || '—'}</option>
            </select>
          </label>

          <button
            type="button"
            className={`chip active:scale-[.97] ${
              reading.tafsirVisible ? 'chip-active' : ''
            }`}
            onClick={() => setReading({ tafsirVisible: !reading.tafsirVisible })}
          >
            {reading.tafsirVisible ? t('hideTafsir') : t('showTafsir')}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-slate-400">
            <span>{L({ ar: 'القارئ', en: 'Reciter' })}</span>
            <select
              value={reciter}
              onChange={(e) => {
                const next = e.target.value as ReciterId;
                patch('reciter', next);
                setAudioSaved(false);
              }}
              aria-label={L({ ar: 'القارئ', en: 'Reciter' })}
              className="max-w-[12rem] rounded-lg border border-white/10 bg-ink-800 px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-gold-400/50"
            >
              {RECITERS.map((r) => (
                <option key={r.id} value={r.id}>{L({ ar: r.ar, en: r.en })}</option>
              ))}
            </select>
          </label>

          {range === 'surah' && surahUrl ? (
            audioSaved ? (
              <span className="text-[11px] text-emerald-400">
                {L({ ar: 'محفوظة للعمل دون إنترنت', en: 'Saved for offline use' })}
              </span>
            ) : (
              <button
                type="button"
                className="chip active:scale-[.97]"
                onClick={() => void saveAudio()}
                disabled={audioBusy}
              >
                {audioBusy
                  ? `${audioPct}%`
                  : L({ ar: 'حفظ التلاوة', en: 'Save recitation' })}
              </button>
            )
          ) : null}

          {range === 'surah' && surah ? (
            <button
              type="button"
              className="chip active:scale-[.97]"
              onClick={() => void shareSurah(surah.n, ayahs, (lang === 'en' ? 'en' : 'ar'))}
            >
              <ShareIcon className="h-3.5 w-3.5" />
              <span>{getBtnLabel('shareImage', lang)}</span>
            </button>
          ) : null}

          {range === 'surah' && surah && !hasSurahAudio(reciter) ? (
            <span className="text-[11px] text-slate-500">
              {L({
                ar: 'لا يتوفّر لهذا القارئ ملف سورة كاملة — التلاوة آية آية',
                en: 'No full-surah file for this reciter — plays ayah by ayah',
              })}
            </span>
          ) : null}
        </div>
      </div>

      {audioError ? (
        <p className="mb-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {audioError}
        </p>
      ) : null}

      {toast ? (
        <p className="no-print fixed inset-x-0 bottom-24 z-40 mx-auto w-fit rounded-xl border border-emerald-500/40 bg-ink-800 px-4 py-2 text-xs text-emerald-200 shadow-lg">
          {toast}
        </p>
      ) : null}

      {ayahs.length === 0 ? (
        <p className="card p-8 text-center text-sm text-slate-400">{t('noResults')}</p>
      ) : null}

      <div className="flex flex-col gap-1">
        {ayahs.map((ay, idx) => {
          const k = keyOf(ay);
          const newSurah = idx === 0 || ayahs[idx - 1].s !== ay.s;
          const active = current === k;
          const marked = markedKeys.has(k);
          const showTafsir = reading.tafsirVisible || !!openTafsir[k];
          const tr = trText(ay, translation);

          return (
            <div key={k}>
              {newSurah ? (
                <div className="my-4 flex items-center gap-3">
                  <span className="h-px flex-1 bg-white/10" />
                  <button
                    type="button"
                    onClick={() => nav(`/quran/${ay.s}`)}
                    className="quran-text rounded-full border border-gold-400/30 bg-gold-400/10 px-3 py-1 text-sm text-gold-200 active:scale-[.97]"
                  >
                    {surahs.find((x) => x.n === ay.s)?.ar ?? `${t('surahs')} ${ay.s}`}
                  </button>
                  <span className="h-px flex-1 bg-white/10" />
                </div>
              ) : null}

              <article
                ref={(el) => {
                  if (el) nodes.current.set(k, el);
                  else nodes.current.delete(k);
                }}
                className={`card p-3 ${active ? 'ayah-active' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => toggleAyah(ay)}
                    aria-label={playing === k ? t('stopRecitation') : t('playRecitation')}
                    className={`num grid h-8 w-8 shrink-0 place-items-center rounded-full border text-xs font-bold transition-colors active:scale-[.97] ${
                      active
                        ? 'border-gold-300 bg-gold-400 text-ink-900'
                        : 'border-gold-400/40 bg-gold-400/10 text-gold-200'
                    }`}
                  >
                    {ay.a}
                  </button>

                  <div className="min-w-0 flex-1">
                    <p
                      className="quran-text text-slate-100"
                      style={{ fontSize: reading.fontSize }}
                    >
                      {ay.text}
                    </p>

                    {ay.sajda ? <p className="mt-1 text-xs text-gold-300">۩</p> : null}

                    {tr ? (
                      <p
                        dir="ltr"
                        className="mt-2 border-s-2 border-gold-400/40 ps-3 text-start text-sm leading-relaxed text-slate-300"
                      >
                        {tr}
                      </p>
                    ) : null}

                    {showTafsir && ay.tafsir ? (
                      <div className="mt-2 rounded-xl border border-white/10 bg-white/5 p-3">
                        <p className="label-ar mb-1">{msg('tafsirLabel')}</p>
                        <p className="text-sm leading-relaxed text-slate-300">{ay.tafsir}</p>
                      </div>
                    ) : null}

                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        className="btn-subtle !px-2 !py-1 text-[11px]"
                        onClick={() => setOpenTafsir((prev) => ({ ...prev, [k]: !prev[k] }))}
                      >
                        {t('tafsir')}
                      </button>
                      <button
                        type="button"
                        className="btn-subtle !px-2 !py-1 text-[11px]"
                        onClick={() => copy(ay.text, msg('copied'))}
                      >
                        <CopyIcon className="h-3.5 w-3.5" />
                        <span>{t('copy')}</span>
                      </button>
                      <button
                        type="button"
                        className={`btn-subtle !px-2 !py-1 text-[11px] ${
                          marked ? 'text-gold-300' : ''
                        }`}
                        onClick={() =>
                          toggleBookmark({
                            id: `ayah-${k}`,
                            kind: 'ayah',
                            ref: k,
                            label: `${surahName(ay.s)}: ${ay.a}`,
                          })
                        }
                      >
                        <BookmarkIcon className="h-3.5 w-3.5" filled={marked} />
                        <span>{marked ? t('bookmarked') : t('bookmark')}</span>
                      </button>
                      <button
                        type="button"
                        className="btn-subtle !px-2 !py-1 text-[11px]"
                        onClick={() => void shareImage(ay)}
                      >
                        <ShareIcon className="h-3.5 w-3.5" />
                        <span>{getBtnLabel('shareImage', lang)}</span>
                      </button>
                      {/* نص المشاركة — ثابت لتجنب تلف التصغير */}
                      <button
                        type="button"
                        className="btn-subtle !px-2 !py-1 text-[11px]"
                        onClick={() => void shareAyah(ay, surah!.n, (lang === 'en' ? 'en' : 'ar'))}
                      >
                        <ShareIcon className="h-3.5 w-3.5" />
                        <span>{getBtnLabel('shareText', lang)}</span>
                      </button>
                      <span className="num ms-auto text-[11px] text-slate-600">
                        {t('juz')} {ay.juz} · {t('page')} {ay.page}
                      </span>
                    </div>
                  </div>
                </div>
              </article>
            </div>
          );
        })}
      </div>

      <audio
        ref={audioRef}
        className="hidden"
        preload="none"
        onTimeUpdate={onTime}
        onEnded={stop}
        onError={() => {
          setPlaying(null);
          setCurrent(null);
          setAudioError(msg('audioFail'));
        }}
      />

      {range === 'surah' ? (
        <div className="mt-6 flex items-center justify-between gap-2">
          <button
            type="button"
            className="btn-ghost"
            disabled={surahNo <= 1}
            onClick={() => nav(`/quran/${surahNo - 1}/1`)}
          >
            {t('prev')}
          </button>
          <button type="button" className="btn-subtle" onClick={() => nav('/quran')}>
            {t('surahs')}
          </button>
          <button
            type="button"
            className="btn-ghost"
            disabled={surahNo >= 114}
            onClick={() => nav(`/quran/${surahNo + 1}/1`)}
          >
            {t('next')}
          </button>
        </div>
      ) : null}

      <Ornament label={L(reciterName)} />
    </div>
  );
}

/* ---------- دوال مساعدة خارج المكوّن ---------- */

function trText(ay: AyahView, translation: Translation): string {
  if (translation === 'abdelhaleem') return ay.en1;
  if (translation === 'abdulhye') return ay.en2;
  return '';
}
