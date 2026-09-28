import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { RECITERS, DEFAULT_RECITER_ID } from './audio';
import type { ReciterId } from './audio';
import { clamp, isSafeKey, stripDangerKeys } from './safe';
import type { Lang } from './types';

export type Madhab = 'shafii' | 'hanafi' | 'maliki' | 'hanbali';
export type Theme = 'dark' | 'light';

export interface Bookmark {
  id: string;
  kind: 'ayah' | 'hadith' | 'surah' | 'page';
  ref: string;
  label: string;
  at: number;
}

export interface ReadingState {
  lastSurah: number;
  lastAyah: number;
  bookmarks: Bookmark[];
  /** ذاكرة القراءة: مصحف | تفسير | ترجمة */
  quranMode: 'mushaf' | 'tafsir' | 'translation';
  fontSize: number;
  tafsirVisible: boolean;
  translation: 'none' | 'abdelhaleem' | 'abdulhye';
}

interface SettingsState {
  lang: Lang;
  theme: Theme;
  madhab: Madhab;
  calcMethod: string;
  location: { lat: number; lon: number; label: string } | null;
  athanEnabled: boolean;
  athanVolume: number;
  notifications: boolean;
  dailyReminders: boolean;
  /** قارئ التلاوة المختار — من lib/audio */
  reciter: ReciterId;
  reading: ReadingState;
  tasbihCounts: Record<string, number>;
  tasbihTotal: number;
  bookmarks: Bookmark[];
  adhkarProgress: Record<string, number>;
  onboarded: boolean;

  set: <K extends keyof SettingsState>(k: K, v: SettingsState[K]) => void;
  toggleBookmark: (b: Omit<Bookmark, 'at' | 'id'> & { id?: string }) => void;
  isBookmarked: (kind: Bookmark['kind'], ref: string) => boolean;
  bumpTasbih: (key: string, target: number) => { done: boolean; total: number };
  resetTasbih: () => void;
  setAdhkarProgress: (id: string, n: number) => void;
  completeOnboarding: () => void;
}

const THEMES = new Set(['dark', 'light']);
const MADHABS = new Set(['shafii', 'hanafi', 'maliki', 'hanbali']);
/** معرّفات القرّاء تُشتق من التعريف نفسه فلا تتخلّف عنه أبداً */
const RECITER_IDS: ReadonlySet<string> = new Set(RECITERS.map((r) => r.id));
const BOOKMARK_KINDS = new Set(['ayah', 'hadith', 'surah', 'page']);

function pick<T>(v: unknown, allowed: ReadonlySet<string>, fallback: T): T {
  return typeof v === 'string' && allowed.has(v) ? (v as T) : fallback;
}

function pickBool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

function pickNum(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? clamp(n, min, max) : fallback;
}

/**
 * الإحداثيات: لا تُقبل إلا ضمن نطاق الأرض، وتُهمَل عند الشذوذ.
 * وتُقرَّب إلى ثلاث منازل عشرية — نحو مئة وعشرة أمتار.
 * ما دون ذلك لا يغيّر وقت الصلاة بقدر معتبر، والفارق يُكتب في التخزين
 * الدائم فيكشف موقع المستخدم بدقة أمتار.
 */
function pickLocation(v: unknown): SettingsState['location'] {
  if (!v || typeof v !== 'object') return null;
  const o = v as { lat?: unknown; lon?: unknown; label?: unknown };
  const lat = typeof o.lat === 'number' ? o.lat : NaN;
  const lon = typeof o.lon === 'number' ? o.lon : NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  const label = typeof o.label === 'string' ? o.label.slice(0, 64) : '';
  return { lat: round3(lat), lon: round3(lon), label };
}

