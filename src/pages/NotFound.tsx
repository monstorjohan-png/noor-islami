import { Link } from 'react-router-dom';
import { useL, useT } from '../lib/hooks';
import { Ornament } from '../components/ui';

export default function NotFound() {
  const t = useT();
  const L = useL();
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="num text-6xl font-bold text-gold-500/30">404</p>
      <Ornament />
      <p className="text-slate-400">
        {L({ ar: 'الصفحة التي تبحث عنها غير موجودة', en: 'The page you are looking for does not exist' })}
      </p>
      <Link to="/" className="btn-primary mt-6">
        {t('home')}
      </Link>
    </div>
  );
}
