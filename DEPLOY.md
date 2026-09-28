# النشر — خطوة بخطوة
> الاستضافة: **Cloudflare Pages** · النطاق: **`noor-islami.pages.dev`** مجاني ودائم.

---

## المسار السريع — رابط حيّ في دقائق

أسرع طريق للحصول على رابط دائم، ويتخطّى النشر التلقائي إلى ما بعده. يمكن تفعيله لاحقاً في أي وقت.

### أ. ارفع الكود إلى GitHub

```powershell
cd E:\NOOR
gh auth login
gh repo create noor-islami --public --source=. --remote=origin --push
```

> ‏`gh auth login` يطبع رمزاً في الطرفية ويفتح المتصفّح — أدخل الرمز هناك واسمح. هذا هو الجزء الوحيد الذي لا أستطيع فعله نيابة عنك.

### ب. انشر من جهازك مباشرة (بلا أسرار)

```powershell
npx wrangler login                                   # يفتح المتصفّح — اسمح لـ Cloudflare
npm run data                                         # بيانات المصحف خارج git
npm run build
npx wrangler pages project create noor-islami
npx wrangler pages deploy dist --project-name=noor-islami
```

الرابط الدائم: `https://noor-islami.pages.dev`

### ج. فعّل النشر التلقائي (لاحقاً)

اتبع المرحلتين ١ و ٢ أدناه. بعدها كل `git push` ينشر تلقائياً إلى نفس الرابط نفسه.

لماذا هذا الاختيار: مجاني بلا حدّ زمني، نطاق فرعي دائم يعطيك إياه Cloudflare تلقائياً، شبكة CDN عالمية بلا حدّ زيارات، ودعم لأسرار النشر من GitHub Actions.

---

## المرحلة ١ · النشر الأول (مرة واحدة)

### ١. ادفع المشروع إلى GitHub

```powershell
gh auth login
git remote add origin https://github.com/<اسمك>/noor-islami.git
git push -u origin main
```

### ٢. أنشئ مشروع Cloudflare

عبر [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → اختر `noor-islami`.

الإعدادات:

| الحقل | القيمة |
|---|---|
| Framework preset | `None` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | *(اتركه فارغاً)* |

> الملف `wrangler.toml` و `public/_headers` و `public/_redirects` يتكفّلان بالباقي.

### ٣. أنشئ مفتاحَي الـ API

من dash.cloudflare.com → **My Profile** → **API Tokens** → **Create Token** → **Edit Cloudflare Workers** (يشمل Pages).

ثم احصل على **Account ID** من dash.cloudflare.com → Workers & Pages → إعدادات الحساب.

### ٤. أضفهما كأسرار في GitHub

المستودع → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

### ٥. فعّل النشر

ادفع أي شيء إلى `main`. البوابة تعمل أولاً، فإن نجحت نُشر تلقائياً. الرابط الدائم: `https://noor-islami.pages.dev`

---

## المرحلة ٢ · كل تحديث بعد ذلك

```powershell
git add -A
git commit -m "وصف ما تغيّر"
git push
```

هذا كل شيء. البوابة تُفحص ثم يُنشر تلقائياً إلى نفس الرابط الدائم.

---

## قراءة النتيجة

| المكان | معناه |
|---|---|
| **Quality Gate** أخفق | لا يُنشر شيء. اقرأ أيّ خطوة حمراء — الترتيب: ترميز النص ← نزاهة المحتوى ← الأنواع ← الاختبارات ← البناء ← الأيقونات |
| **Deploy** أخفق | البوابة نجحت لكن النشر فشل. غالباً مفتاح أو معرّف حساب منتهي |
| كلاهما نجح | الرابط الدائم يعرض النسخة الجديدة خلال دقيقة |

---

## تحديث النطاق

`pages.dev` دائم ولا يحتاج شيئاً. إن أردت نطاقاً خاصاً بك:

```powershell
npx wrangler pages project list
# من dash.cloudflare.com → Custom domains → أضف نطاقك
```

النطاق المدفوع ليس جزءاً من الخطة المجانية — `pages.dev` مجاني بالكامل ودائم.

---

## استكشاف الأعطال

| العَرَض | السبب المرجّح | العلاج |
|---|---|---|
| `تعذّر تنزيل` أو بيانات فارغة | المحتوى لم يُجلب | المحتوى خارج git عمداً — شغّل `npm run data` محلياً، وفي GitHub خطوة الجلب تعمل تلقائياً |
| الخطوط العثمانية تظهر بخط الجهاز | سياسة الأمان منعت الخط | تأكد أن `public/_headers` انتقل إلى `dist/_headers` |
| التلاوة لا تعمل | نطاق مختلط أو سياسة أمان | لا تفتح `dist/` عبر `file://` — لا بد من HTTPS |
| `dist/_headers` مفقود في النشر | البناء نُسخ ناقصاً | خطوة `deploy.yml` تفشل قبل النشر عند غيابه، فلا يُنشر بناء بلا حماية بصمت |
| التحديث لا يظهر | عامل خدمة قديم في الذاكرة | التحديث صار بالإخطار لا تلقائياً — هذا مقصود |
