/**
 * صفحة الحساب.
 *
 * تعمل بلا مفاتيح: عندها تعرض حالة الضيف وتُعطّل ما لا يتاح.
 * لا نصّ ديني هنا — نصوص واجهة فقط.
 */

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useT } from '../lib/hooks';
import { initAuth, useAuth } from '../lib/auth/context';
import { isSyncEnabled } from '../lib/sync';
import { Badge, Card, Loading, Ornament, Section } from '../components/ui';

/** نصوص الصفحة — النمط نفسه في بقية الصفحات: عربي وإنجليزي ومفتاح مشتق */
const MESSAGES = {
  guestTitle: { ar: 'التطبيق يعمل كاملاً بلا حساب', en: 'The app works fully without an account' },
  guestBody: {
    ar: 'كل ما تحفظه يبقى على هذا الجهاز وحده، والتطبيق يعمل بلا إنترنت كما هو.',
    en: 'Everything you save stays on this device, and the app keeps working offline.',
  },
  guestNoKeys: {
    ar: 'تسجيل الدخول غير مُهيَّأ في هذه النسخة، فأنت في وضع الضيف. كل شيء يعمل.',
    en: 'Sign-in is not configured in this build, so you are in guest mode. Everything works.',
  },
  guestNoSync: {
    ar: 'المزامنة بين الأجهزة معطّلة هنا، فتبقى محفوظاتك على هذا الجهاز وحده.',
    en: 'Cross-device sync is off here, so your bookmarks stay on this device.',
  },
  privacy: {
    ar: 'لا يغادر هذا الجهاز شيء إلا بعد تسجيل الدخول وتفعيل المزامنة صراحةً.',
    en: 'Nothing leaves this device until you sign in and turn sync on explicitly.',
  },
  googleBtn: { ar: 'المتابعة بحساب جوجل', en: 'Continue with Google' },
  or: { ar: 'أو بالبريد', en: 'Or with email' },
  emailHint: { ar: 'اكتب بريدك الإلكتروني كاملاً', en: 'Example: name@example.com' },
  passHint: { ar: 'ستة أحرف على الأقل', en: 'At least six characters' },
  switchToSignUp: { ar: 'ليس لديك حساب؟ أنشئ واحداً', en: 'No account yet? Create one' },
  switchToSignIn: { ar: 'لديك حساب؟ سجّل الدخول', en: 'Already have one? Sign in' },
  signedIn: { ar: 'حسابك مفتوح الآن', en: 'Your account is open' },
  createdAt: { ar: 'أُنشئ في', en: 'Created' },
  syncOn: { ar: 'مزامنة المحفوظات مفعّلة بين أجهزتك', en: 'Bookmark sync is on across your devices' },
  deleteHint: {
    ar: 'يحذف الحساب من الخادم. المحفوظات على هذا الجهاز تبقى كما هي.',
    en: 'Removes the account on the server. Bookmarks on this device stay as they are.',
  },
  deleteConfirm: { ar: 'سيُحذف حسابك نهائياً. متابعة؟', en: 'Your account will be deleted. Continue?' },
  signInOk: { ar: 'أهلاً بك من جديد.', en: 'Welcome back.' },
  deletedOk: { ar: 'تم حذف الحساب وسجّلنا خروجك.', en: 'The account was deleted and you are signed out.' },
  signUpOk: {
    ar: 'تم إنشاء الحساب. إن أُرسلت رسالة تأكيد فافحص بريدك قبل الدخول.',
    en: 'Account created. If a confirmation email was sent, check your inbox before signing in.',
  },
  unavailable: { ar: 'غير متاح في هذه النسخة', en: 'Not available in this build' },
  guestNote: {
    ar: 'أنت في وضع الضيف — لا حساب، وبياناتك على هذا الجهاز وحده.',
    en: 'You are in guest mode — no account, and your data stays on this device.',
  },
} as const;

type MsgKey = keyof typeof MESSAGES;

type Mode = 'signin' | 'signup';

const INPUT =
  'w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-slate-200 outline-none transition-colors placeholder:text-slate-500 focus:border-gold-400/50 focus:bg-white/10';

