/**
 * تثبيت التطبيق على الهاتف.
 * ------------------------------------------------------------------
 * ما يريده المستخدم: أن ينزّل التطبيق من جوجل كروم فيصير أيقونة على
 * الشاشة الرئيسية تعمل بلا متصفّح، أو ملفاً يُنزَّل مباشرة.
 *
 * الحقيقة التقنية التي لا نتجاوزها:
 *   • Chrome على أندرويد يدعم التثبيت: نلتقط حدث `beforeinstallprompt`
 *     ثم نعرض زرّ «تثبيت» حقيقياً يقود إلى نافذة النظام. هذا هو الطريق
 *     الصحيح والوحيد الذي تعتمده المتصفحات، ولا يمكن اختلاقه ببرمجتنا.
 *   • iOS (سفاري) لا يدعم هذا الحدث إطلاقاً. لا زرّ وهمياً — بل تعليمات
 *     خطوات قصيرة: زرّ المشاركة ثم «إضافة إلى الشاشة الرئيسية».
 *   • بعد التثبيت يصبح التطبيق مستقلاً بلا شريط عنوان، ويشتغل بلا
 *     إنترنت من ذاكرة عامل الخدمة.
 *
 * ما لا ندَّعيه: لا يمكن إطلاق التلاوة من الخلفية بلا فتحيق‏التطبيق‎.
 *   ذلك يحتاج تطبيقاً أصلياً. وما نفقره هو: التلاوة تستمر أثناء تصفّح
 *   التطبيق وقفل الشاشة، وهذا ما تنجزه واجهة المتصفّح فعلاً.
 */

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  prompt(): Promise<void>;
}

/** الحدث المحفوظ — لا يُرمى، وإلا ضاع التثبيت الوحيد */
let deferred: BeforeInstallPromptEvent | null = null;

const listeners = new Set<() => void>();
const notify = () => {
  for (const fn of listeners) fn();
};

/** يُستدعى مرّة واحدة عند بدء التطبيق */
let watching = false;

export function watchInstallPrompt(): void {
  if (typeof window === 'undefined' || watching) return;
  watching = true;

  window.addEventListener('beforeinstallprompt', (e) => {
    // المتصفّح يريد إخفاء الإشعار — نخفيه نحن ونعرضه متى شئنا
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    notify();
  });

  window.addEventListener('appinstalled', () => {
    deferred = null;
    notify();
  });
}

/** يُشترط أن يكون التطبيق مثبَّتاً فعلاً قبل عرض أزرار التحكّم */
export function isInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = navigator as Navigator & {
    standalone?: boolean;
    msStandalone?: boolean;
  };
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
}

/** هل المتصفح يملك حدث التثبيت؟ */
export function canPromptInstall(): boolean {
  return deferred !== null;
}

export type InstallResult = 'accepted' | 'dismissed' | 'unavailable';

/**
 * تشغيل نافذة التثبيت. يُرجع ما يريده المستخدم فعلاً —
 * «رفض» تُبلَّ عنه بوضوح، ولا نُخفيها كأنها نجاح.
 */
export async function promptInstall(): Promise<InstallResult> {
  const e = deferred;
  if (!e) return 'unavailable';
  // الحدث استعماله مرّة واحدة؛ نُفرغه قبل النداء حتى لا نضغطه مرتين
  deferred = null;
  notify();
  try {
    await e.prompt();
    const { outcome } = await e.userChoice;
    notify();
    return outcome;
  } catch (err) {
    // بعض المتصفحات ترمي إن أُلغي التثبيت — لا نُظهر خطأً للمستخدم
    console.warn('تعذّر فتح نافذة التثبيت', err);
    return 'dismissed';
  }
}

/** حارس مستقل عن الجهاز: هل هذا آيفون أو آيباد؟ */
export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // آيباد جديد يقول إنه ماك، فنميّزه للمس
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

/** حارس مستقل عن الجهاز: هل هذا متصفّح مستند إلى واجهة حاسوب؟ */
export function isSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent);
}

/** الاشتراك في تغيّر إمكانية التثبيت — يُستعمل داخل `useSyncExternalStore` */
export function subscribeInstall(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
