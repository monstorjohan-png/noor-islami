/**
 * جدولة التنبيهات في الخلفية.
 * ------------------------------------------------------------------
 * المشكلة: `new Notification()` ينبّه فوراً ولا يجدول شيئاً، فلا يصل
 * إشعار عند إغلاق التطبيق — وهو الحالة التي يحتاجها مستخدم الأذان.
 *
 * الحل هنا ثلاث طبقات، كلٌّ منها تعمل وحدها:
 *
 *  1. جدولة في الذاكرة — طالما التطبيق مفتوح: مؤقّت لكل صلاة.
 *  2. عامل الخدمة — عبر `showNotification` مع المزامنة الدورية في الخلفية،
 *     فيصلك التنبيه حتى أُغلق التطبيق (مدعوم في أندرويد).
  3. تذكير عند الساعة — إن فُتح المتصفح قبل الموعد، يُجدول إشعار؛ وإلا فالمقارنة عند كل فتح.
 *     إشعار عبر `setTimeout` طويل؛ وإلا فالساعة تُقارن عند كل فتح.
 *
 * لا شيء هنا يفترض إذناً: كل خطوة تتحقق وتُبلّغ عن الفشل بدل أن تترك
 * المستخدم ينتظر تنبيهاً لا يأتي.
 */

export interface PrayerSlot {
  key: string;
  label: string;
  /** وقت الدخول بالمللي ثانية منذ منتصف ليل اليوم المحلي */
  ms: number;
}

const TIMERS = new Set<number>();
/** آخر تنبيه أُرسل، لمنع التكرار عند إعادة فتح الصفحة */
const SENT_KEY = 'noor-athan-last';
const SCHEDULE_KEY = 'noor-athan-schedule';

type Outcome = 'scheduled' | 'sent' | 'need-permission' | 'denied' | 'unsupported' | 'failed';

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* التخزين غير متاح — يكتفظ التطبيق بالجدولة في الذاكرة */
  }
}

export function notificationSupport(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export async function requestPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  try {
    if (Notification.permission === 'granted') return 'granted';
    return await Notification.requestPermission();
  } catch (err) {
    console.warn('تعذّر طلب إذن الإشعار', err);
    return Notification.permission;
  }
}

/** إشعار فوري عبر عامل الخدمة إن أمكن، وإلا عبر النافذة */
export async function notifyNow(title: string, body: string, tag = 'noor-athan'): Promise<Outcome> {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission !== 'granted') return 'need-permission';

  // عامل الخدمة يتيح إشعارات قابلة للنقر بعد إغلاق النافذة
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, {
        body,
        tag,
        icon: 'icons/icon-192.png',
        badge: 'icons/icon-192.png',
        dir: 'rtl',
        lang: 'ar',
        data: { url: '/prayer' },
      });
      return 'sent';
    }
  } catch (err) {
    console.warn('تعذّر الإشعار عبر عامل الخدمة، نجرب عبر النافذة', err);
  }

  try {
    new Notification(title, { body, tag });
    return 'sent';
  } catch (err) {
    console.warn('تعذّر إرسال الإشعار', err);
    return 'failed';
  }
}

/**
 * جدولة تنبيه أذان واحد.
 * `fireAt` لحظة الوصول بالمللي ثانية. إن كانت قد مضت فجُلّت لليوم التالي.
 */
function scheduleOne(slot: PrayerSlot, fireAt: number, outcome: Outcome[]): void {
  const delay = fireAt - Date.now();
  if (delay < 0) return; // فات وقته — نتخطاه، ويلحقه المزامنة عند الفتح
  const id = window.setTimeout(() => {
    TIMERS.delete(id);
    writeJSON(SENT_KEY, Date.now());
    void notifyNow(
      `${slot.label} — حان الآن`,
      'حان وقت الصلاة، تقبّل الله منك',
      `noor-athan-${slot.key}`,
    );
  }, Math.min(delay, 2_147_483_000)); // حدّ setTimeout الأقصى
  TIMERS.add(id);
  outcome.push('scheduled');
}

/** إلغاء كل المؤقّتات المعلّقة — يُستدعى قبل إعادة الجدولة */
export function clearSchedule(): void {
  for (const id of TIMERS) window.clearTimeout(id);
  TIMERS.clear();
}

/**
 * يجدول تنبيهات اليوم كله.
 * `slots` تأتي من `computeTimes` في `lib/prayer`.
 */
export function scheduleDay(slots: PrayerSlot[]): { scheduled: number; skipped: number } {
  clearSchedule();
  const outcome: Outcome[] = [];
  const now = Date.now();

  for (const slot of slots) {
    // بداية اليوم المحلي + وقت الصلاة
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    const fireAt = d.getTime() + slot.ms;
    // إن فات الوقت اليوم، جرّبه غداً ليُجدول ولا يُهمَل
    const when = fireAt > now ? fireAt : fireAt + 86_400_000;
    scheduleOne({ ...slot, ms: when - d.getTime() }, when, outcome);
  }

  const schedule = slots.map((s) => ({ key: s.key, label: s.label, ms: s.ms }));
  writeJSON(SCHEDULE_KEY, { at: now, schedule });
  return { scheduled: outcome.length, skipped: slots.length - outcome.length };
}

