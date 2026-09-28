import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useT } from '../lib/hooks';
import { SearchIcon } from './icons';

/** حقل بحث مضغوط في الرأس — الكتابة تنتقل لصفحة البحث */
export default function SearchBar() {
  const t = useT();
  const nav = useNavigate();
  const [q, setQ] = useState('');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const s = q.trim();
        if (s) nav(`/search?q=${encodeURIComponent(s)}`);
      }}
      className="relative"
      role="search"
    >
      <SearchIcon className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-slate-500" />
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t('searchPlaceholder')}
        aria-label={t('search')}
        className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pe-3 ps-9 text-sm text-slate-200 outline-none transition-colors placeholder:text-slate-500 focus:border-gold-400/50 focus:bg-white/10"
      />
    </form>
  );
}
