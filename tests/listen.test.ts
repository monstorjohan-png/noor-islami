/**
 * اختبارات التنقية والتقييم في lib/listen — دوال نقية بلا نموذج.
 * التشغيل: npx vitest run tests/listen.test.ts
 */
import { describe, it, expect } from 'vitest';
import {
  normalizeArabic,
  tokenizeArabic,
  lcsMatch,
  scoreTranscript,
  gradeFromPct,
} from '../src/lib/listen';

describe('normalizeArabic', () => {
  it('removes tashkeel, tatweel and Quranic pause markers', () => {
    expect(normalizeArabic('قُلْ هُوَ ٱللَّهُ أَحَدٌ')).toBe('قل هو الله احد');
    expect(normalizeArabic('بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ')).toBe('بسم الله الرحمن الرحيم');
  });

  it('unifies alef variants, alef maqsurah, ta marbuta, hamza on waw/ya', () => {
    expect(normalizeArabic('آمن')).toBe('امن');
    expect(normalizeArabic('إبراهيم')).toBe('ابراهيم');
    expect(normalizeArabic('هدى')).toBe('هدي');
    expect(normalizeArabic('رحمة')).toBe('رحمه');
    expect(normalizeArabic('مؤمن')).toBe('مومن');
    expect(normalizeArabic('مئذنة')).toBe('ميذنه');
  });

  it('strips digits, latin letters and punctuation', () => {
    expect(normalizeArabic('﴿١. قرآن كريم ABC﴾ ؟!')).toBe('قران كريم');
  });

  it('collapses whitespace', () => {
    expect(normalizeArabic('  قل   هو\nالله  أحد  ')).toBe('قل هو الله احد');
  });
});

describe('tokenizeArabic', () => {
  it('splits into words and drops empties', () => {
    expect(tokenizeArabic('قل هو الله أحد')).toEqual(['قل', 'هو', 'الله', 'احد']);
    expect(tokenizeArabic('   ')).toEqual([]);
  });
});

describe('lcsMatch', () => {
  it('matches common ordered subsequence', () => {
    const { matched, missing } = lcsMatch(['a', 'b', 'c', 'd'], ['a', 'c', 'd']);
    expect(matched).toEqual(['a', 'c', 'd']);
    expect(missing).toEqual(['b']);
  });

  it('handles disjoint sequences', () => {
    const { matched, missing } = lcsMatch(['x', 'y'], ['p', 'q']);
    expect(matched).toEqual([]);
    expect(missing).toEqual(['x', 'y']);
  });

  it('handles got superset', () => {
    const { matched, missing } = lcsMatch(['الله', 'احد'], ['و', 'قل', 'الله', 'ال', 'احد']);
    expect(matched).toEqual(['الله', 'احد']);
    expect(missing).toEqual([]);
  });
});

describe('scoreTranscript', () => {
  const ayah = 'قُلْ هُوَ اللَّهُ أَحَدٌ';

  it('exact recitation scores 100', () => {
    const s = scoreTranscript(ayah, 'قل هو الله أحد');
    expect(s.pct).toBe(100);
    expect(s.missingWords).toEqual([]);
  });

  it('missing word lowers the score', () => {
    const s = scoreTranscript(ayah, 'قل هو أحد');
    expect(s.pct).toBe(75);
    expect(s.missingWords).toEqual(['الله']);
  });

  it('tashkeel and spelling variants still count as correct', () => {
    const s = scoreTranscript(ayah, 'قل هو الله أحدٌ');
    expect(s.pct).toBe(100);
  });

  it('completely wrong transcript scores low', () => {
    const s = scoreTranscript(ayah, 'بسم الله الرحمن الرحيم');
    expect(s.pct).toBeLessThan(50);
  });

  it('handles empty transcript without crashing', () => {
    const s = scoreTranscript(ayah, '');
    expect(s.pct).toBe(0);
    expect(s.missingWords).toEqual(['قل', 'هو', 'الله', 'احد']);
  });
});

describe('gradeFromPct', () => {
  it('maps percentages to self-grade scale', () => {
    expect(gradeFromPct(100)).toBe(2);
    expect(gradeFromPct(90)).toBe(2);
    expect(gradeFromPct(70)).toBe(1);
    expect(gradeFromPct(55)).toBe(1);
    expect(gradeFromPct(54)).toBe(0);
    expect(gradeFromPct(0)).toBe(0);
  });
});
