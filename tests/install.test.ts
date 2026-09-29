import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * منطق التثبيت يُختبر بلا متصفّح حقيقي: نعطي `window` و`navigator`
 * وهميين، فنختبر decisões الكود لا سلوك المتصفّح.
 */

interface Win {
  addEventListener: (t: string, fn: (e: unknown) => void) => void;
  matchMedia: (q: string) => { matches: boolean };
}

let win: Win;
let nav: Record<string, unknown>;
let nativeWindow: unknown;
let nativeNavigator: unknown;

function makeEvent(promptResult: 'accepted' | 'dismissed' | 'throw' = 'accepted') {
  return {
    type: 'beforeinstallprompt',
    preventDefault: vi.fn(),
    platforms: ['web'],
    prompt:
      promptResult === 'throw'
        ? vi.fn().mockRejectedValue(new Error('أُلغي'))
        : vi.fn().mockResolvedValue(undefined),
    userChoice: Promise.resolve({ outcome: promptResult === 'throw' ? 'dismissed' : promptResult }),
  };
}

beforeEach(async () => {
  vi.resetModules();
  nativeWindow = (globalThis as Record<string, unknown>).window;
  nativeNavigator = (globalThis as Record<string, unknown>).navigator;
  win = {
    addEventListener: vi.fn(),
    matchMedia: vi.fn(() => ({ matches: false })),
  };
  nav = { userAgent: 'Mozilla/5.0 (Linux; Android 13) Chrome/120', platform: 'Linux armv8l', maxTouchPoints: 5 };
  (globalThis as Record<string, unknown>).window = win;
  (globalThis as Record<string, unknown>).navigator = nav;
});

afterEach(() => {
  (globalThis as Record<string, unknown>).window = nativeWindow;
  (globalThis as Record<string, unknown>).navigator = nativeNavigator;
});

/** يلتقط المستمع الذي سجّلته الوحدة لنوع حدث معيّن */
function listenerFor(type: string): ((e: unknown) => void) | null {
  const call = (win.addEventListener as ReturnType<typeof vi.fn>).mock.calls.find(
    (c: unknown[]) => c[0] === type,
  );
  return call ? (call[1] as (e: unknown) => void) : null;
}

describe('التثبيت: التقاط نافذة النظام', () => {
  it('قبل الحدث لا يوجد زرّ تثبيت — لا نعد بما لا نملكه', async () => {
    const m = await import('../src/lib/install');
    expect(m.canPromptInstall()).toBe(false);
  });

  it('الحدث يُمنع الافتراضي ثم يُحفظ — فنتولّ نحن وقت العرض', async () => {
    const m = await import('../src/lib/install');
    m.watchInstallPrompt();
    const e = makeEvent();
    listenerFor('beforeinstallprompt')?.(e);
    expect(e.preventDefault).toHaveBeenCalled();
    expect(m.canPromptInstall()).toBe(true);
  });

  it('المشاهدة مرّة واحدة — مستمعان على الحدث يعني ازدواج النداء', async () => {
    const m = await import('../src/lib/install');
    m.watchInstallPrompt();
    m.watchInstallPrompt();
    m.watchInstallPrompt();
    const calls = (win.addEventListener as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c: unknown[]) => c[0] === 'beforeinstallprompt',
    );
    expect(calls.length).toBe(1);
  });

  it('التثبيت المقبول يُعلن نجاحه', async () => {
    const m = await import('../src/lib/install');
    m.watchInstallPrompt();
    listenerFor('beforeinstallprompt')?.(makeEvent('accepted'));
    expect(await m.promptInstall()).toBe('accepted');
  });

  it('رفض المستخدم يُعلَن رفضاً لا نجاحاً — لا نكذب على المستخدم', async () => {
    const m = await import('../src/lib/install');
    m.watchInstallPrompt();
    listenerFor('beforeinstallprompt')?.(makeEvent('dismissed'));
    expect(await m.promptInstall()).toBe('dismissed');
  });

  it('استثناء المتصفّح لا يمرّ إلى المستخدم ولا يقطع التطبيق', async () => {
    const m = await import('../src/lib/install');
    m.watchInstallPrompt();
    listenerFor('beforeinstallprompt')?.(makeEvent('throw'));
    expect(await m.promptInstall()).toBe('dismissed');
  });

  it('الحدث يُستعمل مرّة واحدة — النقر مرتين لا يفتح نافذتين', async () => {
    const m = await import('../src/lib/install');
    m.watchInstallPrompt();
    const e = makeEvent();
    listenerFor('beforeinstallprompt')?.(e);
    await m.promptInstall();
    expect(await m.promptInstall()).toBe('unavailable');
    expect(e.prompt).toHaveBeenCalledTimes(1);
  });

  it('بعد التثبيت لا يبقى زرّ تثبيت', async () => {
    const m = await import('../src/lib/install');
    m.watchInstallPrompt();
    listenerFor('beforeinstallprompt')?.(makeEvent());
    listenerFor('appinstalled')?.(new Event('appinstalled'));
    expect(m.canPromptInstall()).toBe(false);
  });

  it('بلا حدث، النداء يُرجع غير متاح ولا يرمي', async () => {
    const m = await import('../src/lib/install');
    expect(await m.promptInstall()).toBe('unavailable');
  });
});

