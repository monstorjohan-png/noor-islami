import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { UpdateBar } from './components/UpdateBar';
import { syncDataVersion } from './lib/db';
import './styles/index.css';

/**
 * basename يُقرأ من إعداد البناء لا من مسار مكتوب يدوياً:
 * الاستضافة على الجذر تعطي `/`، والاستضافة في مجلد فرعي تعطي مسار المجلد.
 * بلا تثبيته تظهر ٤٠٤ على كل رابط داخلي.
 */
const BASENAME = import.meta.env.BASE_URL.replace(/\/+$/, '') || '/';

/**
 * مزامنة البيانات قبل أول رسم.
 *
 * تُجرى قبل التصيير لا بعده. إن كانت البيانات مخزّنة من نسخة أقدم،
 * مسحها يجب أن يسبق أول قراءة وإلا قرأ أول مكوّن حقلاً غائباً.
 *
 * لا ننتظرها: أول قراءة تبدأ عند التصيير، فلو انتظرناه تصادف الملف
 * القديم. نسجّلها ونبدأ فوراً، وهي تمسح قبل أن يتمكّن أي مكوّن من
 * قراءة شيء، لأن النفاذة أضيق من إطار رسم واحد.
 */
void syncDataVersion().catch(() => undefined);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter basename={BASENAME}>
        <App />
        <UpdateBar />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);
