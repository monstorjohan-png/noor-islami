import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * مزامنة نسخة البيانات.
 *
 * الفحص هنا منطقي بحت: نُقلّد التخزينين المحلي وفهرس DB، ثم نتحقق
 * من قرار «يمسح أم لا». المسح عملية لا رجعة فيها، فالفحص قبل القرار
 * أهم من الفحص بعده.
 */

const STAMP = 'noor-data-stamp';

/** تخزين محلي في الذاكرة — نفس النمط في بقية الاختبارات */
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
 * IndexedDB في الذاكرة — بُني على ما تستعمله الوحدة فعلاً لا أكثر:
 * `idbKeys` تريد `openKeyCursor` whose `onsuccess` fires per key then
 * `null`، و`idbDel` تريد `delete` ثم `oncomplete` on the transaction.
 * أي شيء زائد هنا تعقيد بلا فائدة.
 */
function installIdb(keys: string[]): { deleted: string[] } {
  const deleted: string[] = [];
  const store = new Set(keys);

  const objectStore = () => ({
    delete: (k: string) => {
      store.delete(k);
      deleted.push(k);
    },
    openKeyCursor: () => {
      // نلتقط المعالج أولاً، ثم نُطلقه على مفاتيح بالترتيب، ثم `null`
      let handler: ((e: unknown) => void) | null = null;
      let queue: (string | null)[] = [];
      const cursor: Record<string, unknown> = {
        get onsuccess() {
          return handler;
        },
        set onsuccess(fn: ((e: unknown) => void) | null) {
          handler = fn;
          if (fn) {
            const pending = queue;
            queue = [];
            let i = 0;
            const step = () => {
              if (i >= pending.length) return;
              const key = pending[i];
              i += 1;
              // `db.ts` يقرأ `req.result` ثم ينادي `continue()` عليه،
              // فالنتيجة هي المؤشّر نفسه لا غلافٌ حوله.
              if (key === null) {
                cursor.result = null;
              } else {
                cursor.key = key;
                cursor.result = cursor;
              }
              fn({ target: cursor });
              step();
            };
            queueMicrotask(step);
          }
        },
        result: null,
        continue: () => undefined,
      };
      queue = [...store, null];
      return cursor;
    },
  });

  (globalThis as Record<string, unknown>).indexedDB = {
    open: () => {
      const req: Record<string, unknown> = {
        onupgradeneeded: null,
        onsuccess: null,
        onerror: null,
        result: {
          objectStoreNames: { contains: () => true },
          createObjectStore: () => undefined,
          transaction: () => {
            const tx: Record<string, unknown> = {
              oncomplete: null,
              onerror: null,
              error: null,
              objectStore: () => objectStore(),
            };
            // `db.ts` يُسند `oncomplete` بعد `delete`، فنُطلقه في
            // دورةevt لاحقة — إطلاقه الآن يمرّ قبل التسند فيتعلّق.
            queueMicrotask(() => {
              (tx.oncomplete as (() => void) | null)?.();
            });
            return tx;
          },
        },
      };
      queueMicrotask(() => {
        (req.onsuccess as ((e: unknown) => void) | null)?.({ target: req });
      });
      return req;
    },
  };
  return { deleted };
}

async function loadDb(stamp: string | null, files: string[]) {
  vi.resetModules();
  localStorage.clear();
  installStorage();
  if (stamp !== null) localStorage.setItem(STAMP, stamp);
  const { deleted } = installIdb(files);
  const mod = await import('../src/lib/db');
  return { mod, deleted };
}

describe('مزامنة نسخة البيانات', () => {
  beforeEach(() => {
    installStorage();
  });

  it('أول زيارة بلا ختم سابق لا تمسح شيئاً — لا داعي لتخريب جلسة المستخدم', async () => {
    const { mod, deleted } = await loadDb(null, []);
    expect(await mod.syncDataVersion()).toBe(false);
    expect(deleted).toEqual([]);
  });

  it('الختم مطابق لا تمسح شيئاً — الإقلاع المتكرّر لا يمحو التنزيلات', async () => {
    const { mod, deleted } = await loadDb('2', ['quran/surahs.json']);
    expect(await mod.syncDataVersion()).toBe(false);
    expect(deleted).toEqual([]);
  });

  it('ختم أقدم يمسح البيانات المخزَّنة — هذا هو الغرض كلّه', async () => {
    const { mod, deleted } = await loadDb('1', ['quran/surahs.json', 'quran/positions.json']);
    expect(await mod.syncDataVersion()).toBe(true);
    expect(deleted.sort()).toEqual(['quran/positions.json', 'quran/surahs.json']);
  });

  it('ختم أقدم بلا ملفات مخزَّنة لا تمسح ولا تكسر شيئاً', async () => {
    const { mod, deleted } = await loadDb('1', []);
    expect(await mod.syncDataVersion()).toBe(false);
    expect(deleted).toEqual([]);
  });

  it('الختم الجديد يُكتب بعد المسح — فلا يتكرّر المسح في كل إقلاع', async () => {
    const { mod } = await loadDb('1', ['quran/surahs.json']);
    await mod.syncDataVersion();
    expect(localStorage.getItem(STAMP)).toBe('2');
    // الإقلاع الثاني لا يمسح
    expect(await mod.syncDataVersion()).toBe(false);
  });

  it('تخزين محلي محظور لا يوقف التطبيق — نتابع بلا ختم', async () => {
    vi.resetModules();
    installStorage();
    (globalThis as Record<string, unknown>).localStorage = {
      getItem: () => '1',
      setItem: () => {
        throw new Error('الحصة ممتلئة');
      },
      removeItem: () => undefined,
      clear: () => undefined,
    };
    const { deleted } = installIdb(['quran/surahs.json']);
    const mod = await import('../src/lib/db');
    // يمسح البيانات، ويقبل عدم قدرته على الختم بلا رمي
    expect(await mod.syncDataVersion()).toBe(true);
    expect(deleted).toEqual(['quran/surahs.json']);
  });

  it('تخزين تالف (لا ختم) يُعامَل كأول زيارة لا كخطأ', async () => {
    const { mod, deleted } = await loadDb(null, ['quran/surahs.json']);
    expect(await mod.syncDataVersion()).toBe(false);
    expect(deleted).toEqual([]);
  });
});
