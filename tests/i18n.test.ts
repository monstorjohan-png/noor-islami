import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

/**
 * عقد اللغتين
 * ------------------------------------------------------------------
 * هذا الاختبار لا يختبر سلوكاً، بل يفحص **المصدر نصاً** بالمسار.
 * السبب أن العيب الذي عالجناه بنيوياً لا يترك أثراً في السلوك: نداء
 * `L({ ar: '…' })` بلا `en` يُصيّر فراغاً للقارئ الإنجليزي بلا خطأ،
 * ولا رمية، ولا أثر في أي نتيجة. الفحص النصي هو ما يمنع عودته.
 *
 * القواعد المفروضة:
 *   ١ • كل `L({ … })` فيه `ar` **و** `en` معاً، على أي عدد أسطر.
 *   ٢ • كل `S('عربي', 'English')` لها معاملان لا واحد.
 *   ٣ • لا محرف بديل `�` (U+FFFD) في أي ملف مصدر.
 *   ٤ • كل مفتاح `t('…')` تستعمله الصفحات والمكوّنات موجود في القاموس.
 *
 * وكل قاعدة تُختبر بدلexample معطوب: لولا ذلك لكان هذا الاختبار
 * يمرّ على كاشف لا يلتقط شيئاً — أي اختبار لا يطيّب بنفسه.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');

/* ---------- قراءة المصدر ---------- */

function walk(dir: string, ext: RegExp, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p, ext, out);
    else if (ext.test(name)) out.push(p);
  }
  return out;
}

const TS = /\.tsx?$/;
/** كل ملفات مصدر الواجهة التي قد تحوي نصّاً ظاهراً */
const PAGES = walk(path.join(SRC, 'pages'), TS);
const COMPONENTS = walk(path.join(SRC, 'components'), TS);
const TSX_ALL = [...PAGES, ...COMPONENTS];

const rel = (p: string) => path.relative(ROOT, p).split(path.sep).join('/');
const read = (p: string) => readFileSync(p, 'utf8');

/** يزيل التعليقات وخطوط السلاسل لتفادي مطابقة نصّ يشرح النمط */
function stripNoise(src: string): string {
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (c === '/' && d === '/') {
      while (i < n && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && d === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      // نحتفظ بالمحتوى مع استبدال الحروف بمحايد: القواعد تفحص داخل السلاسل
      out += c;
      i++;
      while (i < n && src[i] !== c) {
        if (src[i] === '\\') {
          out += 'ab';
          i += 2;
          continue;
        }
        out += src[i] === '\n' ? ' ' : src[i];
        i++;
      }
      out += c;
      i++;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

/** رقم السطر لموقع معيّن في النص الأصلي */
function lineAt(src: string, index: number): number {
  return src.slice(0, index).split('\n').length;
}

/* ---------- القاعدة ١: L({ ar, en }) ---------- */

/**
 * يجمع مواضع `L({` ثم يوازن الأقواس ليأخذ كامل الكائن.
 * لا نتوقّف عند أول `}` لأن القيمة قد تكون قالباً فيه `${…}`.
 */
export function findLCalls(code: string): Array<{ args: string; at: number }> {
  const out: Array<{ args: string; at: number }> = [];
  const re = /\bL\(\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code))) {
    const open = code.indexOf('{', m.index);
    let depth = 0;
    let i = open;
    for (; i < code.length; i++) {
      const c = code[i];
      if (c === '{') depth++;
      else if (c === '}') {
        depth--;
        if (depth === 0) break;
      }
    }
    if (i >= code.length) continue; // غير متوازن: يلتقطه فحص tsc لا هذا
    out.push({ args: code.slice(open, i + 1), at: m.index });
    re.lastIndex = i;
  }
  return out;
}

export function missingLangFields(args: string): string[] {
  const missing: string[] = [];
  // حقل بأ curly بعد مسافة: يلتقط `ar:` و `en:` لا نصاً يحوي الحرف
  if (!/(^|[{\s,])ar\s*:/.test(args)) missing.push('ar');
  if (!/(^|[{\s,])en\s*:/.test(args)) missing.push('en');
  return missing;
}

/* ---------- القاعدة ٢: S(ar, en) ---------- */

/** مواضع `S(` مع عدد المعاملات على المستوى الأول */
export function findSCalls(code: string): Array<{ args: number; at: number; snippet: string }> {
  const out: Array<{ args: number; at: number; snippet: string }> = [];
  const re = /\bS\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code))) {
    let depth = 0;
    let commas = 0;
    let hasContent = false;
    let i = m.index + 1;
    for (; i < code.length; i++) {
      const c = code[i];
      // القوالب النصية قد تحوي فواصل نصوصية، والفاصلة معامل فقط خارجها
      if (c === '`' || c === "'" || c === '"') {
        const quote = c;
        i++;
        while (i < code.length && code[i] !== quote) {
          if (code[i] === '\\') i++;
          // التعويض ${…} داخل القالب جزء من المعامل لا فاصل معاملات
          else if (quote === '`' && code[i] === '$' && code[i + 1] === '{') {
            let d = 1;
            i += 2;
            while (i < code.length && d > 0) {
              if (code[i] === '{') d++;
              else if (code[i] === '}') d--;
              i++;
            }
            i--;
          }
        }
        hasContent = true;
        continue;
      }
      if (c === '(' || c === '[' || c === '{') depth++;
      else if (c === ')' || c === ']' || c === '}') {
        depth--;
        if (depth === 0) break;
      } else if (c === ',' && depth === 1) commas++;
      else if (depth === 1 && !/\s/.test(c)) hasContent = true;
    }
    if (i >= code.length) continue;
    if (hasContent) out.push({ args: commas + 1, at: m.index, snippet: code.slice(m.index, i + 1) });
    re.lastIndex = i;
  }
  return out;
}

