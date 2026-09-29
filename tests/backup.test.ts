/**
 * اختبارات النسخ الاحتياطي.
 * تُشغَّل: npx vitest run tests/backup.test.ts
 *
 * منطق خالص بلا React: نُقلّد التخزين المحلي، ونمرّ على كل واجهة من
 * واجهات الوحدة. الفحص هنا على قرار «يمسح أم لا» قبل كل شيء — فالمسح
 * هنا عملية لا رجعة فيها، والخطر الأكبر أن يمسح الاستيراد ما عند
 * المستخدم.
 *
 * النمط في التخزين الوهمي هو نفسه في tests/data-sync.test.ts.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BACKUP_APP, BACKUP_VERSION, MAX_BACKUP_CHARS, SETTINGS_KEY } from '../src/lib/backup';
import { HIFZ_KEY } from '../src/lib/hifz';
import type { BackupFile } from '../src/lib/backup';

/** مخزن التخزين المحلي الوهمي — بيئة بلا متصفّح */
let realStorage: unknown;

/** يقرأ المخزن نفسه ليرى ما كُتب فيه فعلاً */
function read(key: string): string | null {
  return (globalThis as Record<string, unknown>).localStorage === undefined
    ? null
    : (globalThis as unknown as { localStorage: Storage }).localStorage.getItem(key);
}

function installStorage(): void {
  const map = new Map<string, string>();
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k: string, v: string) => map.set(k, String(v)),
    removeItem: (k: string) => map.delete(k),
    clear: () => map.clear(),
  };
}

/**
 * يحمّل الوحدة من جديد فوق تخزين جاهز.
 * إعادة الوحدات لازمة: المخزن الدائم يقرأ التخزين لحظة إنشائه، فإبقاء
 * وحدة محمّلة قبل تثبيت التخزين يجعل الاختبار يقرأ حالة غيره.
 */
async function load(settings?: unknown, hifz?: unknown) {
  vi.resetModules();
  installStorage();
  if (settings !== undefined) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ state: settings, version: 1 }));
  }
  if (hifz !== undefined) localStorage.setItem(HIFZ_KEY, JSON.stringify(hifz));
  const mod = await import('../src/lib/backup');
  const store = await import('../src/lib/store');
  return { ...mod, store };
}

/** حالة إعدادات كما يكتبها المخزن الدائم */
function settings(over: Record<string, unknown> = {}): Record<string, unknown> {
  return { lang: 'ar', theme: 'dark', palette: 'noor', tasbihTotal: 0, tasbihCounts: {}, ...over };
}

/** ملف نسخة كامل صالح */
function backupFile(over: Partial<BackupFile> = {}): BackupFile {
  return {
    v: BACKUP_VERSION,
    createdAt: 1_700_000_000_000,
    app: BACKUP_APP,
    settings: settings(),
    hifz: null,
    keys: [SETTINGS_KEY],
    ...over,
  };
}

/** نصّ ملف نسخة كامل صالح */
function backupText(over: Partial<BackupFile> = {}): string {
  return JSON.stringify(backupFile(over));
}

