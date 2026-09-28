/**
 * المزوّد الفارغ — وهو الوضع الافتراضي للتطبيق.
 *
 * الضمانات الثلاث التي لا تُكسر:
 *   ١ · لا مفاتيح مطلوبة، ولا شيء يُقرأ من التخزين.
 *   ٢ · لا طلب شبكة إطلاقاً — الملف لا يستورد أي شيء خارجي.
 *   ٣ · لا استثناء أبداً: كل دالة تُعيد قيمة صالحة أو لا تفعل شيئاً.
 */

import type { AuthCallback, AuthProvider, AuthSignUpResult } from './types';

/** معرّف ثابت لمستخدم الضيف — لا يُستخدم للمزامنة أبداً */
export const GUEST_ID = 'guest';

const noopSignUp: AuthSignUpResult = { session: null, needsEmailConfirmation: false };

export const nullAuthProvider: AuthProvider = {
  kind: 'null',
  available: false,

  /** لا جلسة مفتوحة في وضع الضيف */
  async getSession() {
    return null;
  },

  /** لا مفاتيح فلا دخول — نُعيد null بدل الرمي */
  async signInWithEmail() {
    return null;
  },

  async signUpWithEmail(): Promise<AuthSignUpResult> {
    return noopSignUp;
  },

  /** لا يوجد ما يُفتح خارجي هنا */
  async signInWithGoogle() {
    /* لا شيء */
  },

  async signOut() {
    /* لا شيء */
  },

  async deleteAccount() {
    /* لا شيء */
  },

  /** نُبقي المشتركين بلا أثر: لا نبثّ ولا نحتفظ بذاكرة */
  subscribe(_cb: AuthCallback) {
    return () => {
      /* لا اشتراك يُحتفظ به */
    };
  },
};

/** هل هذا المزوّد الفارغ هو المستخدم الآن؟ */
export function isNullProvider(provider: AuthProvider | null): boolean {
  return !provider || provider.kind === 'null';
}
