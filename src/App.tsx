import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import { Loading } from './components/ui';
import { useTheme } from './lib/hooks';

/**
 * التقسيم الكسول للصفحات: حزمة البداية تبقى صغيرة،
 * وتُنزَّل بقية الصفحات عند طلبها فقط.
 */
const Home = lazy(() => import('./pages/Home'));
const Quran = lazy(() => import('./pages/Quran'));
const SurahReader = lazy(() => import('./pages/SurahReader'));
const Hadith = lazy(() => import('./pages/Hadith'));
const HadithReader = lazy(() => import('./pages/HadithReader'));
const Prayer = lazy(() => import('./pages/Prayer'));
const Qibla = lazy(() => import('./pages/Qibla'));
const Tasbih = lazy(() => import('./pages/Tasbih'));
const Adhkar = lazy(() => import('./pages/Adhkar'));
const Names = lazy(() => import('./pages/Names'));
const Calendar = lazy(() => import('./pages/Calendar'));
const Search = lazy(() => import('./pages/Search'));
const Bookmarks = lazy(() => import('./pages/Bookmarks'));
const Download = lazy(() => import('./pages/Download'));
const Settings = lazy(() => import('./pages/Settings'));
const More = lazy(() => import('./pages/More'));
const Account = lazy(() => import('./pages/Account'));
const About = lazy(() => import('./pages/About'));
const NotFound = lazy(() => import('./pages/NotFound'));

export default function App() {
  useTheme();

  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="quran" element={<Quran />} />
          <Route path="quran/:surah" element={<SurahReader />} />
          <Route path="quran/:surah/:ayah" element={<SurahReader />} />
          <Route path="hadith" element={<Hadith />} />
          <Route path="hadith/:book" element={<HadithReader />} />
          <Route path="prayer" element={<Prayer />} />
          <Route path="qibla" element={<Qibla />} />
          <Route path="tasbih" element={<Tasbih />} />
          <Route path="adhkar" element={<Adhkar />} />
          <Route path="names" element={<Names />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="search" element={<Search />} />
          <Route path="bookmarks" element={<Bookmarks />} />
          <Route path="download" element={<Download />} />
          <Route path="settings" element={<Settings />} />
          <Route path="more" element={<More />} />
          <Route path="account" element={<Account />} />
          <Route path="about" element={<About />} />
          <Route path="home" element={<Navigate to="/" replace />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
