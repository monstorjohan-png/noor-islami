/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** عنوان مشروع المصادقة — يُترك فارغاً ليعمل التطبيق في وضع الضيف */
  readonly VITE_SUPABASE_URL?: string;
  /** المفتاح العام للمصادقة — بلا سرّ، معروف للجميع بطبيعته */
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** علم المزامنة بين الأجهزة — معطّل إلا إذا كانت القيمة "1" */
  readonly VITE_SYNC?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
