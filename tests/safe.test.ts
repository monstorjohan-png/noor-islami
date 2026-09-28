/**
 * اختبارات حارس المدخلات.
 * كل دالة في `safe` خالصة، وهذا ما يجعلها قابلة للاختبار.
 * القاعدة: كل تعداد أدناه يجب أن يمرّ على نفس دالة الحارس،
 * وإلا بقيت الحماية بلا اختبار يسقط عليها.
 * تُشغَّل: npx vitest run
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import {
  assertDataPath,
  clamp,
  isDataPath,
  isSafeKey,
  newToken,
  safeAssign,
  safeExternalUrl,
  safeInt,
  stripDangerKeys,
} from '../src/lib/safe';

const DATA = path.resolve(__dirname, '../public/data');

/** تعداد ملفات البيانات الفعلي على القرص */
function actualDataFiles(): string[] {
  const out: string[] = [];
  const walk = (rel: string) => {
    for (const name of readdirSync(path.join(DATA, rel))) {
      const r = rel ? `${rel}/${name}` : name;
      if (statSync(path.join(DATA, r)).isDirectory()) walk(r);
      else if (name.endsWith('.json')) out.push(r);
    }
  };
  walk('');
  return out;
}

describe('حارس مسارات الملفات', () => {
  it('يقبل المسارات الحقيقية داخل مجلد البيانات', () => {
    expect(isDataPath('quran/surahs.json')).toBe(true);
    expect(isDataPath('quran/surah/2.json')).toBe(true);
    expect(isDataPath('quran/shards/000.json')).toBe(true);
    expect(isDataPath('hadith/bukhari.json')).toBe(true);
  });

  it('يرفض الخروج من المجلد', () => {
    const bad = [
      '../secrets.json',
      'quran/../../etc/passwd',
      'quran/../../../package.json',
      'quran/..',
      '/etc/passwd',
      '/quran/surahs.json',
      '//evil.com/x.json',
    ];
    for (const p of bad) expect(isDataPath(p), `يجب رفض: ${p}`).toBe(false);
  });

  it('يرفض الفواصل والشرطات المائلة العكسية والترويسات', () => {
    const bad = [
      'quran\\surahs.json',
      'quran/surahs.json?x=1',
      'quran/surahs.json#a',
      'quran/surahs.json%00.png',
      'https://evil.com/x.json',
      'data:text/html,x',
      'quran//surahs.json',
    ];
    for (const p of bad) expect(isDataPath(p), `يجب رفض: ${p}`).toBe(false);
  });

  it('يرفض الأحرف الكبيرة والمسافات والامتدادات الأخرى', () => {
    const bad = ['quran/Surahs.json', 'quran/su rahs.json', 'quran/surahs.js', 'quran/surahs'];
    for (const p of bad) expect(isDataPath(p), `يجب رفض: ${p}`).toBe(false);
  });

  it('يرفض المسار الفارغ والطويل جداً', () => {
    expect(isDataPath('')).toBe(false);
    expect(isDataPath(`quran/${'a'.repeat(300)}.json`)).toBe(false);
  });

  it('كل ملف بيانات حقيقي على القرص يمرّ على الحارس', () => {
    const files = actualDataFiles();
    expect(files.length).toBeGreaterThan(100);
    const rejected = files.filter((f) => !isDataPath(f));
    expect(rejected, `ملفات يرفضها الحارس: ${rejected.join(', ')}`).toEqual([]);
  });

  it('assertDataPath تُرجع المسار الصحيح وترمي عند الشذوذ', () => {
    expect(assertDataPath('quran/surahs.json')).toBe('quran/surahs.json');
    expect(() => assertDataPath('../x.json')).toThrow();
    expect(() => assertDataPath(undefined)).toThrow();
    expect(() => assertDataPath(null)).toThrow();
    expect(() => assertDataPath(42)).toThrow();
  });
});

describe('حارس الأعداد', () => {
  it('يقبل الأعداد الصحيحة داخل المدى ويرفض ما دونه', () => {
    expect(safeInt(5)).toBe(5);
    expect(safeInt('7')).toBe(7);
    expect(safeInt(0)).toBe(0);
    expect(safeInt(1, 1, 114)).toBe(1);
    expect(safeInt(114, 1, 114)).toBe(114);
  });

  it('يرفض الكسور وما لا نهاية والقيم خارج المدى', () => {
    expect(safeInt(1.5)).toBeNull();
    expect(safeInt(NaN)).toBeNull();
    expect(safeInt(Infinity)).toBeNull();
    expect(safeInt(-1)).toBeNull();
    expect(safeInt(0, 1, 114)).toBeNull();
    expect(safeInt(115, 1, 114)).toBeNull();
    expect(safeInt(null)).toBeNull();
    expect(safeInt({})).toBeNull();
    expect(safeInt('abc')).toBeNull();
    expect(safeInt(2 ** 53 + 1)).toBeNull();
  });

  it('clamp يحدّ بلا كسر', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(99, 0, 10)).toBe(10);
    expect(clamp(NaN, 2, 10)).toBe(2);
  });
});

describe('حارس مفاتيح الكائنات', () => {
  it('يرفض مفاتيح تلوّث النماذج الأولية', () => {
    for (const k of ['__proto__', 'constructor', 'prototype']) {
      expect(isSafeKey(k), `يجب رفض: ${k}`).toBe(false);
    }
    expect(isSafeKey('')).toBe(false);
    expect(isSafeKey(5)).toBe(false);
    expect(isSafeKey('dhikr-1')).toBe(true);
  });

  it('stripDangerKeys يحذف المفاتيح الخطرة ويحفظ السليمة', () => {
    const src = JSON.parse('{"__proto__":{"polluted":true},"ok":1,"constructor":2}');
    const out = stripDangerKeys<number>(src);
    expect(out).toEqual({ ok: 1 });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('stripDangerKeys يتحمّل القيم غير الكائنية', () => {
    expect(stripDangerKeys(null)).toEqual({});
    expect(stripDangerKeys('x')).toEqual({});
    expect(stripDangerKeys([1, 2])).toEqual({});
    expect(stripDangerKeys(undefined)).toEqual({});
  });

  it('safeAssign لا يكتب على النماذج الأولية', () => {
    const o: Record<string, number> = {};
    safeAssign(o, '__proto__', 1);
    // الرفض صحيح: لا خاصية خاصة أُنشئت، والنمط الأولي كما هو
    expect(Object.hasOwn(o, '__proto__')).toBe(false);
    expect(Object.getPrototypeOf(o)).toBe(Object.prototype);
    safeAssign(o, 'good', 2);
    expect(o.good).toBe(2);
  });
});

describe('روابط ومفاتيح', () => {
  it('يقبل روابط https فقط', () => {
    expect(safeExternalUrl('https://example.com/a')).toBe('https://example.com/a');
    expect(safeExternalUrl('http://example.com/a')).toBeNull();
    expect(safeExternalUrl('javascript:alert(1)')).toBeNull();
    expect(safeExternalUrl('data:text/html,x')).toBeNull();
    expect(safeExternalUrl('لا رابط')).toBeNull();
  });

  it('newToken عشوائي آمن وطوله مضاعف ستة عشر', () => {
    const a = newToken();
    const b = newToken();
    expect(a).toHaveLength(48);
    expect(a).not.toBe(b);
    expect(/^[0-9a-f]{48}$/.test(a)).toBe(true);
    expect(newToken(8)).toHaveLength(16);
  });
});
