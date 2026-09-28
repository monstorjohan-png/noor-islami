# NOOR —Blueprint (مصدر الحقيقة)
> آخر تحديث: 2026-09-28 · الحالة: جارٍ التنفيذ
> **لا يعدّل هذا الملف إلا قائد الجلسة. الوكلاء يقرأونه فقط.**

## ١ · الهدف
إضافة نظام حماية إنتاجي + تسجيل دخول (Google / بريد / ضيف) + استضافة مجانية دائمة على نطاق مجاني دائم + نشر تلقائي عند كل تحديث على GitHub.

## ٢ · المبادئ غير القابلة للكسر
1. **نصّ ديني لا يُكتب يدوياً إطلاقاً** — يأتي فقط من `scripts/fetch-content.mjs` (مصادر مرخّصة) إلى `public/data/`. ممنوع أي نص ديني مكتوب في `src/`.
2. **العربية سليمة الترميز** — بوابة `node scripts/check-encoding.mjs` تفحص كل `src/` ولا تُضعَف. عند شك: `node -e "console.log(JSON.stringify(line))"` لا修復 على مخرج الطرفية.
3. **العمل دون إنترنت أولاً** — أي طبقة جديدة (مثل المصادقة) **لا يجوز أن تكسر** الوضع المحلي.
4. `noUnusedLocals` / `noUnusedParameters` مفعّلان في tsconfig — لا تسكب متغيرات غير مستعملة.

## ٣ · بوابة التحقق — الترتيب ثابت ولا يُختصر
```
node scripts/check-encoding.mjs
node scripts/verify-content.mjs
npx tsc -p tsconfig.json --noEmit
npx vitest run
npm run build
node scripts/check-icons.mjs
```
النجاح = `GATES_FAILED=0`.

## ٤ · بنية الملفات الجديدة (متفق عليها — لا تخترع غيرها)

### ٤·١ نظام الحماية
| الملف | الدور |
|---|---|
| `src/lib/safe.ts` | المدخل الوحيد لكل القيم التي تُستخدم في بناء مسار أو استعلام. `isDataPath` · `assertDataPath` · `safeInt` · `stripDangerKeys` · `safeAssign` |
| `public/_headers` | رؤوس الأمان لـ Cloudflare Pages (CSP · HSTS · X-Content-Type-Options · Referrer-Policy · Permissions-Policy · frame-ancestors) |
| `public/_redirects` | توجيه SPA إلى `index.html` |
| `src/lib/random.ts` | `newToken()` عبر `crypto.getRandomValues` فقط (لا `Math.random` للمفاتيح) |

**نقطة الاختناق الوحيدة:** `src/lib/db.ts :: loadData` يستدعي `assertDataPath(path)` قبل أي `fetch`. كل مسارات البيانات تمرّ منه. هذا هو حارس SQL-injection المكافئ عندنا — أي استدعاء مستقبلي لملف خارج النطاق يفشل مبكراً.

### ٤·٢ المصادقة
| الملف | الدور |
|---|---|
| `src/lib/auth/types.ts` | `AuthUser` · `AuthSession` · `AuthProvider` (الواجهة) · `AuthState` |
| `src/lib/auth/index.ts` | `resolveAuthProvider()` — يختار Supabase إن وُجدت المفاتيح وإلا `nullAuthProvider` |
| `src/lib/auth/supabase.ts` | تنفيذ الواجهة فوق `@supabase/supabase-js` (dynamic import — لا يُحمَّل بلا مفاتيح) |
| `src/lib/auth/null.ts` | تنفيذ صامت: ضيف دائم، بلا مفاتيح، بلا أخطاء |
| `src/lib/auth/context.tsx` | `AuthProvider` React · `useAuth()` · `useRequireAuth()` |
| `src/pages/Account.tsx` | صفحة الحساب: دخول · إنشاء حساب · Google · ضيف · خروج |
| `src/lib/sync.ts` | مزامنة العلامات بين الأجهزة — **مفعّلة بعلم خاص** `VITE_SYNC` |

**قاعدة التصميم الحاسمة:** المزوّد-null هو **الوضع الافتراضي**. `resolveAuthProvider()` لا يستورد Supabase إطلاقاً إلا إن `VITE_SUPABASE_URL` و`VITE_SUPABASE_ANON_KEY` موجودان. التطبيق بدون مفاتيح = ضيف كامل، صفر أخطاء، صفر طلبات شبكة.

### ٤·٣ النشر
| الملف | الدور |
|---|---|
| `.github/workflows/deploy.yml` | بناء + نشر على Cloudflare Pages عند كل push إلى `main` |
| `wrangler.toml` | إعداد Cloudflare Pages (مشاريع مجانية، نطاق `*.pages.dev` دائم) |
| `.gitignore` | يستثني `public/data/` (٧٠ ميغا) و`node_modules` و`dist` و`.env*` |

## ٥ · عقود مهمة
- `safe.ts` كل دواله **خالصة (pure)** وبلا حالة، تُختبر في `tests/safe.test.ts`.
- `AuthProvider` كل دواله **async** وتُرجع `Promise` — لا حال تزامن.
- صفحة الحساب تعمل بلا مفاتيح: تعرض «أنت في وضع الضيف» وزرّاً معطّلاً لغير المتاح، ولا ترمي استثناءً.

## ٦ · قرارات ثابتة (لا تُراجَع)
- **Cloudflare Pages** للاستضافة: مجاني، نطاق `*.pages.dev` دائم، CDN عالمي، بلا حدود زيارات، دعم Functions. — `pages.dev` هو نطاق مجاني دائم. نطاق مخصّص اختياري عبر `wrangler pages project` إن أراد المستخدم.
- **GitHub Actions** للنشر: الأسرار `CLOUDFLARE_*` في المستودع.
- **Supabase** للمصادقة: مجاني، Google OAuth مدمج، بريد/كلمة مرور، ضيف، و**Row Level Security** يبقي بيانات المستخدم خاصة.
- **بيانات المصحف خارج git** — تُجلب بـ `npm run data` في خطوة أول من `deploy.yml`.
- الاستدامة بصرية، لا uniquement: «لا يُخترق» غير ممكن — تُسلَّم قائمة المخاطر المتبقية بصراحة في التقرير النهائي.