/** تقريب لثلاث منازل عشرية */
function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** العلامات: كل حقل يُعاد بناؤه — لا نصّ يُستعمل كما ورد */
function pickBookmarks(v: unknown): Bookmark[] {
  if (!Array.isArray(v)) return [];
  const out: Bookmark[] = [];
  for (const b of v) {
    if (!b || typeof b !== 'object') continue;
    const o = b as Record<string, unknown>;
    const kind = o.kind;
    if (typeof kind !== 'string' || !BOOKMARK_KINDS.has(kind)) continue;
    const ref = typeof o.ref === 'string' ? o.ref : '';
    if (!ref || ref.length > 128) continue;
    const label = typeof o.label === 'string' ? o.label.slice(0, 200) : '';
    const at = pickNum(o.at, 0, 4e12, Date.now());
    const id = `${kind}:${ref}`.slice(0, 160);
    out.push({ id, kind: kind as Bookmark['kind'], ref, label, at });
    if (out.length >= 2000) break;
  }
  return out;
}

function pickReading(v: unknown): ReadingState {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  return {
    lastSurah: pickNum(o.lastSurah, 1, 114, 1),
    lastAyah: pickNum(o.lastAyah, 1, 286, 1),
    bookmarks: pickBookmarks(o.bookmarks),
    quranMode: pick(o.quranMode, new Set(['mushaf', 'tafsir', 'translation']), 'mushaf' as ReadingState['quranMode']),
    fontSize: pickNum(o.fontSize, 14, 72, 28),
    tafsirVisible: pickBool(o.tafsirVisible, false),
    translation: pick(o.translation, new Set(['none', 'abdelhaleem', 'abdulhye']), 'none' as ReadingState['translation']),
  };
}

/**
 * إعادة بناء الحالة من التخزين المحلي.
 * كل حقل يُعاد بناؤه بقيم محسوبة — لا يُثق بأي حقل قادم كما هو.
 */
function sanitizeHydration(persisted: unknown, current: SettingsState): SettingsState {
  const p = (persisted && typeof persisted === 'object' ? persisted : {}) as Record<string, unknown>;
  return {
    ...current,
    lang: p.lang === 'en' ? 'en' : 'ar',
    theme: pick(p.theme, THEMES, current.theme),
    madhab: pick(p.madhab, MADHABS, current.madhab),
    calcMethod: typeof p.calcMethod === 'string' && p.calcMethod.length <= 32 ? p.calcMethod : current.calcMethod,
    location: pickLocation(p.location),
    athanEnabled: pickBool(p.athanEnabled, current.athanEnabled),
    athanVolume: pickNum(p.athanVolume, 0, 1, current.athanVolume),
    notifications: pickBool(p.notifications, current.notifications),
    dailyReminders: pickBool(p.dailyReminders, current.dailyReminders),
    reciter: pick(p.reciter, RECITER_IDS, current.reciter),
    reading: pickReading(p.reading),
    tasbihCounts: stripDangerKeys<number>(p.tasbihCounts),
    tasbihTotal: pickNum(p.tasbihTotal, 0, 1e9, 0),
    bookmarks: pickBookmarks(p.bookmarks),
    adhkarProgress: stripDangerKeys<number>(p.adhkarProgress),
    onboarded: pickBool(p.onboarded, false),
  };
}

/** القيم الافتراضية — مصدر واحد يستعمله الإنشاء والترحيل والتنقية */
const DEFAULTS = {
  lang: 'ar',
  theme: 'dark',
  madhab: 'shafii',
  calcMethod: 'MuslimWorldLeague',
  location: null,
  athanEnabled: true,
  athanVolume: 0.8,
  notifications: false,
  dailyReminders: true,
  reciter: DEFAULT_RECITER_ID,
  onboarded: false,
  tasbihCounts: {},
  tasbihTotal: 0,
  bookmarks: [],
  adhkarProgress: {},
  reading: {
    lastSurah: 1,
    lastAyah: 1,
    bookmarks: [],
    quranMode: 'mushaf',
    fontSize: 28,
    tafsirVisible: false,
    translation: 'none',
  },
} as const satisfies Omit<SettingsState, Actions>;

