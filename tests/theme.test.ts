/**
 * اختبارات لوحات الألوان.
 * ------------------------------------------------------------------
 * اللوحة رقمٌ داخل متغيّر تنسيق، فاحتمال الانحراف فيها كبير: أن تُكتب
 * قيمة في ملف الأنماط وتُنسى في جدول المصدر، أو أن يدخل معرّفٌ جديد
 * بلا متغيّر، أو أن تُغمَّق لوحةٌ فتضيع عناية الوصول.
 *
 * لذا يقيس هذا الملف ثلاثة أشياء:
 *   ١ • الحارس: معرّف فاسد لا يلوّث التطبيق، ولا يرمي استثناءً.
 *   ٢ • التزام المصدر: جدول القنوات مطابق حرفياً لملف الأنماط.
 *   ٣ • التباين: نصٌّ فوق خلفيته لا ينزل عن ٤٫٥:١، واللوحات الداكنة
 *      الجديدة ليست أسوأ من التي كانت.
 *
 * يُشغَّل: npx vitest run tests/theme.test.ts
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  applyPalette,
  DEFAULT_PALETTE,
  isPalette,
  PALETTES,
  PALETTE_IDS,
  PALETTE_VARS,
  paletteVars,
  VAR_NAMES,
} from '../src/lib/theme';
import type { PaletteId, PaletteVars } from '../src/lib/theme';

const CSS_PATH = path.resolve(__dirname, '../src/styles/index.css');
const STORE_PATH = path.resolve(__dirname, '../src/lib/store.ts');
const HOOKS_PATH = path.resolve(__dirname, '../src/lib/hooks.ts');
const CSS = readFileSync(CSS_PATH, 'utf8');
const STORE_SRC = readFileSync(STORE_PATH, 'utf8');
const HOOKS_SRC = readFileSync(HOOKS_PATH, 'utf8');

/* ---------- أدوات التباين ---------- */

const channel = (v: string): [number, number, number] => {
  const p = v.split(' ').map(Number);
  return [p[0], p[1], p[2]];
};

const linear = (c: number): number => {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
};

const luminance = (v: string): number => {
  const [r, g, b] = channel(v);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
};

