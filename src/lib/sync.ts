/**
 * مزامنة العلامات بين الأجهزة.
 *
 * مفعّلة بعلم واحد: المتغيّر البيئي يساوي واحداً. بدونه لا تنفيذ ولا شبكة
 * ولا أثر — الدالة نفسها تُعيد «مُتخطّى» وتمسّ لا شيئاً.
 *
 * حلّ التصادم: الأحدث يفوز. إن حذف جهاز علامة بعد أن عدّلها جهاز آخر،
 * يفوز الأحدث من الوقتين. والحذف يُحفظ أثراً مؤقتاً (تومبستون) حتى لا
 * تعود العلامة من جهاز ثالث لم يحذفها بعد.
 *
 * جدول العلامات في مشروع الحسابات:
 *
 *   create table public.noor_bookmarks (
 *     id text primary key,
 *     user_id uuid not null references auth.users on delete cascade,
 *     kind text not null,
 *     ref text not null,
 *     label text not null default '',
 *     at bigint not null default 0,
 *     deleted_at bigint
 *   );
 *   alter table public.noor_bookmarks enable row level security;
 *   create policy "own rows" on public.noor_bookmarks
 *     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
 */

import type { Bookmark } from './store';

/** سجلّ علامة كما يُنقل بين الأجهزة */
export interface SyncRecord {
  id: string;
  kind: Bookmark['kind'];
  ref: string;
  label: string;
  /** وقت آخر تعديل */
  at: number;
  /** وقت الحذف، أو صفر إن كانت العلامة موجودة */
  deletedAt: number | null;
}

/** الطرف البعيد — نمرّره بالحقن ليبقى هذا الملف بلا اعتماد خارجي */
export interface RemoteStore {
  pull(userId: string): Promise<SyncRecord[]>;
  push(userId: string, records: SyncRecord[]): Promise<void>;
}

export type SyncStatus = 'skipped' | 'ok' | 'error';

export interface SyncResult {
  status: SyncStatus;
  pushed: number;
  pulled: number;
  /** رسالة عربية عند الفشل */
  error: string | null;
}

/** ما تحتاجه المزامنة من التطبيق */
export interface SyncDeps {
  userId: string;
  /** طرف بعيد جاهز، أو دالة تُنشئه عند الحاجة */
  remote: RemoteStore | (() => Promise<RemoteStore>);
  getLocal: () => Bookmark[];
  setLocal: (bookmarks: Bookmark[]) => void;
  /** إشعار عند تغيّر البيانات المحلية */
  subscribe?: (cb: () => void) => () => void;
}

/** عمر الأثر المحذوف: بعده ننساه فلا يتضخّم التخزين */
export const TOMBSTONE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const TOMBSTONE_KEY = 'noor-sync-tombstones';

const SKIPPED: SyncResult = { status: 'skipped', pushed: 0, pulled: 0, error: null };

/* ---------- البوابة: معطّلة افتراضياً ---------- */

/**
 * المزامنة تعمل فقط عند تفعيل العلم صراحةً.
 * القراءة مباشرةً من بيئة البناء لا عبر كائن، فتثبّتها الأداة قيمةً نهائية
 * فتسقط أداة الترجمة فرع التحميل الديناميكي كلّياً من حزمة الضيف.
 * أنواع هذه المتغيّرات يعرّفها القائد في ملف تعريفات بيئة البناء.
 */
export function isSyncEnabled(): boolean {
  return (import.meta.env.VITE_SYNC as string) === '1';
}

/* ---------- تحويلات خالصة ---------- */

/** الطابع الزمني الحاكم: وقت الحذف إن وُجد وإلا وقت التعديل */
export function stampOf(r: SyncRecord): number {
  return r.deletedAt && r.deletedAt > 0 ? r.deletedAt : r.at;
}

/** علامة محلية إلى سجلّ */
export function toRecord(b: Bookmark): SyncRecord {
  return { id: b.id, kind: b.kind, ref: b.ref, label: b.label ?? '', at: b.at || 0, deletedAt: null };
}

/** سجلّ حيّ إلى علامة محلية */
export function toBookmark(r: SyncRecord): Bookmark {
  return { id: r.id, kind: r.kind, ref: r.ref, label: r.label ?? '', at: r.at || 0 };
}

/** هل القائمتان متطابقتان بالترتيب والمحتوى؟ يمنع حلقة تحديث لا تنتهي */
export function sameBookmarks(a: Bookmark[], b: Bookmark[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (x.id !== y.id || x.at !== y.at || x.ref !== y.ref || (x.label ?? '') !== (y.label ?? '')) return false;
  }
  return true;
}

/* ---------- حلّ التصادم: خالص وقابل للاختبار ---------- */