/* ---------- القاعدة ٣: محرف البديل ---------- */

const REPLACEMENT = '\uFFFD';

/* ---------- القاعدة ٤: مفاتيح القاموس ---------- */

/** مفاتيح كائن القاموس T كما هي في المصدر */
export function dictKeys(i18nSrc: string): Set<string> {
  const keys = new Set<string>();
  const re = /^\s{2}([A-Za-z0-9_]+):\s*\{/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(i18nSrc))) keys.add(m[1]);
  return keys;
}

/** مفاتيح `t('…')` الحرفية المستعملة في مصدر معيّن */
export function usedKeys(code: string): Array<{ key: string; at: number }> {
  const out: Array<{ key: string; at: number }> = [];
  const re = /\bt\(\s*'([A-Za-z0-9_]+)'/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code))) out.push({ key: m[1], at: m.index });
  return out;
}

/* ================================================================== */
/*  ١ • نداءات L الثنائية                                              */
/* ================================================================== */

describe('عقد اللغتين — نداءات L', () => {
  it('كل L({ … }) في الصفحات والمكوّنات فيه ar و en معاً', () => {
    const problems: string[] = [];
    let checked = 0;

    for (const file of TSX_ALL) {
      const raw = read(file);
      const code = stripNoise(raw);
      for (const call of findLCalls(code)) {
        checked++;
        const missing = missingLangFields(call.args);
        if (missing.length) {
          problems.push(
            `${rel(file)}:${lineAt(raw, call.at)} — ناقص: ${missing.join(' و ')} ← ${call.args.replace(/\s+/g, ' ').slice(0, 90)}`,
          );
        }
      }
    }

    expect(checked, 'لم يُعثر على أي نداء L — الكاشف لا يعمل').toBeGreaterThan(20);
    expect(problems, `\n${problems.join('\n')}`).toEqual([]);
  });

  it('الكاشف يمسك النقص فعلاً — نداء بلا en على سطر واحد', () => {
    const found = findLCalls("L({ ar: 'فحص المحتوى' })");
    expect(found).toHaveLength(1);
    expect(missingLangFields(found[0].args)).toEqual(['en']);
  });

  it('الكاشف يمسك النقص عبر عدّة أسطر', () => {
    const found = findLCalls(`L({
      ar: 'نص طويل',
      en: \`القيمة \${x}\`,
    })`);
    expect(found).toHaveLength(1);
    expect(missingLangFields(found[0].args)).toEqual([]);
  });
});

/* ================================================================== */
/*  ٢ • دالة S الثنائية                                                */
/* ================================================================== */

