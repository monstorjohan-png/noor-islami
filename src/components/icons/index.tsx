/** أيقونات خطّية — بلا اعتماد خارجي، تعمل بلا إنترنت */

interface P {
  className?: string;
}

const base = 'h-6 w-6';

export function HomeIcon({ className = base }: P) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5.5 9.5V20a1 1 0 0 0 1 1H10v-5.5h4V21h3.5a1 1 0 0 0 1-1V9.5" />
    </svg>
  );
}

export function QuranIcon({ className = base }: P) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 6.5S10 4.5 5 4.5v13c5 0 7 2 7 2s2-2 7-2v-13c-5 0-7 2-7 2Z" />
      <path d="M12 6.5v13" />
      <path d="M7.5 9h2M7.5 12h2M14.5 9h2M14.5 12h2" />
    </svg>
  );
}

export function PrayerIcon({ className = base }: P) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3v2M4.5 12h15" />
      <path d="M12 5.5a6.5 6.5 0 0 1 4.6 11.1c-.6.5-1 1.4-1 2.4H8.4c0-1-.4-1.9-1-2.4A6.5 6.5 0 0 1 12 5.5Z" />
      <path d="M9.5 21h5" />
    </svg>
  );
}

export function AdhkarIcon({ className = base }: P) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3.5 13.9 9l5.6.4-4.3 3.6 1.4 5.5L12 15.6 7.4 18.5l1.4-5.5L4.5 9.4 10.1 9 12 3.5Z" />
    </svg>
  );
}

export function MoreIcon({ className = base }: P) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="5" cy="12" r="1.4" />
      <circle cx="12" cy="12" r="1.4" />
      <circle cx="19" cy="12" r="1.4" />
    </svg>
  );
}

export function SearchIcon({ className = base }: P) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </svg>
  );
}

export function BookmarkIcon({ className = base, filled = false }: P & { filled?: boolean }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6.5 4.5h11a1 1 0 0 1 1 1v15l-6.5-4-6.5 4v-15a1 1 0 0 1 1-1Z" />
    </svg>
  );
}

export function CopyIcon({ className = base }: P) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5.5 15H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v.5" />
    </svg>
  );
}

export function ShareIcon({ className = base }: P) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="18" cy="5.5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="18.5" r="2.5" />
      <path d="m8.3 10.8 7.4-4M8.3 13.2l7.4 4" />
    </svg>
  );
}

export function PlayIcon({ className = base }: P) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5.5v13l11-6.5-11-6.5Z" />
    </svg>
  );
}

export function PauseIcon({ className = base }: P) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="7" y="5" width="3.5" height="14" rx="1" />
      <rect x="13.5" y="5" width="3.5" height="14" rx="1" />
    </svg>
  );
}

export function QiblaIcon({ className = base }: P) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M15.5 8.5 13 13l-4.5 2.5L11 11l4.5-2.5Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function TasbihIcon({ className = base }: P) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="14.5" r="6" />
      <path d="M9.5 6.5h5M12 6.5v2M5 9l-1.5 2M19 9l1.5 2" />
    </svg>
  );
}

export function NamesIcon({ className = base }: P) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3.5 14.2 8l4.8.7-3.5 3.4.8 4.9-4.3-2.3-4.3 2.3.8-4.9L5 8.7 9.8 8 12 3.5Z" />
    </svg>
  );
}

export function CalendarIcon({ className = base }: P) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 9.5h17M8 3.5V7M16 3.5V7" />
    </svg>
  );
}

export function DownloadIcon({ className = base }: P) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3.5v11M7.5 10.5 12 15l4.5-4.5" />
      <path d="M4.5 17.5v1.5a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-1.5" />
    </svg>
  );
}

export function SettingsIcon({ className = base }: P) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2 5.5 5.5" />
    </svg>
  );
}

export function HadithIcon({ className = base }: P) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4.5 4.5h8a3 3 0 0 1 3 3v12a2.5 2.5 0 0 0-2.5-2.5H4.5v-12Z" />
      <path d="M19.5 4.5h-1a3 3 0 0 0-3 3v12a2.5 2.5 0 0 1 2.5-2.5h1.5v-12Z" />
    </svg>
  );
}
