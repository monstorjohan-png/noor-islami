/**
 * طبقة البيانات المحلية.
 * القاعدة: الذاكرة أولاً، ثم IndexedDB، ثم الشبكة.
 * بذلك يعمل التطبيق كاملاً بدون إنترنت بعد أول زيارة.
 *
 * أمن: كل مسار يمرّ على `assertDataPath` — وهو نقطة الاختناق الوحيدة.
 * أي قيمة شاذة من الـ URL أو التخزين المحلي تُرفض قبل أن تصير طلب شبكة.
 */
import { assertDataPath } from './safe';

const DB_NAME = 'noor-db';
const DB_VERSION = 1;
const STORE = 'files';

let dbp: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  try {
    const db = await open();
    return await new Promise<T | undefined>((resolve, reject) => {
      const r = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      r.onsuccess = () => resolve(r.result as T);
      r.onerror = () => reject(r.error);
    });
  } catch {
    return undefined;
  }
}

async function idbSet(key: string, value: unknown): Promise<void> {
  try {
    const db = await open();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* التخزين غير متاح (وضع التصفح الخاص) — نكمل بالذاكرة */
  }
}

export async function idbDel(key: string): Promise<void> {
  try {
    const db = await open();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch { /* تجاهل */ }
}

export async function idbKeys(): Promise<string[]> {
  try {
    const db = await open();
    return await new Promise<string[]>((resolve, reject) => {
      const keys: string[] = [];
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).openKeyCursor();
      req.onsuccess = () => {
        const cur = req.result;
        if (cur) { keys.push(String(cur.key)); cur.continue(); } else resolve(keys);
      };
      req.onerror = () => reject(req.error);
    });
  } catch { return []; }
}

/* ---------- تحميل ملفات البيانات ---------- */

const mem = new Map<string, unknown>();
const inflight = new Map<string, Promise<unknown>>();

export interface LoadOpts {
  /** يتجاوز الذاكرة و IndexedDB (إعادة تحميل من الشبكة) */
  force?: boolean;
  /** يُستدعى أثناء التنزيل: عدد البايتات المستلمة والمجموع */
  onProgress?: (loaded: number, total: number) => void;
}

export async function loadData<T>(path: string, opts: LoadOpts = {}): Promise<T> {
  // نقطة الاختناق: لا مسار خارج `public/data` يتجاوز هذا السطر أبداً
  assertDataPath(path);

  if (!opts.force && mem.has(path)) return mem.get(path) as T;

  if (!opts.force) {
    const hit = await idbGet<T>(path);
    // قيمة `null` مخزَّنة تُعيد `null` لا `undefined`، فتُعتمد نتيجةً.
    // نعتبرها إصابةً على الذاكرة ونعيد الجلب من الشبكة.
    if (hit !== undefined && hit !== null) {
      mem.set(path, hit);
      return hit;
    }
  }

  const existing = inflight.get(path);
  if (existing) return existing as Promise<T>;

  const p = (async () => {
    const res = await fetch(`${import.meta.env.BASE_URL}data/${path}`);
    if (!res.ok) throw new Error(`تعذّر تحميل ${path} (${res.status})`);

    let json: T;
    if (opts.onProgress && res.body) {
      // نقرأ التدفق حتى نعكس التقدّم الحقيقي بدل indeterminate
      const total = Number(res.headers.get('content-length') ?? 0);
      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let loaded = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          loaded += value.byteLength;
          opts.onProgress(loaded, total);
        }
      }
      const all = new Uint8Array(loaded);
      let at = 0;
      for (const c of chunks) {
        all.set(c, at);
        at += c.byteLength;
      }
      json = JSON.parse(new TextDecoder().decode(all)) as T;
    } else {
      json = (await res.json()) as T;
    }

    mem.set(path, json);
    await idbSet(path, json);
    return json;
  })();

  inflight.set(path, p);
  try { return (await p) as T; } finally { inflight.delete(path); }
}

/** هل الملف محمّل محلياً؟ */
export async function isDownloaded(path: string): Promise<boolean> {
  if (!assertOk(path)) return false;
  if (mem.has(path)) return true;
  return (await idbGet(path)) != null;
}

export async function removeFile(path: string): Promise<void> {
  if (!assertOk(path)) return;
  mem.delete(path);
  await idbDel(path);
  if ('caches' in window) {
    const c = await caches.open('noor-content');
    await Promise.all((await c.keys()).filter((r) => r.url.endsWith(path)).map((r) => c.delete(r)));
  }
}

/** للمدخلات التي قد تأتي من تخزين متلوث — نتحقق ولا نرمي */
function assertOk(path: string): boolean {
  try {
    assertDataPath(path);
    return true;
  } catch {
    return false;
  }
}

/* ---------- تقدير المساحة ---------- */

export async function storageInfo(): Promise<{ used: number; quota: number }> {
  if (navigator.storage?.estimate) {
    const e = await navigator.storage.estimate();
    return { used: e.usage || 0, quota: e.quota || 0 };
  }
  return { used: 0, quota: 0 };
}

/**
 * طلب تخزين دائم.
 * بدونه يحذف المتصفح 68 ميغا من الأذكار والحديث تلقائياً عند ضيق المساحة.
 * المتصفح يعطي الطلب مرة واحدة؛ الرفض ليس خطأ فنخفيه ولا نزعج المستخدم.
 */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch (err) {
    console.warn('تعذّر طلب التخزين الدائم', err);
    return false;
  }
}