describe('عقد اللغتين — دالة S', () => {
  it('كل S(…) لها معاملان: العربي والإنجليزي', () => {
    const problems: string[] = [];
    let checked = 0;

    for (const file of TSX_ALL) {
      const raw = read(file);
      const code = stripNoise(raw);
      for (const call of findSCalls(code)) {
        checked++;
        if (call.args < 2) {
          problems.push(`${rel(file)}:${lineAt(raw, call.at)} — معاملات: ${call.args} ← ${call.snippet.replace(/\s+/g, ' ').slice(0, 90)}`);
        }
      }
    }

    expect(checked, 'لم يُعثر على أي نداء S — الكاشف لا يعمل').toBeGreaterThan(20);
    expect(problems, `\n${problems.join('\n')}`).toEqual([]);
  });

  it('الكاشف يميّز النداء الكامل من الناقص', () => {
    expect(findSCalls("S('تم', 'Done')")[0].args).toBe(2);
    expect(findSCalls("S('تم')")[0].args).toBe(1);
  });

  it('فاصلة داخل القالب النصي لا تُحسب معاملاً', () => {
    expect(findSCalls("S(`${a}, ${b}`, 'x, y')")[0].args).toBe(2);
  });
});

/* ================================================================== */
/*  ٣ · محرف البديل                                                    */
/* ================================================================== */

describe('عقد اللغتين — سلامة الترميز', () => {
  it('لا محرف بديل U+FFFD في أي ملف مصدر', () => {
    const problems: string[] = [];
    for (const file of walk(SRC, TS)) {
      const raw = read(file);
      let idx = raw.indexOf(REPLACEMENT);
      while (idx !== -1) {
        problems.push(`${rel(file)}:${lineAt(raw, idx)}`);
        idx = raw.indexOf(REPLACEMENT, idx + 1);
      }
    }
    expect(problems, `\n${problems.join('\n')}`).toEqual([]);
  });
});

/* ================================================================== */
/*  ٤ · مفاتيح القاموس المستعملة                                      */
/* ================================================================== */

describe('عقد اللغتين — تماسك القاموس', () => {
  const keys = dictKeys(read(path.join(SRC, 'i18n', 'index.ts')));

  it('القاموس لم يتغيّر شكله — عدد المفاتيح معقول', () => {
    expect(keys.size, 'القاموس فارغ أو تغيّر شكله').toBeGreaterThan(100);
  });

  it('كل مفتاح t(…) في الصفحات والمكوّنات موجود في القاموس', () => {
    const problems: string[] = [];
    let checked = 0;

    for (const file of TSX_ALL) {
      const raw = read(file);
      const code = stripNoise(raw);
      for (const { key, at } of usedKeys(code)) {
        checked++;
        if (!keys.has(key)) problems.push(`${rel(file)}:${lineAt(raw, at)} — مفتاح غير معروف: '${key}'`);
      }
    }

    expect(checked, 'لم يُعثر على أي نداء t — الكاشف لا يعمل').toBeGreaterThan(100);
    expect(problems, `\n${problems.join('\n')}`).toEqual([]);
  });

  it('كل قيمة في القاموس فيها اللغتان — لا فراغ ولا حقل ناقص', () => {
    const raw = read(path.join(SRC, 'i18n', 'index.ts'));
    const problems: string[] = [];
    // كل مدخل: `key: { ar: '…', en: '…' }` على سطر أو عدّة أسطر
    const re = /^\s{2}([A-Za-z0-9_]+):\s*\{/gm;
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw))) {
      const open = raw.indexOf('{', m.index);
      const close = raw.indexOf('\n  }', open);
      const body = raw.slice(open, close === -1 ? raw.length : close).replace(/\s+/g, ' ');
      const okAr = /(^|[{\s,])ar\s*:\s*(['`])([^'`]+)\2/.test(body);
      const okEn = /(^|[{\s,])en\s*:\s*(['`])([^'`]+)\2/.test(body);
      if (!okAr || !okEn) {
        problems.push(`src/i18n/index.ts — '${m[1]}' ناقص: ${[okAr ? '' : 'ar', okEn ? '' : 'en'].filter(Boolean).join(' و ')}`);
      }
    }
    expect(problems, `\n${problems.join('\n')}`).toEqual([]);
  });

  it('المفاتيح الثلاثة التي حُذفت مع بياناتها لا ترجع — فجوة بلا مصدر', () => {
    // كانت في القاموس بلا مجموعة أذكار يقابلها في src/data/adhkar.ts
    for (const gone of ['atHome', 'rain', 'quranDhikr']) {
      expect(keys.has(gone), `'${gone}' عاد بلا بيانات`).toBe(false);
    }
  });
});
