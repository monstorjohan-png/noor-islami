import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          search: ['minisearch'],
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      /**
       * `prompt` لا `autoUpdate`.
       * التحديث التلقائي يقفز إلى عامل خدمة جديد في منتصف جلسة مفتوحة،
       * فيخلط `index.html` من نسخة بالحِزم من نسخة أخرى. النتيجة شاشة
       * بيضاء. مع `prompt` يُخبر المستخدم أن هناك نسخة جديدة ويختار.
       */
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        id: '/',
        name: 'نور — NOOR Islamic App',
        short_name: 'نور',
        description: 'تطبيق إسلامي شامل: القرآن والحديث والأذكار والأوقات — يعمل بدون إنترنت',
        lang: 'ar',
        dir: 'rtl',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0b1220',
        theme_color: '#0b1220',
        categories: ['education', 'books', 'lifestyle'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'القرآن', url: '/quran' },
          { name: 'الأذكار', url: '/adhkar' },
          { name: 'الصلاة', url: '/prayer' },
        ],
      },
      workbox: {
        // .ttf مضاف: خط المصحف يجب أن يكون في الذاكرة أو لن يظهر الرسم العثماني
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,ttf}'],
        // المحتوى: لا يُخزَّن مسبقاً كله — يُجلب عند الطلب ويُحفظ في IndexedDB
        navigateFallback: 'index.html',
        // مسارات الخادم والمصادقة لا تُرجع التطبيق — يجب أن تعيد 404 صريحاً.
        // بدون هذا يُخفي عامل خدمة أخطاء الـ API خلف صفحة «غير موجودة».
        navigateFallbackDenylist: [/^\/api\//, /^\/auth\//, /^\/_/, /^\/sw\.js$/],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /\/data\/.*\.json$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'noor-content',
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // مثبَّت على مضيف التلاوة بالضبط. النمط العام `.*` كان يخزّن
            // أي صوت من أي مضيف في العالم لمدة سنة ويشغّله من الذاكرة.
            urlPattern:
              /^https:\/\/cdn\.islamic\.network\/quran\/audio(-surah)?\/\d+\/[a-z0-9._-]+\/\d+\.mp3$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'noor-audio',
              // الإصدار السابع من Workbox أزال حد الحجم بالبايت،
              // فالسقف هنا بعدد المدخلات مع تفريغ عند امتلاء الحصة.
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 60 * 60 * 24 * 365,
                purgeOnQuotaError: true,
              },
              cacheableResponse: { statuses: [200] },
              rangeRequests: true,
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
});
