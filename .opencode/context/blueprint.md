# مخطط تنفيذي: NOOR — الجولة الثانية (إصلاح الفجوات)

> هذا الملف **مصدر الحقيقة الوحيد**. كل وكيل يقرأه قبل التنفيذ ولا يعدّله.
> أنا وحدي أعدّله.

## نتيجة التدقيق الشامل (ملخّص)

المشروع في حالة جيدة بنيوياً: ٢٠ صفحة، ١١ قارئاً، ٦٢٣٦ آية، ٣٦ ألف حديث،
١٠٠ اسم، ٨ مجموعات أذكار، ٥ لوحات ألوان، ١٩٣ اختباراً، بوابة جودة من ٧ خطوات.
ما ينقصه ليس_basisegged فهو قائمة أدناه.

### حرج (يضرّ المستخدم مباشرة)

| # | الفجوة | الملف |
|---|---|---|
| J1 | لا `prefers-reduced-motion` — كل الحركات تعمل لحسّاسية الحركة | `src/styles/index.css` |
| J2 | تنبيه الأذان **لا يعمل والتطبيق مغلق** — `setTimeout` يموت مع التبويب | `src/lib/notifications.ts` |
| J3 | لا نسخة احتياطية ولا تصدير — `clearCache` يحذف نهائياً | `src/lib/backup.ts` (جديد) |
| J6 | شاشة الحاجز عربيّة فقط، والمستخدم الإنجليزي يرى شاشة عربية | `src/components/ErrorBoundary.tsx` |

### عالٍ

| # | الفجوة | الملف |
|---|---|---|
| H1 | ١٣ نصاً في `Prayer.tsx` عربي فقط بلا بديل إنجليزي | `src/pages/Prayer.tsx` |
| H3 | `About.tsx:131` ينادي `L({ar})` **بلا `en`** — فراغ للإنجليزي | `src/pages/About.tsx` |
| H6 | البحث لا يغطي الأذكار ولا أسماء الله | `src/lib/search.ts` |

### متوسط

| # | الفجوة | الملف |
|---|---|---|
| M1 | `useT` مستورد غير مستعمل في `Tasbih.tsx` | `src/pages/Tasbih.tsx` |
| M3 | `ReadingState.bookmarks` حقل ميت لا يقرأه أحد | `src/lib/store.ts` |
| M6 | تعليقان مشوّهان ومكرّران | `src/lib/db.ts` |
| M7 | `key:'hifz'` غير موجود في قاموس `T` | `src/components/Layout.tsx` |
| M14 | `README.md` يخالف الكود في **٨ مواضع** | `README.md` |
| L6 | `IMPROVEMENT_PLAN.md` يصف ميزات غير موجودة | `IMPROVEMENT_PLAN.md` |

## توزيع الملفات — لا تداخل (إلزامي)

| الوكيل | الملفات المملوكة حصرياً |
|---|---|
| `frontend-backup` | `src/lib/backup.ts` (جديد)، `src/components/BackupPanel.tsx` (جديد)، `tests/backup.test.ts` (جديد) |
| `frontend-i18n` | `src/pages/Prayer.tsx`، `src/components/ErrorBoundary.tsx`، `src/components/ui.tsx`، `src/pages/About.tsx`، `src/i18n/index.ts`، `tests/i18n.test.ts` (جديد) |
| `master` (أنا) | `src/styles/index.css`، `src/lib/store.ts`، `src/lib/db.ts`، `src/components/Layout.tsx`، `src/pages/Settings.tsx`، `src/pages/Tasbih.tsx`، `src/lib/search.ts`، `src/pages/Search.tsx`، `src/lib/notifications.ts`، `README.md`، `IMPROVEMENT_PLAN.md` |

**أي ملف خارج جدولك = لا تلمسه. اسأل إن أحتاجته.**

## القواعد الحاكمة (كما هي)

- `npx tsc -p tsconfig.json --noEmit` — صفر أخطاء
- `node scripts/check-encoding.mjs` — صفر تلف
- اختبار vitest جديد يغطي كل سلوك جديد
- **لا حروف لاتينية ملتصقة بجملة عربية** — الفاحص يرفضها
- **لا `npm run build` ولا `npm run gates`** — البناء يتزاحم مع عملي
- **لا `git commit` ولا `git push`** — الدفع مسؤوليتي وحدي
- لا نصّ ديني ولا آية ولا حديث من كتابة اليد — يأتي من خط الأنابيب فقط
- `noUnusedLocals` و `noUnusedParameters` مفروضان

## عقد النسخ الاحتياطي (frontend-backup)

```ts
export interface BackupFile {
  v: 1;
  createdAt: number;
  app: string;
  settings: unknown;   // من store (بدون تواريخ غير قابلة للنسخ)
  hifz: unknown;       // من lib/hifz
  keys: string[];      // ما الذي حُفظ داخله
}
export function collectBackup(): Promise<BackupFile>;
export function parseBackup(text: string): { ok: true; data: BackupFile } | { ok: false; error: string };
export function applyBackup(data: BackupFile): Promise<{ applied: string[]; skipped: string[] }>;
export function backupFileName(): string;
```

قواعد لا تُخترق:
- **التصدير لا يمسح شيئاً أبداً** — قراءة فقط
- **الاستيراد لا يكتب قبل التحقق الكامل** — خطأ واحد = لا تغيير ولا رمي
- كل حقل يُعاد بناؤه من قيمة محسوبة، والتخزين التالف → رفض واضح لا استيراد ناقص
- الاستيراد يدمج لا يستبدل: `bookmarks` تُدمج بمعرّف فريد، لا تُمحى-local
- `clearCache` يبقى كما هو — النسخ الاحتياطي **بديل** عنه لا بديل عنه
- التطبيق بلا `Blob` أو بلا تنزيل (iOS) يعرض النص للنسخ اليدوي بدل زرّ معطّل

## عقدilingual (frontend-i18n)

الهدف: **صفر نصّ عربي يظهر للمستخدم الإنجليزي بلا بديل.**

- كل نصّ في `Prayer.tsx` و`ErrorBoundary.tsx` و`ui.tsx:32` و`About.tsx:131`
  يمرّ عبر `useL()` أو `useT()`، أو يُغلَّف بمفتاح في `src/i18n/index.ts`
- الحاجز يعمل بلا React (بلا سياق موفّر): يستقبل `lang` من `window` مباشرةً
  أو يقرأ من `document.documentElement.lang`، ولا يفترض سياقاً
- `ui.tsx:32` — إن كان النصّ ثابتاً في مكوّن بلا سياق، استخدم
  `document.documentElement.lang` كمصدر لغة مباشرةً
- `About.tsx:131` — أضف `en` لا تتركه فارغاً
- `tests/i18n.test.ts` — اختبار يفحص **المصدر نصاً**: كل `L({...})` بلا `en`
  أو `S(ar)` بأقل من معاملين خطأ. يمنع تكرار العيب بنيوياً لا بتفرّد.

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
- [ ] tsc بلا أخطاء (آخر سطر من المخرجات)
- [ ] check-encoding (آخر سطر)
- [ ] vitest (عدد الاختبارات)
```