export default function Account() {
  const t = useT();
  const m = (k: MsgKey) => (t.lang === 'ar' ? MESSAGES[k].ar : MESSAGES[k].en);
  const auth = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    void initAuth();
  }, []);

  const onMode = (next: Mode) => {
    setMode(next);
    setNotice(null);
    auth.clearError();
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setNotice(null);
    const ok =
      mode === 'signin'
        ? await auth.signInWithEmail(email, pass)
        : await auth.signUpWithEmail(email, pass);
    if (ok) {
      setPass('');
      setNotice(mode === 'signin' ? m('signInOk') : m('signUpOk'));
    }
  };

  const onDelete = async () => {
    setNotice(null);
    if (!window.confirm(m('deleteConfirm'))) return;
    const ok = await auth.deleteAccount();
    if (ok) setNotice(m('deletedOk'));
  };

  if (auth.status === 'idle' || auth.status === 'loading') {
    return <Loading label={t('loading')} />;
  }

  /* ---------- الحساب مفتوح ---------- */
  if (auth.user) {
    return (
      <div className="animate-fade-in">
        <Section title={t('account')} />

        <Card>
          <div className="flex items-center gap-3.5">
            <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-gold-400/15 text-lg font-bold text-gold-200">
              {auth.user.avatarUrl ? (
                <img src={auth.user.avatarUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                (auth.user.displayName || auth.user.email || '؟').slice(0, 1).toUpperCase()
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-100">{auth.user.displayName || auth.user.email}</p>
              <p className="num truncate text-xs text-slate-500">{auth.user.email}</p>
            </div>
            <Badge tone="green">
              {auth.user.method === 'google' ? 'Google' : auth.user.method === 'email' ? t('email') : t('guest')}
            </Badge>
          </div>

          {auth.user.createdAt > 0 ? (
            <p className="mt-3 text-xs text-slate-500">
              {m('createdAt')}{' '}
              <span className="num">{new Date(auth.user.createdAt).toLocaleDateString(t.lang === 'ar' ? 'ar-EG' : 'en-GB')}</span>
            </p>
          ) : null}
        </Card>

        <div className="mt-3">
          <Card>
            <div className="flex items-start gap-3">
              <Badge tone={isSyncEnabled() ? 'green' : 'default'}>{t('sync')}</Badge>
              <p className="min-w-0 flex-1 text-xs leading-relaxed text-slate-400">
                {isSyncEnabled() ? m('syncOn') : m('guestNoSync')}
              </p>
            </div>
          </Card>
        </div>

        <Ornament />

        <div className="space-y-2">
          <button type="button" className="btn-ghost w-full" onClick={() => void auth.signOut()} disabled={auth.busy}>
            {t('signOut')}
          </button>
          <button type="button" className="btn-subtle w-full !text-rose-300" onClick={() => void onDelete()} disabled={auth.busy}>
            {t('deleteAccount')}
          </button>
          <p className="pt-1 text-center text-xs leading-relaxed text-slate-500">{m('deleteHint')}</p>
        </div>

        {notice ? <p className="mt-3 text-center text-xs text-emerald-300">{notice}</p> : null}
        {auth.error ? <p className="mt-3 text-center text-xs text-rose-300">{auth.error}</p> : null}
      </div>
    );
  }

  /* ---------- ضيف: لا مفاتيح ولا تسجيل ---------- */
  if (!auth.canAuthenticate) {
    return (
      <div className="animate-fade-in">
        <Section title={t('account')} />

        <Card>
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-100">{m('guestTitle')}</h2>
            <Badge tone="gold">{t('guest')}</Badge>
          </div>
          <p className="text-sm leading-relaxed text-slate-400">{m('guestNoKeys')}</p>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">{m('guestNote')}</p>
        </Card>

        <Ornament />

        <div className="space-y-2">
          <button type="button" className="btn-ghost w-full" disabled>
            {m('googleBtn')}
          </button>
          <button type="button" className="btn-ghost w-full" disabled>
            {t('signIn')}
          </button>
          <p className="pt-1 text-center text-xs text-slate-500">{m('unavailable')}</p>
        </div>

        <p className="mt-6 text-center text-xs leading-relaxed text-slate-600">{m('privacy')}</p>
      </div>
    );
  }

  /* ---------- ضيف له مفاتيح: نموذج الدخول ---------- */
  return (
    <div className="animate-fade-in">
      <Section title={t('account')} />

      <div className="mb-4 flex gap-2">
        {(['signin', 'signup'] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => onMode(k)}
            className={`chip flex-1 justify-center py-2.5 ${mode === k ? 'chip-active' : ''}`}
          >
            {k === 'signin' ? t('signIn') : t('signUp')}
          </button>
        ))}
      </div>

      <button
        type="button"
        className="btn-ghost w-full"
        onClick={() => void auth.signInWithGoogle()}
        disabled={auth.busy}
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
          <path fill="currentColor" d="M12 11v2.6h4.3c-.2 1.2-1.4 3.4-4.3 3.4A5.9 5.9 0 0 1 6 11a6 6 0 1 1 9.9 4.5l1.8 1.8A8 8 0 1 0 12 4c2.2 0 3.7.9 4.5 1.8l1.6-1.6A9.9 9.9 0 0 0 12 2a10 10 0 1 0 0 20c5.7 0 9.4-4 9.4-9.6 0-.6-.1-1.1-.2-1.6H12Z" />
        </svg>
        {m('googleBtn')}
      </button>

      <div className="my-4 flex items-center gap-3 text-slate-600">
        <span className="h-px flex-1 bg-white/5" />
        <span className="text-xs">{m('or')}</span>
        <span className="h-px flex-1 bg-white/5" />
      </div>

      <form onSubmit={(e) => void onSubmit(e)} className="card space-y-3 p-4">
        <label className="block">
          <span className="label-ar">{t('email')}</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={m('emailHint')}
            autoComplete="email"
            dir="ltr"
            className={`${INPUT} mt-1 text-start`}
          />
        </label>

        <label className="block">
          <span className="label-ar">{t('password')}</span>
          <input
            type="password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            placeholder={m('passHint')}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            dir="ltr"
            className={`${INPUT} mt-1 text-start`}
          />
        </label>

        <button type="submit" className="btn-primary w-full" disabled={auth.busy}>
          {mode === 'signin' ? t('signIn') : t('signUp')}
        </button>
      </form>

      <div className="mt-3 space-y-2 text-center">
        <button type="button" className="btn-subtle w-full" onClick={() => onMode(mode === 'signin' ? 'signup' : 'signin')}>
          {mode === 'signin' ? m('switchToSignUp') : m('switchToSignIn')}
        </button>
        {notice ? <p className="text-xs text-emerald-300">{notice}</p> : null}
        {auth.error ? <p className="text-xs text-rose-300">{auth.error}</p> : null}
      </div>

      <Ornament />

      <div className="space-y-2">
        <p className="text-xs leading-relaxed text-slate-400">{m('guestBody')}</p>
        <p className="text-xs leading-relaxed text-slate-600">{m('privacy')}</p>
      </div>
    </div>
  );
}
