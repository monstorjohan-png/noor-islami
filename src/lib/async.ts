/**
 * أدوات غير متزامنة مشتركة.
 * ------------------------------------------------------------------
 * الغرض: إيقاف الطرق التي تُجمّد الواجهة.
 *
 * القصة: قراءة تدفّق بايتات تستدعي `onProgress` آلاف المرات في الثانية.
 * كل نداء يوقظ React فيعيد بناء الشجرة. النتيجة شاشة بيضاء لثوانٍ
 * على هاتف ضعيف. الحل ليس إلغاء التقدّم، بل تقليل عدد النداءات إلى
 * ما تراه العين: ستّ مرات في الثانية تكفي تماماً.
 */

/** فاصل التقدّم: ستّ مرات بالثانية — ما تراه العين، وأخفّ على المعالج. */
const PROGRESS_MS = 160;

/** فاصل التنازل عن المعالج بالميلي ثانية */
const YIELD_MS = 0;

/** تفويض العمل إلى الإطار التالي، بلا مؤقّت ضائع */
export function yieldToUI(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => resolve());
    else setTimeout(resolve, YIELD_MS);
  });
}

/**
 * يُغلّف دالة سريعة في نسخة لا تتجاوز مرة كل `ms`.
 * آخر قيمة تُطرَح دائماً عند الطلب الأخير — فلا يبقى التقدّم معلّقاً
 * عند نقطة أقل من الحقيقة، وهو الخطأ الذي يُري المستخدم شريطاً ناقصاً.
 */
export function throttle<A extends unknown[]>(
  fn: (...args: A) => void,
  ms: number = PROGRESS_MS,
): ((...args: A) => void) & { flush: () => void } {
  let last = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: A | null = null;

  const run = (args: A) => {
    last = Date.now();
    fn(...args);
  };

  const wrapped = (...args: A) => {
    const now = Date.now();
    const wait = ms - (now - last);
    if (wait <= 0) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      pending = null;
      run(args);
      return;
    }
    pending = args;
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      if (pending) {
        const p = pending;
        pending = null;
        run(p);
      }
    }, wait);
  };

  wrapped.flush = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (pending) {
      const p = pending;
      pending = null;
      fn(...p);
    }
  };

  return wrapped;
}
