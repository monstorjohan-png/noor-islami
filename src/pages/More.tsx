import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useL, useT } from '../lib/hooks';
import { useSettings } from '../lib/store';
import { Section } from '../components/ui';
import InstallPanel from '../components/InstallPanel';
import { shareApp } from '../lib/share';
import {
  AdhkarIcon, BookmarkIcon, CalendarIcon, DownloadIcon, HadithIcon,
  HistoryIcon, NamesIcon, PrayerIcon, QiblaIcon, QuranIcon, ScaleIcon,
  ScholarIcon, SettingsIcon, TasbihIcon,
} from '../components/icons';

export default function More() {
  const t = useT();
  const L = useL();
  const bookmarks = useSettings((s) => s.bookmarks.length);
  const lang = useSettings((s) => s.lang);
  const [shared, setShared] = useState(false);

  const links = [
    { to: '/quran', label: t('quran'), Icon: QuranIcon, desc: { ar: 'المصحف كاملاً مع التفسير والترجمة', en: 'Full mushaf with tafsir and translation' } },
    { to: '/tasmee3', label: L({ ar: 'التسميع', en: 'Recite' }), Icon: QuranIcon, desc: { ar: 'جلسة تسميع تفاعلية — كشف الآية، الكلمة الناقصة، ترتيب الآيات، تقييم ذاتي', en: 'Interactive recitation: reveal, cloze, ordering, self-rating' } },
    { to: '/tajweed', label: L({ ar: 'أحكام التجويد', en: 'Tajweed' }), Icon: QuranIcon, desc: { ar: '٨ أحكام عملية بأمثلة قرآنية مع اختبار قصير', en: '8 practical rulings with Quranic examples' } },
    { to: '/report', label: L({ ar: 'لوحة رحلتك', en: 'Journey' }), Icon: ScholarIcon, desc: { ar: 'حصيلة الحفظ والجلسات والأيام المتتالية + الشارات', en: 'Memorization totals, streak, badges' } },
    { to: '/similar', label: L({ ar: 'متشابه القرآن', en: 'Similar verses' }), Icon: BookmarkIcon, desc: { ar: '٧٥ موضعاً من التطابق اللفظي — بالنص نفسه مع اختبار نفسك', en: '75 word-identical verse groups — with self-test' } },
    { to: '/fiqh', label: L({ ar: 'الفقه', en: 'Fiqh' }), Icon: ScaleIcon, desc: { ar: 'أقوال الأئمة الأربعة وابن تيمية وابن باز — بالأدلة والمصادر', en: 'The four schools, Ibn Taymiyyah and Ibn Baz — with sources' } },
    { to: '/history', label: L({ ar: 'تاريخ الإسلام', en: 'History' }), Icon: HistoryIcon, desc: { ar: 'خط زمني من البعثة إلى اليوم — بالدروس والعبر', en: 'Timeline from the first revelation to today — with lessons' } },
    { to: '/scholars', label: L({ ar: 'العلماء والصالحون', en: 'Scholars' }), Icon: ScholarIcon, desc: { ar: '72 ترجمة من الصحابة إلى المعاصرين — ومغمورون يجب أن تعرفهم', en: '72 biographies from the Companions to modern times — including the unsung' } },
    { to: '/hadith', label: t('hadith'), Icon: HadithIcon, desc: { ar: 'تسعة كتب بسندها ودرجاتها', en: 'Nine collections with isnad and grades' } },
    { to: '/adhkar', label: t('adhkar'), Icon: AdhkarIcon, desc: { ar: 'أذكار الصباح والمساء والصلاة وغيرها', en: 'Morning, evening, after prayer and more' } },
    { to: '/names', label: t('names'), Icon: NamesIcon, desc: { ar: 'أسماء الله الحسنى ومواضعها في القرآن', en: 'The beautiful names and their verses' } },
    { to: '/tasbih', label: t('tasbih'), Icon: TasbihIcon, desc: { ar: 'عدّاد التسبيح', en: 'Tasbih counter' } },
    { to: '/prayer', label: t('prayer'), Icon: PrayerIcon, desc: { ar: 'مواقيت الصلاة والأذان', en: 'Prayer times and athan' } },
    { to: '/qibla', label: t('qibla'), Icon: QiblaIcon, desc: { ar: 'اتجاه القبلة والمسافة للكعبة', en: 'Qibla direction and distance' } },
    { to: '/calendar', label: t('calendar'), Icon: CalendarIcon, desc: { ar: 'التقويم الهجري والمناسبات', en: 'Hijri calendar and occasions' } },
    { to: '/bookmarks', label: t('bookmarks'), Icon: BookmarkIcon, desc: { ar: 'ما حفظته للمراجعة', en: 'What you saved for later' }, badge: bookmarks },
    { to: '/download', label: t('download'), Icon: DownloadIcon, desc: { ar: 'تحميل المحتوى ليعمل بلا إنترنت', en: 'Download content for offline use' } },
    { to: '/settings', label: t('settings'), Icon: SettingsIcon, desc: { ar: 'اللغة والمظهر والمواقيت', en: 'Language, theme and timings' } },
  ];

  return (
    <div className="animate-fade-in">
      <Section title={t('more')} />

      {/* مشاركة التطبيق مع من تحب */}
      <button
        type="button"
        className="btn-primary mb-3 w-full !py-3"
        onClick={() => {
          void shareApp(lang).then(() => {
            setShared(true);
            window.setTimeout(() => setShared(false), 2500);
          });
        }}
      >
        {shared ? L({ ar: 'تمت المشاركة — تقبل الله منا ومنكم', en: 'Shared — may Allah accept' }) : L({ ar: 'شارك نور مع من تحب', en: 'Share Noor with those you love' })}
      </button>

      {/* التثبيت أوّلاً: هو ما يجعل التطبيق على الهاتف بلا متصفّح */}
      <div className="mb-4">
        <InstallPanel />
      </div>

      <ul className="space-y-2">
        {links.map(({ to, label, Icon, desc, badge }) => (
          <li key={to}>
            <Link to={to} className="card flex items-center gap-3.5 p-3.5 transition-colors hover:border-gold-400/30">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gold-400/10 text-gold-300">
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-slate-100">{label}</span>
                  {badge ? <span className="num rounded-full bg-gold-400/20 px-1.5 text-[10px] text-gold-200">{badge}</span> : null}
                </span>
                <span className="mt-0.5 block truncate text-xs text-slate-500">{L(desc)}</span>
              </span>
              <span className="shrink-0 text-slate-600">‹</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
