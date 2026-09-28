/**
 * تنفيذ المصادقة فوق مكتبة الحسابات — يُحمَّل عند الطلب فقط.
 *
 * لا استيراد ثابت هنا إطلاقاً: نستخدم استيراداً ديناميكياً داخل الدالة،
 * فلا يُحمَّل بايت واحد من المكتبة إلا حين توجد مفاتيح فعلاً.
 * السطر الوحيد الذي يلمس المكتبة نوعياً هو الاستيراد من النوع، وهو
 * يُمحى عند البناء ولا ينتج عنه كود.
 *
 * دالة حذف الحساب تُنشأ في مشروع الحسابات مرة واحدة:
 *
 *   create or replace function public.delete_account() returns void
 *   language sql security definer as $$
 *     delete from auth.users where id = auth.uid();
 *   $$;
 */

import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import {
  AuthError,
  authMessage,
  normalizeEmail,
  supabaseAnonKey,
  supabaseUrl,
  validateCredentials,
} from './types';
import type {
  AuthCallback,
  AuthErrorCode,
  AuthMethod,
  AuthProvider,
  AuthSession,
  AuthSignUpResult,
  AuthUser,
} from './types';

type Cached = { url: string; key: string; client: Promise<SupabaseClient> };

let cached: Cached | null = null;

/** عميل واحد لكل زوج مفاتيح؛ الفشل يمسح الذاكرة ليُعاد المحاولة */
async function clientFor(url: string, key: string): Promise<SupabaseClient> {
  if (cached && cached.url === url && cached.key === key) return cached.client;

  const client = (async () => {
    const mod = await import('@supabase/supabase-js');
    return mod.createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // ضروري لعودة المستخدم من نافذة الدخول الخارجية
        detectSessionInUrl: true,
      },
    });
  })().catch((err: unknown) => {
    cached = null;
    throw err;
  });

  cached = { url, key, client };
  return client;
}

/** عميل المصادقة نفسه تستعمله المزامنة — بلا مفاتيح يرمي بوضوح */
export async function getSupabaseClient(): Promise<SupabaseClient> {
  const url = supabaseUrl();
  const key = supabaseAnonKey();
  if (!url || !key) throw new AuthError('not_available', authMessage('not_available'));
  return clientFor(url, key);
}

/** يترجم نصّ المزوّد إلى شفرة عربية — لا نُظهر نصاً أجنبياً للمستخدم */
function toAuthError(err: unknown, fallback: AuthErrorCode): AuthError {
  if (err instanceof AuthError) return err;
  const raw = err instanceof Error ? err.message : String(err ?? '');
  const low = raw.toLowerCase();
  if (low.includes('invalid login credentials')) return new AuthError('invalid_credentials', authMessage('invalid_credentials'));
  if (low.includes('already registered') || low.includes('already been registered') || low.includes('duplicate key')) {
    return new AuthError('email_taken', authMessage('email_taken'));
  }
  if (low.includes('password should be') || low.includes('at least')) return new AuthError('weak_password', authMessage('weak_password'));
  if (low.includes('failed to fetch') || low.includes('network') || low.includes('timeout')) {
    return new AuthError('network', authMessage('network'));
  }
  return new AuthError(fallback, authMessage(fallback));
}

