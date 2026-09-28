/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ink: {
          900: '#0b1220',
          800: '#111b2e',
          700: '#1a2740',
          600: '#243352',
          500: '#33456b',
          400: '#5b6c92',
        },
        gold: {
          50: '#fdf8ec',
          100: '#faf0d4',
          200: '#f3dfa8',
          300: '#e9c877',
          400: '#ddb04b',
          500: '#c9992f',
          600: '#a97c24',
          700: '#855f1f',
        },
        emerald: {
          700: '#0f6b52',
          600: '#12866a',
          500: '#17a37f',
          400: '#34bf9a',
        },
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