/**
 * مزامنة عند فتح التطبيق: يجدول ما لم يُجدول بعد اليوم.
 * يغطي الحالة التي أُغلق فيها التطبيق فات وقت صلاة.
 */
export function syncOnOpen(slots: PrayerSlot[]): number {
  const saved = readJSON<{ at: number; schedule: Array<{ key: string; label: string; ms: number }> } | null>(
    SCHEDULE_KEY,
    null,
  );
  if (!saved) return 0;

  const now = Date.now();
  // إن كانت جدولة أمس، أعد البناء كاملاً
  const fresh = new Date(saved.at);
  fresh.setHours(0, 0, 0, 0);
  if (fresh.getTime() !== new Date(new Date().setHours(0, 0, 0, 0)).getTime()) {
    return scheduleDay(slots).scheduled;
  }

  const lastSent = readJSON<number>(SENT_KEY, 0);
  const d = new Date();
  d.setHours(0, 0, 0, 0);

  for (const slot of saved.schedule) {
    const fireAt = d.getTime() + slot.ms;
    // فاتت ولم تُرسَل بعد، والمتصفح لم يُشعِرها أصلاً
    if (fireAt < now && fireAt > lastSent && Notification.permission === 'granted') {
      writeJSON(SENT_KEY, Date.now());
      void notifyNow(
        `${slot.label} — فات وقته`,
        'تأخّر التنبيه — حان وقت الصلاة',
        `noor-athan-${slot.key}`,
      );
    }
  }
  return scheduleDay(slots).scheduled;
}

/**
 * تفعيل المزامنة الدورية في الخلفية (مدعوم في كروم/أندرويد).
 * يُبقي التنبيه يعمل حتى أُغلق التطبيق تماماً.
 */
export async function enableBackgroundSync(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sw = reg as ServiceWorkerRegistration & {
      periodicSync?: { register(tag: string, opts: { minInterval: number }): Promise<void> };
    };
    if (!sw.periodicSync) return false;
    const state = await navigator.permissions?.query({ name: 'periodic-background-sync' as PermissionName });
    if (state && state.state !== 'granted') return false;
    await sw.periodicSync.register('noor-prayer-times', { minInterval: 12 * 60 * 60 * 1000 });
    return true;
  } catch (err) {
    console.warn('تعذّرت مزامنة الخلفية — سيعمل التنبيه والتبويب مفتوحين فقط', err);
    return false;
  }
}

/* ---------- التذكير اليومي ---------- */

const REMINDER_TAG = 'noor-daily';

/** يوم معيّن بصيغة YYYY-MM-DD بالتوقيت المحلي */
function dayKeyOf(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * يختار آية اليوم موضعاً ثابتاً يتغيّر بتغيّر اليوم.
 * الرقم مشتق من اليوم لا مكتوب في الذاكرة، فيعطي توزيعاً منتظماً على 6236 آية.
 * النص نفسه يُقرأ من المصحف عبر `content.ts` — لا يُكتب من الذاكرة هنا.
 */
export function dailyAyahIndex(from: Date): number {
  const days = Math.floor(
    Date.UTC(from.getFullYear(), from.getMonth(), from.getDate()) / 86400000,
  );
  return (((days * 7919) % 6236) + 6236) % 6236;
}

let dailyTimer: number | null = null;

/** جدولة تذكير يومي في وقت محدّد، ويجدول التالي تلقائياً */
export function scheduleDailyReminder(hour: number, minute: number): void {
  clearDailyReminder();
  if (typeof window === 'undefined') return;
  const now = new Date();
  const fire = new Date(now);
  fire.setHours(hour, minute, 0, 0);
  if (fire.getTime() <= now.getTime()) fire.setDate(fire.getDate() + 1);

  const delay = fire.getTime() - now.getTime();
  dailyTimer = window.setTimeout(() => {
    dailyTimer = null;
    void notifyNow('وردك اليوم', 'حان وقت الأذكار والورد — افتح التطبيق', REMINDER_TAG);
    // يواصل الجدولة كي لا يتوقف التذكير بعد أول مرة
    scheduleDailyReminder(hour, minute);
  }, Math.min(delay, 2147483647));
}

/** إلغاء التذكير ومسح إشعاره الظاهر */
export async function clearDailyReminder(): Promise<void> {
  if (dailyTimer !== null) {
    window.clearTimeout(dailyTimer);
    dailyTimer = null;
  }
  try {
    if (!navigator?.serviceWorker?.controller) return;
    // getNotifications على التسجيل لا على المتحكم
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return;
    const list = await reg.getNotifications({ tag: REMINDER_TAG });
    for (const n of list) n.close();
  } catch (err) {
    console.warn('تعذّر مسح التذكير السابق', err);
  }
}

/** هل أُرسل التذكير اليوم؟ يمنع التكرار عند إعادة فتح التطبيق */
export function dailyReminderSentToday(): boolean {
  return readJSON<string>('noor-daily-sent', '') === dayKeyOf(new Date());
}

export function markDailyReminderSent(): void {
  writeJSON('noor-daily-sent', dayKeyOf(new Date()));
}