describe('التثبيت: كشف حالة الجهاز', () => {
  it('التطبيق المستقل مُثبَّت', async () => {
    win.matchMedia = vi.fn(() => ({ matches: true }));
    const m = await import('../src/lib/install');
    expect(m.isInstalled()).toBe(true);
  });

  it('متصفّح عادي ليس مثبَّتاً', async () => {
    const m = await import('../src/lib/install');
    expect(m.isInstalled()).toBe(false);
  });

  it('آيفون يُكتشف من نوع الجهاز', async () => {
    nav.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Version/17.0 Mobile Safari';
    const m = await import('../src/lib/install');
    expect(m.isIOS()).toBe(true);
  });

  it('آيباد يقول إنه ماك — يُميَّز بعدد نقاط اللمس', async () => {
    nav.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)';
    nav.platform = 'MacIntel';
    nav.maxTouchPoints = 5;
    const m = await import('../src/lib/install');
    expect(m.isIOS()).toBe(true);
  });

  it('حاسوب مكتبي ليس آيفوناً', async () => {
    const m = await import('../src/lib/install');
    expect(m.isIOS()).toBe(false);
  });

  it('سفاري يُعرف من بصمة المتصفح', async () => {
    nav.userAgent =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15';
    const m = await import('../src/lib/install');
    expect(m.isSafari()).toBe(true);
  });

  it('كروم ليس سفاري رغم أنهما على نواة واحدة', async () => {
    nav.userAgent = 'Mozilla/5.0 (Linux; Android 13) Chrome/120 Mobile Safari';
    const m = await import('../src/lib/install');
    expect(m.isSafari()).toBe(false);
  });
});

describe('التثبيت: الاشتراك في التغيير', () => {
  it('المشترك يُبلَّغ عند تغيّر الإمكانية', async () => {
    const m = await import('../src/lib/install');
    m.watchInstallPrompt();
    const fn = vi.fn();
    const off = m.subscribeInstall(fn);
    listenerFor('beforeinstallprompt')?.(makeEvent());
    expect(fn).toHaveBeenCalled();
    off();
  });

  it('إلغاء الاشتراك يوقف الإبلاغ — لا تسريب مستمعين', async () => {
    const m = await import('../src/lib/install');
    m.watchInstallPrompt();
    const fn = vi.fn();
    const off = m.subscribeInstall(fn);
    off();
    listenerFor('beforeinstallprompt')?.(makeEvent());
    expect(fn).not.toHaveBeenCalled();
  });
});
