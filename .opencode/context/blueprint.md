# مخطط تنفيذي: NOOR — تحسينات المستخدم

> هذا الملف **مصدر الحقيقة الوحيد**. كل وكيل يقرأه قبل التنفيذ ولا يعدّله.
> أنا وحدي أعدّله. أي تغيير تصميم يُسجَّل هنا أولاً ثم يُنفَّذ.

## القاعدة الحاكمة

لا يتغيّر شيء في تطبيق مُسلَّم بلا:
1. `npx tsc -p tsconfig.json --noEmit` — صفر أخطاء
2. `node scripts/check-encoding.mjs` — صفر تلف نصي
3. اختبار vitest جديد يغطي السلوك الجديد
4. بوابة `npm run gates` خضراء قبل الدفع إلى غيت هب

## القواعد التي كسرت builds سابقة

| القاعدة | السبب |
|---|---|
| لا حروف لاتينية ملتصقة داخل جملة عربية | `check-encoding.mjs` يرفضها، وقد رفضت ب myself ثلاث مرات |
| لا نصوص دينية من كتابة يدنا | كل نصّ ديني يأتي من خط الأنابيب المرخَّص فقط |
| `noUnusedLocals` و`noUnusedParameters` مفروضان | البناء ينهار إن تُرك متغيّر بلا استعمال |
| لا `npm run build` بالتوازي مع وكيل آخر | البناء يُفرغ `dist/` فتصطدم efforts |
| لا `git commit` ولا `git push` من الوكيل | الدفع مسؤوليتي وحدي، بعد البوابات |

## توزيع الملفات — لا تداخل

| الوكيل | الملفات المملوكة حصرياً |
|---|---|
| `frontend-themes` | `src/lib/theme.ts` (جديد)، `src/styles/index.css`، `tailwind.config.js`، `src/lib/store.ts`، `src/lib/hooks.ts`، `src/pages/Settings.tsx`، `tests/theme.test.ts` (جديد) |
| `frontend-hifz` | `src/lib/hifz.ts` (جديد)، `src/pages/Hifz.tsx` (جديد)، `src/App.tsx`، `src/components/Layout.tsx`، `src/pages/Home.tsx`، `tests/hifz.test.ts` (جديد) |
| `master` (أنا) | `src/lib/install.ts` (جديد)، `src/pages/More.tsx`، `src/lib/audio.ts`، `scripts/probe-reciters.mjs`، `src/i18n/index.ts` |

**أي ملف خارج جدولك = لا تلمسه. اسأل إن أحتجته.**

## العقد ١: الألوان (frontend-themes)

### المشكلة
الألوان مثبَّتة في `tailwind.config.js` كقيم صلبة. تغييرها يتطلب تعديل كل
مكوّن، وكل واحد استعمل `bg-ink-800` حرفياً.

### الحل
الألوان تصبح **متغيّرات CSS** على `html`، وتبقى أسماء تيلويند كما هي
(`ink-900`, `gold-400`, `emerald-500`). لا يتغيّر أي مكوّن.

```
tailwind.config.js:
  ink: { 900: 'rgb(var(--ink-900) / <alpha-value>)', ... }

index.css:
  :root            { --ink-900: 11 18 32; ... }   /* أرقام بلا rgb() */
  [data-palette="emerald"] { --ink-900: 6 26 24; ... }
```

`<alpha-value>` شرط ضروري: المكوّنات تستعمل `bg-ink-800/70` و
`shadow-gold-500/20`، فمن بلاه يسقط الشفافية.

### واجهة الوحدة المطلوبة

```ts
// src/lib/theme.ts
export const PALETTES = [
  { id: 'noor',    ar: 'نور',      en: 'Noor',     desc: { ar: 'ذهبي على كحلي', en: 'Gold on navy' } },
  { id: 'emerald', ar: 'زمرّد',     en: 'Emerald',  desc: { ar: 'أخضر عميق',    en: 'Deep green' } },
  { id: 'royal',   ar: 'أزرق ملكي', en: 'Royal',    desc: { ar: 'كحلي وأزرق',   en: 'Indigo blue' } },
  { id: 'plum',    ar: 'أرجواني',   en: 'Plum',     desc: { ar: 'بنفسجي داكن',  en: 'Dark violet' } },
  { id: 'sand',    ar: 'رملي',      en: 'Sand',     desc: { ar: 'فاتح دافئ',    en: 'Warm light' } },
] as const;

export type PaletteId = (typeof PALETTES)[number]['id'];

export function isPalette(v: unknown): v is PaletteId;
export function applyPalette(id: PaletteId): void;   // يضبط data-palette على html
```

