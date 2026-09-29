/**
 * لوحة النسخ الاحتياطي
 * ------------------------------------------------------------------
 * «مسح الذاكرة» في صفحة الإعدادات يمحو كل شيء بلا رجعة. وهذه اللوحة
 * هي المقابل: تصدير نسخة، واستيرادها على أي جهاز أو بعد أي مسح.
 *
 * ثلاثة أشياء لا نساوم عليها هنا:
 *   • **لا زرّ صامت.** إن تعذّر التنزيل (لوحة المفاتيح على الجوال، أو
 *     متصفّح يرفض إنشاء رابط ملف) يظهر النصّ في حقل مع زرّ نسخ، ولا
 *     يُترك المستخدم أمام زرّ يبدو ناجحاً ولا يفعل شيئاً.
 *   • **التأكيد يسبق الكتابة.** الاستيراد يدمج ولا يمحو، والمستخدم
 *     يحبّ أن يسمع ذلك قبل لا بعده.
 *   • **سبب الفشل بنصّه.** «حدث خطأ» لا تعني شيئاً لمن فقد بياناته؛
 *     نعرض ما الذي رُفض ولماذا، بلغته.
 */

import { useRef, useState } from 'react';
import { useL } from '../lib/hooks';
import { Badge, Card, Row } from './ui';
import {
  SKIP_REASONS,
  applyBackup,
  backupErrorText,
  backupFileName,
  collectBackup,
  parseBackup,
} from '../lib/backup';
import type { BackupFile, ApplyResult } from '../lib/backup';

/** ما ينتظره المستخدم قبل أن يؤكّد: الملف كاملٌ ومتحقَّق منه */
type Pending = { data: BackupFile; source: string };

type Notice = { tone: 'ok' | 'bad'; text: string } | null;

/** هل يستطيع هذا المتصفّح تنزيل ملفاً أصلاً؟ */
function canDownload(): boolean {
  return (
    typeof document !== 'undefined' &&
    typeof Blob !== 'undefined' &&
    typeof URL !== 'undefined' &&
    typeof URL.createObjectURL === 'function'
  );
}

/** ينزّل نصّاً باسم ملف، ويعمل بلا رمي: يُرجع نجاحاً أو فشلاً */
function downloadText(text: string, name: string): boolean {
  try {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    // الإبطال الفوري قد يُلغي التنزيل في بعض المتصفّحات، فنؤجّله قليلاً
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return true;
  } catch {
    return false;
  }
}

/** يقرأ نصّ ملف مختار — متصفّح قديم بلا `File.text` يبقى له القارئ */
function readFile(file: File): Promise<string> {
  if (typeof file.text === 'function') return file.text();
  return new Promise((resolve, reject) => {
    if (typeof FileReader === 'undefined') {
      reject(new Error('no-reader'));
      return;
    }
    const r = new FileReader();
    r.onload = () => resolve(typeof r.result === 'string' ? r.result : '');
    r.onerror = () => reject(new Error('read-failed'));
    r.readAsText(file);
  });
}