export interface MergeResult {
  /** الحالة النهائية بعد التعديل */
  merged: SyncRecord[];
  /** ما يجب رفعه إلى الجهاز البعيد */
  upload: SyncRecord[];
  /** ما يجب عرضه بعد التنزيل */
  download: SyncRecord[];
}

/** يبني فهرساً بالمعرّف وآخر نسخة عند التكرار */
function indexById(list: SyncRecord[]): Map<string, SyncRecord> {
  const map = new Map<string, SyncRecord>();
  for (const r of list) {
    if (!r || typeof r.id !== 'string' || !r.id) continue;
    const prev = map.get(r.id);
    if (!prev || stampOf(r) >= stampOf(prev)) map.set(r.id, r);
  }
  return map;
}

/** يدمج المحلي بالبعيد: الأحدث يفوز، والتساوي لصالح البعيد */
export function mergeRecords(local: SyncRecord[], remote: SyncRecord[]): MergeResult {
  const mine = indexById(local);
  const theirs = indexById(remote);
  const merged: SyncRecord[] = [];
  const upload: SyncRecord[] = [];
  const download: SyncRecord[] = [];

  for (const [id, l] of mine) {
    const r = theirs.get(id);
    if (!r) {
      merged.push(l);
      upload.push(l);
      continue;
    }
    const ls = stampOf(l);
    const rs = stampOf(r);
    if (ls > rs) {
      merged.push(l);
      upload.push(l);
    } else if (rs > ls) {
      merged.push(r);
      download.push(r);
    } else {
      merged.push(r);
      download.push(r);
    }
  }

  for (const [id, r] of theirs) {
    if (mine.has(id)) continue;
    merged.push(r);
    download.push(r);
  }

  merged.sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1));
  return { merged, upload, download };
}

export interface AppliedMerge {
  bookmarks: Bookmark[];
  tombstones: SyncRecord[];
}

/** يفصل النتيجة: علامات حية للعرض، وأثر محذوف باقٍ حتى ينتهي عمره */
export function applyMerge(merged: SyncRecord[], now: number, ttl = TOMBSTONE_TTL_MS): AppliedMerge {
  const bookmarks: Bookmark[] = [];
  const tombstones: SyncRecord[] = [];
  for (const r of merged) {
    if (!r.deletedAt || r.deletedAt <= 0) {
      bookmarks.push(toBookmark(r));
      continue;
    }
    if (now - r.deletedAt < ttl) tombstones.push(r);
  }
  bookmarks.sort((a, b) => a.at - b.at);
  return { bookmarks, tombstones };
}

/* ---------- أثر الحذف المحلي ---------- */

type Bag = Record<string, SyncRecord[]>;

/** يقرأ أثر الحذف من التخزين المحلي — لا يرمي إن كان التخزين ممنوعاً */
export function loadTombstones(userId: string): SyncRecord[] {
  if (typeof localStorage === 'undefined' || !userId) return [];
  try {
    const all = localStorage.getItem(TOMBSTONE_KEY);
    if (!all) return [];
    const bag = JSON.parse(all) as Bag;
    const mine = bag?.[userId];
    return Array.isArray(mine) ? mine.filter((r) => r && typeof r.id === 'string') : [];
  } catch (err) {
    console.warn('تعذّرت قراءة أثر المحذوفات — نكمل بلا مزامنة', err);
    return [];
  }
}

/** يكتب أثر الحذف — الفشل لا يوقف التطبيق */
export function saveTombstones(userId: string, list: SyncRecord[]): void {
  if (typeof localStorage === 'undefined' || !userId) return;
  try {
    const all = localStorage.getItem(TOMBSTONE_KEY);
    const bag: Bag = all ? (JSON.parse(all) as Bag) : {};
    if (!bag || typeof bag !== 'object') return;
    if (list.length) bag[userId] = list;
    else delete bag[userId];
    localStorage.setItem(TOMBSTONE_KEY, JSON.stringify(bag));
  } catch (err) {
    console.warn('تعذّر حفظ أثر المحذوفات — نكمل بلا مزامنة', err);
  }
}

/** يمسح أثر مستخدم بعينه — يُستدعى عند حذف الحساب */
export function forgetUser(userId: string): void {
  saveTombstones(userId, []);
}

/* ---------- التنفيذ ---------- */

let running = false;

/** يجلب الطرف البعيد أو ينشئه، ويبتلع الفشل في نتيجة */
async function resolveRemote(deps: SyncDeps): Promise<RemoteStore | null> {
  try {
    return typeof deps.remote === 'function' ? await deps.remote() : deps.remote;
  } catch (err) {
    console.warn('تعذّر تجهيز جهة المزامنة', err);
    return null;
  }
}

