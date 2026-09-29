/** عناصر واجهة مشتركة — بلا حالة داخلية، تعرض فقط */

import type { ReactNode } from 'react';
import { docLang, t } from '../i18n';

/* ---------- مؤشرات الحالة ---------- */

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
      aria-hidden
    />
  );
}

export function Loading({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-400">
      <Spinner className="h-8 w-8 text-gold-400" />
      {label ? <p className="text-sm">{label}</p> : null}
    </div>
  );
}

export function ErrorBox({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  // المكوّن بلا سياق، والحاجز قد يستدعيه بعد انهياره — فنقرأ من الجذر
  const lang = docLang();
  return (
    <div className="card flex flex-col items-center gap-3 p-8 text-center" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <span className="text-3xl">⚠️</span>
      <p className="text-sm text-slate-300">{error.message}</p>
      {onRetry ? (
        <button type="button" className="btn-ghost" onClick={onRetry}>
          ↻ {t('retry', lang)}
        </button>
      ) : null}
    </div>
  );
}

export function Empty({ label, icon = '🔍' }: { label: string; icon?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-16 text-center text-slate-500">
      <span className="text-3xl opacity-60">{icon}</span>
      <p className="text-sm">{label}</p>
    </div>
  );
}

/* ---------- الحاويات ---------- */

export function Section({
  title, action, children, className = '',
}: { title?: string; action?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <section className={`mb-7 ${className}`}>
      {title ? (
        <header className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-100">{title}</h2>
          {action}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`card p-4 ${className}`}>{children}</div>;
}

export function Badge({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'gold' | 'green' | 'red' }) {
  const tones = {
    default: 'bg-white/5 border-white/10 text-slate-300',
    gold: 'bg-gold-400/15 border-gold-400/40 text-gold-200',
    green: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200',
    red: 'bg-rose-500/15 border-rose-500/40 text-rose-200',
  } as const;
  return <span className={`chip border ${tones[tone]}`}>{children}</span>;
}

/* ---------- أزرار الحالة ---------- */

export function Toggle({
  on, onChange, label, hint,
}: { on: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex w-full items-center justify-between gap-4 py-3 text-start"
    >
      <span className="min-w-0">
        <span className="block text-sm text-slate-200">{label}</span>
        {hint ? <span className="mt-0.5 block text-xs text-slate-500">{hint}</span> : null}
      </span>
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? 'bg-emerald-500' : 'bg-ink-600'}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${on ? 'start-[1.4rem]' : 'start-0.5'}`}
        />
      </span>
    </button>
  );
}

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/5 py-3 last:border-0">
      <span className="shrink-0 text-sm text-slate-400">{label}</span>
      <div className="min-w-0 text-end">{children}</div>
    </div>
  );
}

export function ProgressBar({ value, tone = 'gold' }: { value: number; tone?: 'gold' | 'emerald' }) {
  const bg = tone === 'gold' ? 'bg-gold-400' : 'bg-emerald-500';
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
      <div className={`h-full rounded-full ${bg} transition-all duration-300`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

/* ---------- فواصل زخرفية ---------- */

export function Ornament({ label }: { label?: string }) {
  return (
    <div className="my-6 flex items-center gap-3 text-gold-500/60">
      <span className="h-px flex-1 bg-gradient-to-l from-transparent to-gold-500/40" />
      {label ? <span className="text-xs tracking-widest text-slate-500">{label}</span> : <span className="text-sm">◆</span>}
      <span className="h-px flex-1 bg-gradient-to-r from-transparent to-gold-500/40" />
    </div>
  );
}