/** أول نصّ موجود من قائمة أسماء */
function firstText(...values: unknown[]): string | null {
  for (const v of values) {
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

/** يستنتج طريقة الوصول من قائمة المزوّدات التي سجّل بها المستخدم */
function methodOf(user: User): AuthMethod {
  const providers = user.app_metadata?.providers;
  if (Array.isArray(providers) && providers.includes('google')) return 'google';
  return 'email';
}

/** يوحّد شكل المستخدم المستقل عن المزوّد */
export function toAuthUser(user: User): AuthUser {
  const meta = user.user_metadata ?? {};
  return {
    id: user.id,
    email: user.email ?? null,
    displayName: firstText(meta.full_name, meta.name, meta.display_name),
    avatarUrl: firstText(meta.avatar_url, meta.picture),
    method: methodOf(user),
    createdAt: typeof user.created_at === 'string' ? Date.parse(user.created_at) || 0 : 0,
  };
}

/** يوحّد شكل الجلسة */
export function toAuthSession(session: Session): AuthSession {
  return {
    user: toAuthUser(session.user),
    expiresAt: typeof session.expires_at === 'number' ? session.expires_at * 1000 : 0,
    accessToken: session.access_token ?? null,
  };
}

/** عنوان العودة بعد تأكيد البريد أو بعد دخول جهة خارجية */
function redirectTo(): string | undefined {
  if (typeof window === 'undefined' || !window.location) return undefined;
  return `${window.location.origin}${import.meta.env.BASE_URL ?? '/'}`;
}

/** ينشئ مزوّد المصادقة الحقيقي. يُستدعى من المختار بعد توفّر المفاتيح. */
export async function createSupabaseAuthProvider(url: string, key: string): Promise<AuthProvider> {
  if (!url || !key) throw new AuthError('not_available', authMessage('not_available'));
  // نُجرب الاتصال مبكراً: فشل التحميل يعني ضيفاً لا شاشة خطأ
  const client = await clientFor(url, key);

  const current = async (): Promise<AuthSession | null> => {
    try {
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      return data.session ? toAuthSession(data.session) : null;
    } catch (err) {
      throw toAuthError(err, 'unknown');
    }
  };

  return {
    kind: 'supabase',
    available: true,

    getSession: current,

    async signInWithEmail(email, password) {
      const bad = validateCredentials(email, password);
      if (bad) throw new AuthError(bad, authMessage(bad));
      try {
        const { data, error } = await client.auth.signInWithPassword({
          email: normalizeEmail(email),
          password,
        });
        if (error) throw error;
        return data.session ? toAuthSession(data.session) : null;
      } catch (err) {
        throw toAuthError(err, 'invalid_credentials');
      }
    },

    async signUpWithEmail(email, password): Promise<AuthSignUpResult> {
      const bad = validateCredentials(email, password);
      if (bad) throw new AuthError(bad, authMessage(bad));
      try {
        const { data, error } = await client.auth.signUp({
          email: normalizeEmail(email),
          password,
          options: { emailRedirectTo: redirectTo() },
        });
        if (error) throw error;
        const session = data.session ? toAuthSession(data.session) : null;
        return { session, needsEmailConfirmation: !session };
      } catch (err) {
        throw toAuthError(err, 'email_taken');
      }
    },

    async signInWithGoogle() {
      try {
        const { error } = await client.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: redirectTo(), skipBrowserRedirect: false },
        });
        if (error) throw error;
        // الطلب ينقل المتصفح إلى النافذة الخارجية، فلن نعود إلى هنا
      } catch (err) {
        throw toAuthError(err, 'network');
      }
    },

    async signOut() {
      try {
        const { error } = await client.auth.signOut();
        if (error) throw error;
      } catch (err) {
        throw toAuthError(err, 'unknown');
      }
    },

    /**
     * حذف الحساب من الخادم عبر دالة آمنة معرَّفة في مشروع الحسابات،
     * ثم نسقط الجلسة محلياً. إن غابت الدالة نُبلغ القارئ بوضوح.
     */
    async deleteAccount() {
      try {
        const { data, error } = await client.auth.getUser();
        if (error) throw error;
        if (!data.user) throw new AuthError('not_available', authMessage('not_available'));
      } catch (err) {
        throw toAuthError(err, 'not_available');
      }

      try {
        const { error } = await client.rpc('delete_account');
        if (error) throw error;
      } catch (err) {
        throw toAuthError(err, 'not_available');
      }

      try {
        await client.auth.signOut();
      } catch {
        // الجلسة قد تكون أُلغيت أصلاً بحذف الحساب — لا نُفسد العملية لأجلها
      }
    },

    subscribe(cb: AuthCallback) {
      const { data } = client.auth.onAuthStateChange((_event, session) => {
        // نؤجّل التنفيذ خارج مسار الاستدعاء حتى لا نقفل طلب الشبكة
        queueMicrotask(() => {
          try {
            cb(session ? toAuthSession(session) : null);
          } catch (err) {
            console.warn('تعذّر تطبيق تغيّر حالة المصادقة', err);
          }
        });
      });
      return () => {
        try {
          data.subscription.unsubscribe();
        } catch {
          // إلغاء مكرّر لا يضرّ
        }
      };
    },
  };
}
