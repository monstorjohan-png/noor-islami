/**
 * حارس المدخلات
 * ------------------------------------------------------------------
 * نقطة اختناق واحدة لكل قيمة قادمة من الخارج (URL · localStorage · IndexedDB)
 * قبل أن تُستخدم في بناء مسار ملف أو فهرس كائن.
 *
 * القاعدة: من لا يمرّ من هنا، لا يصل.
 */

/* ---------- مسارات ملفات البيانات ---------- */

/**
 * الجذور المسموحة داخل `public/data`.
 * أسماء إنجليزية صغيرة فقط. أي `..` أو شرطة مائلة عكسية أو شرطة مائلة
 * أولى أو علامة استفهام أو ترميز نسبي يُرفض.
 */
const DATA_PATH = /^(?:[a-z0-9][a-z0-9_-]*\.json|(?:quran|hadith)\/[a-z0-9][a-z0-9_-]*(?:\/[a-z0-9][a-z0-9_-]*)?\.json)$/;

/** الحد الأقصى لطول المسار — حدّ دفاعي ضد المدخلات العبثية */
const MAX_PATH = 128;

/** Whether a string can be used as a data file path */
export function isDataPath(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0 && v.length <= MAX_PATH && DATA_PATH.test(v);
}

/**
 * Returns the path if valid, otherwise throws.
 * Call this at the single choke point (`loadData`) so every file path
 * is guaranteed to be confined to the data directory.
 */
export function assertDataPath(v: unknown): string {
  if (!isDataPath(v)) throw new Error(`مسار بيانات غير مسموح: ${String(v).slice(0, 40)}`);
  return v;
}

/* ---------- الأعداد ---------- */

const MIN_INT = 0;
const MAX_INT = 1e9;

/** Strict integer: rejects NaN · Infinity · fractional values · negative values · huge values */
export function safeInt(v: unknown, min = MIN_INT, max = MAX_INT): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  if (!Number.isSafeInteger(n)) return null;
  if (n < min || n > max) return null;
  return n;
}

/** Clamp a number into a range — for sizes, volumes, and font sizes */
export function clamp(n: number, min: number, max: number): number {
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
}

/* ---------- كائنات الحفظ المحلي ---------- */

const DANGEROUS = new Set(['__proto__', 'constructor', 'prototype']);

/** Whether a key is safe as a dictionary key */
export function isSafeKey(k: unknown): k is string {
  return typeof k === 'string' && k.length > 0 && k.length <= 64 && !DANGEROUS.has(k);
}

/**
 * Copies a dictionary while dropping dangerous keys.
 * `JSON.parse` of `{"__proto__":{...}}` produces an own property that
 * `obj[key] = value` would otherwise write to the prototype chain.
 */
export function stripDangerKeys<T>(src: unknown): Record<string, T> {
  const out: Record<string, T> = {};
  if (!src || typeof src !== 'object' || Array.isArray(src)) return out;
  for (const [k, v] of Object.entries(src as Record<string, unknown>)) {
    if (isSafeKey(k)) out[k] = v as T;
  }
  return out;
}

/**
 * Sets a key without ever touching the prototype chain.
 * Use instead of `obj[key] = v` for any key from storage or URL.
 */
export function safeAssign<T>(obj: Record<string, T>, key: string, value: T): void {
  if (isSafeKey(key)) obj[key] = value;
}

/* ---------- روابط خارج التطبيق ---------- */

/** Only allow opening external links over https, and always with noopener */
export function safeExternalUrl(url: string): string | null {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
}

/* ---------- رموز عشوائية ---------- */

/**
 * Cryptographically secure random string.
 * `Math.random` is unacceptable for session keys or tokens.
 */
export function newToken(bytes = 24): string {
  const a = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(a);
  let out = '';
  for (const b of a) out += b.toString(16).padStart(2, '0');
  return out;
}
