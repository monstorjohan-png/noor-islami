
---

# تحديث 2026-09-28 — العقود المضافة

هذه العقود جديدة. أي وكيل يلمس الملفات المذكورة يقرأ هذا القسم أولاً.

## 1) تشريح المصحف — `src/lib/content.ts`

`quran/uthmani.json` لم يعد في مسار القراءة الساخنة. بديله:

| الملف | الحجم | متى يُقرأ |
|---|---|---|
| `quran/shard-index.json` | 1 ك.ب | دائماً: `{shardSize, shards, total, offset}` |
| `quran/surah/<n>.json` | 2 ك.ب – 513 ك.ب | عند فتح سورة |
| `quran/shards/<nnn>.json` | 510 ك.ب – 1.7 م.ب | لصف عام واحد أو جزء |
| `quran/search.json` | 1.4 م.ب | عند أول بحث فقط |

عقود ثابتة:

```ts
makeReverseMap(offset: number[], total: number): (gi: number) => [s: number, a: number]
getAyahRow(gi: number): Promise<QuranRow | null>
getSurahAyahs(s: number): Promise<AyahView[]>          // يقرأ quran/surah/<n>.json
getQuranSearchIndex(): Promise<Array<[normalized, skeleton, globalIndex]>>
getQuran(): Promise<QuranRow[]>                        // باق للبحث الكامل والتفسير
```

`uthmani.json` لا يُحذف: البحث الشامل والتفسير الكامل ما زالا يحتاجانه.

## 2) التلاوة — `src/lib/audio.ts`

```ts
RECITERS: 6 قرّاء
surahAudioUrl(reciter, surah): string
ayahAudioUrl(reciter, globalIndex): string            // مفهرس من +1
isAudioCached(url): Promise<boolean>
downloadSurahAudio(reciter, surah, onProgress?): Promise<'done' | 'error'>
clearAudioCache(): Promise<void>
```

مفتاح اختيار القارئ: `reciter` في `SettingsState` من نوع `ReciterId`، افتراضيه `DEFAULT_RECITER_ID`.

## 3) بطاقة الآية — `src/lib/card.ts`

```ts
renderAyahCard(card: ImageCard): Promise<Blob>        // 1080x1080 PNG
cardFileName(card: ImageCard): string
shareAyahImage(blob, fileName, title): Promise<'shared' | 'downloaded'>
```

`renderAyahCard` يرمي استثناءً عند الفشل عمداً — المتصل يعرض رسالة صريحة ثم يرجع لمشاركة النص.

## 4) التنبيهات — `src/lib/notifications.ts`

```ts
notifyNow(title, body, tag?): Promise<Outcome>
scheduleDay(slots: PrayerSlot[]): { scheduled, skipped }
syncOnOpen(slots: PrayerSlot[]): number
enableBackgroundSync(): Promise<boolean>              // PeriodicSync، أندرويد
scheduleDailyReminder(hour, minute): void
dailyAyahIndex(date: Date): number                    // 0..6235 من اليوم المحلي
```

`PrayerSlot = { key, label, ms }` — `ms` فرق عن منتصف ليل اليوم المحلي.

## 5) التنزيل والتقدّم — `src/lib/db.ts`

```ts
loadData<T>(path, opts?: { force?: boolean; onProgress?: (loaded, total) => void })
requestPersistence(): Promise<boolean>                // navigator.storage.persist
storageInfo(): Promise<{ used, quota }>
```

`onProgress` يقرأ `res.body` كتدفق؛ بلاه يبقى `res.json()` كما هو. الفشل يرمي استثناءً كما كان.

## 6) بوابة الجودة — `.github/workflows/quality.yml`

الترتيب: `check-encoding` ثم `verify-content` ثم `tsc` ثم `vitest` ثم `build` ثم `check-icons`.
الأسرع يفشل أولاً. لا يُدمج قبل المرور كاملاً.