/**
 * دورة مزامنة واحدة: تنزيل، دمج، رفع.
 * معطّلة تماماً بلا العلم، ومحصّنة من التزامن المتكرر.
 */
export async function runSync(deps: SyncDeps): Promise<SyncResult> {
  if (!isSyncEnabled()) return SKIPPED;
  if (!deps.userId) return SKIPPED;
  if (running) return SKIPPED;

  const remote = await resolveRemote(deps);
  if (!remote) return { status: 'error', pushed: 0, pulled: 0, error: 'تعذّر الاتصال بخدمة المزامنة.' };

  running = true;
  try {
    let remoteList: SyncRecord[];
    try {
      remoteList = await remote.pull(deps.userId);
    } catch (err) {
      console.warn('تعذّر تنزيل العلامات', err);
      return { status: 'error', pushed: 0, pulled: 0, error: 'تعذّر تنزيل العلامات من الخادم.' };
    }

    const local = [...deps.getLocal().map(toRecord), ...loadTombstones(deps.userId)];
    const { merged, upload, download } = mergeRecords(local, Array.isArray(remoteList) ? remoteList : []);
    const applied = applyMerge(merged, Date.now());

    saveTombstones(deps.userId, applied.tombstones);
    if (!sameBookmarks(deps.getLocal(), applied.bookmarks)) deps.setLocal(applied.bookmarks);

    if (upload.length) {
      try {
        await remote.push(deps.userId, upload);
      } catch (err) {
        console.warn('تعذّر رفع العلامات', err);
        return { status: 'error', pushed: 0, pulled: download.length, error: 'تعذّر حفظ العلامات على الخادم.' };
      }
    }

    return { status: 'ok', pushed: upload.length, pulled: download.length, error: null };
  } catch (err) {
    console.warn('مزامنة العلامات فشلت', err);
    return { status: 'error', pushed: 0, pulled: 0, error: 'تعذّر إتمام المزامنة.' };
  } finally {
    running = false;
  }
}

/**
 * مزامنة مستمرة: دورة أولى ثم دورة بعد كل تغيير محلي، مع تجميع
 * التغييرات المتقاربة في دورة واحدة. تُعيد دالة إيقاف.
 */
export function startSync(deps: SyncDeps, delayMs = 1500): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const clear = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const go = () => {
    if (stopped) return;
    void runSync(deps);
  };

  const schedule = () => {
    if (stopped) return;
    clear();
    timer = setTimeout(() => {
      timer = null;
      go();
    }, delayMs);
  };

  go();
  const unsubscribe = deps.subscribe ? deps.subscribe(schedule) : () => {};

  const onOnline = () => go();
  if (typeof window !== 'undefined') window.addEventListener('online', onOnline);

  return () => {
    stopped = true;
    clear();
    try {
      unsubscribe();
    } catch (err) {
      console.warn('تعذّر إلغاء الاشتراك في المزامنة', err);
    }
    if (typeof window !== 'undefined') window.removeEventListener('online', onOnline);
  };
}

/* ---------- الطرف البعيد الحقيقي ---------- */

/** طرف بعيد فوق مكتبة الحسابات — يُحمَّل عند الطلب ولا يُستورد ثابتاً */
export async function createSupabaseRemote(): Promise<RemoteStore> {
  // الفحص هنا مكتوب مباشرةً حتى تسقط الأداة الاستيراد كلّه في حزمة الضيف
  if ((import.meta.env.VITE_SYNC as string) !== '1') {
    throw new Error('المزامنة معطّلة في هذه النسخة.');
  }
  const { getSupabaseClient } = await import('./auth/supabase');
  const client = await getSupabaseClient();
  const table = 'noor_bookmarks';

  return {
    async pull(userId) {
      const { data, error } = await client
        .from(table)
        .select('id, kind, ref, label, at, deleted_at')
        .eq('user_id', userId);
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: String(row.id ?? ''),
        kind: (row.kind ?? 'ayah') as SyncRecord['kind'],
        ref: String(row.ref ?? ''),
        label: String(row.label ?? ''),
        at: Number(row.at ?? 0),
        deletedAt: row.deleted_at === null || row.deleted_at === undefined ? null : Number(row.deleted_at),
      }));
    },

    async push(userId, records) {
      if (!records.length) return;
      const rows = records.map((r) => ({
        id: r.id,
        user_id: userId,
        kind: r.kind,
        ref: r.ref,
        label: r.label ?? '',
        at: r.at || 0,
        deleted_at: r.deletedAt ?? null,
      }));
      const { error } = await client.from(table).upsert(rows, { onConflict: 'id' });
      if (error) throw error;
    },
  };
}
