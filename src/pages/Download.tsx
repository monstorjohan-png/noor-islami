import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadData, removeFile, isDownloaded, storageInfo, requestPersistence } from '../lib/db';
import { getHadithIndex } from '../lib/content';
import { audioCacheInfo, clearAudioCache } from '../lib/audio';
import { yieldToUI } from '../lib/async';
import { useAsync, useL, useT } from '../lib/hooks';
import { Badge, Card, ErrorBox, Loading, ProgressBar, Section } from '../components/ui';
import { DownloadIcon } from '../components/icons';
import type { HadithBookMeta } from '../lib/types';

/** ملفات البيانات القابلة للتنزيل */
interface Item {
  path: string;
  label: string;
  bytes: number;
  required: boolean;
  note?: string;
}

const CORE: Item[] = [
  { path: 'quran/surahs.json', label: 'فهرس السور', bytes: 21_000, required: true },
  { path: 'quran/positions.json', label: 'مواضع الآيات (جزء/صفحة/سجدة)', bytes: 121_000, required: true },
  { path: 'quran/shard-index.json', label: 'فهرس أجزاء المصحف', bytes: 1_000, required: true },
  {
    path: 'quran/search.json',
    label: 'فهرس البحث (بلا تفسير ولا ترجمة)',
    bytes: 1_437_000,
    required: true,
    note: 'يجعل البحث كله يعمل بلا إنترنت',
  },
  {
    path: 'quran/uthmani.json',
    label: 'المصحف كاملاً + التفسير + الترجمة',
    bytes: 6_438_829,
    required: false,
    note: 'اختياري الآن: كل سورة تُقرأ من ملفها. نزّله للبحث في التفسير الكامل',
  },
];

const mb = (b: number) => (b >= 1_048_576 ? `${(b / 1_048_576).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`);

const pctOf = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

