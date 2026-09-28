/**
 * أنواع طبقة المصادقة — عقدٌ واحد يجمع المزوّدين.
 *
 * القاعدة: الواجهة لا تعرف أي مزوّد بعينه. المزوّد الفارغ (وضع الضيف)
 * والمزوّد الحقيقي ينفّذان الواجهة نفسها، والتطبيق يختار بينهما وقت التشغيل.
 */

/** نوع المزوّد الذي اختاره التطبيق */
export type AuthKind = 'null' | 'supabase';

/** كيف وصل المستخدم إلى حسابه */
export type AuthMethod = 'guest' | 'email' | 'google';

/** مستخدم بعد توحيد شكله بين المزوّدين */
export interface AuthUser {
  id: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  method: AuthMethod;
  /** وقت إنشاء الحساب بمللي ثانية */
  createdAt: number;
}

export interface AuthSession {
  user: AuthUser;
  /** وقت انتهاء الرمز بمللي ثانية؛ صفر يعني غير معروف */
  expiresAt: number;
  /** رمز الوصول للحسابات الحقيقية فقط؛ الضيف بلا رمز */
  accessToken: string | null;
}

/** يُستدعى عند تغيّر الجلسة؛ يُعيد دالة لإلغاء الاشتراك */
export type AuthCallback = (session: AuthSession | null) => void;

/** أسباب الفشل — تُترجم كلّها إلى رسالة عربية واحدة */
export type AuthErrorCode =
  | 'not_available'
  | 'invalid_input'
  | 'weak_password'
  | 'invalid_credentials'
  | 'email_taken'
  | 'network'
  | 'unknown';

/** خطأ مصادقة يحمل شفرته ورسالته العربية الجاهزة للعرض */
export class AuthError extends Error {
  readonly code: AuthErrorCode;

  constructor(code: AuthErrorCode, message: string) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}

/** رسائل عربية موحّدة — لا نعرض أبداً نصّاً أجنبياً للمستخدم */
export function authMessage(code: AuthErrorCode): string {
  switch (code) {
    case 'not_available':
      return 'الدخول غير مُهيَّأ في هذه النسخة — التطبيق يعمل بالكامل في وضع الضيف.';
    case 'invalid_input':
      return 'البريد الإلكتروني غير صحيح. اكتبه كاملاً على الصورة المعتادة.';
    case 'weak_password':
      return 'كلمة المرور قصيرة جداً — ستة أحرف على الأقل.';
    case 'invalid_credentials':
      return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
    case 'email_taken':
      return 'هذا البريد مُسجَّل مسبقاً. سجّل الدخول بكلمة المرور بدل ذلك.';
    case 'network':
      return 'تعذّر الاتصال بالخادم. تحقّق من الإنترنت وحاول مجدداً.';
    case 'unknown':
    default:
      return 'تعذّر إتمام العملية. حاول مرة أخرى.';
  }
}

/* ---------- أدوات خالصة للتحقق من المدخلات ---------- */

/**
 * قراءة متغيّرات البيئة لمزوّد الحسابات وحده.
 * هذه القراءات للملف الذي لا يُحمَّل أصلاً بلا مفاتيح، فلا تشترط ثابتةً.
 */
function readText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** عنوان مشروع الحسابات — فارغ يعني: ضيف بلا مفاتيح */
export function supabaseUrl(): string {
  return readText(import.meta.env.VITE_SUPABASE_URL);
}

/** المفتاح العام المجهول — فارغ يعني: ضيف بلا مفاتيح */
export function supabaseAnonKey(): string {
  return readText(import.meta.env.VITE_SUPABASE_ANON_KEY);
}

/** يوحّد البريد: بلا مسافات وحروف صغيرة */
export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

/** هل شكل البريد معقول؟ تحقّق خفيف بلا كلفة */
export function isEmailLike(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

/** أقصر كلمة مرور مقبولة عند مزوّد الحسابات */
export const MIN_PASSWORD = 6;

/** يفحص المدخلين ويعيد شفرة الخطأ أو null إن كانا صالحين */
export function validateCredentials(email: string, password: string): AuthErrorCode | null {
  if (!isEmailLike(normalizeEmail(email))) return 'invalid_input';
  if (password.length < MIN_PASSWORD) return 'weak_password';
  return null;
}

/** نتيجة إنشاء حساب: قد يطلب المزوّد تأكيد البريد قبل السماح بالدخول */
export interface AuthSignUpResult {
  session: AuthSession | null;
  needsEmailConfirmation: boolean;
}

/**
 * واجهة المزوّد — كل دوالها غير متزامنة ولا تحفظ حالة تزامن.
 * دوال الدخول تُعيد null حين لا يحدث شيء (وضع الضيف) بدل أن ترمي،
 * أما المزوّد الحقيقي فيرمي AuthError برسالة عربية جاهزة.
 */
export interface AuthProvider {
  readonly kind: AuthKind;
  /** هل الدخول متاح أصلاً؟ خطأ يعني ضيفاً دائماً بلا مفاتيح */
  readonly available: boolean;
  getSession(): Promise<AuthSession | null>;
  signInWithEmail(email: string, password: string): Promise<AuthSession | null>;
  signUpWithEmail(email: string, password: string): Promise<AuthSignUpResult>;
  signInWithGoogle(): Promise<void>;
  signOut(): Promise<void>;
  deleteAccount(): Promise<void>;
  subscribe(cb: AuthCallback): () => void;
}

/* ---------- الحالة داخل التطبيق ---------- */

export type AuthStatus = 'idle' | 'loading' | 'ready';

/** ما تراه واجهة المستخدم: دوال العمليات تُعيد نجاحها ولا ترمي أبداً */
export interface AuthState {
  status: AuthStatus;
  session: AuthSession | null;
  user: AuthUser | null;
  /** لا حساب مفتوح: البيانات على هذا الجهاز وحده */
  isGuest: boolean;
  /** هل مفاتيح الدخول موجودة أصلاً */
  canAuthenticate: boolean;
  /** جارٍ تنفيذ عملية الآن */
  busy: boolean;
  /** آخر رسالة خطأ عربية جاهزة للعرض */
  error: string | null;
  signInWithEmail(email: string, password: string): Promise<boolean>;
  signUpWithEmail(email: string, password: string): Promise<boolean>;
  signInWithGoogle(): Promise<boolean>;
  signOut(): Promise<boolean>;
  deleteAccount(): Promise<boolean>;
  clearError(): void;
  refresh(): Promise<void>;
}
