/**
 * لوحة «تثبيت التطبيق».
 * ------------------------------------------------------------------
 * ثلاث حالات فقط، وكل واحدة تقول الحقيقة:
 *
 *   ١ • التطبيق مثبَّت      → نكتب ذلك ونخفي الزر
 *   ٢ • المتصفح يدعم التثبيت → زرّ حقيقي يفتح نافذة النظام
 *   ٣ • آيفون أو متصفّح بلا دعم → خطوات مكتوبة، لا زرّ لا يفعل شيئاً
 *
 * حالة رابعة لا نعرضها: زرّ معطّل بلا سبب. أسوأ من غيابه.
 */
import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  canPromptInstall,
  isIOS,
  isInstalled,
  promptInstall,
  subscribeInstall,
  watchInstallPrompt,
  type InstallResult,
} from '../lib/install';
import { useL } from '../lib/hooks';
import { DownloadIcon } from '../components/icons';

export default function InstallPanel() {
  const L = useL();
  /**
   * لقطتان أوليتان لا كائن: `useSyncExternalStore` يقارن النتيجة بـ
   * `Object.is`، فكائن جديد كل نداء يُطلق إعادة رسم لا تنتهي.
   */
  const canPrompt = useSyncExternalStore(subscribeInstall, canPromptInstall);
  const installed = useSyncExternalStore(subscribeInstall, isInstalled);
  const [result, setResult] = useState<InstallResult | null>(null);

  useEffect(() => {
    watchInstallPrompt();
  }, []);

  const run = async () => {
    setResult(await promptInstall());
  };

  if (installed) {
    return (
      <div className="card flex items-center gap-3.5 p-3.5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-500/15 text-emerald-400">
          <DownloadIcon className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-slate-100">
            {L({ ar: 'التطبيق مثبَّت على جهازك', en: 'The app is installed on your device' })}
          </span>
          <span className="mt-0.5 block text-xs text-slate-500">
            {L({
              ar: 'يعمل بلا متصفّح وبلا إنترنت',
              en: 'Runs without a browser and without internet',
            })}
          </span>
        </span>
      </div>
    );
  }

  return (
    <div className="card p-4">
      <div className="flex items-start gap-3.5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gold-400/10 text-gold-300">
          <DownloadIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium text-slate-100">
            {L({ ar: 'ثبّت التطبيق على هاتفك', en: 'Install the app on your phone' })}
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            {canPrompt
              ? L({
                  ar: 'يفتح نافذة النظام لتثبيت التطبيق على الشاشة الرئيسية. يعمل بعدها بلا متصفّح وبكلماته.',
                  en: 'Opens the system dialog to install it on your home screen. It then works without a browser.',
                })
              : L({
                  ar: 'المتصفّح هنا لا يفتح نافذة تثبيت تلقائية، فالتثبيت بخطوتين:',
                  en: 'This browser has no automatic install dialog, so it takes two steps:',
                })}
          </p>

          {canPrompt ? (
            <button
              type="button"
              onClick={() => void run()}
              className="btn-primary mt-3 w-full sm:w-auto"
            >
              {L({ ar: 'تثبيت التطبيق', en: 'Install app' })}
            </button>
          ) : (
            <ol className="mt-3 space-y-1.5 text-xs text-slate-300">
              <li className="flex gap-2">
                <span className="num text-gold-300">1</span>
                <span>
                  {isIOS()
                    ? L({
                        ar: 'اضغط زرّ المشاركة في أسفل الشاشة.',
                        en: 'Tap the Share button at the bottom of the screen.',
                      })
                    : L({
                        ar: 'افتح قائمة المتصفّح (ثلاث نقاط أو ⋮).',
                        en: 'Open the browser menu (three dots).',
                      })}
                </span>
              </li>
              <li className="flex gap-2">
                <span className="num text-gold-300">2</span>
                <span>
                  {isIOS()
                    ? L({
                        ar: 'اختر «إضافة إلى الشاشة الرئيسية» ثم «إضافة».',
                        en: 'Choose “Add to Home Screen”, then “Add”.',
                      })
                    : L({
                        ar: 'اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».',
                        en: 'Choose “Install app” or “Add to Home screen”.',
                      })}
                </span>
              </li>
            </ol>
          )}

          {result === 'dismissed' ? (
            <p className="mt-2 text-[11px] text-amber-400">
              {L({ ar: 'أُلغي التثبيت. يمكنك العودة متى شئت.', en: 'Install cancelled. You can return any time.' })}
            </p>
          ) : null}

          <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
            {L({
              ar: 'التلاوة تستمر أثناء التصفّح وقفل الشاشة، وتظهر أزرار التشغيل والإيقاف في إشعار الهاتف. أما تشغيلها بلا فتح التطبيق فهو يحتاج تطبيقاً أصلياً لا متصفّحاً.',
              en: 'Recitation keeps playing while you browse and while the screen is locked, with play/pause controls in the notification. Starting it without opening the app needs a native app, not a browser.',
            })}
          </p>
        </div>
      </div>
    </div>
  );
}
