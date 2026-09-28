import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { UpdateBar } from './components/UpdateBar';
import './styles/index.css';

/**
 * basename يُقرأ من إعداد البناء لا من مسار مكتوب يدوياً:
 * الاستضافة على الجذر تعطي `/`، والاستضافة في مجلد فرعي تعطي `'/noor-islami/'`.
 * بلا تثبيته تظهر ٤٠٤ على كل رابط داخلي.
 */
const BASENAME = import.meta.env.BASE_URL.replace(/\/+$/, '') || '/';

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
