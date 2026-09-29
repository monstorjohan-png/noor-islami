/**
 * فحص القرّاء على شبكة التلاوة.
 * ------------------------------------------------------------------
 * كل سطر في قائمة القرّاء داخل `src/lib/audio.ts` يجب أن يكون مُختبَراً
 * هنا بطلب حقيقي. لا نثق بقائمة منسوخة من مكان آخر: خادم الملفات يردّ
 * ٤٠٣ على المجلدات التي لا وجود لها، ومناكبُ قائمةً من عشرين معرّفاً
 * كانت روابط ميتة يعرضها التطبيق للمستخدم دون أن ينتبه.
 *
 * الاستعمال:
 *   node scripts/probe-reciters.mjs          # يفحص ويطبع
 *   node scripts/probe-reciters.mjs --write  # يفحص ويحدّث audio.ts
 *
 * ليس جزءاً من بوابات الجودة: فحص شبكي لا يُعوَّل عليه في البناء اليومي.
 */

import { readFile, writeFile } from 'node:fs/promises';

const HOST = 'https://cdn.islamic.network';
const TIMEOUT = 12_000;
const WRITE = process.argv.includes('--write');

/**
 * القوائم المُرشَّحة للاختيار بين `ayahRate` و `surahRate`.
 * الترتيب **تنازلي عمداً**: نختبر ١٢٨ قبل ٦٤ فنلتقط أعلى جودة.
 * لو كان تصاعدياً لأخذ ٦٤ دائماً — لأن ٦٤ يعمل إن وُجد ١٢٨ —
 * فالاختيار الأول لا يدل على الأفضل أبداً.
 */
const RATES = [128, 64];

/** المعرّفات المرشَّحة للقرّاء الجدد — تُختبر كلها ولا يُعتمد إلا ما يردّ ٢٠٠ */
const CANDIDATES = [
  ['ar.alafasy', 'مشاري راشد العفاسي', 'Mishary Rashid Alafasy'],
  ['ar.abdulbasitmurattal', 'عبد الباسط عبد الصمد — مرتل', 'Abdul Basit Abdul Samad (Murattal)'],
  ['ar.abdulbasitmujawwad', 'عبد الباسط عبد الصمد — مجوّد', 'Abdul Basit Abdul Samad (Mujawwad)'],
  ['ar.husary', 'محمود خليل الحصري', 'Mahmoud Khalil Al-Husary'],
  ['ar.minshawi', 'محمد صديق المنشاوي', 'Al-Minshawi (Murattal)'],
  ['ar.minshawi_murattal', 'المنشاوي مرتل', 'Al-Minshawi (Murattal) alt'],
  ['ar.saoodshuraym', 'سعود الشريم', 'Saood Ash-Shuraym'],
  ['ar.hudhaify', 'علي الحذيفي', 'Ali Al-Hudhaify'],
  ['ar.mahermuaiqly', 'ماهر المعيقلي', 'Maher Al-Muaiqly'],
  ['ar.shaatree', 'أبو بكر الشاطري', 'Abu Bakr Al-Shatri'],
  ['ar.muhammadayyoub', 'محمد أيوب', 'Muhammad Ayyoub'],
  ['ar.suleimanshammari', 'سليمان الشامي', 'Sulayman Ash-Shammari'],
  ['ar.tablawi', 'محمد الطبلاوي', 'Mohamed Al-Tablawi'],
  ['ar.rifai', 'هاني الرفاعي', 'Hani Ar-Rifai'],
  ['ar.sudais', 'عبد الرحمن السديس', 'Abdur-Rahman as-Sudais'],
  ['ar.abdurrrahmaansudais', 'السديس', 'as-Sudais alt'],
  ['ar.ghamdi', 'سعد الغامدي', 'Saad Al-Ghamdi'],
  ['ar.uthaymeen', 'أحمد بن عثيمين', 'Ahmed ibn Uthaymeen'],
  // أضيفت في الجولة الثانية — كلها مرشّحة لا أكثر، والاختبار هو الحكم
  ['ar.abdullaahbasfar', 'عبد الله بصفر', 'Abdullah Basfar'],
  ['ar.abdullaahjuhaynee', 'عبد الله الجهني', 'Abdullah Al-Juhany'],
  ['ar.mustafakhalil', 'مصطفى الخليل', 'Mustafa Khalil'],
  ['ar.husarymujawwad', 'الحصري مجوّد', 'Al-Husary (Mujawwad)'],
  ['ar.mohammadayyoub', 'محمد أيوب', 'Muhammad Ayyoub'],
  ['ar.yasser', 'ياسر الدوسري', 'Yasser Al-Dosari'],
  ['ar.masoodwarshall', 'محمود خليل الحصري', 'Al-Husary (alt)'],
  ['ar.alqatami', 'خليفة القطعامي', 'Khalifa Al-Qatami'],
  ['ar.moaserarayat', 'أبو عبد الرحمن السلفي', 'As-Salafi'],
  ['ar.husarymuallim', 'الحصري المعلّم', 'Al-Husary (Muallim)'],
  ['ar.aliabdulrahmanhusary', 'الحصري', 'Al-Husary (alt id)'],
  ['ar.walidalshuraimi', 'وليد الشريم', 'Walid Ash-Shuraimi'],
  ['ar.turkiassubayd', 'تركي السبيعي', 'Turki As-Subaid'],
  ['ar.sultan_al_qarni', 'سلطان القاري', 'Sultan Al-Qarni'],
  ['ar.salahalbudair', 'صلاح البراك', 'Salah Al-Budair'],
  ['ar.mohammad_al_sallal', 'محمد صال الشلبي', 'Muhammad As-Sallal'],
  ['ar.husary_128', 'الحصري ١٢٨', 'Al-Husary (128)'],
];

