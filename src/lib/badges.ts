/**
 * شارات نور — تُكتسب بالعمل لا بالضغط.
 * كل شارة نقية تأخذ إحصائيات محسوبة من التخزين المحلي وتُرجع تحققت أم لا.
 */

export interface BadgeStats {
  /** آيات محفوظة كلياً */
  memorized: number;
  /** آيات بدرجة «أتقنت» في آخر تسميع */
  mastered: number;
  /** جلسات التسميع المنجزة */
  sessions: number;
  /** أيام متتالية بنشاط على الأقل */
  streak: number;
  /** ختمات اكتملت (completedRuns في متابعة الحفظ) */
  completedRuns: number;
  /** سور أتقنتها كاملة */
  fullSurahs: number;
}

export interface BadgeDef {
  id: string;
  title: { ar: string; en: string };
  desc: { ar: string; en: string };
  unlocked: (s: BadgeStats) => boolean;
}

export const BADGES: BadgeDef[] = [
  { id: 'first-ayah', title: { ar: 'أول آية', en: 'First ayah' }, desc: { ar: 'احفظ آيتك الأولى', en: 'Memorize your first ayah' }, unlocked: (s) => s.memorized >= 1 },
  { id: 'ten-ayahs', title: { ar: 'عشر آيات', en: 'Ten ayahs' }, desc: { ar: 'احفظ عشر آيات', en: 'Memorize ten ayahs' }, unlocked: (s) => s.memorized >= 10 },
  { id: 'fifty-ayahs', title: { ar: 'خمسون آية', en: 'Fifty ayahs' }, desc: { ar: 'احفظ ٥٠ آية', en: 'Memorize 50 ayahs' }, unlocked: (s) => s.memorized >= 50 },
  { id: 'hundred-ayahs', title: { ar: 'مئة آية', en: 'A hundred ayahs' }, desc: { ar: 'احفظ ١٠٠ آية', en: 'Memorize 100 ayahs' }, unlocked: (s) => s.memorized >= 100 },
  { id: 'three-hundred', title: { ar: 'ثلاثمئة آية', en: 'Three hundred' }, desc: { ar: 'احفظ ٣٠٠ آية', en: 'Memorize 300 ayahs' }, unlocked: (s) => s.memorized >= 300 },
  { id: 'thousand', title: { ar: 'ألف آية', en: 'A thousand' }, desc: { ar: 'احفظ ١٠٠٠ آية', en: 'Memorize 1000 ayahs' }, unlocked: (s) => s.memorized >= 1000 },

  { id: 'master-10', title: { ar: 'عشر آيات متقنة', en: 'Ten mastered' }, desc: { ar: 'أتقن ١٠ آيات في التسميع', en: 'Master 10 ayahs in practice' }, unlocked: (s) => s.mastered >= 10 },
  { id: 'master-50', title: { ar: 'خمسون متقنة', en: 'Fifty mastered' }, desc: { ar: 'أتقن ٥٠ آية في التسميع', en: 'Master 50 ayahs in practice' }, unlocked: (s) => s.mastered >= 50 },
  { id: 'master-100', title: { ar: 'مئة متقنة', en: 'A hundred mastered' }, desc: { ar: 'أتقن ١٠٠ آية في التسميع', en: 'Master 100 ayahs in practice' }, unlocked: (s) => s.mastered >= 100 },
  { id: 'master-300', title: { ar: 'ثلاثمئة متقنة', en: 'Three hundred mastered' }, desc: { ar: 'أتقن ٣٠٠ آية في التسميع', en: 'Master 300 ayahs in practice' }, unlocked: (s) => s.mastered >= 300 },

  { id: 'session-1', title: { ar: 'أول جلسة', en: 'First session' }, desc: { ar: 'أكمل جلسة تسميع واحدة', en: 'Complete one recitation session' }, unlocked: (s) => s.sessions >= 1 },
  { id: 'session-10', title: { ar: 'عشر جلسات', en: 'Ten sessions' }, desc: { ar: 'أكمل ١٠ جلسات تسميع', en: 'Complete 10 recitation sessions' }, unlocked: (s) => s.sessions >= 10 },
  { id: 'session-50', title: { ar: 'خمسون جلسة', en: 'Fifty sessions' }, desc: { ar: 'أكمل ٥٠ جلسة تسميع', en: 'Complete 50 recitation sessions' }, unlocked: (s) => s.sessions >= 50 },

  { id: 'streak-7', title: { ar: 'أسبوع بلا انقطاع', en: 'A week no gap' }, desc: { ar: '٧ أيام متتالية بنشاط', en: '7 consecutive days of activity' }, unlocked: (s) => s.streak >= 7 },
  { id: 'streak-30', title: { ar: 'شهر بلا انقطاع', en: 'A month no gap' }, desc: { ar: '٣٠ يوم متتالية بنشاط', en: '30 consecutive days of activity' }, unlocked: (s) => s.streak >= 30 },
  { id: 'streak-100', title: { ar: 'مئة يوم نور', en: 'Hundred days of light' }, desc: { ar: '١٠٠ يوم متتالية بنشاط', en: '100 consecutive days of activity' }, unlocked: (s) => s.streak >= 100 },

  { id: 'full-surah', title: { ar: 'سورة كاملة', en: 'A full surah' }, desc: { ar: 'أتقن سورة كاملة', en: 'Master one full surah' }, unlocked: (s) => s.fullSurahs >= 1 },
  { id: 'khatma', title: { ar: 'ختمة نور', en: 'A completed khatma' }, desc: { ar: 'أكمل ختمة كاملة للمصحف', en: 'Complete a full reading of the Quran' }, unlocked: (s) => s.completedRuns >= 1 },
];

export interface BadgeResult extends BadgeDef {
  isUnlocked: boolean;
}

/** حساب كل الشارات وحالة قفلها — نقية تماماً */
export function evaluateBadges(s: BadgeStats): BadgeResult[] {
  return BADGES.map((b) => ({ ...b, isUnlocked: b.unlocked(s) }));
}

export function unlockedCount(s: BadgeStats): number {
  return BADGES.reduce((n, b) => n + (b.unlocked(s) ? 1 : 0), 0);
}
