/**
 * حاجز الأخطاء
 * ------------------------------------------------------------------
 * بلا هذا، أي رمية أثناء التصيير تفكّك الشجرة كلها ويبقى المستخدم أمام
 * شاشة بيضاء لا يستطيع الخروج منها إلا بإعادة تحميل يدوية.
 *
 * سبب الرمية الأول ليس خللاً في React بل تخزين محلي محرَّب: كل ما نخزّنه
 * محلياً قابل للتحرير من أي نص على نفس الأصل. فالحاجز ليس رفاهية.
 *
 * قاعدة هنا: لا يستعمل هذا الملف `useSettings` ولا `useT` ولا `ui.tsx`.
 * الحاجز يعمل بعد أن يكون أي موفّر سياق قد انهار أصلاً، فسحبُ سياقاً
 * إليه يجعله ينهار داخل الحاجز. اللغة تُقرأ من `document.documentElement.lang`
 * وهي نفس القيمة التي يكتبها `useTheme` على الجذر.
 */
import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { docLang, t } from '../i18n';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  info: string;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null, info: '' };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // نُبقي السجل مختصراً: مسار المكوّنات وحده يكفي لتشخيص البلاغ
    this.setState({ info: (info.componentStack ?? '').split('\n').slice(0, 6).join('\n') });
    console.warn('تعطّل عرض التطبيق', error);
  }

  /** يمسح كل ما نخزّنه محلياً ثم يعيد التحميل من الصفر */
  private reset = async (): Promise<void> => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      for (const db of await indexedDB.databases?.()) {
        if (db.name) indexedDB.deleteDatabase(db.name);
      }
      if ('caches' in window) {
        for (const name of await caches.keys()) await caches.delete(name);
      }
      if (navigator.serviceWorker) {
        for (const r of await navigator.serviceWorker.getRegistrations()) {
          await r.unregister();
        }
      }
    } catch {
      /* تعذّر التنظيف — إعادة التحميل تجري على أي حال */
    }
    location.reload();
  };

  /** محاولة أخيرة بلا فقدان بيانات: إعادة تحميل فقط */
  private reload = (): void => {
    location.reload();
  };

  override render(): ReactNode {
    const { error, info } = this.state;
    if (!error) return this.props.children;

    // بلا سياق: اللغة من الجذر مباشرة
    const lang = docLang();
    const say = (k: string) => t(k, lang);

    return (
      <div
        className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100 p-6"
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
        lang={lang}
      >
        <div className="max-w-md w-full text-center">
          <div className="text-5xl mb-4" aria-hidden="true">
            ⚠️
          </div>
          <h1 className="text-xl font-bold mb-2">{say('crashTitle')}</h1>
          <p className="text-slate-400 mb-6 leading-relaxed">{say('crashBody')}</p>

          {info && (
            <pre
              dir="ltr"
              className="text-left text-xs text-slate-500 bg-slate-900 rounded-lg p-3 mb-6 overflow-auto max-h-32"
            >
              {error.message}
              {'\n'}
              {info}
            </pre>
          )}

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={this.reload}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white py-3 font-semibold"
            >
              {say('retry')}
            </button>
            <button
              type="button"
              onClick={() => void this.reset()}
              className="rounded-xl border border-slate-700 hover:bg-slate-900 text-slate-300 py-3"
            >
              {say('clearDeviceData')}
            </button>
          </div>

          <p className="text-xs text-slate-600 mt-6">{say('clearDeviceDataNote')}</p>
        </div>
      </div>
    );
  }
}