### العقد مع `store.ts`
حقل واحد يُضاف: `palette: PaletteId` — افتراضي `'noor'`.
يُضاف إلى: `SettingsState`، `DEFAULTS`، `sanitizeHydration` (بـ `isPalette`)،
`partialize`. **لا تلمس** `theme` ولا `lang` ولا حقول أخرى.
الإصدار يبقى `version: 1` — لا ترفعه، فذلك يمسح إعدادات المستخدمين.

### العقد مع `hooks.ts`
`useTheme()` يقرأ `palette` أيضاً ويطبّقه داخل نفس `useEffect` القائم.

## العقد ٢: متابعة الختم (frontend-hifz)

### ليس في `store.ts` —state خاص به
`store.ts` ملك themes. حالة الختم في `src/lib/hifz.ts` بمفتاح تخزين خاص
`noor-hifz`. هذا فصلٌ مقصود: ميزات مستقلة لا تتزاحم.

### واجهة الوحدة المطلوبة

```ts
export interface HifzEntry {
  surah: number;
  /** أعلى آية محفوظة — الأرقام ١..ن محفوظة */
  maxAyah: number;
  /** محفوظات متفرقة خارج التسلسل (نقول: حفظت ٥ و ٩) */
  extra?: number[];
  updatedAt: number;
}

export interface HifzState {
  entries: HifzEntry[];
  /** يوم بدء الخطة — رقم اليوم منذ تاريخ مرجعي ثابت */
  startDay: number;
  /** عدد الآيات المستهدفة يومياً */
  dailyTarget: number;
  /** الختمة الأولى اكتملت */
  completedRuns: number;
  /** آخر ختمة اكتملت */
  lastCompletedAt: number | null;
}

export function loadHifz(): HifzState;
export function saveHifz(s: HifzState): void;
export function sanitizeHifz(v: unknown): HifzState;
export const todayIndex: () => number;      // عدد الأيام منذ ١٩٧٠-٠١-٠١
export function memorizedCount(e: HifzEntry | undefined): number;
export function surahProgress(e: HifzEntry | undefined, ayahCount: number): number; // ٠..١
export function dueForReview(s: HifzState, today: number, limit: number): ReviewItem[];
export interface ReviewItem { surah: number; ayah: number; }
```

### قواعد衛生 للبيانات (نفس فلسفة `store.ts`)
كل حقل يُعاد بناؤه من قيمة محسوبة. لا حقل يُستعمل كما ورد من التخزين:
- `surah` بين ١ و ١١٤
- `maxAyah` بين ٠ و ٢٨٦
- `extra` أرقام بين ١ و ٢٨٦ بلا تكرار
- عدد المدخلات سقفه ١١٤
- `dailyTarget` بين ١ و ٥٠
- `startDay` بين ٠ و ١٠٠٠٠٠
- تخزين تالف أو قيمة `null` → القيم الافتراضية، **ولا ترمي**

### الصفحة `src/pages/Hifz.tsx` — أربع لبنات
1. **حلقة اليوم**: ما تبقّى اليوم، عدّاد، زر «انتهيت» يزيد `maxAyah`
2. **الأجزاء**: شبكة ١١٤ سورة، كل واحدة بنسبة وحالة (لم يبدأ / جارٍ / تمّت)
3. **الإحصاء**: النسبة الكلية، نسبة الجزء، سلسلة الأيام المتتالية،
   عدد الختمات المكتملة
4. **المراجعة**: قائمة آيات مستحقة، كل آية تُعرض مخفيّة النصّ أوّلاً
   ثم تُكشف بضغطة — زرّان «أتتقنتها» و«أعِدها». لا نصّ ديني مكتوب
   بيدنا: النصّ يأتي من `src/lib/content.ts` عند العرض.

### الطريق والملاحة
- `src/App.tsx`: `const Hifz = lazy(...)` + `<Route path="hifz" element={<Hifz />} />`
- `src/components/Layout.tsx`: عنصر قائمة بلا تابع
- `src/pages/Home.tsx`: بطاقة واحدة على الأقل

### النصوص
استعمل `useT()` و`useL()` من `../lib/hooks`. **لا تلمس** `src/i18n/index.ts`
(ملكي). النصوص العربية inline عبر `L({ ar: '...', en: '...' })`.

## تنسيق التسليم الإلزامي

```
## تسليم: <اسم الوكيل> — <المهمة>
### الملفات المنشأة/المعدلة
- <المسار>: وصف سطر واحد
### الواجهات المتاحة للآخرين
- <الدالة>: التوقيع
### القرارات المهمة
- <القرار>: السبب
### ما لم يُنجز (إن وجد)
- <المهمة>: السبب
### التحقق
- [ ] tsc بلا أخطاء (أدرج آخر سطر من المخرجات)
- [ ] check-encoding بلا تلف (أدرج العدد)
- [ ] vitest يمرّ (أدرج عدد الاختبارات)
```
