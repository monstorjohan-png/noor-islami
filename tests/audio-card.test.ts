/**
 * اختبارات وحدات التلاوة وبطاقة الآية.
 * تتحقق من العقود لا من الشبكة: الروابط تُبنى ولا تُنزَّل.
 */
import { describe, it, expect } from 'vitest';
import {
  RECITERS,
  SURAH_RECITERS,
  ayahAudioUrl,
  hasSurahAudio,
  surahAudioUrl,
  DEFAULT_RECITER_ID,
} from '../src/lib/audio';
import { cardFileName } from '../src/lib/card';
import { dailyAyahIndex } from '../src/lib/notifications';

describe('روابط التلاوة', () => {
  it('القارئ الافتراضي ضمن القائمة', () => {
    expect(RECITERS.map((r) => r.id)).toContain(DEFAULT_RECITER_ID);
  });

  it('كل قارئ له اسم عربي ولاتيني', () => {
    for (const r of RECITERS) {
      expect(r.ar.length).toBeGreaterThan(3);
      expect(r.en.length).toBeGreaterThan(3);
      // معرّف واحد لا يحمل مسافة ولا حرفاً عربياً
      expect(r.id).toMatch(/^[a-z.]+$/);
    }
  });

  it('رابط السورة يشير لملف mp3 واحد', () => {
    const u = surahAudioUrl('ar.alafasy', 114);
    expect(u).toBe('https://cdn.islamic.network/quran/audio-surah/128/ar.alafasy/114.mp3');
  });

  it('رابط الآية مفهرس من واحد لا من صفر', () => {
    // أول آية في المصحف = 1 لا 0
    expect(ayahAudioUrl('ar.alafasy', 0)).toMatch(/\/1\.mp3$/);
    expect(ayahAudioUrl('ar.alafasy', 6235)).toMatch(/\/6236\.mp3$/);
  });

  it('كل قارئ له ملف سورة أو لا شيء — لا رابط ميت', () => {
    // ملف السورة موجود لثلاثة قرّاء فقط. من لا ملف له يعيد `null`،
    // لأن بناء رابط لملف غير موجود يعني رابطاً ميتاً يُعرض للمستخدم.
    for (const r of RECITERS) {
      const u = surahAudioUrl(r.id, 1);
      if (hasSurahAudio(r.id)) {
        expect(u).toBeTruthy();
        expect(u).toContain(`/${r.id}/`);
      } else {
        expect(u).toBeNull();
      }
    }
  });

  it('كل القرّاء لهم ملف آية برابط مختلف', () => {
    const urls = RECITERS.map((r) => ayahAudioUrl(r.id, 1));
    expect(new Set(urls).size).toBe(RECITERS.length);
  });

  it('لكل قارئ معدل آية معرّف', () => {
    for (const r of RECITERS) {
      expect([64, 128]).toContain(r.ayahRate);
    }
  });

  it('معدّل السورة يُذكر صراحة للقرّاء الذين لهم ملف', () => {
    for (const r of SURAH_RECITERS) {
      expect([64, 128]).toContain((r as { surahRate: number }).surahRate);
    }
  });

  it('معرّف قارئ غير معروف لا يصل إلى الرابط', () => {
    // القارئ يأتي من التخزين المحلي بعد إعادة الترطيب، فقد يكون محرَّباً.
    // لا يُدرج في الرابط أبداً — نرجع للقارئ الافتراضي.
    const u = surahAudioUrl('ar.unknown' as never, 1);
    expect(u).not.toContain('ar.unknown');
    expect(u).toBe(surahAudioUrl(DEFAULT_RECITER_ID, 1));
    expect(ayahAudioUrl('ar.unknown' as never, 1)).toBe(ayahAudioUrl(DEFAULT_RECITER_ID, 1));
  });

  it('رقم سورة أو آية شاذّ لا يصل إلى الرابط', () => {
    // من URL مباشرة: قيم خارج المدى تُقصَّى إلى الحد الأقرب
    for (const bad of [0, -5, 115, 1e9, NaN, 1.5]) {
      expect(surahAudioUrl('ar.alafasy', bad)).toBe(surahAudioUrl('ar.alafasy', 1));
    }
    expect(ayahAudioUrl('ar.alafasy', -1)).toBe(ayahAudioUrl('ar.alafasy', 0));
    expect(ayahAudioUrl('ar.alafasy', NaN)).toMatch(/\/1\.mp3$/);
  });

  it('كل روابط القرّاء على مضيف التلاوة وحده', () => {
    for (const r of RECITERS) {
      const u = surahAudioUrl(r.id, 1);
      const list: string[] = [ayahAudioUrl(r.id, 1)];
      if (u) list.push(u);
      for (const link of list) {
        expect(new URL(link).host).toBe('cdn.islamic.network');
        expect(new URL(link).protocol).toBe('https:');
      }
    }
  });
});

describe('اسم ملف البطاقة', () => {
  it('يحوي اسم السورة ورقمها', () => {
    const name = cardFileName({
      text: 'بسم الله',
      surah: 'الفاتحة',
      surahNo: 1,
      ayahNo: 1,
    });
    expect(name).toBe('noor-الفاتحة-1-1.png');
  });

  it('يزيل المحارف غير الصالحة في اسم الملف', () => {
    const name = cardFileName({
      text: 'x',
      surah: 'سورة / الناس؟',
      surahNo: 114,
      ayahNo: 6,
    });
    expect(name).toMatch(/^noor-[\p{L}\p{N}-]+-114-6\.png$/u);
  });
});

describe('آية اليوم والتذكير', () => {
  it('نفس اليوم يعطي نفس الآية', () => {
    const a = dailyAyahIndex(new Date(2026, 1, 18));
    const b = dailyAyahIndex(new Date(2026, 1, 18, 23, 59));
    expect(a).toBe(b);
  });

  it('لا يخرج عن نطاق المصحف في سنة كاملة', () => {
    const seen = new Set<number>();
    for (let d = 0; d < 366; d++) {
      const date = new Date(2026, 0, 1 + d);
      const i = dailyAyahIndex(date);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(6236);
      seen.add(i);
    }
    // التوزيع منتظم: كل يوم موضع مختلف
    expect(seen.size).toBe(366);
  });

  it('يتغيّر بتغيّر اليوم', () => {
    expect(dailyAyahIndex(new Date(2026, 1, 18))).not.toBe(
      dailyAyahIndex(new Date(2026, 1, 19)),
    );
  });
});
