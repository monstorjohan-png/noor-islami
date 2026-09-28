import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { useSettings } from '../lib/store';
import { useOnline, useT, useTheme } from '../lib/hooks';
import { AdhkarIcon, HomeIcon, MoreIcon, PrayerIcon, QuranIcon } from './icons';
import SearchBar from './SearchBar';

const MAIN_NAV: Array<{ to: string; key: string; Icon: (p: { className?: string }) => JSX.Element; end?: boolean }> = [
  { to: '/', key: 'home', Icon: HomeIcon, end: true },
  { to: '/quran', key: 'quran', Icon: QuranIcon },
  { to: '/prayer', key: 'prayer', Icon: PrayerIcon },
  { to: '/adhkar', key: 'adhkar', Icon: AdhkarIcon },
  { to: '/more', key: 'more', Icon: MoreIcon },
] as const;

export default function Layout() {
  const t = useT();
  useTheme();
  const online = useOnline();
  const setLang = useSettings((s) => s.set);
  const lang = useSettings((s) => s.lang);
  const mainRef = useRef<HTMLElement>(null);
  const { pathname } = useLocation();

  // كل تنقّل يبدأ من أعلى الصفحة
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
    window.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <div className="pattern-bg flex min-h-dvh flex-col bg-ink-900">
      <header className="no-print sticky top-0 z-30 border-b border-white/5 bg-ink-900/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 pt-[max(.75rem,var(--safe-t))] pb-3">
          <NavLink to="/" className="flex shrink-0 items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-gold-300 to-gold-500 text-lg font-bold text-ink-900 shadow-lg shadow-gold-500/20">
              ن
            </span>
            <span className="hidden text-lg font-bold text-slate-100 sm:block">{t('appName')}</span>
          </NavLink>

          <div className="min-w-0 flex-1">
            <SearchBar />
          </div>

          <NavLink
            to="/account"
            className={({ isActive }) =>
              `grid h-9 w-9 shrink-0 place-items-center rounded-xl border transition-colors ${
                isActive ? 'border-gold-400/40 bg-gold-400/10 text-gold-300' : 'border-white/5 text-slate-400 hover:text-slate-200'
              }`
            }
            aria-label={t('account')}
            title={t('account')}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="12" cy="8" r="3.5" />
              <path d="M4.8 19.5a7.2 7.2 0 0 1 14.4 0" />
            </svg>
          </NavLink>

          <button
            type="button"
            onClick={() => setLang('lang', lang === 'ar' ? 'en' : 'ar')}
            className="btn-ghost shrink-0 !px-3 !py-2 text-xs font-semibold"
            aria-label={t('language')}
          >
            {lang === 'ar' ? 'EN' : 'ع'}
          </button>
        </div>

        {!online ? (
          <div className="bg-amber-500/15 px-4 py-1.5 text-center text-xs text-amber-200">
            {lang === 'ar' ? 'وضع عدم الاتصال — المحتوى المُنزَّل ما زال يعمل' : 'Offline — downloaded content still works'}
          </div>
        ) : null}
      </header>

      <main ref={mainRef} className="mx-auto w-full max-w-3xl flex-1 px-4 pb-28 pt-4">
        <Outlet />
      </main>

      <nav className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-white/5 bg-ink-900/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-stretch justify-around px-2 pt-1.5 pb-[max(.35rem,var(--safe-b))]">
          {MAIN_NAV.map(({ to, key, Icon, end }) => (
            <NavLink
              key={key}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] transition-colors ${
                  isActive ? 'text-gold-300' : 'text-slate-500 hover:text-slate-300'
                }`
              }
            >
              <Icon className="h-6 w-6" />
              <span className="max-w-full truncate">{t(key)}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
