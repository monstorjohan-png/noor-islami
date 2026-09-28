/**
 * اختبارات طبقة المصادقة والمزامنة.
 * تُشغَّل: npx vitest run
 *
 * المحاور: المزوّد الفارغ لا يرمي، الأدوات الخالصة، وحلّ تصادم المزامنة.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { nullAuthProvider, GUEST_ID } from '../src/lib/auth/null';
import { hasSupabaseConfig, resolveAuthProvider } from '../src/lib/auth/index';
import {
  authMessage,
  isEmailLike,
  normalizeEmail,
  validateCredentials,
  MIN_PASSWORD,
} from '../src/lib/auth/types';
import type { AuthProvider } from '../src/lib/auth/types';
import {
  applyMerge,
  isSyncEnabled,
  loadTombstones,
  mergeRecords,
  runSync,
  sameBookmarks,
  saveTombstones,
  stampOf,
  toRecord,
  TOMBSTONE_TTL_MS,
} from '../src/lib/sync';
import type { RemoteStore, SyncRecord } from '../src/lib/sync';
import type { Bookmark } from '../src/lib/store';

afterEach(() => {
  vi.unstubAllEnvs();
});

/** علامة مخزّنة محلياً */
function bm(id: string, at: number, ref = id): Bookmark {
  return { id, kind: 'ayah', ref, label: '', at };
}

/** سجلّ مزامنة */
function rec(id: string, at: number, deletedAt: number | null = null): SyncRecord {
  return { id, kind: 'ayah', ref: id, label: '', at, deletedAt };
}

/** طرف بعيد مزعج: أي استدعاء يُحسب فشلاً */
function trapRemote(): RemoteStore & { calls: number } {
  const r = {
    calls: 0,
    pull() {
      r.calls++;
      return Promise.reject(new Error('must not run'));
    },
    push() {
      r.calls++;
      return Promise.reject(new Error('must not run'));
    },
  };
  return r;
}

/** تخزين محلي في الذاكرة: بيئة الاختبار بلا متصفح */
function withFakeStorage(fn: () => void): void {
  const map = new Map<string, string>();
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k: string, v: string) => {
      map.set(k, String(v));
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
    clear: () => map.clear(),
  };
  try {
    fn();
  } finally {
    (globalThis as Record<string, unknown>).localStorage = undefined;
  }
}

/* ---------- المزوّد الفارغ: وضع الضيف ---------- */

describe('المزوّد الفارغ: وضع الضيف', () => {
  it('لا يرمي استثناءً في أي دالة', async () => {
    await expect(nullAuthProvider.getSession()).resolves.toBeNull();
    await expect(nullAuthProvider.signInWithEmail('a@b.com', 'secret1')).resolves.toBeNull();
    await expect(nullAuthProvider.signUpWithEmail('a@b.com', 'secret1')).resolves.toEqual({
      session: null,
      needsEmailConfirmation: false,
    });
    await expect(nullAuthProvider.signInWithGoogle()).resolves.toBeUndefined();
    await expect(nullAuthProvider.signOut()).resolves.toBeUndefined();
    await expect(nullAuthProvider.deleteAccount()).resolves.toBeUndefined();
  });

  it('يعلن أن الدخول غير متاح', () => {
    expect(nullAuthProvider.available).toBe(false);
    expect(nullAuthProvider.kind).toBe('null');
    expect(GUEST_ID).toBe('guest');
  });

  it('الاشتراك يُلغى بأمان ولا يبثّ شيئاً', () => {
    let fired = 0;
    const off = nullAuthProvider.subscribe(() => {
      fired++;
    });
    expect(typeof off).toBe('function');
    expect(() => off()).not.toThrow();
    expect(fired).toBe(0);
  });

  it('المختار يعيد المزوّد الفارغ بلا مفاتيح، بلا رمي', async () => {
    expect(hasSupabaseConfig()).toBe(false);
    const provider: AuthProvider = await resolveAuthProvider();
    expect(provider.kind).toBe('null');
    expect(provider.available).toBe(false);
    await expect(provider.getSession()).resolves.toBeNull();
  });
});

/* ---------- أدوات خالصة ---------- */

describe('أدوات التحقق الخالصة', () => {
  it('يوحّد البريد بلا مسافات وبحروف صغيرة', () => {
    expect(normalizeEmail('  Ali@Example.COM ')).toBe('ali@example.com');
  });

  it('يقبل البريد المعقول ويرفض ما لا معنى له', () => {
    expect(isEmailLike('ali@example.com')).toBe(true);
    expect(isEmailLike('ali@example')).toBe(false);
    expect(isEmailLike('ali example.com')).toBe(false);
    expect(isEmailLike('')).toBe(false);
  });

  it('يرفض المدخلات الناقصة ويعطي شفرة عربية', () => {
    expect(validateCredentials('ali@example.com', '12345')).toBe('weak_password');
    expect(MIN_PASSWORD).toBe(6);
    expect(validateCredentials('ali@example', '123456')).toBe('invalid_input');
    expect(validateCredentials('ali@example.com', '123456')).toBeNull();
  });

  it('كل شفرة خطأ لها رسالة عربية غير فارغة', () => {
    const codes = [
      'not_available',
      'invalid_input',
      'weak_password',
      'invalid_credentials',
      'email_taken',
      'network',
      'unknown',
    ] as const;
    for (const code of codes) {
      const msg = authMessage(code);
      expect(msg.length).toBeGreaterThan(5);
      expect(/[\u0600-\u06FF]/.test(msg)).toBe(true);
      expect(/[A-Za-z]/.test(msg)).toBe(false);
    }
  });
});