/**
 * هل الملف موجود فعلاً؟
 *
 * نطلب ملفين مختلفين حتى لا نحسب المصادفةَ ملفاً ناقصاً موجوداً:
 * لو نجحت آية واحدة وfailedت مئة فهو ملف معلّق لا فهرس كامل.
 * ونعيد المحاولة ثلاث مرات، فالرفض الأول قد يكون مهلة شبكة لا غياب ملف.
 *
 * التوقيع كان `exists(path)` بينما الاستدعاء المتكرر كان `exists(x, 1)`
 * — الوسيط الثاني لا وجود له فيُهمل، والاكتفاء تصاعدي بلا حدّ.
 * استُبدل بحارس `depth` صريح.
 */
async function exists(path, depth = 0) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
    try {
      const res = await fetch(`${HOST}${path}`, { signal: ctrl.signal });
      clearTimeout(timer);
      const type = res.headers.get('content-type') || '';
      if (res.status === 200 && type.includes('mpeg')) {
        if (depth >= 1) return true;
        const second = path.replace(/\/\d+\.mp3$/, '/100.mp3');
        if (second === path) return true;
        return exists(second, depth + 1);
      }
      // ٤٠٣ و٤٠٤ يعنيان المجلد غير موجود على خادم الملفات — لا فائدة من التكرار
      if (res.status === 403 || res.status === 404) return false;
    } catch {
      clearTimeout(timer);
    }
  }
  return false;
}

/** يبحث عن أول معدل يعمل لملفات الآيات */
async function findAyahRate(id) {
  for (const rate of RATES) {
    if (await exists(`/quran/audio/${rate}/${id}/1.mp3`)) return rate;
  }
  return null;
}

/** يبحث عن أول معدل يعمل لملف السورة الكاملة */
async function findSurahRate(id) {
  for (const rate of RATES) {
    if (await exists(`/quran/audio-surah/${rate}/${id}/1.mp3`)) return rate;
  }
  return null;
}

console.log(`فحص القرّاء على ${HOST}\n`);

const found = [];
for (const [id, ar, en] of CANDIDATES) {
  process.stdout.write(`… ${id}`);
  const ayahRate = await findAyahRate(id);
  if (!ayahRate) {
    console.log(`\r  ✗ ${id} — لا ملف آية`);
    continue;
  }
  const surahRate = await findSurahRate(id);
  console.log(
    `\r  ✓ ${id.padEnd(26)} آية ${String(ayahRate).padStart(3)}  سورة ${
      surahRate ? String(surahRate).padStart(3) : ' —'
    }`,
  );
  found.push({ id, ayahRate, surahRate, ar, en });
}

console.log(`\n=== النتيجة: ${found.length} قارئاً ===`);
for (const r of found) {
  console.log(
    `  ${r.id.padEnd(26)} ayahRate: ${r.ayahRate}` +
      (r.surahRate ? `, surahRate: ${r.surahRate}` : ''),
  );
}

if (!WRITE) {
  console.log('\n(لم يُطلب --write، فلم تتغيّر الملفات)');
  process.exit(0);
}

const block = found
  .map((r) => {
    const fields = [`id: '${r.id}'`, `ayahRate: ${r.ayahRate}`];
    if (r.surahRate) fields.push(`surahRate: ${r.surahRate}`);
    fields.push(`ar: '${r.ar}'`, `en: '${r.en}'`);
    return `  { ${fields.join(', ')} },`;
  })
  .join('\n');

const file = 'src/lib/audio.ts';
const src = await readFile(file, 'utf8');
const next = src.replace(
  /export const RECITERS = \[[\s\S]*?\n\] as const;/,
  `export const RECITERS = [\n${block}\n] as const;`,
);

if (next === src) {
  console.error('\nتعذّر العثور على قائمة القرّاء داخل audio.ts — لم يتغيّر شيء');
  process.exit(1);
}

await writeFile(file, next, 'utf8');
console.log(`\nحُدِّثت ${file} بـ ${found.length} قارئاً`);