describe('النسخ الاحتياطي', () => {
  beforeEach(() => {
    realStorage = (globalThis as Record<string, unknown>).localStorage;
    installStorage();
  });

  afterEach(() => {
    (globalThis as Record<string, unknown>).localStorage = realStorage;
  });

  /* ---------- التصدير ---------- */

  it('التصدير يجمع المخزين كاملَين ولا يمسح شيئاً', async () => {
    const mod = await load(
      settings({ tasbihTotal: 12, tasbihCounts: { morning: 3 }, location: { lat: 21.4, lon: 39.9, label: 'مكة' } }),
      { entries: [{ surah: 1, maxAyah: 5, updatedAt: 1_700_000_000_000 }], startDay: 100, dailyTarget: 20, completedRuns: 0, lastCompletedAt: null },
    );

    const file = await mod.collectBackup();

    expect(file.v).toBe(1);
    expect(file.app).toBe(BACKUP_APP);
    expect(file.keys).toEqual([SETTINGS_KEY, HIFZ_KEY]);
    expect(file.settings).not.toBeNull();
    expect(file.hifz).not.toBeNull();

    // التصدير قراءة فقط: كل ما فيه ما زال في مكانه
    expect(read(SETTINGS_KEY)).not.toBeNull();
    expect(read(HIFZ_KEY)).not.toBeNull();
  });

  it('مخزن تالف لا يُسقط التصدير — ناقص خيرٌ من رمي', async () => {
    vi.resetModules();
    installStorage();
    localStorage.setItem(SETTINGS_KEY, '{هذا ليس JSON');
    localStorage.setItem(HIFZ_KEY, JSON.stringify({ entries: [], startDay: 1, dailyTarget: 20, completedRuns: 0, lastCompletedAt: null }));
    const mod = await import('../src/lib/backup');

    const file = await mod.collectBackup();

    expect(file.settings).toBeNull();
    expect(file.keys).toEqual([HIFZ_KEY]);
    // التخزين التالف باقٍ كما هو — لا نمسح ما لا نستطيع قراءته
    expect(read(SETTINGS_KEY)).toBe('{هذا ليس JSON');
  });

  it('جهاز بلا تخزين محلي يعطي نسخة فارغة لا رمي', async () => {
    vi.resetModules();
    (globalThis as Record<string, unknown>).localStorage = undefined;
    const mod = await import('../src/lib/backup');
    const file = await mod.collectBackup();
    expect(file.settings).toBeNull();
    expect(file.hifz).toBeNull();
    expect(file.keys).toEqual([]);
  });

  it('اسم الملف لاتيني يحمل التاريخ — اسم عربي في اسم ملف لا يُفتح', async () => {
    const mod = await load();
    const name = mod.backupFileName();
    expect(name).toMatch(/^noor-backup-\d{4}-\d{2}-\d{2}\.json$/);
    expect(name).not.toMatch(/[\u0600-\u06FF]/);
  });

  /* ---------- رفض المدخلات ---------- */

  it('نصّ ليس ملف نسخة يُرفض برسالة مفهومة', async () => {
    const mod = await load();
    for (const bad of [
      'ليس JSON',
      '',
      '   ',
      '{',
      '[1,2,3]',
      '42',
      '"نص"',
      'null',
      'true',
      '{}',
    ]) {
      const r = mod.parseBackup(bad);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(mod.backupErrorText(r.error, 'ar')).not.toBe('');
    }
  });

  it('ملف من نسخة أحدث يُرفض قبل أي كتابة', async () => {
    const mod = await load(settings({ tasbihTotal: 7 }));
    const r = mod.parseBackup(JSON.stringify({ ...backupFile(), v: 2 }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('version');
    expect(mod.store.useSettings.getState().tasbihTotal).toBe(7);
  });

  it('ملف من تطبيق آخر يُرفض', async () => {
    const mod = await load();
    for (const app of ['other-app', 'NOOR', '', undefined]) {
      const r = mod.parseBackup(JSON.stringify({ ...backupFile(), app }));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toBe('app');
    }
  });

  it('إعدادات ليست كائناً تُرفض كلها — لا استيراد ناقص', async () => {
    const mod = await load();
    for (const bad of ['نص', 5, [], {}, true]) {
      const r = mod.parseBackup(JSON.stringify({ ...backupFile(), settings: bad }));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toBe('notObject');
    }
  });

  it('إعدادات غائبة تعني لا إعدادات — سليمة لا مرفوضة', async () => {
    const mod = await load(settings({ tasbihTotal: 3 }));
    for (const absent of [null, undefined]) {
      const r = mod.parseBackup(JSON.stringify({ ...backupFile({}), settings: absent, keys: [HIFZ_KEY] }));
      expect(r.ok).toBe(true);
      if (!r.ok) continue;
      expect(r.data.settings).toBeNull();
      const res = await mod.applyBackup(r.data);
      expect(res.applied).not.toContain(SETTINGS_KEY);
      expect(res.skipped).toContain(SETTINGS_KEY);
      // العدّاد المحلّي لم يُمسّ
      expect(mod.store.useSettings.getState().tasbihTotal).toBe(3);
    }
  });

  it('ملف ضخم يُرفض قبل التحليل — تحليل نصّ كبير يوقف الواجهة', async () => {
    const mod = await load();
    const huge = `"${'ا'.repeat(MAX_BACKUP_CHARS + 10)}"`;
    expect(huge.length).toBeGreaterThan(MAX_BACKUP_CHARS);
    const r = mod.parseBackup(huge);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('tooLarge');
  });

  it('ملف سليم يُقبل ويعيد بُنيته', async () => {
    const mod = await load();
    const r = mod.parseBackup(backupText({ keys: [SETTINGS_KEY, HIFZ_KEY] }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.v).toBe(1);
      expect(r.data.app).toBe(BACKUP_APP);
      expect(r.data.createdAt).toBe(1_700_000_000_000);
      expect(r.data.keys).toEqual([SETTINGS_KEY, HIFZ_KEY]);
    }
  });

  it('ملف بلا حقل متابعة الحفظ سليم — نسخة إعدادات وحدها', async () => {
    const mod = await load();
    const r = mod.parseBackup(JSON.stringify(backupFile({ hifz: undefined, keys: [SETTINGS_KEY] })));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.hifz).toBeNull();
      const res = await mod.applyBackup(r.data);
      expect(res.applied).not.toContain(HIFZ_KEY);
      expect(res.skipped).toContain(HIFZ_KEY);
    }
  });

  /* ---------- قاعدة الدمج ---------- */

  it('عدّاد التسبيح لا يتراجع — الأكبر بين المحلّي والنسخة', async () => {
    const ahead = await load(settings({ tasbihTotal: 100 }));
    const back = await ahead.parseBackup(backupText({ settings: settings({ tasbihTotal: 50 }) }));
    if (back.ok) await ahead.applyBackup(back.data);
    expect(ahead.store.useSettings.getState().tasbihTotal).toBe(100);

    const behind = await load(settings({ tasbihTotal: 50 }));
    const forth = await behind.parseBackup(backupText({ settings: settings({ tasbihTotal: 100 }) }));
    if (forth.ok) await behind.applyBackup(forth.data);
    expect(behind.store.useSettings.getState().tasbihTotal).toBe(100);
  });

  it('عدّاد كل ذكر يأخذ الأكبر — ولا يُكتب صفر فوق تقدّم قائم', async () => {
    const mod = await load(settings({ tasbihCounts: { morning: 33, evening: 7 }, tasbihTotal: 40 }));
    const r = await mod.parseBackup(
      backupText({ settings: settings({ tasbihCounts: { morning: 0, evening: 20, night: 5 } }) }),
    );
    if (!r.ok) throw new Error('كان يجب أن يُقبل الملف');
    await mod.applyBackup(r.data);

    const counts = mod.store.useSettings.getState().tasbihCounts;
    expect(counts['morning']).toBe(33);
    expect(counts['evening']).toBe(20);
    expect(counts['night']).toBe(5);
  });

  it('تقدّم الأذكار يأخذ الأقصى لكل معرّف ولا يُمحى المحلّي', async () => {
    const mod = await load(settings({ adhkarProgress: { a: 4, b: 9 } }));
    const r = await mod.parseBackup(backupText({ settings: settings({ adhkarProgress: { a: 2, b: 0, c: 6 } }) }));
    if (!r.ok) throw new Error('كان يجب أن يُقبل الملف');
    await mod.applyBackup(r.data);

    const p = mod.store.useSettings.getState().adhkarProgress;
    expect(p).toEqual({ a: 4, b: 9, c: 6 });
  });

  it('مفتاح خبيث في ملف مستورد لا يصل إلى المخزن', async () => {
    const mod = await load(settings({ tasbihCounts: { a: 1 } }));
    const r = await mod.parseBackup('{"v":1,"app":"' + BACKUP_APP + '","settings":' + JSON.stringify(settings({ tasbihCounts: { __proto__: 99, b: 2 } })) + ',"hifz":null,"keys":[]}');
    if (!r.ok) throw new Error('كان يجب أن يُقبل الملف');
    await mod.applyBackup(r.data);
    expect(mod.store.useSettings.getState().tasbihCounts['b']).toBe(2);
    // مفتاح خبيث في الملف لا يبلغ المخزن ولا يلوّث سلسلة النماذج
    const counts = mod.store.useSettings.getState().tasbihCounts;
    expect(Object.getPrototypeOf(counts)).toBe(Object.prototype);
    expect(Object.keys(counts)).toEqual(['a', 'b']);
  });

  it('المحفوظات تُدمج بمعرّف فريد — لا تكرار ولا محذوف', async () => {
    const mod = await load(
      settings({
        bookmarks: [
          { id: 'surah:1', kind: 'surah', ref: '1', label: 'الفاتحة', at: 1 },
          { id: 'ayah:2:255', kind: 'ayah', ref: '2:255', label: 'آية', at: 2 },
        ],
      }),
    );
    const r = await mod.parseBackup(
      backupText({
        settings: settings({
          bookmarks: [
            { id: 'surah:1', kind: 'surah', ref: '1', label: 'نسخة', at: 99 },
            { id: 'hadith:5', kind: 'hadith', ref: '5', label: 'حديث', at: 3 },
            { id: 'surah:1', kind: 'surah', ref: '1', label: 'مكرّر', at: 4 },
          ],
        }),
      }),
    );
    if (!r.ok) throw new Error('كان يجب أن يُقبل الملف');
    await mod.applyBackup(r.data);

    const marks = mod.store.useSettings.getState().bookmarks;
    expect(marks).toHaveLength(3);
    expect(marks.filter((b) => b.id === 'surah:1')).toHaveLength(1);
    // المحليّ هو الذيبقى: لا يستبدله الإدخال الأحدث في الملف
    expect(marks.find((b) => b.id === 'surah:1')?.at).toBe(1);
    expect(marks.find((b) => b.id === 'ayah:2:255')).toBeTruthy();
    expect(marks.find((b) => b.id === 'hadith:5')).toBeTruthy();
  });

  it('المحفوظات التالفة تُهمَل ولا تُسقط الاستيراد', async () => {
    const mod = await load(settings({ bookmarks: [{ id: 'page:3', kind: 'page', ref: '3', label: 'صفحة', at: 1 }] }));
    const r = await mod.parseBackup(
      backupText({ settings: settings({ bookmarks: ['نص', { kind: 'unknown', ref: '1' }, null, { kind: 'page', ref: '' }] }) }),
    );
    if (!r.ok) throw new Error('كان يجب أن يُقبل الملف');
    const res = await mod.applyBackup(r.data);
    expect(res.applied).not.toContain('bookmarks');
    expect(mod.store.useSettings.getState().bookmarks).toHaveLength(1);
  });

  it('اللغة والمظهر ولوحة الألوان لا تُستورد مهما كانت في الملف', async () => {
    const mod = await load(settings({ lang: 'ar', theme: 'dark', palette: 'noor' }));
    const r = await mod.parseBackup(
      backupText({ settings: settings({ lang: 'en', theme: 'light', palette: 'plum' }) }),
    );
    if (!r.ok) throw new Error('كان يجب أن يُقبل الملف');
    const res = await mod.applyBackup(r.data);

    const s = mod.store.useSettings.getState();
    expect(s.lang).toBe('ar');
    expect(s.theme).toBe('dark');
    expect(s.palette).toBe('noor');
    for (const name of ['lang', 'theme', 'palette']) expect(res.skipped).toContain(name);
  });

  it('الموقع المحلّي لا يُستبدل، والغائب يُستعاد', async () => {
    const kept = await load(settings({ location: { lat: 1, lon: 2, label: 'محلي' } }));
    const r1 = await kept.parseBackup(backupText({ settings: settings({ location: { lat: 21.4, lon: 39.9, label: 'مكة' } }) }));
    if (r1.ok) await kept.applyBackup(r1.data);
    expect(kept.store.useSettings.getState().location?.label).toBe('محلي');

    const empty = await load(settings({ location: null }));
    const r2 = await empty.parseBackup(backupText({ settings: settings({ location: { lat: 21.42, lon: 39.83, label: 'مكة' } }) }));
    if (r2.ok) await empty.applyBackup(r2.data);
    expect(empty.store.useSettings.getState().location?.label).toBe('مكة');
  });

  it('إتمام الإرشاد لا يتراجع', async () => {
    const mod = await load(settings({ onboarded: false }));
    const r = await mod.parseBackup(backupText({ settings: settings({ onboarded: true }) }));
    if (r.ok) await mod.applyBackup(r.data);
    expect(mod.store.useSettings.getState().onboarded).toBe(true);
  });

  /* ---------- متابعة الحفظ ---------- */

  it('متابعة الحفظ تُدمج بالقيمة الأعلى لكل سورة', async () => {
    const mod = await load(
      settings(),
      {
        entries: [{ surah: 1, maxAyah: 3, extra: [9], updatedAt: 1000 }],
        startDay: 100,
        dailyTarget: 20,
        completedRuns: 0,
        lastCompletedAt: null,
      },
    );
    const r = await mod.parseBackup(
      backupText({
        hifz: {
          entries: [{ surah: 1, maxAyah: 7, extra: [9, 11], updatedAt: 2000 }],
          startDay: 50,
          dailyTarget: 30,
          completedRuns: 2,
          lastCompletedAt: 5000,
        },
      }),
    );
    if (!r.ok) throw new Error('كان يجب أن يُقبل الملف');
    const res = await mod.applyBackup(r.data);
    expect(res.applied).toContain(HIFZ_KEY);

    const saved = JSON.parse(read(HIFZ_KEY) as string);
    const surah = saved.entries.find((e: { surah: number }) => e.surah === 1);
    expect(surah.maxAyah).toBe(7);
    expect(surah.extra).toEqual([9, 11]);
    expect(saved.completedRuns).toBe(2);
    // الخطة موجودة محلياً (entries غير فارغة) ⇒ تُحفظ القيم المحلية
    expect(saved.startDay).toBe(100);
    expect(saved.dailyTarget).toBe(20);
  });

  it('خطة قائمة لا تُبدَّل بخطة أقدم من النسخة', async () => {
    const mod = await load(
      settings(),
      { entries: [{ surah: 2, maxAyah: 1, updatedAt: 1 }], startDay: 900, dailyTarget: 10, completedRuns: 1, lastCompletedAt: 10 },
    );
    const r = await mod.parseBackup(
      backupText({ hifz: { entries: [], startDay: 100, dailyTarget: 40, completedRuns: 0, lastCompletedAt: null } }),
    );
    if (r.ok) await mod.applyBackup(r.data);
    const saved = JSON.parse(read(HIFZ_KEY) as string);
    expect(saved.startDay).toBe(900);
    expect(saved.dailyTarget).toBe(10);
  });

  it('متابعة الحفظ التالفة تُنقّى ولا تُسقط الاستيراد', async () => {
    const mod = await load(settings({ tasbihTotal: 4 }));
    const r = await mod.parseBackup(
      backupText({ hifz: { entries: [{ surah: 9999, maxAyah: -5 }, 'نص', null], startDay: 'x', dailyTarget: 900, completedRuns: -3, lastCompletedAt: 'لا' } }),
    );
    if (!r.ok) throw new Error('كان يجب أن يُقبل الملف');
    const res = await mod.applyBackup(r.data);
    const saved = JSON.parse(read(HIFZ_KEY) as string);
    expect(saved.entries).toEqual([]);
    expect(saved.dailyTarget).toBeLessThanOrEqual(50);
    expect(saved.completedRuns).toBe(0);
    expect(saved.lastCompletedAt).toBeNull();
    expect(mod.store.useSettings.getState().tasbihTotal).toBe(4);
    // لم يجرِ أي تغيير على الإعدادات — فقط الحفظ المُنقّى
    expect(res.applied).not.toContain('tasbihTotal');
  });

  /* ---------- الأثر على التخزين ---------- */

  it('ملف تالف لا يغيّر شيئاً — قِس قبل وبعد', async () => {
    const mod = await load(
      settings({ tasbihTotal: 9, tasbihCounts: { a: 2 } }),
      { entries: [{ surah: 1, maxAyah: 2, updatedAt: 1 }], startDay: 10, dailyTarget: 20, completedRuns: 0, lastCompletedAt: null },
    );
    const beforeSettings = read(SETTINGS_KEY);
    const beforeHifz = read(HIFZ_KEY);

    const r = await mod.parseBackup('{"v":1,"app":"تطبيق آخر","settings":{},"hifz":{},"keys":[]}');
    expect(r.ok).toBe(false);
    // المتصل لا يستدعي التطبيق أصلاً، وحتى لو استدعى: لا كتابة
    if (r.ok) await mod.applyBackup(r.data);

    expect(read(SETTINGS_KEY)).toBe(beforeSettings);
    expect(read(HIFZ_KEY)).toBe(beforeHifz);
  });

  it('دورة كاملة: صدّر ثم استورد فالنتيجة مطابقة للأصل', async () => {
    const source = await load(
      settings({
        tasbihTotal: 55,
        tasbihCounts: { morning: 12, night: 3 },
        adhkarProgress: { afterMaghrib: 2 },
        bookmarks: [{ id: 'surah:18', kind: 'surah', ref: '18', label: 'الكهف', at: 42 }],
        location: { lat: 24.7, lon: 46.6, label: 'الرياض' },
        onboarded: true,
        reading: { lastSurah: 18, lastAyah: 10, bookmarks: [], quranMode: 'mushaf', fontSize: 28, tafsirVisible: false, translation: 'none' },
      }),
      {
        entries: [{ surah: 18, maxAyah: 4, updatedAt: 1700 }],
        startDay: 200,
        dailyTarget: 15,
        completedRuns: 0,
        lastCompletedAt: null,
      },
    );
    const file = await source.collectBackup();

    // جهاز آخر فارغ
    const target = await load();
    const parsed = target.parseBackup(JSON.stringify(file));
    if (!parsed.ok) throw new Error('كان يجب أن يُقبل الملف المُصدَّر');
    const res = await target.applyBackup(parsed.data);

    const s = target.store.useSettings.getState();
    expect(s.tasbihTotal).toBe(55);
    expect(s.tasbihCounts).toEqual({ morning: 12, night: 3 });
    expect(s.adhkarProgress).toEqual({ afterMaghrib: 2 });
    expect(s.bookmarks.map((b) => b.id)).toEqual(['surah:18']);
    expect(s.location?.label).toBe('الرياض');
    expect(s.onboarded).toBe(true);
    expect(s.reading.lastSurah).toBe(18);

    const hifz = JSON.parse(read(HIFZ_KEY) as string);
    expect(hifz.entries[0]).toEqual({ surah: 18, maxAyah: 4, updatedAt: 1700 });
    expect(hifz.dailyTarget).toBe(15);
    expect(res.applied.length).toBeGreaterThan(0);

    // وتصدير ما بعد الاستيراد يعطي ما سبق
    const again = await target.collectBackup();
    expect((again.settings as Record<string, unknown>)['tasbihTotal']).toBe(55);
    expect(JSON.stringify(again.hifz)).toBe(JSON.stringify(file.hifz));
  });

  it('استيراد ملف بلا محفوظات على جهاز فيه محفوظات لا يمسحها', async () => {
    const mod = await load(
      settings({ bookmarks: [{ id: 'ayah:2:1', kind: 'ayah', ref: '2:1', label: 'آية', at: 7 }] }),
    );
    const r = await mod.parseBackup(backupText({ settings: settings({ bookmarks: [] }) }));
    if (!r.ok) throw new Error('كان يجب أن يُقبل الملف');
    const res = await mod.applyBackup(r.data);
    expect(res.applied).not.toContain('bookmarks');
    expect(mod.store.useSettings.getState().bookmarks).toHaveLength(1);
  });
});
