/**
 * مختار مزوّد المصادقة — هذا هو الملف الوحيد الذي يقرأ مفاتيح البيئة.
 *
 * القاعدة الحاسمة: بلا مفاتيح = ضيف كامل، بلا أخطاء، بلا طلبات شبكة.
 * لا استيراد ثابت لملف المزوّد الحقيقي هنا إطلاقاً؛ حتى تسمية الملف نفسها
 * لا تُحمَّل من الحزمة إلا حين توجد مفاتيح فعلاً.
 */

import { nullAuthProvider } from './null';
import { authMessage } from './types';
import type { AuthProvider } from './types';

export type {
  AuthCallback,
  AuthErrorCode,
  AuthKind,
  AuthMethod,
  AuthProvider as AuthDriver,
  AuthSession,
  AuthSignUpResult,
  AuthState,
  AuthUser,
} from './types';

/**
 * هل توجد مفاتيح دخول صالحة الشكل؟
 * تُقرأ مباشرةً من بيئة البناء لا عبر كائن، فتثبّتها الأداة قيمةً نهائية،
 * فتسقط فروع الضيف من الحزمة كلياً ولا يُحمَّل منها بايت واحد.
 * أنواع هذه المتغيّرات يعرّفها القائد في ملف تعريفات بيئة البناء.
 */
export function hasSupabaseConfig(): boolean {
  const url = (import.meta.env.VITE_SUPABASE_URL ?? '') as string;
  const key = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '') as string;
  return Boolean(url && key);
}

/**
 * يختار المزوّد: الحقيقي إن وُجدت المفاتيح، وإلا المزوّد الفارغ.
 * لا ترمي أبداً — أي فشل تحميل يُعيد التطبيق إلى وضع الضيف.
 */
export async function resolveAuthProvider(): Promise<AuthProvider> {
  const url = (import.meta.env.VITE_SUPABASE_URL ?? '') as string;
  const key = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '') as string;
  if (!url || !key) return nullAuthProvider;

  try {
    const mod = await import('./supabase');
    const provider = await mod.createSupabaseAuthProvider(url, key);
    if (!provider) return nullAuthProvider;
    return provider;
  } catch (err) {
    console.warn(authMessage('not_available'), err);
    return nullAuthProvider;
  }
}

export { nullAuthProvider, GUEST_ID, isNullProvider } from './null';
export { authMessage, AuthError, isEmailLike, normalizeEmail, validateCredentials, MIN_PASSWORD } from './types';