/* ---------- المزامنة: معطّلة افتراضياً ---------- */

describe('المزامنة: البوابة', () => {
  it('معطّلة بلا علم، فلا تنفيذ ولا شبكة', async () => {
    expect(isSyncEnabled()).toBe(false);
    const remote = trapRemote();
    const result = await runSync({
      userId: 'u1',
      remote,
      getLocal: () => [],
      setLocal: () => {
        throw new Error('must not write');
      },
    });
    expect(result.status).toBe('skipped');
    expect(result.pushed).toBe(0);
    expect(result.pulled).toBe(0);
    expect(remote.calls).toBe(0);
  });

  it('تتجاهل المستخدم الفارغ', async () => {
    vi.stubEnv('VITE_SYNC', '1');
    const remote = trapRemote();
    const result = await runSync({ userId: '', remote, getLocal: () => [], setLocal: () => undefined });
    expect(result.status).toBe('skipped');
    expect(remote.calls).toBe(0);
  });

  it('مع العلم: تنزيل ثم رفع ثم لا تكرار', async () => {
    vi.stubEnv('VITE_SYNC', '1');
    expect(isSyncEnabled()).toBe(true);

    const server: SyncRecord[] = [rec('ayah:1', 100)];
    const remote: RemoteStore = {
      pull: () => Promise.resolve(server.map((r) => ({ ...r }))),
      push: (_u, rows) => {
        for (const row of rows) {
          const i = server.findIndex((s) => s.id === row.id);
          if (i >= 0) server[i] = { ...row };
          else server.push({ ...row });
        }
        return Promise.resolve();
      },
    };

    let local: Bookmark[] = [bm('ayah:1', 100), bm('ayah:2', 200)];
    const first = await runSync({
      userId: 'u1',
      remote,
      getLocal: () => local,
      setLocal: (list) => {
        local = list;
      },
    });

    expect(first.status).toBe('ok');
    expect(first.pushed).toBe(1); // العلامة الجديدة فقط
    expect(first.pulled).toBe(1); // المساواة في الطابع لصالح البعيد
    expect(local.map((b) => b.id)).toEqual(['ayah:1', 'ayah:2']);
    expect(server).toHaveLength(2);

    // الدورة الثانية لا تغيّر شيئاً ولا ترفع شيئاً
    const second = await runSync({
      userId: 'u1',
      remote,
      getLocal: () => local,
      setLocal: (list) => {
        local = list;
      },
    });
    expect(second.status).toBe('ok');
    expect(second.pushed).toBe(0);
    expect(sameBookmarks(local, [bm('ayah:1', 100), bm('ayah:2', 200)])).toBe(true);
  });

  it('مع العلم: فشل التنزيل يُعاد كرسالة عربية لا كرمي', async () => {
    vi.stubEnv('VITE_SYNC', '1');
    const remote: RemoteStore = {
      pull: () => Promise.reject(new Error('network down')),
      push: () => Promise.resolve(),
    };
    const result = await runSync({ userId: 'u1', remote, getLocal: () => [], setLocal: () => undefined });
    expect(result.status).toBe('error');
    expect(result.error).toBeTruthy();
    expect(/[\u0600-\u06FF]/.test(result.error ?? '')).toBe(true);
  });
});

/* ---------- المزامنة: حلّ التصادم (دوال خالصة) ---------- */

