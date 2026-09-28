/**
 * تسجيل عامل الخدمة (Service Worker).
 * ------------------------------------------------------------------
 * `vite-plugin-pwa` يولّد `sw.js`، ونستدعيه بأنفسسنا لنعرف لحظة ظهور
 * نسخة جديدة بدل أن تُبدَّل النسخة تحت يد المستخدم بلا إخبار.
 *
 * لا أحد يعرف أن رمزاً جديداً نُفِّذ إلا إن أخبرناه. لذلك نستخدم
 * `registerType: 'prompt'` ولا نعتمد التحديث التلقائي.
 */
import { registerSW } from 'virtual:pwa-register';

export interface UpdateHandlers {
  /** يُستدعى عند جاهزية نسخة جديدة — لعرض شريط التحديث */
  onNeedRefresh?: () => void;
  /** يُستدعى حين يصبح التطبيق جاهزاً للعمل دون إنترنت */
  onOfflineReady?: () => void;
  /** يُستدعى عند فشل التسجيل — التطبيق يعمل بدونه على أي حال */
  onError?: (err: unknown) => void;
}

/** يدعم المتصفح عامل الخدمة؟ */
export const swSupported = typeof navigator !== 'undefined' && 'serviceWorker' in navigator;

/**
 * يسجّل عامل الخدمة ويبلّغ عن التحديث.
 * يعيد دالة تفرض التحديث الفوري، و`null` إن تعذّر التسجيل.
 */
export function setupServiceWorker(handlers: UpdateHandlers = {}): (() => Promise<void>) | null {
  if (!swSupported) return null;
  if (import.meta.env.DEV) return null;

  try {
    const update = registerSW({
      immediate: true,
      onNeedRefresh: () => handlers.onNeedRefresh?.(),
      onOfflineReady: () => handlers.onOfflineReady?.(),
      onRegisterError: (err: unknown) => handlers.onError?.(err),
    });
    return () => update(true);
  } catch (err) {
    handlers.onError?.(err);
    return null;
  }
}

/** هل التطبيق مُهيَّأ للعمل دون إنترنت؟ */
export function isOfflineReady(): boolean {
  return swSupported && !!navigator.serviceWorker.controller;
}

/** هل الجهاز متصل بالإنترنت؟ */
export function isOnline(): boolean {
  return typeof navigator.onLine === 'boolean' ? navigator.onLine : true;
}