type Actions =
  | 'set'
  | 'toggleBookmark'
  | 'isBookmarked'
  | 'bumpTasbih'
  | 'resetTasbih'
  | 'setAdhkarProgress'
  | 'completeOnboarding';

function useSettingsDefaults(): SettingsState {
  return { ...DEFAULTS, ...emptyActions() } as SettingsState;
}

function emptyActions() {
  return {
    set: () => undefined,
    toggleBookmark: () => undefined,
    isBookmarked: () => false,
    bumpTasbih: () => ({ done: false, total: 0 }),
    resetTasbih: () => undefined,
    setAdhkarProgress: () => undefined,
    completeOnboarding: () => undefined,
  };
}

export const useSettings = create<SettingsState>()(
  persist(
    (set, get) => ({
      ...DEFAULTS,

      set: (k, v) => {
        // `set` مُعدِّل عام على كل الحقول، والمفتاح يأتي من الكود.
        // الحارس هنا يمنع كتابة `__proto__` لو تسرّب مفتاح من التخزين.
        if (!isSafeKey(k)) return;
        set({ [k]: v } as never);
      },

      toggleBookmark: (b) =>
        set((s) => {
          const id = b.id ?? `${b.kind}:${b.ref}`;
          const i = s.bookmarks.findIndex((x) => x.id === id || (x.kind === b.kind && x.ref === b.ref));
          const bookmarks =
            i >= 0 ? s.bookmarks.filter((_, k) => k !== i) : [...s.bookmarks, { ...b, id, at: Date.now() }];
          return { bookmarks };
        }),

      isBookmarked: (kind, ref) => get().bookmarks.some((b) => b.kind === kind && b.ref === ref),

      bumpTasbih: (key, target) => {
        const cur = (get().tasbihCounts[key] || 0) + 1;
        const total = cur >= target ? 0 : cur;
        set((s) => {
          const next = { ...s.tasbihCounts };
          if (isSafeKey(key)) next[key] = total;
          return { tasbihCounts: next, tasbihTotal: cur >= target ? s.tasbihTotal + 1 : s.tasbihTotal };
        });
        return { done: cur >= target, total };
      },

      resetTasbih: () => set({ tasbihCounts: {}, tasbihTotal: 0 }),

      setAdhkarProgress: (id, n) =>
        set((s) => {
          const next = { ...s.adhkarProgress };
          if (isSafeKey(id)) next[id] = clamp(n, 0, 1e6);
          return { adhkarProgress: next };
        }),

      completeOnboarding: () => set({ onboarded: true }),
    }),
    {
      name: 'noor-settings',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        lang: s.lang,
        theme: s.theme,
        madhab: s.madhab,
        calcMethod: s.calcMethod,
        location: s.location,
        athanEnabled: s.athanEnabled,
        athanVolume: s.athanVolume,
        notifications: s.notifications,
        dailyReminders: s.dailyReminders,
        reciter: s.reciter,
        reading: s.reading,
        tasbihCounts: s.tasbihCounts,
        tasbihTotal: s.tasbihTotal,
        bookmarks: s.bookmarks,
        adhkarProgress: s.adhkarProgress,
        onboarded: s.onboarded,
      }) as never,
      /**
       * لا يُعتمد ما يصل من التخزين كما هو: التخزين المحلي قابل للتحرير
       * من أي نص على نفس الأصل، فنعيد بناء كل حقل من قيم محسوبة هنا.
       */
      merge: (persisted, current) => sanitizeHydration(persisted, current),
      /**
       * أي ترقية للنسخة يجب أن تمرّ هنا، وإلا مسح zustand الإعدادات بصمت.
       * نعيد بناء القيم من الافتراضيات ثم نطبّق القديم فوقها بعد تنقيته.
       */
      migrate: (persisted, _version) =>
        sanitizeHydration(persisted, useSettingsDefaults()) as never,
    },
  ),
);
