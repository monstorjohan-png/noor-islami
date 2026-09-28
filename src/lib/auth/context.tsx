/**
 * حالة المصادقة داخل التطبيق.
 *
 * الحالة في مخزن صغير خارج المتصوّر لا يحتاج غلافاً: كل صفحة تقرأها
 * متى شاءت، والتطبيق يعمل كاملاً قبل أن تُفتح صفحة الحساب أصلاً.
 * الغلاف موجود لمن يريد تركيبه عند الجذر، وهو اختياري لا يفرض شيئاً.
 */

import { useEffect, useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { resolveAuthProvider } from './index';
import { nullAuthProvider } from './null';
import { authMessage, normalizeEmail, validateCredentials } from './types';
import type { AuthProvider as AuthDriver, AuthSession, AuthState } from './types';
import { createSupabaseRemote, forgetUser, isSyncEnabled, startSync } from '../sync';
import { useSettings } from '../store';

/* ---------- العمليات ---------- */

const listeners = new Set<() => void>();

/** يحوّل أي خطأ إلى رسالة عربية جاهزة للعرض */
function messageOf(err: unknown): string {
  if (err instanceof Error && /[\u0600-\u06FF]/.test(err.message)) return err.message;
  return authMessage('unknown');
}

/** يغلّف عملية واحدة: يمنع الازدواج ويحوّل الخطأ إلى رسالة عربية */
async function run(op: () => Promise<void>): Promise<boolean> {
  if (snapshot.busy) return false;
  emit({ busy: true, error: null });
  try {
    await op();
    return true;
  } catch (err) {
    emit({ error: messageOf(err) });
    return false;
  } finally {
    emit({ busy: false });
  }
}

/** يفحص المدخلين قبل أي طلب شبكة */
function checkInput(email: string, password: string): string | null {
  const bad = validateCredentials(email, password);
  if (bad) {
    emit({ error: authMessage(bad) });
    return null;
  }
  return normalizeEmail(email);
}

async function doSignIn(email: string, password: string): Promise<boolean> {
  const clean = checkInput(email, password);
  if (!clean) return false;
  return run(async () => {
    const driver = await getDriver();
    if (!driver.available) throw new Error(authMessage('not_available'));
    applySession(await driver.signInWithEmail(clean, password));
  });
}

async function doSignUp(email: string, password: string): Promise<boolean> {
  const clean = checkInput(email, password);
  if (!clean) return false;
  return run(async () => {
    const driver = await getDriver();
    if (!driver.available) throw new Error(authMessage('not_available'));
    const res = await driver.signUpWithEmail(clean, password);
    if (res.session) applySession(res.session);
  });
}

async function doGoogle(): Promise<boolean> {
  return run(async () => {
    const driver = await getDriver();
    if (!driver.available) throw new Error(authMessage('not_available'));
    await driver.signInWithGoogle();
  });
}

async function doSignOut(): Promise<boolean> {
  const ok = await run(async () => {
    const driver = await getDriver();
    await driver.signOut();
  });
  if (ok) {
    unbindSync();
    applySession(null);
  }
  return ok;
}

async function doDeleteAccount(): Promise<boolean> {
  const userId = snapshot.user?.id ?? '';
  const ok = await run(async () => {
    const driver = await getDriver();
    await driver.deleteAccount();
  });
  if (ok) {
    unbindSync();
    forgetUser(userId);
    applySession(null);
  }
  return ok;
}

function doClearError(): void {
  emit({ error: null });
}

async function doRefresh(): Promise<void> {
  try {
    const driver = await getDriver();
    applySession(await driver.getSession());
  } catch (err) {
    emit({ error: messageOf(err) });
  }
}

/* ---------- المخزن ---------- */

let snapshot: AuthState = {
  status: 'idle',
  session: null,
  user: null,
  isGuest: true,
  canAuthenticate: false,
  busy: false,
  error: null,
  signInWithEmail: doSignIn,
  signUpWithEmail: doSignUp,
  signInWithGoogle: doGoogle,
  signOut: doSignOut,
  deleteAccount: doDeleteAccount,
  clearError: doClearError,
  refresh: doRefresh,
};

function emit(patch: Partial<AuthState>): void {
  snapshot = { ...snapshot, ...patch };
  for (const l of [...listeners]) l();
}

function subscribeListener(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

const getSnapshot = (): AuthState => snapshot;

/** حالة المصادقة — لا ترمي أبداً، وكل عملية تُعيد نجاحها */
export function useAuth(): AuthState {
  return useSyncExternalStore(subscribeListener, getSnapshot, getSnapshot);
}

/* ---------- دورة حياة المزوّد ---------- */

let driverPromise: Promise<AuthDriver> | null = null;
let stopSync: (() => void) | null = null;
let syncUserId = '';

/** تبدأ المزامنة للمستخدم — لا تفعل شيئاً إن كان العلم معطّلاً */
function bindSync(userId: string): void {
  if (!isSyncEnabled() || !userId) return;
  if (syncUserId === userId && stopSync) return;

  stopSync?.();
  syncUserId = userId;
  stopSync = startSync({
    userId,
    remote: () => createSupabaseRemote(),
    getLocal: () => useSettings.getState().bookmarks,
    setLocal: (list) => {
      useSettings.getState().set('bookmarks', list);
    },
    subscribe: (cb) => {
      let last = useSettings.getState().bookmarks;
      return useSettings.subscribe((s) => {
        if (s.bookmarks !== last) {
          last = s.bookmarks;
          cb();
        }
      });
    },
  });
}

function unbindSync(): void {
  stopSync?.();
  stopSync = null;
  syncUserId = '';
}

function applySession(session: AuthSession | null): void {
  emit({ session, user: session?.user ?? null, isGuest: !session });
  if (session) bindSync(session.user.id);
  else unbindSync();
}

/** يضمن وجود مزوّد — يبدأه أول مرة فقط، ولا يرمي أبداً */
export function initAuth(): Promise<AuthDriver> {
  if (!driverPromise) {
    driverPromise = (async () => {
      emit({ status: 'loading' });
      const driver = await resolveAuthProvider();
      try {
        driver.subscribe(applySession);
        emit({ canAuthenticate: driver.available, status: 'ready' });
        applySession(await driver.getSession());
      } catch (err) {
        // فشل القراءة الأولى ليس سبباً لكسر التطبيق: نكمل ضيفاً
        console.warn('تعذّرت قراءة جلسة الحساب — نكمل في وضع الضيف', err);
        emit({ status: 'ready', canAuthenticate: false, error: messageOf(err) });
      }
      return driver;
    })().catch((err: unknown) => {
      console.warn('تعذّر تجهيز المصادقة — نكمل في وضع الضيف', err);
      emit({ status: 'ready', canAuthenticate: false, isGuest: true });
      return nullAuthProvider;
    });
  }
  return driverPromise;
}

async function getDriver(): Promise<AuthDriver> {
  if (!driverPromise) await initAuth();
  return (await driverPromise) ?? nullAuthProvider;
}

/* ---------- الواجهة والغلاف ---------- */

/** غلاف اختياري: يهيّئ المصادقة عند التركيب. التطبيق يعمل بدونه */
export function AuthProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    void initAuth();
  }, []);
  return <>{children}</>;
}

/** لصفحات لا معنى لها بلا حساب — تعيد إلى صفحة الحساب بدل أن تنهار */
export function useRequireAuth(redirect = '/account'): AuthState {
  const auth = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (auth.status === 'ready' && !auth.session) navigate(redirect, { replace: true });
  }, [auth.status, auth.session, navigate, redirect]);
  return auth;
}

/** يوقف المزامنة الجارية — لمن يُريد الإيقاف بنفسه */
export function stopUserSync(): void {
  unbindSync();
}