/** نسبة التباين كما يعرّفها معيار إتاحة المحتوى */
const contrast = (a: string, b: string): number => {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

/** لونٌ بشفافية فوق لون — كما يركّبها المتصفّح */
const over = (fg: string, alpha: number, bg: string): string =>
  channel(fg)
    .map((c, i) => Math.round(c * alpha + channel(bg)[i] * (1 - alpha)))
    .join(' ');

/* ---------- قراءة ملف الأنماط ---------- */

type Block = Record<string, string>;

/** كتلة CSS واحدة باسم متغيّراتها، أو فارغة إن لم توجد */
function cssBlock(selector: string, mustContain: string): Block {
  const at = CSS.indexOf(selector);
  const open = CSS.indexOf('{', at);
  if (at < 0 || open < 0) return {};
  const close = CSS.indexOf('}', open);
  if (close < 0) return {};
  const body = CSS.slice(open + 1, close);
  if (!body.includes(mustContain)) return {};
  const out: Block = {};
  for (const m of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

const rootVars = cssBlock(':root', '--ink-900');

/* ---------- معطيات التباين من استعمال التطبيق الحقيقي ---------- */

/** سطح البطاقة: ink-800 بشفافية ٧٠٪ فوق خلفية الصفحة */
const cardBg = (v: PaletteVars): string => over(v['--ink-800'], 0.7, v['--ink-900']);
/** سطح الحقل والقائمة: ink-700 */
const fieldBg = (v: PaletteVars): string => v['--ink-700'];
/** خلفية الرقعة الذهبية: gold-400 بشفافية ١٥٪ فوق البطاقة */
const chipBg = (v: PaletteVars): string => over(v['--gold-400'], 0.15, cardBg(v));
/** شريط التنبيه الكهرماني: ٥٪ من كهرماني تيلويند فوق الخلفية */
const noteBg = (v: PaletteVars): string => over('245 158 11', 0.05, v['--ink-900']);

/** نصٌّ أساسي: الحدّ الذي يشترطه العقد ٤٫٥:١ */
const PRIMARY: Array<[string, (v: PaletteVars) => string, (v: PaletteVars) => string]> = [
  ['متن الصفحة ١٠٠', (v) => v['--slate-100'], (v) => v['--ink-900']],
  ['نصّ البطاقة ٢٠٠', (v) => v['--slate-200'], cardBg],
  ['نصّ البطاقة ٣٠٠', (v) => v['--slate-300'], cardBg],
  ['كبسولة ٣٠٠', (v) => v['--slate-300'], (v) => over(v['--ink-800'], 0.7, v['--ink-900'])],
  ['نصّ داخل الحقل ١٠٠', (v) => v['--slate-100'], fieldBg],
  ['نصّ داخل الحقل ٢٠٠', (v) => v['--slate-200'], fieldBg],
  ['الزر الأساسي', (v) => v['--ink-900'], (v) => v['--gold-400']],
  ['الزر عند المرور', (v) => v['--ink-900'], (v) => v['--gold-300']],
  ['شعار التطبيق', (v) => v['--ink-900'], (v) => v['--gold-300']],
  ['نصّ ذهبي ١٠٠', (v) => v['--gold-100'], (v) => v['--ink-900']],
  ['نصّ ذهبي ٣٠٠', (v) => v['--gold-300'], (v) => v['--ink-900']],
  ['نصّ ذهبي ٤٠٠', (v) => v['--gold-400'], (v) => v['--ink-900']],
  ['شارة ذهبية', (v) => v['--gold-200'], chipBg],
  ['تظليل الآية', (v) => v['--gold-100'], (v) => over(v['--gold-400'], 0.3, v['--ink-900'])],
  ['كبسولة عائمة', (v) => v['--gold-100'], (v) => over(v['--ink-700'], 0.95, v['--ink-900'])],
  ['نصّ أخضر ٤٠٠', (v) => v['--emerald-400'], (v) => v['--ink-900']],
  ['أبيض على الأخضر', () => '255 255 255', (v) => v['--emerald-600']],
  ['تنبيه كهرماني ٢٠٠', (v) => v['--amber-200'], noteBg],
  ['رسالة ذهبية ٣٠٠', (v) => v['--amber-300'], (v) => v['--ink-900']],
  ['تنبيه ذهبي ٤٠٠', (v) => v['--amber-400'], (v) => v['--ink-900']],
  ['خطأ وردي ٣٠٠', (v) => v['--rose-300'], (v) => v['--ink-900']],
  ['خطر وردي ٢٠٠', (v) => v['--rose-200'], (v) => over('244 63 94', 0.15, cardBg(v))],
];

/**
 * نصوصٌ ثانوية كانت في التطبيق قبل اللوحات ولم يبلغ تباينها ٤٫٥.
 * ما نحرسه هنا ليس الرقم المطلق بل الشرط: ألّا تسوء بلوحة جديدة،
 * وألّا تسوء في «نور» نفسها إلا بتغيير متعمَّد مكتوب في هذا الملف.
 */
const SECONDARY: Array<[string, (v: PaletteVars) => string, (v: PaletteVars) => string, number]> = [
  ['نصّ خافت ٤٠٠', (v) => v['--slate-400'], (v) => v['--ink-900'], 3.9],
  ['نصّ خافت ٥٠٠', (v) => v['--slate-500'], (v) => v['--ink-900'], 3.9],
  ['نصّ خافت ٦٠٠', (v) => v['--slate-600'], (v) => v['--ink-900'], 2.4],
];

/* ---------- الحارس ---------- */

describe('حارس معرّفات اللوحات', () => {
  it('يقبل اللوحات الخمس المعلنة', () => {
    for (const p of PALETTES) expect(isPalette(p.id)).toBe(true);
    expect(PALETTE_IDS.size).toBe(5);
  });

  it('يرفض ما ليس لوحةً', () => {
    const bad = ['', 'Noor', 'NOOR', 'noor ', 'noor\n', 'blue', 'cuts', 'sand2', '0'];
    for (const v of bad) expect(isPalette(v)).toBe(false);
    for (const v of [null, undefined, 0, 1, true, false, {}, [], ['noor'], Symbol('noor')]) {
      expect(isPalette(v)).toBe(false);
    }
  });

  it('لا ينفتح على مفاتيح النماذج الأولية', () => {
    for (const v of ['__proto__', 'constructor', 'toString', 'hasOwnProperty']) {
      expect(isPalette(v)).toBe(false);
    }
  });
});

/* ---------- جدول القنوات ---------- */

describe('جدول القنوات', () => {
  it('يسمّي كل متغيّر مرة واحدة', () => {
    expect(new Set(VAR_NAMES).size).toBe(VAR_NAMES.length);
    expect(Object.keys(PALETTE_VARS[DEFAULT_PALETTE]).sort()).toEqual([...VAR_NAMES].sort());
  });

  it('يكتب كل متغيّر ثلاث قنوات لا لوناً كاملاً', () => {
    for (const id of PALETTE_IDS) {
      for (const name of VAR_NAMES) {
        const v = PALETTE_VARS[id][name];
        expect(v, `${id} ${name}`).toMatch(/^\d{1,3} \d{1,3} \d{1,3}$/);
        for (const c of channel(v)) expect(c).toBeGreaterThanOrEqual(0) && expect(c).toBeLessThanOrEqual(255);
      }
    }
  });

  it('paletteVars يعيد نسخة لا الأصل، ويتراجع للافتراضية عند الخلل', () => {
    const copy = paletteVars('emerald');
    copy['--ink-900'] = '0 0 0';
    expect(PALETTE_VARS.emerald['--ink-900']).not.toBe('0 0 0');
    expect(paletteVars('cuts' as PaletteId)).toEqual(PALETTE_VARS[DEFAULT_PALETTE]);
  });
});

/* ---------- التطبيق على الجذر ---------- */

/** مستند وهمي يكفي لالتقاط ما تفعله اللوحة */
function fakeDoc() {
  const state = { palette: '', meta: '' };
  return {
    state,
    document: {
      documentElement: {
        dataset: {
          set palette(v: string) { state.palette = v; },
          get palette() { return state.palette; },
        },
      },
      querySelector: () => ({ set content(v: string) { state.meta = v; }, get content() { return state.meta; } }),
    } as unknown as Document,
  };
}

function withDocument(doc: Document | undefined, fn: () => void): void {
  const g = globalThis as { document?: Document };
  const prev = Object.prototype.hasOwnProperty.call(g, 'document') ? g.document : undefined;
  if (doc === undefined) delete g.document;
  else g.document = doc;
  try {
    fn();
  } finally {
    if (prev === undefined) delete g.document;
    else g.document = prev;
  }
}

describe('تثبيت اللوحة على الجذر', () => {
  it('لا يفعل شيئاً ولا يرمي بلا مستند', () => {
    withDocument(undefined, () => {
      expect(() => applyPalette('sand')).not.toThrow();
    });
  });

  it('يكتب سمة اللوحة على الجذر', () => {
    const f = fakeDoc();
    withDocument(f.document, () => {
      applyPalette('plum');
      expect(f.state.palette).toBe('plum');
      applyPalette('sand');
      expect(f.state.palette).toBe('sand');
    });
  });

  it('يتبع لون شريط الحالة في الجوال لون اللوحة', () => {
    const f = fakeDoc();
    withDocument(f.document, () => {
      applyPalette('noor');
      expect(f.state.meta).toBe('#0b1220');
      applyPalette('sand');
      expect(f.state.meta).toBe('#f7f3ea');
    });
  });

  it('لوحة فاسدة أو مستند يرمي: لا استثناء', () => {
    const f = fakeDoc();
    withDocument(f.document, () => {
      applyPalette('cuts' as PaletteId);
      expect(f.state.palette).toBe(DEFAULT_PALETTE);
    });
    const broken = {
      get documentElement(): never {
        throw new Error('لا مستند');
      },
    } as unknown as Document;
    withDocument(broken, () => {
      expect(() => applyPalette('royal')).not.toThrow();
    });
  });
});

/* ---------- التزام ملف الأنماط ---------- */

describe('التزام ملف الأنماط بجدول القنوات', () => {
  it('الجذر يحمل قيم «نور» حرفياً كما كانت في الإعداد', () => {
    // ١٨ قيمة كانت مُعرَّفة في إعداد تيلويند، ولا يحقّ تغيير رقم فيها
    const configured: Record<string, string> = {
      '--ink-400': '91 108 146', '--ink-500': '51 69 107', '--ink-600': '36 51 82',
      '--ink-700': '26 39 64', '--ink-800': '17 27 46', '--ink-900': '11 18 32',
      '--gold-50': '253 248 236', '--gold-100': '250 240 212', '--gold-200': '243 223 168',
      '--gold-300': '233 200 119', '--gold-400': '221 176 75', '--gold-500': '201 153 47',
      '--gold-600': '169 124 36', '--gold-700': '133 95 31',
      '--emerald-400': '52 191 154', '--emerald-500': '23 163 127',
      '--emerald-600': '18 134 106', '--emerald-700': '15 107 82',
    };
    for (const [k, v] of Object.entries(configured)) expect(rootVars[k], k).toBe(v);
  });

  it('الجذر لا ينقصه متغيّر ولا يزيده', () => {
    expect(Object.keys(rootVars).sort()).toEqual([...VAR_NAMES].sort());
  });

  it('كل لوحة تُعرَّف في الملف بقيم جدولها حرفياً', () => {
    for (const p of PALETTES) {
      const block = p.id === DEFAULT_PALETTE ? rootVars : cssBlock(`[data-palette='${p.id}']`, '--ink-900');
      expect(Object.keys(block).sort(), p.id).toEqual([...VAR_NAMES].sort());
      for (const name of VAR_NAMES) expect(block[name], `${p.id} ${name}`).toBe(PALETTE_VARS[p.id][name]);
    }
  });

  it('لوحة لكل معرّف، ولا معرّف بلا لوحة', () => {
    for (const p of PALETTES) {
      if (p.id === DEFAULT_PALETTE) continue;
      expect(CSS, p.id).toContain(`[data-palette='${p.id}']`);
    }
  });

  it('اللوحة الفاتحة تعلن نظام الألوان الفاتح لنظام التشغيل', () => {
    expect(CSS).toMatch(/\[data-palette='sand'\]\s*\{[^}]*color-scheme:\s*light/);
  });

  it('لا لون مدموج صلب داخل الملف — كله عبر المتغيّرات', () => {
    expect(CSS).not.toMatch(/rgba?\(\s*\d/);
  });
});

/* ---------- تباين النصّ ---------- */

describe('تباين النصّ في كل لوحة', () => {
  for (const p of PALETTES) {
    it(`${p.id}: النصوص الأساسية فوق ٤٫٥:١`, () => {
      const v = PALETTE_VARS[p.id];
      for (const [label, fg, bg] of PRIMARY) {
        expect(contrast(fg(v), bg(v)), `${p.id} — ${label}`).toBeGreaterThanOrEqual(4.5);
      }
    });

    it(`${p.id}: اللوحة الفاتحة تُصلح الشفافية التي تُنزل النصّ`, () => {
      if (p.id !== 'sand') return;
      // هذه.classes تُصلَح بقواعد خارج الطبقات، فنتحقق من وجودها ومن نتيجتها
      const fixed: Array<[string, string]> = [
        ['.text-gold-300\\/80', '--gold-300'],
        ['.text-gold-500\\/70', '--gold-500'],
        ['.text-amber-200\\/60', '--amber-200'],
        ['.text-amber-200\\/90', '--amber-200'],
        ['.text-amber-300\\/90', '--amber-300'],
        ['.text-rose-100\\/90', '--rose-100'],
      ];
      const v = PALETTE_VARS[p.id];
      for (const [sel, name] of fixed) {
        expect(CSS, sel).toContain(sel);
        expect(contrast(v[name], v['--ink-900']), sel).toBeGreaterThanOrEqual(4.5);
      }
      // والأبيض فوق الأخضر يبقى أبيضاً في هذه اللوحة وحدها
      expect(CSS).toMatch(/\[data-palette='sand'\]\s+\.bg-emerald-500\.text-white[\s\S]*?color:\s*#fff/);
      expect(CSS.match(/color:\s*#fff/g) ?? []).toHaveLength(1);
    });
  }

  it('اللوحات الجديدة ليست أسوأ من «نور» في النصوص الثانوية', () => {
    const base = PALETTE_VARS[DEFAULT_PALETTE];
    for (const p of PALETTES) {
      if (p.id === DEFAULT_PALETTE) continue;
      const v = PALETTE_VARS[p.id];
      for (const [label, fg, bg, min] of SECONDARY) {
        expect(contrast(fg(v), bg(v)), `${p.id} — ${label}`).toBeGreaterThanOrEqual(
          Math.min(min, contrast(fg(base), bg(base))),
        );
      }
    }
  });

  it('«نور» لم تتدهور عن أرقامها المعروفة', () => {
    const v = PALETTE_VARS[DEFAULT_PALETTE];
    const s400 = contrast(v['--slate-400'], v['--ink-900']);
    const s500 = contrast(v['--slate-500'], v['--ink-900']);
    expect(s400).toBeGreaterThanOrEqual(3.9);
    expect(s500).toBeGreaterThanOrEqual(3.9);
  });
});

/* ---------- التكامل مع الحالة ---------- */

describe('تكامل اللوحة مع المخزن', () => {
  it('الحقل في المواضع الأربعة: الافتراضي، التنقية، الحفظ، النسخة', () => {
    expect(STORE_SRC).toMatch(/palette:\s*DEFAULT_PALETTE/);
    expect(STORE_SRC).toMatch(/palette:\s*isPalette\(p\.palette\)\s*\?\s*p\.palette\s*:\s*DEFAULT_PALETTE/);
    expect(STORE_SRC).toMatch(/palette:\s*s\.palette/);
    // رفع النسخة يمسح إعدادات المستخدم بصمت، فغير مسموح
    expect(STORE_SRC).toMatch(/version:\s*1\b/);
    expect(STORE_SRC).not.toMatch(/version:\s*[2-9]/);
  });

  it('الخطّاف يطبّق اللوحة ويعيد التنفيذ عند تغيّرها', () => {
    expect(HOOKS_SRC).toMatch(/applyPalette\(palette\)/);
    expect(HOOKS_SRC).toMatch(/\}, \[theme, lang, palette\]\)/);
  });

  it('اللوحة تُثبَّت عند إنشاء المخزن لا عند أول رسم', () => {
    // التخزين المحلي يُقرأ متزامناً فيُعرف الاختيار قبل paint
    expect(STORE_SRC).toMatch(/applyPalette\(useSettings\.getState\(\)\.palette\)/);
  });
});
