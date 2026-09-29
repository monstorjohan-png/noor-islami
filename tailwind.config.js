/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      /**
       * كل لون هنا متغيّر CSS على الجذر، قيمته في src/styles/index.css
       * ويختارها المستخدم من لوحاته. `<alpha-value>` ليس زينة: المكوّنات
       * تستعمل شفافية مثل bg-ink-800/70 و shadow-gold-500/20، فمن
       * يتخلّى عنه يسقط الشفافية عند كل تدرّج.
       *
       * الدرجات التي لا تُذكر هنا تبقى على قيم تيلويند الأصلية. وهذا
       * مقصود في الكهرماني والوردي: درجة ٥٠٠ تستعمل خافتةً كخلفية
       * خلف نصٍّ داكن، فتبقى كما هي في اللوحة الفاتحة.
       */
      colors: {
        ink: {
          400: 'rgb(var(--ink-400) / <alpha-value>)',
          500: 'rgb(var(--ink-500) / <alpha-value>)',
          600: 'rgb(var(--ink-600) / <alpha-value>)',
          700: 'rgb(var(--ink-700) / <alpha-value>)',
          800: 'rgb(var(--ink-800) / <alpha-value>)',
          900: 'rgb(var(--ink-900) / <alpha-value>)',
        },
        gold: {
          50: 'rgb(var(--gold-50) / <alpha-value>)',
          100: 'rgb(var(--gold-100) / <alpha-value>)',
          200: 'rgb(var(--gold-200) / <alpha-value>)',
          300: 'rgb(var(--gold-300) / <alpha-value>)',
          400: 'rgb(var(--gold-400) / <alpha-value>)',
          500: 'rgb(var(--gold-500) / <alpha-value>)',
          600: 'rgb(var(--gold-600) / <alpha-value>)',
          700: 'rgb(var(--gold-700) / <alpha-value>)',
        },
        /** ٢٠٠ و٣٠٠ تستعملان نصّاً فوق مساحات خضراء خفيفة، فتُغمقان في الفاتحة */
        emerald: {
          200: 'rgb(var(--emerald-200) / <alpha-value>)',
          300: 'rgb(var(--emerald-300) / <alpha-value>)',
          400: 'rgb(var(--emerald-400) / <alpha-value>)',
          500: 'rgb(var(--emerald-500) / <alpha-value>)',
          600: 'rgb(var(--emerald-600) / <alpha-value>)',
          700: 'rgb(var(--emerald-700) / <alpha-value>)',
        },
        /** درجات النص: مقلوبةٌ في اللوحة الفاتحة، فتصبح ١٠٠ داكنة */
        slate: {
          50: 'rgb(var(--slate-50) / <alpha-value>)',
          100: 'rgb(var(--slate-100) / <alpha-value>)',
          200: 'rgb(var(--slate-200) / <alpha-value>)',
          300: 'rgb(var(--slate-300) / <alpha-value>)',
          400: 'rgb(var(--slate-400) / <alpha-value>)',
          500: 'rgb(var(--slate-500) / <alpha-value>)',
          600: 'rgb(var(--slate-600) / <alpha-value>)',
          700: 'rgb(var(--slate-700) / <alpha-value>)',
          800: 'rgb(var(--slate-800) / <alpha-value>)',
          900: 'rgb(var(--slate-900) / <alpha-value>)',
          950: 'rgb(var(--slate-950) / <alpha-value>)',
        },
        /** درجتان وثلاثة تُستعملان نصّاً، فتُغمقان في اللوحة الفاتحة */
        amber: {
          200: 'rgb(var(--amber-200) / <alpha-value>)',
          300: 'rgb(var(--amber-300) / <alpha-value>)',
          400: 'rgb(var(--amber-400) / <alpha-value>)',
        },
        rose: {
          100: 'rgb(var(--rose-100) / <alpha-value>)',
          200: 'rgb(var(--rose-200) / <alpha-value>)',
          300: 'rgb(var(--rose-300) / <alpha-value>)',
        },
        /**
         * الأبيض متغيّر مثل غيره: في اللوحة الفاتحة ينقلب إلى quasi أسود
         * فيصير bg-white/5 ظلاً خفيفاً بدل بياضٍ لا يُرى على ورق فاتح.
         * أما نصّه فوق الأخضر فيبقى أبيضً صريحاً — يُثبَّت في ملف الأنماط.
         */
        white: 'rgb(var(--white) / <alpha-value>)',
      },
      fontFamily: {
        quran: ['"Quran Web"', '"KFGQPC Uthmanic Script HAFS"', '"Amiri Quran"', '"Traditional Arabic"', 'serif'],
        arabic: ['"Noto Naskh Arabic"', '"Amiri"', '"Segoe UI"', 'Tahoma', 'sans-serif'],
        latin: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn .25s ease-out',
        'slide-up': 'slideUp .28s cubic-bezier(.22,1,.36,1)',
        'pulse-soft': 'pulseSoft 2.4s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'none' } },
        pulseSoft: { '0%,100%': { opacity: '1' }, '50%': { opacity: '.55' } },
      },
    },
  },
  plugins: [],
};
