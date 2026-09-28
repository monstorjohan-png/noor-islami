import { useEffect, useMemo, useRef, useState } from 'react';
import { useSettings } from './store';
import { t } from '../i18n';

/** اللغة الحالية + دالة ترجمة، تُعيد الانتقال عند تغيّر اللغة */
export function useT() {
  const lang = useSettings((s) => s.lang);
  return useMemo(() => {
    const fn = (key: string) => t(key, lang);
    fn.lang = lang;
    return fn;
  }, [lang]);
}

/** نص ثنائي اللغة (ar/en) لمصدر البيانات */
export function useL() {
  const lang = useSettings((s) => s.lang);
  return useMemo(() => {
    const fn = (v?: { ar?: string; en?: string } | null) => {
      if (!v) return '';
      return (lang === 'ar' ? v.ar : v.en) || v.ar || v.en || '';
    };
    fn.lang = lang;
    return fn;
  }, [lang]);
}

/** سلسلة ثنائية سريعة: S('عربي', 'English') — للنصوص الطارئة داخل الصفحات */
export function useS() {
  const lang = useSettings((s) => s.lang);
  return useMemo(() => {
    const fn = (ar: string, en: string) => (lang === 'ar' ? ar : en);
    fn.lang = lang;
    return fn;
  }, [lang]);
}

/** يطبّق المظهر المخزَّن على عنصر html */
export function useTheme() {
  const theme = useSettings((s) => s.theme);
  const lang = useSettings((s) => s.lang);
  useEffect(() => {
    const el = document.documentElement;
    el.classList.toggle('dark', theme === 'dark');
    el.lang = lang;
    el.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [theme, lang]);
}

/** مؤقّت يعيد التصيير كل مللي ثانية */
export function useTick(ms = 1000): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setN((x) => x + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
  return n;
}

/** خطأ محمّل بشكل آمن */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): {
  data: T | null; error: Error | null; loading: boolean; reload: () => void;
} {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fnRef.current()
      .then((d) => { if (alive) setData(d); })
      .catch((e) => { if (alive) setError(e instanceof Error ? e : new Error(String(e))); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  return { data, error, loading, reload: () => setNonce((n) => n + 1) };
}

/** كشف الاتصال بالإنترنت */
export function useOnline(): boolean {
  const [on, setOn] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const up = () => setOn(true);
    const down = () => setOn(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  return on;
}

/** تأخير القيمة — للبحث الفوري */
export function useDebounced<T>(value: T, ms = 250): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}