export default function Download() {
  const t = useT();
  const L = useL();
  const books = useAsync<HadithBookMeta[]>(() => getHadithIndex(), []);

  const items: Item[] = useCallback(() => [
    ...CORE,
    ...(books.data ?? []).map((b) => ({
      path: `hadith/${b.key}.json`,
      label: `${b.label.ar} — ${b.label.en}`,
      bytes: b.bytes,
      required: false,
      note: b.gaps > 0 ? `${b.gaps} حديثاً ناقصاً في الطبعة المفتوحة — أُسقط وسُجّل` : undefined,
    })),
  ], [books.data])();

  const [done, setDone] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<Record<string, string>>({});
  const [space, setSpace] = useState({ used: 0, quota: 0 });
  const [progress, setProgress] = useState({ loaded: 0, total: 0 });
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [audioInfo, setAudioInfo] = useState({ entries: 0, bytes: 0 });
  // مرجع حي للإلغاء — useRef لا يُعيد الرسم فتبقى الواجهة مستجيبة
  const abortRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(null);
    setProgress({ loaded: 0, total: 0 });
  }, []);

  // الإلغاء عند مغادرة الصفحة — لا نترك تنزيلاً يجري بلا صاحب
  useEffect(() => () => abortRef.current?.abort(), []);

  // قياس ذاكرة التلاوات: بعض المتصفحات لا تُظهر حجم bodies المخزَّنة
  const refreshAudio = useCallback(async () => {
    try { setAudioInfo(await audioCacheInfo()); } catch { /* غير مدعوم */ }
  }, []);

  const wipeAudio = async () => {
    await clearAudioCache();
    await refreshAudio();
  };

  // تخزين دائم: يمنع حذف 68 ميغا تلقائياً عند ضيق مساحة الجهاز
  useEffect(() => {
    void navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(false));
  }, []);

  const refresh = useCallback(async () => {
    // فحص فقط بلا تنزيل: isDownloaded يقرأ الذاكرة وIndexedDB ولا يمس الشبكة
    const map: Record<string, boolean> = {};
    for (const it of items) {
      try { map[it.path] = await isDownloaded(it.path); } catch { map[it.path] = false; }
    }
    setDone(map);
    setSpace(await storageInfo());
    await refreshAudio();
  }, [items, refreshAudio]);

  useEffect(() => { void refresh(); }, [refresh]);

  const one = async (it: Item) => {
    const ctl = new AbortController();
    abortRef.current = ctl;
    setBusy(it.path);
    setProgress({ loaded: 0, total: it.bytes });
    setFailed((f) => ({ ...f, [it.path]: '' }));
    try {
      await loadData(it.path, {
        force: true,
        signal: ctl.signal,
        onProgress: (loaded, total) => setProgress({ loaded, total: total || it.bytes }),
      });
      setDone((d) => ({ ...d, [it.path]: true }));
    } catch (e) {
      // الإلغاء ليس خطأً يُعرض على المستخدم
      if (e instanceof DOMException && e.name === 'AbortError') return;
      setFailed((f) => ({ ...f, [it.path]: e instanceof Error ? e.message : String(e) }));
    } finally {
      if (abortRef.current === ctl) abortRef.current = null;
      setBusy(null);
      setProgress({ loaded: 0, total: 0 });
      setSpace(await storageInfo());
    }
  };

  const all = async () => {
    // «تنزيل الكل» كان يعيد تنزيل ٦٨ ميغا كاملة في كل ضغطة، فكانت أبطأ
    // من أن تُنساب، والمس المستخدم يجب أن ينزّل ما ينقصه فقط.
    const todo = items.filter((it) => !done[it.path]);
    if (!todo.length) {
      await requestPersistence();
      if (await requestPersistence()) setPersisted(true);
      setSpace(await storageInfo());
      return;
    }

    const ctl = new AbortController();
    abortRef.current = ctl;
    setBusy('__all__');
    const base = total - todo.reduce((a, b) => a + b.bytes, 0);
    let acc = base;
    for (const it of todo) {
      const from = acc;
      acc += it.bytes;
      setProgress({ loaded: from, total: acc });
      try {
        await loadData(it.path, {
          force: true,
          signal: ctl.signal,
          onProgress: (loaded, t) => setProgress({ loaded: from + loaded, total: t || acc }),
        });
        setDone((d) => ({ ...d, [it.path]: true }));
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') {
          cancel();
          return;
        }
        setDone((d) => ({ ...d, [it.path]: false }));
      }
      // نُفسح المجال للرسم بين ملف وآخر، فلا تتجمّد الواجهة
      await yieldToUI();
    }
    if (abortRef.current === ctl) abortRef.current = null;
    setBusy(null);
    setProgress({ loaded: 0, total: 0 });
    // بعد كل التنزيل نطلب التخزين الدائم مرة واحدة
    if (await requestPersistence()) setPersisted(true);
    setSpace(await storageInfo());
  };

  const drop = async (it: Item) => {
    if (it.required) return;
    setBusy(it.path);
    await removeFile(it.path);
    setDone((d) => ({ ...d, [it.path]: false }));
    setBusy(null);
    setSpace(await storageInfo());
  };

  const total = items.reduce((a, b) => a + b.bytes, 0);
  const gotBytes = items.filter((i) => done[i.path]).reduce((a, b) => a + b.bytes, 0);
  // أثناء التنزيل يعرض البايت الفعلي، لا تقديراً على الملفات المكتملة فقط
  const livePct = progress.total > 0
    ? Math.round((progress.loaded / progress.total) * 100)
    : total ? Math.round((gotBytes / total) * 100) : 0;
  const pct = Math.min(100, Math.max(pctOf(gotBytes, total), livePct));

  if (books.loading) return <Loading />;

  return (
    <div className="animate-fade-in">
      <Section title={t('downloadForOffline')}>
        <Card>
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <span className="text-sm text-slate-300">{t('offlineReady')}</span>
            <span className="num text-sm text-gold-300">{pct}%</span>
          </div>
          <ProgressBar value={pct} />
          <p className="mt-2 text-xs text-slate-500">
            {busy && progress.total > 0
              ? `${mb(progress.loaded)} ${L({ ar: 'من', en: 'of' })} ${mb(progress.total)}`
              : `${mb(gotBytes)} ${L({ ar: 'من', en: 'of' })} ${mb(total)}`}
            {space.quota ? ` — ${t('freeSpace')} ${mb(space.quota - space.used)}` : ''}
          </p>
          <div className="mt-3 flex gap-2">
            <button type="button" className="btn-primary flex-1" onClick={all} disabled={!!busy}>
              {busy === '__all__' ? <Loading /> : t('downloadAll')}
            </button>
            {busy ? (
              <button type="button" className="btn-ghost" onClick={cancel}>
                {L({ ar: 'إيقاف', en: 'Stop' })}
              </button>
            ) : null}
          </div>
          {busy && progress.total > 0 ? (
            <p className="mt-1 text-center text-[11px] text-slate-500">
              {L({ ar: 'يُنزَّل ما ينقص فقط', en: 'Only missing files are downloaded' })}
            </p>
          ) : null}
          {persisted === false ? (
            <button
              type="button"
              className="btn-ghost mt-2 w-full"
              onClick={async () => setPersisted(await requestPersistence())}
            >
              {L({
                ar: 'احفظ التنزيلات دائماً (يمنع المتصفح من حذفها)',
                en: 'Keep downloads permanently (stop the browser evicting them)',
              })}
            </button>
          ) : persisted === true ? (
            <p className="mt-2 text-center text-[11px] text-emerald-400">
              {L({ ar: 'التخزين الدائم مفعّل', en: 'Permanent storage enabled' })}
            </p>
          ) : null}
        </Card>
      </Section>

      <Section title={L({ ar: 'القرآن', en: 'Quran' })}>
        <ul className="space-y-2">
          {items.filter((i) => i.path.startsWith('quran/')).map((it) => (
            <Row key={it.path} it={it} isDone={!!done[it.path]} busy={busy === it.path} err={failed[it.path]} onGet={() => one(it)} onDrop={() => drop(it)} t={t} L={L} />
          ))}
        </ul>
      </Section>

      <Section title={t('hadith')}>
        <ul className="space-y-2">
          {items.filter((i) => i.path.startsWith('hadith/')).map((it) => (
            <Row key={it.path} it={it} isDone={!!done[it.path]} busy={busy === it.path} err={failed[it.path]} onGet={() => one(it)} onDrop={() => drop(it)} t={t} L={L} />
          ))}
        </ul>
      </Section>

      <Section title={L({ ar: 'التلاوات المحفوظة', en: 'Saved recitations' })}>
        <Card>
          <p className="flex items-baseline justify-between gap-3 text-sm text-slate-300">
            <span>{L({ ar: 'التلاوات المحفوظة', en: 'Saved recitations' })}</span>
            <span className="num text-gold-300">
              {audioInfo.entries} — {mb(audioInfo.bytes)}
            </span>
          </p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            {L({
              ar: 'تُحفظ التلاوات من داخل صفحة السورة بزر «حفظ التلاوة»، فتعمل بعد ذلك بلا إنترنت.',
              en: 'Save a recitation from inside the surah page with the "Save recitation" button; it then works offline.',
            })}
          </p>
          {audioInfo.entries > 0 ? (
            <button type="button" className="btn-ghost mt-3 w-full" onClick={wipeAudio}>
              {L({ ar: 'حذف كل التلاوات المحفوظة', en: 'Delete all saved recitations' })}
            </button>
          ) : null}
        </Card>
      </Section>

      <p className="mt-6 text-center text-xs leading-relaxed text-slate-500">
        {t('gapsNote')}
        <br />
        <Link to="/about" className="text-gold-400 underline">{t('contentSources')}</Link>
      </p>
    </div>
  );
}