describe('المزامنة: حلّ التصادم', () => {
  it('الطابع الحاكم هو الحذف إن وُجد', () => {
    expect(stampOf(rec('a', 100, 200))).toBe(200);
    expect(stampOf(rec('a', 100))).toBe(100);
  });

  it('الأحدث يفوز: البعيد يفوز على المحلي الأقدم', () => {
    const { merged, upload, download } = mergeRecords([rec('a', 100)], [rec('a', 300)]);
    expect(merged).toHaveLength(1);
    expect(merged[0].at).toBe(300);
    expect(upload).toHaveLength(0);
    expect(download).toHaveLength(1);
  });

  it('الأحدث يفوز: المحلي يفوز على البعيد الأقدم', () => {
    const { merged, upload, download } = mergeRecords([rec('a', 400)], [rec('a', 100)]);
    expect(merged[0].at).toBe(400);
    expect(upload.map((r) => r.id)).toEqual(['a']);
    expect(download).toHaveLength(0);
  });

  it('التساوي في الطابع لصالح البعيد', () => {
    const { merged, upload, download } = mergeRecords([rec('a', 100)], [rec('a', 100)]);
    expect(merged).toHaveLength(1);
    expect(upload).toHaveLength(0);
    expect(download).toHaveLength(1);
  });

  it('حذف البعيد يهزم تعديلاً محلياً أقدم', () => {
    const { merged, upload, download } = mergeRecords([rec('a', 100)], [rec('a', 100, 500)]);
    expect(merged[0].deletedAt).toBe(500);
    expect(upload).toHaveLength(0);
    expect(download).toHaveLength(1);
  });

  it('تعديل محلي بعد الحذف يُحيي العلامة', () => {
    const { merged, upload, download } = mergeRecords([rec('a', 900)], [rec('a', 100, 500)]);
    expect(merged[0].deletedAt).toBeNull();
    expect(merged[0].at).toBe(900);
    expect(upload.map((r) => r.id)).toEqual(['a']);
    expect(download).toHaveLength(0);
  });

  it('ما عند طرف وحده: الجديد يُرفع والجديد يُنزَّل', () => {
    const { merged, upload, download } = mergeRecords([rec('mine', 10)], [rec('theirs', 20)]);
    expect(merged.map((r) => r.id)).toEqual(['mine', 'theirs']);
    expect(upload.map((r) => r.id)).toEqual(['mine']);
    expect(download.map((r) => r.id)).toEqual(['theirs']);
  });

  it('يتجاهل السجلات بلا معرّف', () => {
    const bad = { ...rec('x', 1), id: '' } as SyncRecord;
    const { merged } = mergeRecords([bad], [rec('ok', 1)]);
    expect(merged.map((r) => r.id)).toEqual(['ok']);
  });
});

/* ---------- المزامنة: أثر الحذف ---------- */

describe('المزامنة: أثر الحذف والتطبيق', () => {
  const now = 1_000_000_000_000;

  it('يفصل الحية عن المحذوف', () => {
    const applied = applyMerge([rec('live', 10), rec('gone', 10, now - 1000)], now);
    expect(applied.bookmarks.map((b) => b.id)).toEqual(['live']);
    expect(applied.tombstones.map((r) => r.id)).toEqual(['gone']);
  });

  it('يتجاهل الأثر الذي طال عمره', () => {
    const old = rec('gone', 10, now - TOMBSTONE_TTL_MS - 1);
    const applied = applyMerge([old], now);
    expect(applied.tombstones).toHaveLength(0);
    expect(applied.bookmarks).toHaveLength(0);
  });

  it('العلامة المحذوفة لا تظهر في العلامات إطلاقاً', () => {
    const applied = applyMerge([rec('gone', 10, now)], now);
    expect(applied.bookmarks.some((b) => b.id === 'gone')).toBe(false);
  });

  it('يحوّل العلامة إلى سجلّ وإلاه', () => {
    const r = toRecord(bm('ayah:5', 42));
    expect(r).toMatchObject({ id: 'ayah:5', ref: 'ayah:5', at: 42, deletedAt: null });
  });

  it('يقارن القوائم بالترتيب والمحتوى', () => {
    expect(sameBookmarks([bm('a', 1)], [bm('a', 1)])).toBe(true);
    expect(sameBookmarks([bm('a', 1)], [bm('a', 2)])).toBe(false);
    expect(sameBookmarks([bm('a', 1)], [bm('b', 1)])).toBe(false);
    expect(sameBookmarks([bm('a', 1)], [])).toBe(false);
  });

  it('أثر الحذف يُحفظ ويُقرأ بلا رمي، ويُنسى بفراغه', () => {
    const original = (globalThis as Record<string, unknown>).localStorage;
    withFakeStorage(() => {
      saveTombstones('u-test', [rec('x', 1, now)]);
      expect(loadTombstones('u-test').map((r) => r.id)).toEqual(['x']);

      saveTombstones('u-test', []);
      expect(loadTombstones('u-test')).toHaveLength(0);

      // مستخدم لم يُسجَّل له أثر
      expect(loadTombstones('u-missing')).toHaveLength(0);
      // ومفتاح بلا بيانات
      expect(loadTombstones('')).toHaveLength(0);
    });
    (globalThis as Record<string, unknown>).localStorage = original;
  });

  it('بيانات تخزين تالفة لا تكسر القراءة', () => {
    const original = (globalThis as Record<string, unknown>).localStorage;
    withFakeStorage(() => {
      localStorage.setItem('noor-sync-tombstones', '{ليس بصيغة صحيحة');
      expect(() => loadTombstones('u-test')).not.toThrow();
      expect(loadTombstones('u-test')).toHaveLength(0);
    });
    (globalThis as Record<string, unknown>).localStorage = original;
  });
});
