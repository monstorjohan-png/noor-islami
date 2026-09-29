/**
 * التلاوة في الخلفية وأزرار التحكّم خارج التطبيق.
 * ------------------------------------------------------------------
 * ما يريده المستخدم: أن تشتغل التلاوة وإن أغلق التطبيق، وأن يجد
 * زرَّي تشغيل وإيقاف في إشعار الهاتف أو شاشة القفل.
 *
 * الأداة الصحيحة هي Media Session API — هي معيار في المتصفحات،
 * المتصفحات التي تدعمها: Chrome، Edge، Opera.
 * ويقرأها مشغّل النظام فيعرضها في الإشعار وعلى شاشة القفل.
 * على iOS لا تحكّم كامل بالإشعار، لكن التشغيل في الخلفية يعمل لأن
 * عنصر الصوت نفسه يبقى حياً ما دام التشغيل جارياً.
 *
 * ما لا تستطيعه المتصفحات، ولا ندّعيه:
 *   • الإقلاع في الخلفية بلا صفحة مفتوحة — يحتاج تطبيقاً أصلياً.
 *     لهذا لنعد أن التطبيق يعمل في الخلفية ما دام التلاوة جارية،
 *     ونقولها للمستخدم بصيغتها الصحيحة.
 *
 * القواعد التي التزمها:
 *   ١ • `audioContext` لا يُنشأ إلا بعد لمس المستخدم. إنشاؤه مسبقاً
 *      يجعله `suspended` فلا يبثّ، وهو خطأ شائع يُصمت الصوت بلا سبب.
 *   ٢ • كل مسار نُعيده للنظام في `try/catch`. استثناء غير معالَج
 *      هنا يُسقط التطبيق كله أثناء التلاوة.
 *   ٣ • لا نعِد بإمكانية لا يدعمها المتصفح: نتحقق قبل أن نكتب.
 */

type HandlerName =
  | 'play' | 'pause' | 'previoustrack' | 'nexttrack'
  | 'seekbackward' | 'seekforward' | 'seekto' | 'stop';

export interface MediaHandlers {
  play?: () => void;
  pause?: () => void;
  prev?: () => void;
  next?: () => void;
  backward?: (seconds?: number) => void;
  forward?: (seconds?: number) => void;
  seekTo?: (time: number) => void;
  stop?: () => void;
}

const SUPPORTED =
  typeof navigator !== 'undefined' && typeof navigator.mediaSession !== 'undefined';

/** هل يمكن الاعتماد على إشعار التحكّم على هذا المتصفح؟ */
export const mediaSessionSupported = (): boolean => SUPPORTED;

/**
 * تسجيل أزرار التحكّم. الخطأ يُبتلع عمداً: بعض المتصفحات ترمي
 * على اسم إجراء لا تعرفه، وخطؤنا هنا يوقف التلاوة كلّها.
 */
export function registerMediaHandlers(h: MediaHandlers): void {
  if (!SUPPORTED) return;
  const map: Array<[HandlerName, MediaSessionActionHandler]> = [
    ['play', () => h.play?.()],
    ['pause', () => h.pause?.()],
    ['previoustrack', () => h.prev?.()],
    ['nexttrack', () => h.next?.()],
    ['seekbackward', (d) => h.backward?.(d ? Number(d) : 10)],
    ['seekforward', (d) => h.forward?.(d ? Number(d) : 10)],
    ['stop', () => h.stop?.()],
    ['seekto', (d) => {
      if (d && typeof d.seekTime === 'number') h.seekTo?.(d.seekTime);
    }],
  ];
  for (const [name, fn] of map) {
    try {
      navigator.mediaSession.setActionHandler(name as MediaSessionAction, fn);
    } catch {
      // المتصفح لا يعرف هذا الإجراء — نُهمله ولا نُظهر خطأً للمستخدم
    }
  }
}

export function clearMediaHandlers(): void {
  if (!SUPPORTED) return;
  const names: MediaSessionAction[] = [
    'play', 'pause', 'previoustrack', 'nexttrack',
    'seekbackward', 'seekforward', 'seekto', 'stop',
  ];
  for (const n of names) {
    try {
      navigator.mediaSession.setActionHandler(n, null);
    } catch { /* غير مدعوم — تجاهل */ }
  }
}

/** صورة الغلاف: تُفضَّل من ذاكرة التطبيق نفسها فلا تحتاج شبكة */
export interface Cover {
  src: string;
  sizes?: string;
  type?: string;
}

/** عنوان الإشعار: يظهر على شاشة القفل وفي قائمة المشغّل */
export function setMediaMetadata(meta: {
  title: string;
  artist: string;
  album: string;
  artwork?: Cover[];
}): void {
  if (!SUPPORTED) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: meta.title,
      artist: meta.artist,
      album: meta.album,
      artwork: (meta.artwork ?? []).map((c) => ({
        src: c.src,
        sizes: c.sizes,
        type: c.type ?? 'image/png',
      })),
    });
  } catch (err) {
    console.warn('تعذّر ضبط بيانات الإشعار', err);
  }
}

/** حالة التشغيل والإيقاف في الإشعار */
export function setMediaPlayback(state: 'playing' | 'paused' | 'none'): void {
  if (!SUPPORTED) return;
  try {
    navigator.mediaSession.playbackState = state;
  } catch { /* غير مدعوم — تجاهل */ }
}

/* ---------- منع إطفاء الشاشة أثناء التلاوة ---------- */

/**
 * إبقاء الشاشة مضاءة أثناء الاستماع. يعمل على Chrome و Edge.
 * لا نعد به: بعض الأجهزة لا تدعمه، والاستعمال يُحرّر القفل تلقائياً.
 */
export class WakeGuard {
  private lock: WakeLockSentinel | null = null;
  private wanted = false;

  async hold(): Promise<void> {
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
    this.wanted = true;
    if (this.lock) return;
    try {
      this.lock = await navigator.wakeLock.request('screen');
      this.lock.addEventListener('release', () => {
        this.lock = null;
      });
    } catch (err) {
      // رفض المتصفح أو البطارية المنخفضة — التلاوة تستمر بلا إبقاء شاشة
      console.warn('تعذّر إبقاء الشاشة مضاءة', err);
    }
  }

  release(): void {
    this.wanted = false;
    void this.lock?.release().catch(() => undefined);
    this.lock = null;
  }

  /**
   * المتصفح يُحرّر القفل عند إخفاء الصفحة، فنجدده عند العودة.
   * بلا هذا التجديد تتوقف حماية الشاشة بعد أول انتقال.
   */
  syncVisibility(): void {
    if (typeof document === 'undefined') return;
    if (document.visibilityState === 'visible' && this.wanted && !this.lock) {
      void this.hold();
    }
  }
}
