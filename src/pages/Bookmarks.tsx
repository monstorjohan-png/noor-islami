import { Link } from 'react-router-dom';
import { useSettings } from '../lib/store';
import { useL, useT } from '../lib/hooks';
import { Empty, Section } from '../components/ui';
import { BookmarkIcon } from '../components/icons';

const OPEN = { ar: 'فتح', en: 'Open' };

export default function Bookmarks() {
  const t = useT();
  const L = useL();
  const bookmarks = useSettings((s) => s.bookmarks);
  const toggleBookmark = useSettings((s) => s.toggleBookmark);

  if (!bookmarks.length) {
    return (
      <div className="animate-fade-in">
        <Section title={t('bookmarks')} />
        <Empty label={t('bookmarks')} icon="🔖" />
      </div>
    );
  }

  const sorted = [...bookmarks].sort((a, b) => b.at - a.at);

  return (
    <div className="animate-fade-in">
      <Section title={`${t('bookmarks')} — ${sorted.length}`}>
        <ul className="space-y-2.5">
          {sorted.map((b) => (
            <li key={`${b.kind}:${b.ref}`} className="card flex items-start gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="mb-1 break-words text-sm text-slate-200">{b.label || b.ref}</p>
                <p className="text-xs text-slate-500">
                  <span className="num">{new Date(b.at).toLocaleDateString(L.lang === 'ar' ? 'ar-EG' : 'en-GB')}</span>
                  {' · '}
                  {b.ref}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Link to={linkFor(b.kind, b.ref)} className="btn-ghost !px-2.5 !py-2 text-xs">
                  {L(OPEN)}
                </Link>
                <button
                  type="button"
                  aria-label={t('bookmarks')}
                  onClick={() => toggleBookmark({ kind: b.kind, ref: b.ref, label: b.label })}
                  className="btn-ghost !px-2 !py-2"
                >
                  <BookmarkIcon filled className="h-4 w-4 text-gold-300" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <p className="text-center text-xs text-slate-500">
        {t('dataAndPrivacy')}
      </p>
    </div>
  );
}

/** يحوّل المرجع المحفوظ إلى رابط داخلي */
function linkFor(kind: string, ref: string): string {
  if (kind === 'ayah') {
    const [s, a] = ref.split(':');
    return `/quran/${s}/${a ?? 1}`;
  }
  if (kind === 'hadith') {
    const [book, n] = ref.split(':');
    return n ? `/hadith/${book}?n=${n}` : `/hadith/${book}`;
  }
  if (kind === 'surah') return `/quran/${ref}`;
  if (kind === 'page') return `/quran?page=${ref}`;
  return '/bookmarks';
}
