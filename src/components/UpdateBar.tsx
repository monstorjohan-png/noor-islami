/**
 * شريط التحديث
 * ------------------------------------------------------------------
 * العامل لا يستبدل نفسه تلقائياً. هذا الشريط هو ما يقول للمستخدم إن
 * هناك نسخة جديدة، ويجعله هو من يقرّر متى. الاستبدال في وسط جلسة
 * مفتوحة يخلط ملفات نسختين فيتبيض الشاشة.
 */
import { useCallback, useEffect, useState } from 'react';
import { setupServiceWorker } from '../registerSW';
import { useSettings } from '../lib/store';

export function UpdateBar() {
  const lang = useSettings((s) => s.lang);
  const ar = lang === 'ar';

  const [ready, setReady] = useState(false);
  const [offline, setOffline] = useState(false);
  const [apply, setApply] = useState<(() => Promise<void>) | null>(null);

  useEffect(() => {
    const force = setupServiceWorker({
      onNeedRefresh: () => setReady(true),
      onOfflineReady: () => setOffline(true),
    });
    setApply(() => force);

    // الجاهزية ليست معلومة عاجلة — تختفي بعد ست ثوانٍ
    const t = setTimeout(() => setOffline(false), 6000);
    return () => clearTimeout(t);
  }, []);

  const update = useCallback(() => {
    void apply?.();
  }, [apply]);

  if (offline) {
    return (
      <div
        role="status"
        className="fixed bottom-4 inset-x-4 z-50 mx-auto max-w-sm rounded-2xl bg-emerald-900/95 text-emerald-50 text-sm px-4 py-3 text-center shadow-xl backdrop-blur"
      >
        {ar ? 'التطبيق جاهز للعمل بدون إنترنت' : 'Ready to work offline'}
      </div>
    );
  }

  if (!ready) return null;

  return (
    <div
      role="alert"
      className="fixed bottom-4 inset-x-4 z-50 mx-auto max-w-sm rounded-2xl bg-slate-800/95 text-slate-50 text-sm px-4 py-3 shadow-xl backdrop-blur flex items-center gap-3"
    >
      <span className="flex-1 text-right">
        {ar ? 'تتوفّر نسخة جديدة' : 'A new version is available'}
      </span>
      <button
        type="button"
        onClick={update}
        className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 font-semibold text-white"
      >
        {ar ? 'تحديث الآن' : 'Update'}
      </button>
    </div>
  );
}