function Row({
  it, isDone, busy, err, onGet, onDrop, t, L,
}: {
  it: Item; isDone: boolean; busy: boolean; err?: string;
  onGet: () => void; onDrop: () => void;
  t: (k: string) => string; L: (v?: { ar?: string; en?: string } | null) => string;
}) {
  if (err) {
    return (
      <li>
        <ErrorBox error={new Error(err)} onRetry={onGet} />
      </li>
    );
  }
  return (
    <li className="card flex items-center gap-3 p-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-slate-200">{it.label}</p>
        <p className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
          <span className="num">{mb(it.bytes)}</span>
          {isDone ? <Badge tone="green">{t('downloaded')}</Badge> : null}
          {it.required ? <Badge>{L({ ar: 'أساسي', en: 'Core' })}</Badge> : null}
        </p>
        {it.note ? <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{it.note}</p> : null}
      </div>
      {it.required ? (
        <span className="shrink-0 text-xs text-slate-600">{isDone ? '✓' : '—'}</span>
      ) : isDone ? (
        <button type="button" onClick={onDrop} disabled={busy} className="btn-ghost shrink-0 !px-3 !py-2 text-xs">
          {L({ ar: 'حذف', en: 'Remove' })}
        </button>
      ) : (
        <button type="button" onClick={onGet} disabled={busy} className="btn-primary shrink-0 !px-3 !py-2 text-xs">
          <DownloadIcon className="h-4 w-4" />
          {busy ? '…' : L({ ar: 'تنزيل', en: 'Get' })}
        </button>
      )}
    </li>
  );
}