export default function BackupPanel() {
  const L = useL();
  const lang = L.lang;
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [result, setResult] = useState<ApplyResult | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [pasted, setPasted] = useState('');
  const [manual, setManual] = useState('');

  const fail = (code: string) =>
    setNotice({ tone: 'bad', text: backupErrorText(code, lang) || L({ ar: 'تعذّر قراءة الملف', en: 'Could not read the file' }) });

  const reset = () => {
    setPending(null);
    setResult(null);
    setNotice(null);
  };

  /** التصدير: يبني النصّ ثم ينزّله، وإلا يعرضه للنسخ اليدوي */
  const exportBackup = async () => {
    setBusy(true);
    reset();
    try {
      const file = await collectBackup();
      const text = JSON.stringify(file, null, 2);
      if (file.keys.length === 0) {
        setNotice({
          tone: 'bad',
          text: L({ ar: 'لا يوجد ما يُحفظ على هذا الجهاز بعد', en: 'There is nothing stored on this device yet' }),
        });
        return;
      }
      if (!canDownload()) {
        setManual(text);
        setNotice({
          tone: 'ok',
          text: L({
            ar: 'هذا المتصفّح لا ينزّل الملفات، فالنسخة معروضة أدناه — انسخها واحفظها في ملف',
            en: 'This browser cannot download files, so the backup is shown below — copy it into a file',
          }),
        });
        return;
      }
      if (!downloadText(text, backupFileName())) {
        setManual(text);
        setNotice({
          tone: 'bad',
          text: L({
            ar: 'تعذّر التنزيل على هذا الجهاز — النسخة معروضة أدناه، انسخها يدوياً',
            en: 'Download failed on this device — the backup is shown below, copy it manually',
          }),
        });
        return;
      }
      setNotice({
        tone: 'ok',
        text: L({ ar: 'حُفظت النسخة على جهازك', en: 'The backup file was saved to your device' }),
      });
    } catch {
      setNotice({ tone: 'bad', text: L({ ar: 'تعذّر إنشاء النسخة', en: 'Could not create the backup' }) });
    } finally {
      setBusy(false);
    }
  };

  /** يمرّ النصّ بالتحقق، ولا يقترح التأكيد إلا لملف سليم */
  const stage = (text: string, source: string) => {
    setResult(null);
    if (typeof text !== 'string' || text.trim() === '') {
      setPending(null);
      setNotice({ tone: 'bad', text: L({ ar: 'الملف فارغ', en: 'The file is empty' }) });
      return;
    }
    const parsed = parseBackup(text);
    if (!parsed.ok) {
      setPending(null);
      setNotice({ tone: 'bad', text: backupErrorText(parsed.error, lang) });
      return;
    }
    setPending({ data: parsed.data, source });
    setNotice(null);
  };

  const pickFile = async (file: File | undefined) => {
    if (!file || busy) return;
    setBusy(true);
    try {
      stage(await readFile(file), 'file');
    } catch {
      fail('notJson');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  /** الكتابة الحقيقية — بعد التحقق والتأكيد، لا قبلهما */
  const confirmImport = async () => {
    if (!pending || busy) return;
    setBusy(true);
    try {
      const res = await applyBackup(pending.data);
      setResult(res);
      setPending(null);
      setPasted('');
      setNotice({
        tone: 'ok',
        text:
          res.applied.length === 0
            ? L({
                ar: 'لم يتغيّر شيء — بياناتك على الجهاز أحدث من محتوى النسخة',
                en: 'Nothing changed — the data on this device is newer than the backup',
              })
            : L({ ar: 'تم استيراد النسخة', en: 'The backup was imported' }),
      });
    } catch {
      setNotice({ tone: 'bad', text: L({ ar: 'تعذّر الاستيراد', en: 'The import failed' }) });
    } finally {
      setBusy(false);
    }
  };

  const copy = async (text: string) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
      else if (typeof document !== 'undefined') {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.top = '-1000px';
        document.body.appendChild(ta);
        ta.select();
        try {
          document.execCommand('copy');
        } catch {
          /* المتصفّح رفض الأمر — الحقل ظاهر فننسخه باليد */
        }
        document.body.removeChild(ta);
      }
      setNotice({ tone: 'ok', text: L({ ar: 'نُسخ النصّ', en: 'The text was copied' }) });
    } catch {
      setNotice({
        tone: 'bad',
        text: L({ ar: 'تعذّر النسخ على هذا المتصفح — انسخ النصّ يدوياً', en: 'Copy is unavailable in this browser — copy the text manually' }),
      });
    }
  };

  const dateOf = (ms: number) =>
    ms > 0
      ? new Date(ms).toLocaleString(lang === 'ar' ? 'ar' : 'en', { dateStyle: 'medium', timeStyle: 'short' })
      : L({ ar: 'بلا تاريخ', en: 'No date' });

  return (
    <Card className="mb-4">
      <p className="pb-1 text-xs leading-relaxed text-slate-500">
        {L({
          ar: 'احفظ تقدّمك وإعداداتك في ملف واحد. الاستيراد يدمج ولا يمحو شيئاً ممّا لديك.',
          en: 'Keep your progress and settings in one file. Importing merges and never erases what you have.',
        })}
      </p>

      <div className="flex flex-wrap gap-2 py-3">
        <button type="button" className="btn-ghost flex-1" onClick={exportBackup} disabled={busy}>
          {busy ? L({ ar: 'جارٍ…', en: 'Working…' }) : L({ ar: 'تصدير نسخة', en: 'Export backup' })}
        </button>
        <button
          type="button"
          className="btn-ghost flex-1"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          {L({ ar: 'استيراد نسخة', en: 'Import backup' })}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json,text/plain"
          className="hidden"
          onChange={(e) => void pickFile(e.target.files?.[0])}
        />
      </div>

      {/* نسخة معروضة للنقل اليدوي — حين لا يستطيع المتصفّح تنزيل ملف */}
      {manual ? (
        <div className="border-t border-white/5 py-3">
          <p className="label-ar pb-1">{L({ ar: 'النسخة جاهزة للنسخ اليدوي', en: 'Backup ready to copy by hand' })}</p>
          <textarea
            readOnly
            dir="ltr"
            value={manual}
            rows={5}
            className="num w-full rounded-lg border border-white/10 bg-ink-700 p-2 text-xs text-slate-200 outline-none"
          />
          <button type="button" className="btn-subtle mt-2 w-full" onClick={() => void copy(manual)}>
            {L({ ar: 'نسخ', en: 'Copy' })}
          </button>
        </div>
      ) : null}

      {/* لصق النصّ يدوياً — حين يفشل منتقي الملفات أو لا يوجد ملف */}
      <div className="border-t border-white/5 py-3">
        <label className="label-ar block pb-1" htmlFor="backup-paste">
          {L({ ar: 'أو الصق نصّ النسخة هنا', en: 'Or paste the backup text here' })}
        </label>
        <textarea
          id="backup-paste"
          dir="ltr"
          rows={3}
          value={pasted}
          disabled={busy}
          onChange={(e) => setPasted(e.target.value)}
          className="num w-full rounded-lg border border-white/10 bg-ink-700 p-2 text-xs text-slate-100 outline-none"
        />
        <button
          type="button"
          className="btn-subtle mt-2 w-full"
          disabled={busy || pasted.trim() === ''}
          onClick={() => stage(pasted, 'paste')}
        >
          {L({ ar: 'تحقّق من النصّ الملصوق', en: 'Check the pasted text' })}
        </button>
      </div>

      {/* التأكيد: بعد التحقق، وقبل أي كتابة */}
      {pending ? (
        <div className="rounded-xl border border-gold-400/30 bg-gold-400/5 p-3">
          <p className="text-sm text-gold-200">{L({ ar: 'الاستيراد يدمج ولا يمحو', en: 'Importing merges, it never erases' })}</p>
          <ul className="py-2 text-xs leading-relaxed text-slate-300">
            <li>• {L({ ar: 'كل عدّاد يأخذ الأكبر بينه وبين هذه النسخة', en: 'Every counter takes the larger of the two' })}</li>
            <li>• {L({ ar: 'المحفوظات تُضاف ولا يُمحى أيّ محفوظ لديك', en: 'Bookmarks are added, none of yours is removed' })}</li>
            <li>• {L({ ar: 'متابعة حفظ القرآن تُدمج بالقيمة الأعلى', en: 'Quran memorization is merged by the highest value' })}</li>
            <li>• {L({ ar: 'لغة التطبيق ولونه لا تُستورد إطلاقاً', en: 'App language and colors are never imported' })}</li>
          </ul>
          <Row label={L({ ar: 'تاريخ النسخة', en: 'Backup date' })}>
            <span className="text-xs text-slate-300">{dateOf(pending.data.createdAt)}</span>
          </Row>
          {pending.data.keys.length ? (
            <div className="flex flex-wrap items-center gap-1 py-2">
              <span className="label-ar">{L({ ar: 'محتوى الملف', en: 'File contents' })}</span>
              {pending.data.keys.map((k) => (
                <Badge key={k} tone="gold">
                  <span className="num">{k}</span>
                </Badge>
              ))}
            </div>
          ) : null}
          <div className="flex gap-2 pt-2">
            <button type="button" className="btn-ghost flex-1" disabled={busy} onClick={() => void confirmImport()}>
              {busy ? L({ ar: 'جارٍ الاستيراد…', en: 'Importing…' }) : L({ ar: 'تأكيد الاستيراد', en: 'Confirm import' })}
            </button>
            <button type="button" className="btn-subtle flex-1" disabled={busy} onClick={reset}>
              {L({ ar: 'إلغاء', en: 'Cancel' })}
            </button>
          </div>
        </div>
      ) : null}

      {/* رسالة صريحة بعد كل عملية: كم طُبِّق وكم تُرك */}
      {notice ? (
        <p className={`pb-2 text-xs leading-relaxed ${notice.tone === 'ok' ? 'text-emerald-300' : 'text-rose-300'}`}>
          {notice.text}
        </p>
      ) : null}

      {result ? (
        <div className="border-t border-white/5 py-3">
          <p className="pb-2 text-xs text-slate-400">
            {L({ ar: 'طُبِّق', en: 'Applied' })}: <span className="num">{result.applied.length}</span>{' · '}
            {L({ ar: 'تُرك بلا استيراد', en: 'Left out' })}: <span className="num">{result.skipped.length}</span>
          </p>
          {result.applied.length ? (
            <div className="flex flex-wrap items-center gap-1 pb-2">
              {result.applied.map((k) => (
                <Badge key={k} tone="green">
                  <span className="num">{k}</span>
                </Badge>
              ))}
            </div>
          ) : null}
          <details className="text-xs text-slate-500">
            <summary className="cursor-pointer">
              {L({ ar: 'لماذا تُركت هذه الحقول؟', en: 'Why were these left out?' })}
            </summary>
            <ul className="py-2 leading-relaxed">
              {result.skipped.map((k) => (
                <li key={k} className="py-1">
                  <span className="num text-slate-300">{k}</span>
                  {SKIP_REASONS[k] ? ` — ${SKIP_REASONS[k][lang] || SKIP_REASONS[k].ar}` : ''}
                </li>
              ))}
            </ul>
          </details>
        </div>
      ) : null}

      <p className="pt-1 text-[11px] leading-relaxed text-slate-600">
        {L({
          ar: 'التصدير لا يحذف شيئاً، والاستيراد لا يكتب قبل التحقق الكامل. هذه اللوحة بديلٌ عن المسح لا بديلٌ عنه.',
          en: 'Exporting deletes nothing, and importing writes nothing before full validation. This panel is an alternative to wiping, not a replacement.',
        })}
      </p>
    </Card>
  );
}
